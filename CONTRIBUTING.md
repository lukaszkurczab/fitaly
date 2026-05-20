# Contributing to Fitaly (mobile)

## Branches

| Pattern | Purpose |
|---------|---------|
| `main` | Production-ready code; protected, requires PR |
| `feat/<short-name>` | New features |
| `fix/<short-name>` | Bug fixes |
| `chore/<short-name>` | Tooling, deps, config |

## Pull Requests

- One logical change per PR; keep diffs reviewable
- Title format: `type: short description` (e.g. `feat: add meal duplicate action`)
- Link the relevant issue if one exists
- All CI checks must be green before merge (lint, typecheck, tests, launch-readiness)
- Do not merge your own PR without a review on feature/fix branches

## Local setup

```bash
npm ci
cp .env.example .env          # fill in local values
npx expo start
```

For a local backend, set `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000` in `.env`.

## Running checks

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # Jest unit tests
npm run test:targeted -- --coverage --runTestsByPath src/services/release/checkLaunchReadinessConfig.test.ts \
  --collectCoverageFrom=scripts/check-launch-readiness.lib.js
npm run check:launch-readiness:android   # production config gate
npm run check:launch-readiness:ios
```

## Validation policy

Use risk-based validation. Small visual/layout/copy patches do not imply Maestro E2E.

| Tier | Change type | Validation |
|------|-------------|------------|
| Tier 0 | Documentation or copy-only | No runtime tests unless copy affects legal, billing, or health-sensitive flows. Run `npm run lint` / `npm run typecheck` only if source files changed. |
| Tier 1 | Simple UI/layout polish | Run `npm run typecheck` and `npm run lint`; do not run Maestro by default. Include manual visual check instructions. |
| Tier 2 | Component logic or shared component changes | Run `npm run typecheck`, `npm run lint`, and relevant unit/component tests if present. Use targeted Maestro only if the component affects a critical flow. |
| Tier 3 | Critical flow changes | Run a targeted Maestro flow, plus lint/typecheck and relevant tests. Critical flows include auth/session routing, onboarding completion, add meal save, local-first sync, premium/restore, reminders, account deletion, and navigation. |
| Tier 4 | Release gate or full app review | Run smoke or full relevant Maestro suites before release candidates, larger merges, full visual/product review, or explicit request. |

When Maestro is appropriate, prefer focused package scripts such as `npm run e2e:smoke:login`, `npm run e2e:release-gate:add-meal:manual`, or `npm run e2e:platform-layout:small-screen-forms` before running a full suite. Any `e2e-full` wrapper or equivalent full-suite run is for full visual/product review, not every patch.

## Environment and build profiles

The canonical mapping of EAS build profiles to backend URLs lives in `eas.json`.
The `.env.example` documents the same mapping for local development.
**Never diverge these two sources.** If you change a backend URL, update both.

| Profile | Backend |
|---------|---------|
| `smoke` / `development` / `preview` / `internal` / `e2e-test` | `fitaly-backend-smoke.up.railway.app` |
| `production` / `production-apk` | `fitaly-backend-production.up.railway.app` |

## API contract changes

When you add, remove, or rename a field in a request/response that the backend also produces:

1. Open a PR in `fitaly-backend` first (or simultaneously) with the backend change
2. Update the contract snapshot in `scripts/verify-backend-contract.sh`
3. CI will verify sync automatically — do not skip or `SKIP` the contract check

## Adding or changing features behind a flag

Feature flags live in `app.config.js` (`extra.*`) and are read from `EXPO_PUBLIC_*` env vars.

- Default **off** in production until explicitly enabled
- Document the flag in `eas.json` comments if it affects a build profile

## Release checklist

Before tagging a release build:

- [ ] `CHANGELOG.md` updated with changes since last version
- [ ] Version bumped in `package.json` and `app.config.js`
- [ ] `npm run check:launch-readiness:android` passes locally with production env
- [ ] `npm run check:launch-readiness:ios` passes locally with production env
- [ ] `Release Candidate` workflow is green and `release-evidence` artifact is attached
- [ ] E2E Maestro flows pass on a real device or EAS build
- [ ] Smoke export check passes for the disposable smoke account
- [ ] Disposable smoke delete evidence is attached before approving the `production` environment
- [ ] `EXPO_PUBLIC_ENABLE_BACKEND_LOGGING` is `false` in `eas.json` production profile
- [ ] RC keys set as EAS Secrets (`eas secret:list` to verify)
