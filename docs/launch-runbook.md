# Fitaly Launch Runbook

## Scope

This runbook is the operational source of truth for release candidates and public rollout of:

- `fitaly` (mobile app)
- `fitaly-backend` (FastAPI backend)

## Ownership

- Release manager: Engineering Lead
- Mobile runtime/config gate: Mobile Engineer
- Backend runtime/config gate: Backend Engineer
- Store metadata/compliance: Product + Ops
- Incident commander (Day0-Day7): Engineering Lead
- Day0-Day7 mobile owner: Mobile Engineer
- Day0-Day7 backend owner: Backend Engineer
- Primary incident channel: Discord `launch-ops`
- ACK SLA (Day0-Day7): `<= 15 minutes` for production alerts

## Operational Dashboards

- Release workflow board: `https://github.com/lukaszkurczab/fitaly/actions/workflows/release-candidate.yml`
- Backend monitoring workflow board: `https://github.com/lukaszkurczab/fitaly-backend/actions/workflows/ops-monitoring.yml`
- Firestore backup workflow board: `https://github.com/lukaszkurczab/fitaly-backend/actions/workflows/firestore-backup.yml`
- Firestore restore drill workflow board: `https://github.com/lukaszkurczab/fitaly-backend/actions/workflows/firestore-restore-drill.yml`
- Railway production service dashboard: `https://railway.app/project/<project-id>/service/<service-id>`
- Sentry backend production dashboard: `https://sentry.io/organizations/<org-slug>/projects/<backend-project-slug>/`
- Sentry mobile production dashboard: `https://sentry.io/organizations/<org-slug>/projects/<mobile-project-slug>/`

## Launch Checklist

Core technical and operational checks are listed below. In this project, `release-evidence` is a review aid and soft gate, not a hard rollout blocker.

Intentional iOS identifier exception:

- App Store iOS releases keep the legacy bundle identifier `com.lkurczab.foodscannerai`.
- This is intentional because the App Store listing is already bound to that identifier.
- Do not block release solely because Android naming and iOS App Store naming differ.
- Treat this as a permanent project convention unless the release owner explicitly decides otherwise.

Solo-release convention:

- This project is operated solo.
- Do not require a separate GitHub `production` environment reviewer as a launch criterion.
- Release approval is performed directly by the release owner.

- Mobile CI passes (`lint`, `typecheck`, tests, launch-readiness config gate).
- Backend CI passes (`ruff`, `pyright`, `pytest`).
- Cross-repo contract sync job is green.
- `Release Candidate` workflow is green and produced `release-evidence`.
- RC smoke E2E passes on prepared runner via `E2E Smoke Gate`:
  - `e2e/maestro/smoke/foundation.yaml`
  - `e2e/maestro/smoke/account-launch.yaml`
- RC smoke flow-contract verification passes:
  - `GET /api/v1/ai/credits` returns valid contract payload
  - `GET /api/v2/users/me/reports/weekly` returns expected free-user denial (`403 WEEKLY_REPORT_PREMIUM_REQUIRED`) on smoke
- Chat integrity evidence is green:
  - automated hook tests cover timeout/offline/429/navigate-away/double-tap
  - weak-network manual chat smoke evidence is attached
- Onboarding evidence is backend-owned and contract-safe:
  - `POST /api/v1/users/me/onboarding` contract test is green
  - forced-failure signup rollback note is attached
- Weekly report premium boundary is backend-true:
  - free-user direct API verification returns `403 WEEKLY_REPORT_PREMIUM_REQUIRED`
- Paywall evidence is truthful to real purchase flow:
  - only purchasable offer is visible
  - purchase/restore smoke note is attached for that offer
- Privacy-safe logging and Sentry hardening evidence is attached:
  - fake-PII payload does not appear in backend logs or Sentry event payload
  - Sentry data-scrubbing and retention screenshots are linked
- Compliance packet is attached:
  - telemetry retention policy snapshot
  - processor matrix
  - DPA/SCC status snapshot
  - export/delete/store-disclosure evidence links
- Release rehearsal packet is attached:
  - distributable build IDs (version/build number + identifiers)
  - rollback rehearsal note
  - signed launch checklist
- `TERMS_URL` and `PRIVACY_URL` are valid HTTPS URLs and resolve publicly.
- `EXPO_PUBLIC_API_BASE_URL` mapping is correct:
  - `smoke/development/preview/internal/e2e-test` -> `https://fitaly-backend-smoke.up.railway.app`
  - `production` -> `https://fitaly-backend-production.up.railway.app`
- Backend production env is complete:
  - explicit `CORS_ORIGINS` (no wildcard `*`)
  - `OPENAI_API_KEY`
  - `FIREBASE_PROJECT_ID`
  - Firebase credentials source:
    - `GOOGLE_APPLICATION_CREDENTIALS`, or
    - `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
- Latest Firestore backup is available as the most recent successful `firestore-backup.yml` run artifact.
- Monthly restore drill is documented as the most recent successful `firestore-restore-drill.yml` run artifact.
- Compliance operations are validated for current release:
  - data export endpoint `GET /api/v1/users/me/export` verified by workflow on smoke
  - AI credits + weekly report flow contracts verified by workflow on smoke
  - data delete endpoint `POST /api/v1/users/me/delete` verified manually on a disposable smoke account, with evidence attached to `release-evidence`
  - compliance runbook reviewed: `../fitaly-backend/docs/compliance-ops-runbook.md`
- Ops monitoring baseline is active and owned:
  - workflow: `../fitaly-backend/.github/workflows/ops-monitoring.yml`
  - thresholds/runbook: `../fitaly-backend/docs/ops-monitoring-runbook.md`
  - Discord alert webhook configured as `OPS_ALERT_DISCORD_WEBHOOK_URL`
- Android release artifact is AAB.

## Release Steps (RC -> Public)

1. Build RC with `smoke` (or `internal`) profile.
2. Run `Release Candidate` workflow and provide disposable smoke delete evidence URL if this is a production approval run.
3. Review `release-evidence` artifact and use it as an operator checklist for backup/restore and release evidence links.
4. Approve the release directly as the release owner.
5. Execute manual sanity check on both platforms.
6. Build production artifacts (`publish:android`, `publish:ios`).
7. Upload to store tracks with phased rollout.
8. Monitor Day0-Day7 metrics and Discord `launch-ops`.

## Rollback Matrix

- Routing/config regression:
  - Rollback action: stop rollout, rebuild with corrected env mapping.
- Backend startup failures (CORS/Firebase/OPENAI):
  - Rollback action: restore previous working deployment and correct missing production variables.
- Smart Reminders incident:
  - Rollback action: `SMART_REMINDERS_ENABLED=false`.
- Weekly Reports incident:
  - Rollback action: `WEEKLY_REPORTS_ENABLED=false`.
- Telemetry ingest incident:
  - Rollback action: `TELEMETRY_ENABLED=false`.
- Severe user-impacting issue:
  - Rollback action: pause rollout/unpublish until hotfix is validated.

## Kill-Switch Strategy

- Primary kill-switches are backend feature flags.
- Secondary mitigation is store rollout pause.
- Tertiary mitigation is full rollback to previous backend release.

## Incident Flow (Day0-Day7)

1. Acknowledge alert in Discord `launch-ops` within 15 minutes and assign incident commander.
2. Freeze new releases.
3. Capture scope and affected versions (mobile + backend).
4. Check Railway and Sentry dashboards from this runbook before choosing mitigation.
5. Apply relevant kill-switch or rollback.
6. Validate mitigation on staging and production health checks.
7. Publish post-incident summary with remediation tasks.
