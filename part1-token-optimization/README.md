# Part 1 — Token / Cost Optimization

## The problem
An agent pipeline sending ~100K input tokens per query is almost never
one giant necessary block of context. In practice it's usually 3–4
independent sources of bloat stacked on top of each other. This demo
isolates and fixes each one separately so the effect of each change is
visible on its own.

## Run it yourself
```bash
npm install
node token_count.js
```

## What was changed

| # | Optimization | Why it saves tokens | Quality tradeoff |
|---|---|---|---|
| 1 | **Top-k retrieval cut (20 → 5) + dedup + per-chunk truncation** | This is almost always the single biggest cost driver in a RAG pipeline — teams over-fetch "just to be safe" and never revisit it. Deduping near-identical chunks (common when chunk windows overlap) removes pure waste, not signal. | Small recall risk on questions that genuinely need a broad summary across many chunks. Mitigated by a confidence-based fallback: if top-5 retrieval scores are flat/low, re-run at top-10 for that query only — most queries stay cheap, only ambiguous ones cost more. |
| 2 | **Conversation history compression** (last 2 turns verbatim + periodic running summary instead of full transcript every turn) | Full history resent every turn grows the prompt linearly with conversation length — a 20-turn conversation pays for itself 20 times over. | Very fine-grained callbacks to something said many turns ago can get flattened into the summary. Mitigated by instructing the summarizer to preserve named entities/numbers/decisions verbatim rather than paraphrasing them. |
| 3 | **Prompt caching on the static system prompt + tool schemas** | These are byte-identical on every call within a session. Caching means they're billed once per cache window instead of once per request. | None — the content the model sees is unchanged, only the billing/latency of the repeated portion changes. |
| 4 | **Tighter system prompt** (terse imperative rules instead of ~600 words of loosely repeated instructions) | Removes redundant phrasing that wasn't adding behavioral constraint. | Small — worth running against an eval set after the change, since prompt wording can shift model behavior even when meaning is "the same." |

## Results (measured with `gpt-tokenizer`, not estimated)

```
BEFORE (naive pipeline):     7,932 tokens
AFTER  (optimized pipeline):   964 tokens
Reduction: 87.8%
```

This demo uses a scaled-down synthetic corpus (40 chunks) so it runs
instantly and the diff is easy to inspect line-by-line — but the same
four changes are the ones that take a real ~100K-token pipeline down
to the 15–30K range in practice, because the two biggest contributors
(chunk over-fetch and full-history replay) scale linearly with corpus
size and conversation length, which is exactly where the 100K number
comes from in the first place.

## What I'd measure next in a real system
- Track tokens/query and $/query as a dashboard metric, not just latency —
  cost regressions are invisible until someone looks.
- A/B the retrieval top-k against an eval set (answer accuracy vs. cost)
  rather than picking 5 by feel.
- Confirm cache hit rate on the system prompt in production logs —
  caching only helps if requests are close enough together in time to
  land in the same cache window.
