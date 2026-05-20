# Fitaly (`fitaly`)

This repository is proprietary and is not licensed for public use, redistribution, or modification.

An Expo/React Native mobile app for scanning meals (photo, text, barcode), analyzing nutrition values, tracking history and statistics, and supporting premium features.

AI execution is backend-managed: the app calls backend AI endpoints and does not execute OpenAI requests directly on the client.

## Stack

- Expo SDK 53
- React Native 0.79.x + React 19
- TypeScript
- Firebase (`auth`, `firestore`, `storage`)
- RevenueCat (`react-native-purchases`)
- i18next (PL/EN localizations)

## Project Structure

Core principle: functional code belongs in `feature/*` modules, and the global layer is only for shared code.

```text
src/
  feature/
    Auth/
    Home/
    Meals/
    History/
    Statistics/
    UserProfile/
    Subscription/
    AI/
    Onboarding/
  components/   # global shared UI components
  hooks/        # global hooks
  services/     # global services (e.g. firebase, billing, offline)
  utils/        # global helpers
  theme/        # styling and themes
  navigation/   # app navigation
  types/        # global types
  locales/      # i18n translations
```

## Requirements

- Node.js 22 LTS
- npm
- Expo CLI (`npx expo ...`)
- For native builds:
- Android Studio (Android)
- Xcode + CocoaPods (iOS, macOS)

## Installation and Run

1. Install dependencies:

```bash
npm install
```

2. Create local env from template:

```bash
cp .env.example .env
```

3. Run the app:

```bash
# Expo (dev server)
npm run start

# Expo dev client
npm run dev

# Native run
npm run android
npm run ios
```

4. Code quality checks:

```bash
npm run lint
npm run typecheck
```

5. Tests:

```bash
# full suite + coverage
npm run test

# targeted run for changed area (recommended during day-to-day work)
npm run test -- src/hooks/__tests__/useMeals.test.ts

# cheap FE↔BE guardrail for profile/onboarding contract drift
npm run test:profile-contract
```

`npm run test:profile-contract` compares the mirrored mobile fixture with the backend canonical fixture. If the backend checkout is not a sibling directory, point it explicitly with `BACKEND_REPO=/path/to/fitaly-backend`.

## Environment Variables

File: `.env`

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/
EXPO_PUBLIC_API_VERSION=v1
EXPO_PUBLIC_ENABLE_BACKEND_LOGGING=true
EXPO_PUBLIC_ENABLE_TELEMETRY=false
RC_IOS_API_KEY=
RC_ANDROID_API_KEY=
TERMS_URL=
PRIVACY_URL=
DEBUG_OCR=false
DISABLE_BILLING=false
FORCE_PREMIUM=false

# only for the font download script
GOOGLE_FONTS_KEY=
```

Description:

- `EXPO_PUBLIC_API_BASE_URL` - base URL of the backend API used for AI, logging, and other server-managed features.
- `EXPO_PUBLIC_API_BASE_URL` environment mapping:
  - local dev: `http://localhost:8000/`
  - dev/smoke builds (`smoke`, `development`, `preview`, `internal`, `e2e-test`): `https://fitaly-backend-smoke.up.railway.app`
  - production builds: `https://fitaly-backend-production.up.railway.app`
- `EXPO_PUBLIC_API_VERSION` - backend API version prefix used by the app.
- `EXPO_PUBLIC_ENABLE_BACKEND_LOGGING` - enables forwarding selected client errors to the backend logging endpoint.
- `EXPO_PUBLIC_ENABLE_TELEMETRY` - enables mobile telemetry batching and release-critical event emission. **Also requires backend `TELEMETRY_ENABLED=true`.**
- `RC_IOS_API_KEY` - RevenueCat iOS API key (required for iOS subscriptions).
- `RC_ANDROID_API_KEY` - RevenueCat Android API key (required for Android subscriptions).
- `TERMS_URL` - terms and conditions URL (used in paywall/subscription screens).
- `PRIVACY_URL` - privacy policy URL.
- `DEBUG_OCR` - OCR debug flag (`true`/`false`). Keep `false` for production.
- `DISABLE_BILLING` - disables billing in dev (`true`/`false`).
- `FORCE_PREMIUM` - premium testing flag (`true`/`false`).
- `SENTRY_ORG` - Sentry organization slug used for source map upload.
- `SENTRY_PROJECT` - Sentry project slug used for source map upload.
- `SENTRY_ENVIRONMENT` - Sentry environment tag (`smoke`, `production`, etc.).
- `SENTRY_DSN` - app runtime DSN for crash/error reporting from the device.
- `SENTRY_AUTH_TOKEN` - build-time auth token used by `sentry-cli` for source map upload.
- `GOOGLE_FONTS_KEY` - used only by `npm run fonts:download`.

The canonical mobile to backend matrix for prod, smoke, and dev/local is [docs/runtime-config.md](./docs/runtime-config.md).

### Production release checks

`publish:android`, `publish:ios`, `build:android`, and `build:ios` run `scripts/check-launch-readiness.mjs` before EAS.

Useful commands:

- `npm run build:android:smoke` / `npm run build:ios:smoke` - local EAS build against smoke backend profile.
- `npm run eas:android:smoke` / `npm run eas:ios:smoke` - cloud EAS build with explicit `smoke` profile.
- `Release Candidate` GitHub workflow - public launch gate that reruns mobile/backend CI, smoke E2E, smoke export verification, and assembles `release-evidence.md` before final release approval.

Local build helper note:

- `scripts/build.js` defaults `SENTRY_DISABLE_AUTO_UPLOAD=true` so local builds do not fail on Sentry source-map upload auth.
- To force source-map upload during local builds, run with `SENTRY_DISABLE_AUTO_UPLOAD=false` and a valid `SENTRY_AUTH_TOKEN`.

The production check blocks release when:

- `TERMS_URL` or `PRIVACY_URL` are missing/invalid
- `eas.json` API base URL mapping does not match required dev(smoke)/production split
- `eas.json` production Android artifact is not `app-bundle`
- Android `targetSdkVersion` is below `35`
- Android Firebase config does not match `com.lkurczab.fitaly` (`google-services.json`)
- App Store iOS build-time `ios.bundleIdentifier` is not set to `com.lkurczab.foodscannerai`

iOS production/App Store exception:

- The App Store listing is tied to the legacy iOS bundle identifier `com.lkurczab.foodscannerai`.
- For that reason, App Store iOS builds must keep `ios.bundleIdentifier = com.lkurczab.foodscannerai`.
- Do not treat Android/package naming (`com.lkurczab.fitaly`) as the source of truth for App Store iOS releases.
- Native iOS project files and Firebase plist may differ from the App Store build-time identifier; that divergence is an accepted long-term project convention.
- When reviewing iOS release readiness, treat this as an intentional permanent exception, not a rename candidate.

GitHub release and alerting workflows expect these repository secrets:

- `OPS_ALERT_DISCORD_WEBHOOK_URL`
- `FIREBASE_WEB_API_KEY`
- `SMOKE_EXPORT_TEST_EMAIL`
- `SMOKE_EXPORT_TEST_PASSWORD`

The manual disposable smoke delete helper (`node scripts/manual-delete-smoke-check.mjs`) intentionally uses separate env vars:

- `SMOKE_DELETE_TEST_EMAIL`
- `SMOKE_DELETE_TEST_PASSWORD`

### v2 selective adoption

The mobile app uses v2 endpoints selectively:

- **AI Chat**: Chat runtime is canonical v2 and sends user prompts to `POST /api/v2/ai/chat/runs`.
- **AI Chat history**: Thread/message projection reads use `/api/v2/users/me/chat/*`; AI Chat code is guarded against `/api/v1` and legacy `/ai/ask`.
- **AI Chat persona**: Mobile stores assistant preference as user profile `aiStyle`; backend bounds it to Fitaly style profiles and applies brand guardrails in the v2 prompt.
- **Telemetry**: When `EXPO_PUBLIC_ENABLE_TELEMETRY=true`, the telemetry client batches events and sends them to `POST /api/v2/telemetry/events/batch`.
- **NutritionState**: The Home screen fetches from `GET /api/v2/users/me/state?day=YYYY-MM-DD` with local fallback caching. If the backend is unreachable, the consumer falls back to locally-computed state.
- **Smart Reminders**: The app fetches `GET /api/v2/users/me/reminders/decision?day=YYYY-MM-DD`, schedules only `decision="send"`, and cancels on `suppress`, `noop`, invalid payload, or failure. Mobile schedules from canonical backend `scheduledAtUtc`, not reconstructed local clock fields. Device notification permission stays a mobile execution concern, not part of the backend reminder decision contract.
- **Smart Reminders scope**: Smart Reminders v1 currently depend on NutritionState, habit signals already surfaced through state, existing reminder preferences, and current-time evaluation context. Coach Insights v1 remain a separate surface and are not a runtime input to reminder decisions in v1.
- **Legacy residue policy**: Mobile no longer exposes legacy meal/day reminder forms as a production path. Notifications settings now drive a single canonical runtime (smart reminders + local scheduling + system prefs).

All other features (meals, photo analysis, subscriptions) continue to use v1 endpoints.

If AI features are enabled locally, the mobile app still needs a reachable backend configured through `EXPO_PUBLIC_API_BASE_URL`; the OpenAI API key now lives only on the backend.

Additionally, native Firebase config files are required:

- `google-services.json` (Android)
- `GoogleService-Info.plist` (iOS)

## Development

Architecture guidelines:

- By default, add new code under `src/feature/<FeatureName>/` (`screens`, `components`, `hooks`, `services`, `types`).
- Treat feature code as private: do not import directly between features.
- If code is reused by 2+ features, move it to the global layer (`components`, `hooks`, `services`, `utils`, `theme`, `types`).
- Use the `@/` alias for cross-folder imports.
- Keep import direction: `screens -> feature internals -> global -> SDK`.
- All UI strings should go through i18next (`src/locales/...`), no hardcoded UI text.
- Prefer named exports; use default export only where already consistent (e.g. screens).
- Before finishing changes, choose validation by risk. Do not run Maestro by default for small visual/layout/copy work unless the prompt asks for it or the change touches navigation, state, or business logic.

Validation policy:

| Tier | Change type | Required validation |
| --- | --- | --- |
| Tier 0 | Documentation or copy-only | No runtime tests required. Run `npm run lint` / `npm run typecheck` only if source files changed. If copy affects legal, billing, or health-sensitive flows, move up to the relevant higher tier. |
| Tier 1 | Simple UI/layout polish | Run `npm run typecheck` and `npm run lint`. Do not run Maestro by default. Include manual visual check steps for the touched screen, viewport/device class, and any obvious interaction states. |
| Tier 2 | Component logic or shared component changes | Run `npm run typecheck`, `npm run lint`, and relevant unit/component tests if present. Run targeted Maestro only when the component affects a critical flow. |
| Tier 3 | Critical flow changes | Run `npm run typecheck`, `npm run lint`, relevant tests, and the targeted Maestro flow. Critical flows include auth/session routing, onboarding completion, add meal save, local-first sync, premium/restore, reminders, account deletion, and navigation. |
| Tier 4 | Release gate or full app review | Run smoke or full relevant Maestro suites before release candidates, larger merges, full visual/product review, or explicit request. |

General test guidance:

- Prefer targeted tests for touched files/features during regular development.
- When running only part of the Jest suite, scope coverage to the touched source files, for example:

```bash
npm run test:targeted -- --coverage --runTestsByPath src/services/release/checkLaunchReadinessConfig.test.ts \
  --collectCoverageFrom=scripts/check-launch-readiness.lib.js
```

- Run the full Jest suite before releases, large refactors, or cross-feature changes.

## E2E Maestro

Maestro flows are grouped by role under `e2e/maestro/`. The canonical suites are `smoke`, `release-gate`, `nightly-regression`, and `platform-layout`.

```bash
# minimal startup/account smoke
npm run e2e:smoke:foundation
npm run e2e:smoke:account-launch

# release candidate gate
npm run e2e:release-gate

# broader scheduled/manual checks
npm run e2e:nightly-regression
npm run e2e:platform-layout
```

Prefer focused Maestro commands such as `npm run e2e:smoke:login`, `npm run e2e:release-gate:add-meal:manual`, or `npm run e2e:platform-layout:small-screen-forms` over a whole suite when validating one flow. Any `e2e-full` wrapper or equivalent full-suite run is reserved for full visual/product review, release gates, larger merges, or explicit request.

See [E2E Maestro Test Matrix](./docs/e2e-test-matrix.md) for fixture/deep link contracts, CI classification, and selector rules.

## Operator docs

- [Public Launch Readiness 2026-04-08](./docs/public-launch-readiness-2026-04-08.md) — current source of truth for what is automated vs manual for public launch; supersedes older external audit notes
- [Launch Runbook](./docs/launch-runbook.md) — Go/No-Go checklist, rollback matrix, kill-switch and incident flow
- [Canonical Notifications Release Hardening](./docs/notifications-canonical-release-hardening.md) — environment matrix, diagnostics panel, real-device smoke plan, interpretation checklist
- Backend Ops Monitoring Runbook: `../fitaly-backend/docs/ops-monitoring-runbook.md` — production health/latency thresholds and incident triage
- Backend Compliance Ops Runbook: `../fitaly-backend/docs/compliance-ops-runbook.md` — data export/delete flow, retention cadence and privacy incident process
- [Coach Insights v1 Semantics](./docs/coach-insights-v1.md) — mobile contract handling, empty-state modes, telemetry rules
- [Coach Insights v1 Rollout](./docs/coach-insights-v1-rollout.md) — preconditions, verification, rollback behavior
- [Smart Reminders v1 Rollout (archival)](./docs/smart-reminders-v1-rollout.md) — historical rollout notes and migration context
- [Notifications Legacy Sunset Note](./docs/notifications-legacy-sunset-note.md) — what was removed vs retained as compatibility-only

## License

This repository is distributed under a proprietary, all-rights-reserved license. See [LICENSE](./LICENSE).
