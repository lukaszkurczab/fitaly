# Runtime Config Contract

This is the minimal mobile to backend runtime contract for launch-critical Fitaly environments. It exists to prevent drift between the Expo build profile and the Railway backend profile.

Do not put secrets in this document. RevenueCat, Firebase, OpenAI, and Sentry secrets stay in EAS/Railway secret stores.

## Environment Matrix

| Contract environment | Mobile build profile | Mobile `EXPO_PUBLIC_API_BASE_URL` | Backend Railway environment | Backend `ENVIRONMENT` | Telemetry | Smart Reminders | Billing | RevenueCat expectations | Firebase eager init | OpenAI / AI gateway |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `prod` | `production` | `https://fitaly-backend-production.up.railway.app` | `prod` | `production` | Mobile `EXPO_PUBLIC_ENABLE_TELEMETRY=true`; backend `TELEMETRY_ENABLED=true`. | Mobile `EXPO_PUBLIC_ENABLE_SMART_REMINDERS=true`; backend `SMART_REMINDERS_ENABLED=true`. | Enabled. `DISABLE_BILLING=false`; `FORCE_PREMIUM` must not be `true`. | Production RevenueCat project/API keys. `RC_IOS_API_KEY` and `RC_ANDROID_API_KEY` must be provided to EAS; backend `REVENUECAT_API_KEY` and `REVENUECAT_WEBHOOK_SECRET` must match the production RevenueCat project. | Backend `EAGER_FIREBASE_INIT=true`; production deploy fails fast when Firebase config or credentials are invalid. | Backend `OPENAI_API_KEY` configured; `AI_CHAT_ENABLED=true`; `AI_GATEWAY_ENABLED=true`. Mobile never receives the OpenAI key. |
| `smoke` | `smoke` for release rehearsal, `internal`/`e2e-test` when explicitly using smoke backend | `https://fitaly-backend-smoke.up.railway.app` | `smoke` | `production` | Launch-like smoke uses mobile `EXPO_PUBLIC_ENABLE_TELEMETRY=true` and backend `TELEMETRY_ENABLED=true`. If a test intentionally disables telemetry, record it as rollback coverage, not release readiness. | Mobile `EXPO_PUBLIC_ENABLE_SMART_REMINDERS=true`; backend `SMART_REMINDERS_ENABLED=true`. | Enabled for launch rehearsal. `DISABLE_BILLING=false`; use sandbox/test purchase flow where applicable. | Separate smoke/sandbox RevenueCat keys or a RevenueCat setup whose products are safe for test purchases. Backend RevenueCat webhook/API secrets may be separate from prod but must target the same smoke account/project expectation. | Backend defaults to `EAGER_FIREBASE_INIT=false` to keep Railway smoke lightweight. Temporarily set `true` only for infra readiness tests that intentionally validate Firestore startup credentials. | Backend has smoke or limited `OPENAI_API_KEY`; `AI_CHAT_ENABLED=true`; `AI_GATEWAY_ENABLED=true`. Smoke may use separate secrets/API quota, but should exercise launch-like AI behavior. |
| `dev/local` | Local Expo runtime, optionally `development` dev-client profile | Local default `http://localhost:8000/`; dev-client profiles that need remote backend may inherit smoke URL intentionally. | local developer backend | `local` or `development` | Default off: mobile `EXPO_PUBLIC_ENABLE_TELEMETRY=false`; backend `TELEMETRY_ENABLED=false` unless testing telemetry locally. | Default follows app config: mobile enabled unless overridden; backend default `SMART_REMINDERS_ENABLED=true`. Local failures must not block production readiness. | Developer choice. `DISABLE_BILLING=true` is allowed locally; `FORCE_PREMIUM=true` is allowed only for local testing. | Keys may be empty locally; use sandbox keys only when testing purchase flows. Never use production RevenueCat webhook secrets in local ad hoc tests. | Developer choice. Use local Firebase credentials only when testing Firebase paths; local config must not be treated as release evidence. | `OPENAI_API_KEY` may be unset unless testing AI. Mobile still calls backend through `EXPO_PUBLIC_API_BASE_URL`; OpenAI key stays backend-only. |

Notes:

- Railway `smoke` is an environment label. The backend `ENVIRONMENT` value remains `production` for smoke because the backend settings currently allow `local`, `development`, `staging`, and `production`, and launch-like smoke should keep production-class runtime checks.
- `SENTRY_ENVIRONMENT` distinguishes telemetry/error streams: use `production` for prod and `smoke` for smoke.
- Smoke can use separate Firebase, RevenueCat, OpenAI, and Sentry secrets. The important contract is behavior parity, not secret reuse.
- Local/dev fallbacks must never be used as production readiness evidence.

## Sanity Gate

`scripts/check-launch-readiness.mjs` validates the nonsensitive parts of this contract for `eas.json`:

- `smoke` and `production` must set `EXPO_PUBLIC_ENABLE_TELEMETRY=true`.
- `smoke` and `production` must set `EXPO_PUBLIC_ENABLE_SMART_REMINDERS=true`.
- `smoke` and `production` must set `DISABLE_BILLING=false`.
- API URL mapping must keep smoke/dev-client profiles on the smoke Railway backend and production on the production Railway backend.

The gate intentionally does not check secret presence for smoke and does not print secret values.

Run it directly with `npm run check:runtime-config`.

## Smoke Checklist After Runtime Config Changes

1. Confirm `eas.json` has the expected smoke API URL and launch-like client flags:
   - `EXPO_PUBLIC_API_BASE_URL=https://fitaly-backend-smoke.up.railway.app`
   - `EXPO_PUBLIC_ENABLE_TELEMETRY=true`
   - `EXPO_PUBLIC_ENABLE_SMART_REMINDERS=true`
   - `DISABLE_BILLING=false`
   - `SENTRY_ENVIRONMENT=smoke`
2. Confirm Railway smoke variables align with backend launch-like behavior:
   - `ENVIRONMENT=production`
   - `TELEMETRY_ENABLED=true`
   - `SMART_REMINDERS_ENABLED=true`
   - `AI_CHAT_ENABLED=true`
   - `AI_GATEWAY_ENABLED=true`
   - `WEEKLY_REPORTS_ENABLED=true`
   - `REVENUECAT_API_KEY` / `REVENUECAT_WEBHOOK_SECRET` point to the intended smoke or sandbox RevenueCat setup.
3. Confirm smoke uses separate or intentionally scoped secrets/API quota for Firebase, OpenAI, RevenueCat, and Sentry.
4. Build or run the smoke profile and verify the app points at the smoke backend, not production.
5. Run smoke backend health checks:
   - `GET https://fitaly-backend-smoke.up.railway.app/api/v1/health`
   - Use `/api/v1/health/firestore` only for a deliberate deep Firebase readiness check.
6. Run authenticated smoke flow checks when smoke account secrets are available:
   - mobile `node scripts/verify-smoke-flow-contracts.mjs`
   - mobile `node scripts/verify-smoke-export.mjs`
   - backend `python scripts/check-flow-contracts.py --base-url https://fitaly-backend-smoke.up.railway.app --env smoke`
7. Capture release evidence for telemetry ingest, Smart Reminder decision, AI chat or AI meal path, weekly report premium gating, and purchase/restore smoke note.
