# Part 3 — CI/CD and Deployment

Workflow file: `.github/workflows/ci-cd.yml` (repo root `.github/`, GitHub
requires it there — copy referenced here for review).

## What it does
- **On every push to any branch, and on PRs into `main`:** install deps,
  run `npm run lint`, run `npm test`. This is the fast feedback loop —
  you find out you broke something before it's anywhere near production.
- **On push/merge to `main` only, gated on the test job passing
  (`needs: test`):** deploy to a `staging` GitHub Environment, then run
  a post-deploy smoke test (`/healthz` check) so a "successful" deploy
  that's actually broken doesn't silently pass.
- Deploy never runs if lint/test failed — `needs: test` makes that
  structural, not a convention someone has to remember.

## Secrets / API key handling
- All secrets (`STAGING_DEPLOY_API_KEY`, `STAGING_HOST`, etc.) live in
  **GitHub Environment secrets** (Settings → Environments → `staging`),
  not repo-level secrets and never in the workflow file or code.
  Environment secrets can be scoped so only jobs targeting that
  environment can read them, and can require manual approval before
  release if needed later (useful once this graduates to a `production`
  environment).
- Secrets are referenced only via `${{ secrets.NAME }}` and injected as
  job-scoped environment variables at run time — never printed, never
  echoed, never written to a log line. GitHub automatically redacts
  known secret values in logs, but I still avoid ever putting a secret
  into an `echo` or a string I don't need to.
- No secret ever reaches a `.env` file that gets committed. If a repo
  needs a `.env.example` for local dev, it lists variable *names* only.
- Least privilege: the deploy key used here should be scoped to
  staging-deploy permissions only, not a general admin/prod credential —
  a leaked staging key should not be able to touch production.
- Rotation: treat any key that touches CI as rotatable on a schedule and
  immediately on suspected exposure; because it's a GitHub secret and
  not hardcoded anywhere, rotation is a one-place update, not a
  find-and-replace across the codebase.

## Rollback plan — first 5 minutes if a deploy breaks production

1. **Stop the bleeding, don't diagnose yet.** Immediately roll back to
   the last known-good deployment/build artifact (redeploy the previous
   Git SHA / previous container image tag) rather than trying to
   hotfix forward under pressure. Most platforms (Vercel, ECS, k8s,
   Render, etc.) support a one-command "redeploy previous" — that's the
   first command I run, before I do anything else.
2. **Confirm the rollback actually took** via the same smoke test used
   in the deploy job (`/healthz` or equivalent), not just "the deploy
   command returned success."
3. **Communicate** — a one-line status update (incident channel /
   status page) that production had an issue and a rollback is in
   progress, so nobody else is debugging the same fire blind.
4. **Only after service is stable**, pull logs/traces from the broken
   deploy window to actually diagnose root cause, using the same
   isolate-by-symptom approach from Part 2 — but now with no time
   pressure, because users are no longer affected.
5. **Prevent recurrence**: if this class of failure wasn't caught by
   the smoke test or CI, that gap gets a test/check added before the
   next deploy attempt — a rollback without a follow-up fix to the
   pipeline just guarantees a repeat incident later.

The underlying principle: rollback is a mechanical, pre-decided action
(redeploy previous known-good build), not a judgment call made in the
moment — the moment of an outage is the worst possible time to be
improvising a fix.
