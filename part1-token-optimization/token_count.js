const { encode } = require("gpt-tokenizer");
const { buildNaivePrompt } = require("./before_pipeline");
const { buildOptimizedPrompt } = require("./after_pipeline");

// --- Build a realistic synthetic scenario -----------------------------
// 40 "document chunks" of ~180 words each (mimics chunked PDF content),
// with some near-duplicate/overlapping chunks thrown in, like a real
// vector DB over-fetch would return.
function makeChunk(i) {
  const filler =
    "In the fiscal review, quarterly revenue figures and operational metrics were discussed at length, covering topics such as vendor contracts, compliance requirements, staffing allocations, infrastructure spend, and forward-looking projections for the next two fiscal quarters. ".repeat(8);
  return `Section ${i}: ${filler} Reference ID: DOC-${i}.`;
}
const corpus = Array.from({ length: 40 }, (_, i) => makeChunk(i));
// force some near-duplicates (common with overlapping chunk windows)
corpus[5] = corpus[2];
corpus[9] = corpus[2];
corpus[14] = corpus[7];

// 12 turns of prior conversation
const history = Array.from({ length: 12 }, (_, i) => ({
  role: i % 2 === 0 ? "user" : "assistant",
  content:
    i % 2 === 0
      ? `Follow-up question #${i} about the quarterly report, referencing earlier figures.`
      : `Here is the answer to follow-up #${i}, citing chunk data and prior numbers discussed.`,
}));

const query = "What was the vendor contract spend mentioned in the Q3 section, and how does it compare to Q2?";

// --- BEFORE -------------------------------------------------------------
const naivePrompt = buildNaivePrompt({ query, corpus, history });
const naiveTokens = encode(naivePrompt).length;

// --- AFTER ----------------------------------------------------------------
const optimized = buildOptimizedPrompt({ query, corpus, history });
const optimizedFullText = optimized.systemPrompt + "\n\n" + optimized.userContent;
const optimizedTokens = encode(optimizedFullText).length;
// system prompt tokens counted separately to show the cacheable portion
const systemTokens = encode(optimized.systemPrompt).length;

console.log("=== TOKEN COUNT COMPARISON (real gpt-tokenizer counts) ===\n");
console.log(`BEFORE (naive pipeline):     ${naiveTokens.toLocaleString()} tokens`);
console.log(`AFTER  (optimized pipeline): ${optimizedTokens.toLocaleString()} tokens`);
console.log(
  `Reduction: ${(((naiveTokens - optimizedTokens) / naiveTokens) * 100).toFixed(1)}%\n`
);
console.log(
  `Of the AFTER total, ${systemTokens} tokens are the static system prompt -`
);
console.log(
  `with prompt caching enabled, those are billed once per ~5min window, not per request.`
);
