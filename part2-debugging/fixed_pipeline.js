const axios = require("axios");
const { z } = { z: require("zod") }; // conceptual — schema validation library

// FIX A: explicit timeout + bounded retry with backoff, and the timeout
// is now a signal we can alert on, instead of an indefinite hang.
async function retrieveContext(query, { timeoutMs = 3000, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(
        "http://vector-db.internal/query",
        { query },
        { timeout: timeoutMs }
      );
      return res.data.chunks;
    } catch (err) {
      const isLastAttempt = attempt === retries;
      console.error(
        JSON.stringify({
          event: "retrieve_context_failed",
          attempt,
          error: err.code || err.message,
        })
      );
      if (isLastAttempt) throw new Error(`retrieveContext failed after ${retries + 1} attempts: ${err.message}`, { cause: err });
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt)); // backoff
    }
  }
}

// FIX B: strip markdown fences defensively, validate against a schema,
// and fail loudly (with the raw text logged) instead of throwing an
// opaque JSON.parse error or silently returning malformed data.
const ExtractedSchema = z.object({
  fields: z.record(z.string()),
});

function parseModelJson(rawText) {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error(JSON.stringify({ event: "model_json_parse_failed", rawText }));
    throw new Error("Model did not return valid JSON — see logged rawText", { cause: err });
  }
  const result = ExtractedSchema.safeParse(parsed);
  if (!result.success) {
    console.error(
      JSON.stringify({ event: "model_json_schema_invalid", issues: result.error.issues, parsed })
    );
    throw new Error("Model JSON did not match expected schema");
  }
  return result.data;
}

async function extractStructuredData(context, query) {
  const response = await callLLM({
    prompt: `Extract the requested fields as JSON from this context:\n${context}\n\nQuestion: ${query}`,
  });
  return parseModelJson(response.text);
}

// FIX C: no silent fallback. If the dependency fails, the pipeline fails
// visibly and traceably, instead of returning a plausible-looking wrong
// answer. If a default is truly acceptable business-wise, it must be
// explicit and logged, never a quiet catch-all.
async function enrichWithAccountData(extracted, accountId) {
  const account = await lookupAccount(accountId);
  if (!account) {
    console.error(JSON.stringify({ event: "account_lookup_missing", accountId }));
    throw new Error(`No account found for accountId=${accountId} — refusing to guess a tier`);
  }
  return { ...extracted, accountTier: account.tier };
}

async function runPipeline(query, accountId, requestId) {
  console.log(JSON.stringify({ event: "pipeline_start", requestId, query, accountId }));
  const context = await retrieveContext(query);
  console.log(JSON.stringify({ event: "context_retrieved", requestId, chunkCount: context.length }));
  const extracted = await extractStructuredData(context, query);
  console.log(JSON.stringify({ event: "extraction_complete", requestId }));
  const result = await enrichWithAccountData(extracted, accountId);
  console.log(JSON.stringify({ event: "pipeline_complete", requestId }));
  return result;
}

async function callLLM(_opts) {
  throw new Error("stub - replace with real API call");
}
async function lookupAccount(_id) {
  throw new Error("stub - replace with real DB call");
}

module.exports = { runPipeline, retrieveContext, extractStructuredData, enrichWithAccountData };
