# Part 2 — Debugging an Intermittently Failing Multi-Step Pipeline

`broken_pipeline.js` has three real, independent bugs baked in, one per
symptom in the brief. `fixed_pipeline.js` is the corrected version. This
README is the actual step-by-step process, not just the end diagnosis.

## Step 0 — Before touching code: reproduce and characterize
Intermittent bugs waste time when you start guessing. First I'd pull:
- **Request logs / traces** for the last N failures — timestamps, request
  IDs, which step failed, latency per step.
- **Frequency and pattern**: is it correlated with load, time of day,
  specific inputs, specific accounts? Three different symptoms
  (timeout / malformed output / silent wrong data) is itself a strong
  signal — it usually means **three separate bugs**, not one root cause.
  I would not go looking for a single unifying explanation; I'd triage
  each symptom independently.

## Step 1 — Isolate by symptom

### Timeout
- Check: is there an explicit timeout set on every network call in the
  chain (vector DB, LLM API, any internal service)? In `broken_pipeline.js`,
  `retrieveContext` has none — under connection-pool exhaustion or a
  cold-starting dependency it can hang indefinitely.
- Tool: distributed tracing (or even just per-step `console.time` if
  nothing fancier is wired up yet) to see **which step** is hanging, not
  just that the overall request timed out.
- Fix: explicit timeout + bounded retry with exponential backoff (see
  `fixed_pipeline.js`), so a slow dependency fails fast and loud instead
  of hanging the whole pipeline.

### Malformed output
- Check: what does the raw model response look like on a failing
  request? This requires that raw LLM output actually gets logged —
  if it isn't, that's the first thing I'd add, because you cannot
  debug an LLM step you can't see the output of.
- In `broken_pipeline.js`, `extractStructuredData` does a bare
  `JSON.parse` on the model's raw text. Models intermittently wrap JSON
  in ` ```json ` fences or add a stray sentence before the JSON — common,
  not rare, and exactly the kind of thing that looks "random" until you
  look at the actual text.
- Fix: strip fences defensively, then validate against an explicit
  schema (`zod` in the fix) rather than trusting `JSON.parse` alone, and
  log the raw text on any failure so the *next* failure is diagnosable
  in one look instead of a repeat investigation.

### Silent wrong data (the dangerous one — no error, no log, no alert)
- This is the hardest class because nothing crashes, so nothing pages
  you. I'd start from the output, not the logs: take a known-wrong
  result, and walk backward through each step's output for that
  specific request ID, comparing what each step *actually returned*
  against what it *should* have returned given the input.
- In `broken_pipeline.js`, `enrichWithAccountData` silently falls back
  to a hardcoded `"standard"` tier if the account lookup fails — the
  pipeline "succeeds" while quietly returning a plausible-looking wrong
  answer.
- Fix: remove the silent fallback. A missing dependency result should
  fail the request loudly (or, if a default is genuinely acceptable
  business-wise, that default must be explicit and logged as a
  fallback event, never a quiet catch-all with no trace).

## Step 2 — Tools I'd actually pull, in order
1. **Structured logs per step** (`event`, `requestId`, `durationMs`,
   `success/failure`) — if these don't exist yet, adding them is the
   very first fix, before touching business logic, because without them
   every subsequent bug is a repeat of this same investigation.
2. **A handful of reproduced failing request IDs**, replayed step-by-step
   in isolation (not the full pipeline) to pin down exactly which step
   diverges from expected behavior.
3. **Diffing raw LLM input/output** for failing vs. passing requests on
   the same step, since LLM steps are the most likely source of
   "sometimes" behavior in an otherwise deterministic pipeline.
4. Only after the above — profiling/load testing, if the timeout
   correlates with load rather than a specific dependency.

## Step 3 — Prevent recurrence, not just patch this instance
- Add schema validation on every LLM-produced JSON boundary, not just
  the one that broke.
- Add timeouts + retries as a standard wrapper around every external
  call, not case-by-case.
- Turn "silent fallback" into a lint-able anti-pattern for this
  codebase — any `catch` that swallows an error and returns a default
  must log a `fallback_used` event at minimum.
