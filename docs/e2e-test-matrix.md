# E2E Maestro Test Matrix

This document is the canonical map for Fitaly Maestro coverage. The suite names describe how the tests are used, not when they were implemented.

## Suites

| Suite | Purpose | Command | CI / local | Notes |
| --- | --- | --- | --- | --- |
| `smoke` | Minimal startup, login, add-meal, chat, offline, and account launch checks. | `npm run e2e:smoke` or focused `npm run e2e:smoke:*` scripts | CI self-hosted, EAS Android smoke, local | Used by `.github/workflows/e2e-smoke-gate.yml` and `.eas/workflows/e2e-maestro.yml`. |
| `release-gate` | Stable release candidate gate for account access, onboarding, meal save propagation, payments, offline/sync, reports, notifications, share, and destructive guards. | `npm run e2e:release-gate` | CI self-hosted and local | Used by release branches and `.github/workflows/release-candidate.yml`. |
| `nightly-regression` | Wider deterministic regression for failure states, account cleanup, report content, share errors, billing states, and offline conflict/failure surfaces. | `npm run e2e:nightly-regression` | CI self-hosted scheduled/manual and local | Runs on schedule in `.github/workflows/e2e-regression.yml`. |
| `platform-layout` | Small-screen, keyboard, sheet, modal, and permission-safe layout checks. | `npm run e2e:platform-layout` | Manual CI dispatch on self-hosted runner and local | Use targeted simulator/device profiles through `E2E_UDID` or platform selection. |

## Runner Contract

`scripts/run-e2e-local.sh` starts Expo with `E2E=true`, verifies the smoke API health endpoint unless `E2E_SKIP_API_HEALTH=1`, substitutes `${E2E_*}` placeholders in copied Maestro flows, and writes JUnit results to `E2E_RESULTS_PATH`.

Required or commonly used environment variables:

| Variable | Purpose |
| --- | --- |
| `E2E_PLATFORM` | `ios` or `android`; defaults to `ios`. |
| `E2E_UDID` | Optional simulator/device target. |
| `E2E_API_BASE_URL` | Backend API used by auth/smoke flows; defaults to the smoke backend URL. |
| `E2E_SKIP_API_HEALTH` | Set to `1` only when deliberately testing unavailable backend behavior. |
| `E2E_EMAIL`, `E2E_PASSWORD` | Canonical smoke user credentials. |
| `E2E_ALT_EMAIL`, `E2E_ALT_PASSWORD` | Alternate smoke user credentials for account isolation. |
| `E2E_DISPOSABLE_EMAIL`, `E2E_DISPOSABLE_USERNAME`, `E2E_DISPOSABLE_PASSWORD` | Disposable registration user; the release-gate registration flow deletes it before finishing. |
| `E2E_RESULTS_PATH` | JUnit output path. |

## Flow Matrix

| Suite | Flow | File | Coverage | Seed / fixture | CI safety |
| --- | --- | --- | --- | --- | --- |
| `smoke` | Login | `e2e/maestro/smoke/login.yaml` | Dev client launch, smoke login, Home readiness | Smoke backend user | Self-hosted/local |
| `smoke` | Foundation | `e2e/maestro/smoke/foundation.yaml` | Login, add meal, chat, offline banner | Smoke backend user | Self-hosted/local |
| `smoke` | Add meal | `e2e/maestro/smoke/add-meal.yaml` | Manual meal save smoke | Smoke backend user | Self-hosted/local |
| `smoke` | Chat AI | `e2e/maestro/smoke/chat-ai.yaml` | Chat smoke path | Smoke backend user and mock reply env | Self-hosted/local |
| `smoke` | Offline error | `e2e/maestro/smoke/offline-error.yaml` | Forced offline banner | `fitaly://e2e/connectivity` | Self-hosted/local |
| `smoke` | Account launch | `e2e/maestro/smoke/account-launch.yaml` | Account screen navigation | Smoke backend user | Self-hosted/local |
| `smoke` | Auth bootstrap | `e2e/maestro/smoke/auth-bootstrap.yaml` | Login bootstrap and ready state | Smoke backend user | Self-hosted/local |
| `smoke` | Register conflict | `e2e/maestro/smoke/register-conflict.yaml` | Duplicate/invalid registration guard | Smoke backend state | Self-hosted/local |
| `release-gate` | Register and onboarding | `e2e/maestro/release-gate/auth-register-onboarding.yaml` | Register, onboarding, restart session persistence, disposable user cleanup | Disposable user env | Self-hosted/local |
| `release-gate` | Login validation | `e2e/maestro/release-gate/auth-login-validation.yaml` | Login validation and recovery | Smoke backend user | Self-hosted/local |
| `release-gate` | Manual meal propagation | `e2e/maestro/release-gate/add-meal-manual-edit-save-propagates.yaml` | Manual add, review edit, save, Home, History | `activated-user-empty` | Self-hosted/local |
| `release-gate` | Text meal propagation | `e2e/maestro/release-gate/add-meal-text-save-propagates.yaml` | Text AI fixture, Review, save, Home, History | `credits=ok`, `ai=textSuccess` | Self-hosted/local |
| `release-gate` | Photo meal propagation | `e2e/maestro/release-gate/add-meal-photo-save-propagates.yaml` | Camera-safe photo fixture, Review, save, Home, History | `credits=ok`, `ai=photoSuccess` | Self-hosted/local |
| `release-gate` | Barcode meal propagation | `e2e/maestro/release-gate/add-meal-barcode-save-propagates.yaml` | Camera-safe barcode fixture, Review, save, Home, History | `barcode=known` | Self-hosted/local |
| `release-gate` | Saved meal template | `e2e/maestro/release-gate/add-meal-saved-template.yaml` | Save-to-my-meals from Review, then create meal from saved template | `activated-user-empty` | Self-hosted/local |
| `release-gate` | Review edit layout | `e2e/maestro/release-gate/review-edit-layout.yaml` | Review edit details, time picker, ingredient editor, keyboard reachability | `user-with-draft` | Self-hosted/local |
| `release-gate` | History edit/delete | `e2e/maestro/release-gate/history-edit-delete.yaml` | History details, edit, delete, empty state consistency | `user-with-today-meal` | Self-hosted/local |
| `release-gate` | Home/History/Statistics | `e2e/maestro/release-gate/home-history-statistics-after-save.yaml` | Local-first propagation through shared selectors | `activated-user-empty` | Self-hosted/local |
| `release-gate` | Chat history | `e2e/maestro/release-gate/chat-basic-history.yaml` | Legal gate, send, mock reply, history persists after tab switch | `credits=ok`, `chat=success` | Self-hosted/local |
| `release-gate` | Premium and restore success | `e2e/maestro/release-gate/premium-paywall-restore.yaml` | No-credit text meal gate, paywall, restore success mock | `credits=none`, `billing=free`, then `restoreSuccess` | Self-hosted/local |
| `release-gate` | Offline save/sync | `e2e/maestro/release-gate/offline-save-sync.yaml` | Forced offline save, pending badge, reconnect to synced state | `activated-user-empty`, connectivity deep link | Self-hosted/local |
| `release-gate` | Notifications preferences | `e2e/maestro/release-gate/notifications-preferences.yaml` | Account entry, notification settings, permission-safe preference surface | `notificationPermission=denied` or app default | Self-hosted/local |
| `release-gate` | Weekly report entry unavailable | `e2e/maestro/release-gate/weekly-report-entry-unavailable.yaml` | Home/report entry and unavailable state | `weeklyReport=unavailable` | Self-hosted/local |
| `release-gate` | Share save and share | `e2e/maestro/release-gate/share-save-and-share.yaml` | Save-and-share composer path | `shareExport=success` | Self-hosted/local |
| `release-gate` | Account delete cancel | `e2e/maestro/release-gate/account-delete-cancel.yaml` | Destructive delete guard can be cancelled | Smoke backend user | Self-hosted/local |
| `nightly-regression` | Account disposable delete | `e2e/maestro/nightly-regression/account-delete-disposable-user.yaml` | Full disposable account deletion | Disposable user env | Self-hosted/local |
| `nightly-regression` | Reset password | `e2e/maestro/nightly-regression/auth-reset-password.yaml` | Reset request and check-mailbox navigation | Smoke-safe email | Self-hosted/local |
| `nightly-regression` | Chat error | `e2e/maestro/nightly-regression/chat-error-state.yaml` | Chat deterministic transport failure and retry surface | `chat=failure` | Self-hosted/local |
| `nightly-regression` | Chat no credits | `e2e/maestro/nightly-regression/chat-no-credits.yaml` | Empty chat no-credit banner and upgrade navigation | `credits=none`, `billing=free` | Self-hosted/local |
| `nightly-regression` | Credits none text meal | `e2e/maestro/nightly-regression/credits-none-text-meal.yaml` | Text meal no-credit explanation and upgrade path | `credits=none`, `billing=free` | Self-hosted/local |
| `nightly-regression` | Billing restore failure | `e2e/maestro/nightly-regression/billing-restore-failure.yaml` | Restore failure feedback without real billing | `billing=restoreFailure` | Self-hosted/local |
| `nightly-regression` | Billing entitlement states | `e2e/maestro/nightly-regression/billing-entitlement-states.yaml` | Free and premium access rows on manage subscription | `billing=free`, then `billing=premium` | Self-hosted/local |
| `nightly-regression` | Text meal AI failure | `e2e/maestro/nightly-regression/text-meal-ai-failure.yaml` | AI analysis failure returns to Describe Meal with error and CTA | `ai=failure` | Self-hosted/local |
| `nightly-regression` | Barcode not found | `e2e/maestro/nightly-regression/barcode-not-found.yaml` | Manual barcode lookup not found state without camera | `barcode=unknown` | Self-hosted/local |
| `nightly-regression` | Offline failed/conflict states | `e2e/maestro/nightly-regression/offline-failed-conflict-states.yaml` | Visible failed and conflict meal badges in Home and History | `user-with-failed-meal`, `user-with-conflict-meal` | Self-hosted/local |
| `nightly-regression` | Reminders disabled | `e2e/maestro/nightly-regression/reminders-disabled-state.yaml` | Disabled/degraded reminder state | `reminder=disabled` | Self-hosted/local |
| `nightly-regression` | Weekly report ready | `e2e/maestro/nightly-regression/weekly-report-open.yaml` | Ready weekly report sections | `weeklyReport=available` | Self-hosted/local |
| `nightly-regression` | Share customize | `e2e/maestro/nightly-regression/share-customize-basic.yaml` | Share composer customization basics | `shareExport=success` | Self-hosted/local |
| `nightly-regression` | Share export error | `e2e/maestro/nightly-regression/share-export-error.yaml` | Export/share error state | `shareExport=failure` | Self-hosted/local |
| `nightly-regression` | Share invalid no photo | `e2e/maestro/nightly-regression/share-invalid-no-photo.yaml` | Share composer invalid/no-photo guard | `user-with-today-meal` | Self-hosted/local |
| `platform-layout` | Small-screen forms | `e2e/maestro/platform-layout/small-screen-forms.yaml` | Review form, ingredient editor, fixed footer reachability | `user-with-draft` | Manual self-hosted/local |
| `platform-layout` | Text meal keyboard | `e2e/maestro/platform-layout/text-meal-keyboard.yaml` | Text meal inputs and CTA remain reachable with keyboard | `activated-user-empty`, `ai=textSuccess` | Manual self-hosted/local |
| `platform-layout` | Chat long input keyboard | `e2e/maestro/platform-layout/chat-long-input-keyboard.yaml` | Chat composer growth and send action reachability | `credits=ok`, `chat=success` | Manual self-hosted/local |
| `platform-layout` | Barcode manual sheet | `e2e/maestro/platform-layout/barcode-manual-sheet.yaml` | Manual barcode bottom sheet compression and actions | `barcode=unknown` | Manual self-hosted/local |
| `platform-layout` | Paywall open layout | `e2e/maestro/platform-layout/paywall-open-layout.yaml` | Paywall modal root and primary/restore actions are visible | `credits=none`, `billing=restoreFailure` | Manual self-hosted/local |

## Selector Contract

New Maestro assertions should use stable `testID` selectors. Translated text is acceptable only when the test is explicitly validating copy. Reusable components should accept a `testID` prop when they expose one of these critical surfaces:

| Surface | Required selectors |
| --- | --- |
| Screen root | `<surface>-screen` |
| Inputs | `<surface>-<field>-input` |
| Primary CTA | `<surface>-<action>-button` |
| Close/back | Explicit close/back testID when the flow must assert escape behavior |
| Sheet/modal root | `<surface>-sheet` or `<surface>-modal` |
| Error/disabled state | `<surface>-error`, `<surface>-disabled-reason`, or a more specific suffix |
| Empty state | `<surface>-empty-state` plus escape CTA when applicable |
| Rows/items | Stable domain IDs when available; index IDs are acceptable only for deterministic single-item fixtures |
| Sync state | `home-meal-sync-<state>-<index>`, `history-meal-sync-<state>-<index>`, or detail-specific equivalents |

Recent selector/testability additions:

| Selector | File | Reason |
| --- | --- | --- |
| `chat-credits-banner` and `chat-credits-banner-action-button` on empty no-credit chat | `src/feature/AI/screens/ChatScreen.tsx`, `src/feature/AI/components/ChatStatusBanner.tsx` | Allows deterministic no-credit chat gate without sending a prompt. |
| `manage-subscription-action-feedback-<tone>` | `src/feature/Subscription/screens/ManageSubscriptionScreen.tsx` | Allows billing restore failure/success feedback assertions. |
| `manage-subscription-tier-value-<tier>` | `src/components/SettingsRow.tsx`, `src/feature/Subscription/screens/ManageSubscriptionScreen.tsx` | Allows billing free/premium assertions without translated text selectors. |
| `add-meal-text-error` | `src/feature/Meals/screens/MealAdd/DescribeMealScreen.tsx` | Allows AI analysis failure assertions after returning from analyzing. |
| Barcode E2E simulation for all barcode fixture states | `src/feature/Meals/screens/MealAdd/BarcodeScanScreen.tsx` | Allows known, not-found, invalid, and offline barcode states without camera permissions. |

## E2E Fixture Contract

All fixture paths are fail-closed behind `E2E=true`. Outside E2E mode, `getE2EFixtureState()` returns `null`, deep links do nothing, and production SDK/backend paths remain canonical.

Seed deep link:

```text
fitaly://e2e/seed?fixture=activated-user-empty&credits=ok&ai=textSuccess
```

Supported seed keys:

| Key | Values |
| --- | --- |
| `fixture` | `activated-user-empty`, `user-with-today-meal`, `user-with-photo-meal`, `user-with-saved-meals`, `user-with-draft`, `user-with-failed-meal`, `user-with-conflict-meal` |
| `credits` | `ok`, `low`, `none` |
| `ai` | `textSuccess`, `photoSuccess`, `failure`, `timeout`, `insufficientCredits` |
| `barcode` | `known`, `unknown`, `invalid`, `offline` |
| `billing` | `free`, `premium`, `restoreSuccess`, `restoreFailure` |
| `chat` | `success`, `failure` |
| `shareExport` | `success`, `failure`, `permissionDenied`, `shareUnavailable` |
| `notificationPermission` | `allowed`, `denied` |
| `reminder` | `send`, `suppress`, `noop`, `disabled` |
| `weeklyReport` | `available`, `unavailable`, `disabled`, `forbidden` |

Status IDs are emitted as `e2e-ready-<key>-<value>`, for example `e2e-ready-ai-failure`. Connectivity can be forced with:

```text
fitaly://e2e/connectivity?offline=1
fitaly://e2e/connectivity?offline=0
```

## CI Classification

| Workflow | What it runs | Runner | Blocking intent |
| --- | --- | --- | --- |
| `.github/workflows/e2e-smoke-gate.yml` | `e2e:smoke:foundation`, `e2e:smoke:account-launch` | self-hosted | Blocks smoke gate and release candidate workflow dependency. |
| `.github/workflows/e2e-regression.yml` | `release-gate` on release branches/manual, `nightly-regression` on schedule/manual, `platform-layout` on manual dispatch | self-hosted | Release branches block only on `release-gate`; nightly/platform are broader diagnostics. |
| `.github/workflows/release-candidate.yml` | Mobile/backend CI, smoke E2E, release-gate E2E, backend smoke contracts, release evidence | self-hosted for Maestro, hosted for non-device jobs | Blocks release candidate evidence. |
| `.eas/workflows/e2e-maestro.yml` | Android smoke flows | EAS nested virtualization | Optional smoke validation for Android build artifacts. |

## Known Gaps

| Gap | Reason | Risk | Recommended action |
| --- | --- | --- | --- |
| Native OS permission prompts are not a hard gate. | Permission prompts vary by simulator state and platform. Current platform-layout flows prefer E2E fixture surfaces over OS dialogs. | Store-submission-only regressions may need manual confirmation. | Keep fixture assertions in Maestro and run manual OS prompt checks before store submission. |
| Screenshot baselines are not canonical. | Mechanical visibility/reachability assertions are the current gate. | Visual polish regressions still require manual review. | Add optional local screenshot flows only for high-risk surfaces after mechanical selectors are exhausted. |
| Nightly report/reminder backend smoke remains mostly fixture-driven in Maestro. | Backend-owned contract checks live in smoke flow scripts and backend CI. | Maestro may not catch backend contract drift alone. | Keep backend smoke contract workflow in release-candidate and add mobile contract tests when API shape changes. |
