/**
 * A multi-step agent pipeline with three real, distinct bugs baked in —
 * one for each symptom described in the brief. They're independent bugs;
 * fixing one doesn't fix the others. See fixed_pipeline.js + README.md
 * for the diagnosis and fix of each.
 */

const axios = require("axios");

// STEP 1: retrieve context
async function retrieveContext(query) {
  // BUG A (intermittent TIMEOUT): no timeout set on the HTTP client, and
  // no retry/backoff. Under normal load the vector DB responds in ~200ms,
  // but under cold-start or connection-pool exhaustion it can hang
  // indefinitely with no upper bound — the caller just waits forever.
  const res = await axios.post("http://vector-db.internal/query", { query });
  return res.data.chunks;
}

// STEP 2: call the LLM to extract structured data
async function extractStructuredData(context, query) {
  const response = await callLLM({
    prompt: `Extract the requested fields as JSON from this context:\n${context}\n\nQuestion: ${query}`,
  });

  // BUG B (intermittent MALFORMED OUTPUT): naive JSON.parse on raw model
  // output with no schema validation and no handling of the model
  // wrapping JSON in markdown fences (```json ... ```), which it does
  // often enough to matter but not every time — hence "intermittent."
  return JSON.parse(response.text);
}

// STEP 3: merge extracted data with a second, independent lookup
async function enrichWithAccountData(extracted, accountId) {
  const account = await lookupAccount(accountId);

  // BUG C (SILENT WRONG DATA): if lookupAccount fails or returns null,
  // this falls back to a hardcoded default instead of raising — so the
  // pipeline "succeeds" and returns a plausible-looking but wrong answer,
  // with no error, no log, nothing to signal that a fallback was used.
  return {
    ...extracted,
    accountTier: account ? account.tier : "standard", // <-- silent wrong-data bug
  };
}

async function runPipeline(query, accountId) {
  const context = await retrieveContext(query);
  const extracted = await extractStructuredData(context, query);
  const result = await enrichWithAccountData(extracted, accountId);
  return result;
}

// --- stubs for illustration, not real implementations ---
async function callLLM(_opts) {
  throw new Error("stub - replace with real API call");
}
async function lookupAccount(_id) {
  throw new Error("stub - replace with real DB call");
}

module.exports = { runPipeline, retrieveContext, extractStructuredData, enrichWithAccountData };
