const { compressHistory, retrieveChunksOptimized } = require("../part1-token-optimization/after_pipeline");

test("compressHistory keeps last 2 turns raw and summarizes the rest", () => {
  const history = Array.from({ length: 6 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `turn ${i}`,
  }));
  const { raw, summary } = compressHistory(history, 2);
  expect(raw.length).toBe(2);
  expect(raw[1].content).toBe("turn 5");
  expect(summary).toContain("4 turns");
});

test("compressHistory returns no summary when history is short", () => {
  const history = [{ role: "user", content: "hi" }];
  const { raw, summary } = compressHistory(history, 2);
  expect(raw.length).toBe(1);
  expect(summary).toBe("");
});

test("retrieveChunksOptimized returns at most topK chunks", () => {
  const corpus = ["alpha beta", "gamma delta", "alpha gamma", "epsilon zeta"];
  const result = retrieveChunksOptimized("alpha", corpus, 2);
  expect(result.length).toBeLessThanOrEqual(2);
});
