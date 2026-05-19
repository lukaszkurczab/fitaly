# E2E Test Matrix and Selector Contract

## Current State

Confirmed from the mobile repo on 2026-05-18:

- Maestro flows live in `e2e/maestro`.
- The local runner is `scripts/run-e2e-local.sh`.
- Package scripts expose `npm run e2e`, foundation/auth/add-meal smoke scripts, P0/P1 account lifecycle scripts, P0 Add Meal scripts, P0/P2 layout scripts, P0/P1 chat and paywall scripts, and `e2e:offline-error`.
- `.github/workflows/e2e-smoke-gate.yml` runs `foundation-smoke.yaml` and `account-launch-smoke.yaml` on a self-hosted runner. `.github/workflows/release-candidate.yml` calls that smoke gate.
- Current Maestro coverage is smoke-level only:
  - `login.yaml`: reset, login, land on Home.
  - `auth-bootstrap.yaml`: login, logout, login again, app restart session persistence.
  - `register-conflict.yaml`: registration username conflict validation.
  - `add-meal.yaml`: login, open Add Meal, choose manual, save, return Home.
  - `chat-ai.yaml`: login, accept chat legal gate if present, send one message, assert AI response.
  - `offline-error.yaml`: force E2E offline mode and assert offline banner.
  - `foundation-smoke.yaml`: combines login, manual meal save, chat mock, and offline banner.
  - `account-launch-smoke.yaml`: navigates key Account/Profile sub-screens.
- E2E runtime support is guarded by `E2E=true` through `app.config.js`, `src/services/e2e/config.ts`, `src/services/e2e/deepLink.ts`, `src/services/e2e/status.tsx`, and `src/services/e2e/connectivity.ts`.
- The current E2E reset link is `fitaly://e2e/reset` with `logout` and `offline` flags. It clears local offline storage and `AsyncStorage`, can sign out, and exposes hidden status IDs such as `e2e-booted`, `e2e-ready-login`, `e2e-ready-home`, and `e2e-ready-offline`.
- Existing product surfaces are under `src/feature/Auth`, `Onboarding`, `Meals`, `Home`, `History`, `Statistics`, `AI`, `Subscription`, and `UserProfile`.

## Strategy

Automated E2E should cover functional behavior. Manual QA should be limited to subjective visual polish, copy feel, device-specific visual review, and final App Store / Play Store asset review.

Priority levels:

- `P0 release-gate`: must pass before release candidate approval. These flows protect account access, onboarding, meal logging, local-first propagation, payment gates, offline/sync basics, and high-risk runtime guards.
- `P1 nightly regression`: runs on schedule and before major release branches. These flows broaden functional coverage for secondary paths, edits, filters, reports, settings, and repeated-use behavior.
- `P2 platform/layout/permission`: runs on targeted device/platform matrices or before store submission. These flows focus on iOS/Android permission prompts, keyboard/sheet layout, occlusion, and platform-specific sharing/camera behavior.

## Runner Contract

- Use `scripts/run-e2e-local.sh <flow-or-directory>` as the canonical local runner.
- The runner starts Expo with `CI=1 E2E=true`, injects `EXPO_PUBLIC_API_BASE_URL`, waits for Metro, primes the dev client, copies flow files to a temp directory, substitutes `__E2E_EXPO_URL__` and `${E2E_*}` variables, then runs `maestro test`.
- Default smoke API is `https://fitaly-backend-smoke.up.railway.app`.
- Override only through documented E2E env vars: `E2E_PLATFORM`, `E2E_EXPO_PORT`, `E2E_EXPO_HOST`, `E2E_RESULTS_PATH`, `E2E_UDID`, `E2E_API_BASE_URL`, `E2E_EXPO_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_ALT_EMAIL`, `E2E_ALT_PASSWORD`, `E2E_CONFLICT_USERNAME`, `E2E_REGISTER_EMAIL`, and `E2E_REGISTER_PASSWORD`.
- Keep smoke flows deterministic. Network-dependent flows must use smoke backend accounts or explicit E2E mocks; they must not depend on personal accounts.

## Fixture and Mock Rules

- E2E-only fixtures, deep links, overlays, network overrides, AI mock replies, fake connectivity, seeded profile data, and permission shortcuts must be guarded by `E2E=true`.
- E2E guards must fail closed: when `E2E=true` is absent, the code path must be inert and must not affect production runtime.
- Do not add kill switches as hidden fallbacks to old architecture. Kill switches are allowed only for AI, reminders, weekly reports, payments, or costly backend surfaces.
- E2E mocks should simulate external boundaries, not replace canonical app state propagation. For meals, tests must still assert local-first writes and shared selector propagation through Home, History, and Statistics.
- Deterministic seed links supported by the current harness include fixture, credits, AI meal analysis, barcode, billing, and chat states, for example `fitaly://e2e/seed?credits=ok&chat=success`, `chat=failure`, `billing=free`, `billing=premium`, `billing=restoreSuccess`, and `billing=restoreFailure`. These states are inert unless `E2E=true`.

## Maestro Naming

Use this file naming convention:

- `p0-<surface>-<behavior>.yaml` for release gates.
- `p1-<surface>-<behavior>.yaml` for nightly regressions.
- `p2-<surface>-<behavior>-<platform-or-layout>.yaml` for platform, permission, and layout coverage.
- Shared helper flows use `_helper-<purpose>.yaml`.
- Current smoke files can remain while coverage is being expanded, but new launch-grade flows should use the priority prefix.

Examples:

- `p0-auth-login-session.yaml`
- `p0-add-meal-manual-save-propagates.yaml`
- `p1-history-filter-edit-delete.yaml`
- `p2-add-meal-text-keyboard-occlusion-ios.yaml`
- `_helper-login-smoke-user.yaml`

## Selector Contract

Use `testID` selectors instead of translated text whenever possible. Text selectors are allowed only for verifying copy-specific behavior or while a missing `testID` is being added in the same change set.

Recommended `testID` format:

- Stable, lowercase kebab-case.
- Prefix by surface or component owner: `login-*`, `register-*`, `onboarding-*`, `meal-add-*`, `review-meal-*`, `home-*`, `history-*`, `statistics-*`, `chat-*`, `paywall-*`, `notifications-*`, `weekly-report-*`, `share-*`, `account-*`, `settings-*`, `e2e-*`.
- Screen roots use `<surface>-screen`, for example `history-list-screen` or `statistics-screen`.
- Primary CTAs use `<surface>-primary-button` only when there is one clear primary action; otherwise name the action, for example `review-meal-save-button`.
- Repeated rows use semantic IDs where stable, for example `history-meal-row-${mealId}` or `saved-meal-add-${mealId}`. Avoid index-only IDs except for static controls.
- Modal and sheet roots use `<surface>-sheet` or `<surface>-modal`.
- Inputs use `<surface>-<field>-input`.
- Toggles and checkboxes use `<surface>-<setting>-toggle` or `<surface>-<setting>-checkbox`.
- Error and state banners use `<surface>-<state>-banner`, for example `chat-disabled-banner` or `offline-banner`.

Current confirmed selectors already used by Maestro include:

- Auth: `login-email-input`, `login-password-input`, `login-submit-button`, `login-register-link`, `register-username-input`, `register-email-input`, `register-password-input`, `register-confirm-password-input`, `register-password-visibility-toggle`, `register-confirm-password-visibility-toggle`, `register-terms-checkbox`, `register-submit-button`.
- Tabs: `tab-home`, `tab-statistics`, `tab-add-meal`, `tab-chat`, `tab-profile`.
- Add Meal / Review: `meal-add-option-manual`, `meal-add-option-photo`, `meal-add-option-text`, `meal-add-option-barcode`, `meal-add-option-saved`, `review-meal-save-button`, `review-meal-close`, `review-meal-photo`, `meal-name-input`, `barcode-manual-input`, `ingredient-editor-sheet`.
- Chat: `chat-input`, `chat-send-button`, `chat-message-ai`, `chat-message-user`, `chat-legal-accept`, `chat-disabled-banner`, `chat-context-unavailable-banner`, `chat-error-state`, `chat-retry-button`, `chat-credits-banner`, `chat-credits-banner-action-button`.
- Account / settings: `account-profile-details-row`, `profile-details-screen`, `profile-photo-screen`, `username-change-screen`, `email-change-screen`, `password-change-screen`, `manage-subscription-screen`, `legal-privacy-screen`, `data-ai-clarity-screen`, `help-feedback-screen`, `contact-support-screen`, `send-feedback-screen`, `app-settings-screen`, `notifications-screen`, `delete-account-screen`.
- Runtime: `e2e-booted`, `e2e-ready-login`, `e2e-ready-home`, `e2e-ready-offline`, `offline-banner`.

Additional launch-grade selectors added for new Maestro flows include:

- Auth reset/check mailbox: `login-screen`, `login-forgot-password-link`, `reset-password-screen`, `reset-password-email-input`, `reset-password-submit-button`, `check-mailbox-screen`, `check-mailbox-login-button`, `check-mailbox-send-again-button`.
- Onboarding: `onboarding-screen`, `onboarding-loading-state`, `onboarding-step-1`, `onboarding-age-input`, `onboarding-height-input`, `onboarding-weight-input`, `onboarding-step-1-next-button`, `onboarding-step-2`, `onboarding-preferences-dropdown`, `onboarding-activity-dropdown`, `onboarding-goal-picker`, `onboarding-step-3`, `onboarding-lifestyle-notes-input`, `onboarding-step-4`, `onboarding-step-4-submit-button`, `onboarding-confirm-modal`.
- Add Meal text/photo/barcode: `add-meal-text-screen`, `add-meal-text-name-input`, `add-meal-text-description-input`, `add-meal-text-analyze-button`, `add-meal-photo-screen`, `add-meal-photo-capture-button`, `barcode-scan-screen`, `barcode-open-manual-button`, `barcode-manual-sheet`, `barcode-manual-submit-button`.
- Review/edit: `review-meal-screen`, `review-meal-edit-button`, `review-meal-save-share-button`, `review-meal-save-to-my-meals-checkbox`, `meal-details-form-screen`, `meal-type-picker-trigger`, `meal-time-picker-trigger`, `ingredient-row-0`, `ingredient-add-button`, `ingredient-editor-name-input`, `ingredient-editor-submit-button`.
- Home/History/Statistics: `home-screen`, `home-today-meals-list`, `home-today-meal-row-0`, `home-empty-state`, `history-list-screen`, `history-meal-row-0`, `history-meal-details-screen`, `history-meal-edit-button`, `history-meal-delete-button`, `statistics-screen`, `statistics-range-7d-button`, `statistics-empty-state-no_history`, `statistics-premium-banner`.
- Chat/premium/notifications/weekly/share/account: `chat-screen`, `chat-legal-modal`, `paywall-modal`, `paywall-restore-button`, `manage-subscription-primary-button`, `manage-subscription-status-row`, `manage-subscription-tier-row`, `add-meal-text-credits-explanation`, `notifications-smart-reminders-toggle`, `weekly-report-screen`, `weekly-report-refresh-button`, `share-mode-quick-button`, `share-mode-customize-button`, `share-save-gallery-button`, `share-system-share-button`, `account-screen`, `delete-account-password-input`, `delete-account-confirm-button`.

Missing selector contract items should be added before or with new flows. Do not write new Maestro flows that depend on translated Polish or English labels when the UI control can expose a stable `testID`.

## Layout and Occlusion Rule

Layout/occlusion tests must assert visibility and interactability of inputs, sheets, and CTAs after keyboard and sheet interactions.

These are functional layout tests, not screenshot or per-pixel visual tests. They should fail when a user cannot reach an active field, bottom sheet action, fixed footer CTA, modal dismissal, or save/submit action. They should not assert exact spacing, colors, typography, or visual polish; those remain manual QA scope unless a stable semantic state can be asserted.

Required checks:

- Focus an input, type, and assert the submit/continue CTA is visible and tappable.
- Open bottom sheets and modals, scroll if needed, then assert close, primary, and destructive actions remain visible and tappable.
- On small-screen profiles, assert keyboard does not cover login/register/onboarding/add-meal/chat inputs or primary CTAs.
- For Add Meal review/edit, assert ingredient editor, time/type pickers, save CTA, and save-and-share CTA remain reachable after sheet interactions.
- Run layout flows on iOS and Android when permissions, keyboard behavior, camera, date/time picker, share sheet, or notification settings differ by platform.

Current functional layout flows:

- `e2e/maestro/p0/review-edit-layout.yaml`: release-gate coverage for Review Meal -> Edit details, time picker sheet reachability, ingredient editor keyboard reachability, submit, save, Home, and History propagation.
- `e2e/maestro/p2/layout-small-screen-forms.yaml`: small-screen profile coverage for long meal/ingredient names and fixed footer reachability. Run this on a small simulator/device profile through the runner's `E2E_UDID` or platform-specific device selection.

## Matrix

| Surface | Priority | Flow | Current Maestro Coverage | Missing / Required Coverage |
| --- | --- | --- | --- | --- |
| Auth | P0 | Login with smoke user, logout, login again, restart with persisted session | Partial: `login.yaml`, `auth-bootstrap.yaml` | Convert to `p0-auth-login-session.yaml`; assert loading settles, Home tab is interactable, logout confirmation uses IDs only. |
| Auth | P0 | Register validation and duplicate username/email handling | Partial: `register-conflict.yaml` | Add duplicate email, weak password, terms unchecked, keyboard occlusion, and successful disposable registration cleanup path where backend supports it. |
| Auth | P1 | Reset password and check-mailbox navigation | None confirmed | Add reset request happy path with smoke-safe account and invalid email validation. |
| Onboarding | P0 | First-run onboarding completion creates ready profile and enters Home | None confirmed | Add full flow across basic data, preferences, health, AI preferences, consent/readiness gates. Must use E2E seeded or disposable user and assert Home ready. |
| Onboarding | P1 | Resume/refill onboarding after interruption | None confirmed | Restart mid-flow, assert saved fields, complete without duplicate profile state. |
| Onboarding | P2 | Keyboard/layout for numeric fields and dropdowns | None confirmed | Assert age, height, weight, selectors, and CTAs remain visible/tappable on small iOS and Android viewports. |
| Add Meal: manual | P0 | Manual save propagates immediately to Home, History, and Statistics | Partial: `add-meal.yaml`, `foundation-smoke.yaml` only assert return Home | Add canonical flow: Add tab -> manual -> review -> save -> Home today list/totals -> History row -> Statistics aggregate. Must validate local-first state, pending/failed/conflict indicators where applicable. |
| Add Meal: text | P0 | Text meal AI analysis to review/save | None confirmed | Add E2E-safe AI fixture guarded by `E2E=true`; assert text input, analyzing state, review contents, save, propagation. |
| Add Meal: photo | P0 | Photo capture or fixture analysis to review/save | None confirmed | Add E2E camera/photo fixture guarded by `E2E=true`; cover permission granted path and review/save propagation. |
| Add Meal: barcode | P0 | Barcode scan/manual-code lookup to review/save | None confirmed | Add deterministic barcode fixture or smoke product code; assert manual sheet, lookup result, review, save, propagation. |
| Add Meal: saved | P0 | Save reusable meal and add from saved meal | None confirmed | Add save-to-my-meals path from review, then saved meal picker add path. Assert saved template appears and new logged meal is created. |
| Add Meal: draft recovery | P1 | Resume/discard in-progress draft | None confirmed | Create draft, leave flow, return, assert resume sheet, resume path, discard path. |
| Add Meal: failures | P1 | AI failure, barcode not found, offline save queue | Partial offline banner only | Add visible failure/retry states and queued local save behavior. No backend refetch fallback. |
| Add Meal: layout | P2 | Keyboard/sheet occlusion in text/manual/review/barcode | Added: `p2/layout-small-screen-forms.yaml` covers review edit form and ingredient editor on a small-screen profile | Add text input, barcode manual input sheet, and platform-specific permission layout coverage. |
| Review/Edit | P0 | Review edit name/type/time/ingredients before save | Added: `p0/review-edit-layout.yaml` covers draft resume, edit details, time picker, ingredient editor keyboard reachability, save, Home, and History propagation | Add value-level edit assertions and History details edit/delete coverage. |
| Review/Edit | P1 | Edit/delete historical meal | None confirmed | Open History meal details, edit fields, assert Home/History/Statistics update; delete and assert removal across selectors. |
| Home | P0 | Today state after meal save and offline pending state | Partial return Home only | Assert hero/totals/today meals list from shared local selectors, pending/failed/conflict states, and Add CTA/method selector. |
| Home | P1 | Weekly progress and coach insight card interactions | None confirmed | Assert weekly progress graph states, coach insight CTA opens Add Meal, empty day state. |
| History | P0 | Saved meal appears in History after local save | None confirmed | Assert row, day grouping by `dayKey`, details navigation, pending/failed/conflict indicators. |
| History | P1 | Filters, pagination/refresh, saved meals list | None confirmed | Add date/type/filter flows, saved meals duplicate/edit/delete, pull-to-refresh if supported. |
| Statistics | P0 | Statistics aggregate updates after local save | None confirmed | Assert daily/range totals after saving known fixture meal. Must share same dayKey model as Home/History. |
| Statistics | P1 | Range switcher, custom range, premium/limited state | None confirmed | Assert 7/30/custom ranges, empty state, limited history CTA/paywall behavior. |
| AI Chat | P0 | Legal gate, send prompt, receive E2E mock reply, return later with history intact | Added: `p0/chat-basic-history.yaml`; legacy `chat-ai.yaml` and `foundation-smoke.yaml` still cover basic smoke | Add new thread/history sheet management and long-message keyboard layout. |
| AI Chat | P1 | Chat transport failure and retry/error state | Added: `p1/chat-error-state.yaml` with `chat=failure` and no persisted assistant reply | Add credits-low warning and gateway/context-unavailable variants. |
| AI Chat | P2 | Keyboard occlusion and long message layout | None confirmed | Assert composer/send button visibility after long input and keyboard open on small screens. |
| Premium/Paywall | P0 | Paywall opens from gated Add Meal text path and restore is safe | Added: `p0/premium-paywall-restore.yaml` with `billing=free` then `billing=restoreSuccess`; RevenueCat is bypassed under `E2E=true` | Add subscribe-success mock and close/legal-link paths. |
| Premium/Paywall | P1 | Manage subscription screen, entitlement state display, credits-none meal gate | Added: `p1/credits-none-text-meal.yaml` for no-credits Add Meal text upgrade to paywall | Add restore failure and billing premium/free row assertions. |
| Notifications/Reminders | P0 | Notifications settings toggles and permission request path | Partial account nav reaches screen | Add notification screen state, permission CTA, not-now path, reminder toggle persistence, no ghost schedules when denied. |
| Notifications/Reminders | P1 | Smart reminder decision/scheduling smoke | None confirmed in Maestro; unit coverage exists | Add E2E fixture for backend decision guarded by `E2E=true`, assert scheduled/suppressed/noop user-visible state where exposed. |
| Notifications/Reminders | P2 | iOS/Android permission prompt handling | None confirmed | Platform flows for denied/granted/system settings paths. |
| Weekly Reports | P0 | Weekly report entry from Home and unavailable/locked state | None confirmed | Assert weekly report card/screen, loading, locked/403 or ready state using smoke backend contract. |
| Weekly Reports | P1 | Refresh and ready report content sections | None confirmed | Assert refresh action, summary/insights/recommendations sections with deterministic fixture. |
| Share | P0 | Save-and-share opens share composer from meal review/details | None confirmed | Add review save-and-share or History details share path; assert composer opens and export/share CTA is interactable. |
| Share | P1 | Customize composer layers/presets | None confirmed | Assert preset selection, text/card/chart/photo tools, color picker, reset, close without data loss. |
| Share | P2 | Native share sheet/platform permissions | None confirmed | iOS/Android share sheet smoke, screenshot/export layout, cancel path. |
| Account/Settings | P0 | Account navigation and logout/delete-account guard | Partial: `account-launch-smoke.yaml` | Keep as P0 or P1 depending release gate scope; add asserts for destructive confirmation, no accidental delete. |
| Account/Settings | P1 | Profile details, username/email/password forms, language, legal/help/feedback | Partial navigation only | Add form validation, keyboard layout, submit/cancel paths with smoke-safe fixtures. |
| Offline/Sync | P0 | Forced offline banner and local-first meal queue | Partial: `offline-error.yaml`, `foundation-smoke.yaml` banner only | Add save while offline, visible pending state, reconnect, synced state. Must not use backend refetch/timestamp fallback for immediate UI consistency. |
| Offline/Sync | P1 | Retry/failure/conflict surfaces | None confirmed | Add queued retry, failed operation, conflict indicator, dead-letter/user recovery if exposed. |
| Telemetry smoke | P0 | Telemetry client initializes safely and critical events do not block UX | None confirmed in Maestro; unit tests exist under telemetry services | Add E2E-safe telemetry sink guarded by `E2E=true`; assert login/add meal/chat/paywall actions continue when telemetry is disabled or sink fails. |
| Telemetry smoke | P1 | Navigation/session event smoke | None confirmed | Add smoke assertions through E2E sink or logs, without exposing personal data. |

## P0 Release Gate Set

Build this set before expanding lower-priority flows:

1. `p0-auth-login-session.yaml`
2. `p0-onboarding-first-run-ready-profile.yaml`
3. `p0-add-meal-manual-save-propagates.yaml`
4. `p0-add-meal-text-save-propagates.yaml`
5. `p0-add-meal-photo-save-propagates.yaml`
6. `p0-add-meal-barcode-save-propagates.yaml`
7. `p0-add-meal-saved-template.yaml`
8. `p0-review-edit-save-propagates.yaml`
9. `p0-history-details-edit-delete.yaml`
10. `p0-statistics-after-save.yaml`
11. `p0/chat-basic-history.yaml`
12. `p0/premium-paywall-restore.yaml`
13. `p0-notifications-settings.yaml`
14. `p0-weekly-report-entry.yaml`
15. `p0-share-meal-composer.yaml`
16. `p0-offline-save-sync.yaml`
17. `p0-telemetry-smoke.yaml`

## P1 Nightly Regression Set

Run nightly and on release branches after P0 is stable:

- Auth reset/check-mailbox.
- Onboarding resume/refill.
- Add Meal draft recovery and failure/retry paths.
- History filters, saved meal management, pagination/refresh.
- Statistics ranges and limited/premium states.
- AI chat error/retry variants, new thread, credits/gateway errors.
- Manage subscription, restore failure, billing free/premium entitlement states, and `p1/credits-none-text-meal.yaml`.
- Smart reminder decision/scheduling fixture.
- Weekly report ready/refresh states.
- Share composer customization.
- Account/settings form validation and language/legal/help/feedback paths.
- Offline retry/failure/conflict recovery.
- Telemetry navigation/session smoke.

## P2 Platform/Layout/Permission Set

Run on targeted iOS and Android device profiles:

- Login/register/onboarding keyboard occlusion.
- Add Meal text/manual/review/barcode bottom sheet and keyboard occlusion.
- Chat long-input keyboard occlusion.
- Camera/photo permission granted/denied/limited paths.
- Barcode camera permission paths.
- Notification permission granted/denied/system settings paths.
- Native share sheet open/cancel/export paths.
- Date/time picker platform behavior.
- Small-screen and large-font layout for inputs, sheets, and CTAs.

## Manual QA Scope

Manual QA should not be the primary validator for functional behavior listed above. After P0/P1/P2 automation is in place, manual QA should focus on:

- Subjective visual polish.
- Copy tone and localization feel.
- Final App Store / Play Store screenshots, preview assets, and metadata.
- Exploratory checks around animation feel and device-specific polish that is not practical to assert deterministically.
