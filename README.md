# AI Pipeline Assignment — Token Optimization, Debugging, CI/CD

Submission for the technical assignment covering cost-awareness in AI
systems, debugging under pressure, and deployment discipline.

## Structure

```
.
├── part1-token-optimization/   # Before/after agent pipeline + real token counts
│   ├── before_pipeline.js
│   ├── after_pipeline.js
│   ├── token_count.js          # run: node token_count.js
│   └── README.md               # optimizations, tradeoffs, results
├── part2-debugging/            # Broken pipeline with 3 real bugs + fixes
│   ├── broken_pipeline.js
│   ├── fixed_pipeline.js
│   └── README.md               # full debugging methodology, step by step
├── part3-cicd/
│   ├── ci-cd.yml                # copy of the workflow for easy review
│   └── README.md               # secrets handling + rollback plan
├── .github/workflows/ci-cd.yml # the actual GitHub Actions workflow
├── tests/pipeline.test.js      # tests the CI pipeline runs
├── eslint.config.js
└── package.json
```

## Quick start
```bash
npm install
npm run lint        # 0 errors
npm test             # 3/3 passing
node part1-token-optimization/token_count.js   # real before/after token counts
```

## Summary of each part

**Part 1 — Token optimization**: cut a synthetic 7,932-token naive prompt
down to 964 tokens (87.8% reduction) via four changes — retrieval top-k
reduction + dedup, conversation history compression, prompt caching on
static content, and a tightened system prompt. Full tradeoff analysis
in `part1-token-optimization/README.md`.

**Part 2 — Debugging**: `broken_pipeline.js` reproduces all three
symptoms from the brief (timeout, malformed output, silent wrong data)
as three independent, realistic bugs. `part2-debugging/README.md` is
the actual investigation process — what I'd check first, what tools/logs
I'd pull, how I'd isolate each one — followed by the concrete fix for
each in `fixed_pipeline.js`.

**Part 3 — CI/CD**: working GitHub Actions workflow — lint + test on
every push, deploy to staging on merge to `main`, gated on tests
passing, with a post-deploy smoke test. Secrets handling and a 5-minute
rollback plan are in `part3-cicd/README.md`.

## Video interview
A video walkthrough covering the "what" and "why" of each part is
submitted separately per the assignment requirements.
