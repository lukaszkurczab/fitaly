# UX/UI Maestro Release-Hardening Loop

## Goal

This document tracks the UX/UI Maestro release-hardening process for Fitaly.

Paths 1–17 were reviewed path-by-path and are now only provisional historical evidence.

The current active goal is Path 18: perform a fresh final cross-path UX/UI release gate using current repo state, fresh test results, fresh screenshots, shared-component regression checks, and strict premium visual review before declaring Go / No-Go.

## Confirmed Repo Facts

- App repo: `/Users/lukaszkurczab/Desktop/Projects/Fitaly/fitaly`.
- E2E runner: `scripts/run-e2e-local.sh`.
- Suite runner: `scripts/e2e/run-suite.mjs`.
- Visual-audit runner: `scripts/e2e/run-visual-suite.mjs`.
- Suite map: `scripts/e2e/suites.json`.
- Package scripts:
  - `npm run e2e:release-gate`
  - `npm run e2e:smoke`
  - `npm run e2e:auth`
  - `npm run e2e:add-meal`
  - `npm run e2e:home-history-statistics`
  - `npm run e2e:ai-chat`
  - `npm run e2e:premium-billing`
  - `npm run e2e:notifications-retention`
  - `npm run e2e:share`
  - `npm run e2e:platform-layout`
  - `npm run e2e:visual-audit`
  - `npm run e2e:full-review`
- Visual-audit screenshots: `e2e/artifacts/visual-audit/<runId>/screenshots`.
- Latest visual-audit pointer: `e2e/artifacts/visual-audit/latest`.
- Default E2E platform: iOS unless `E2E_PLATFORM` overrides it.

## Definition Of 9/10 Quality

A path is 9/10 only when it passes the relevant Maestro flow, post-fix screenshots show no obvious regression, the user understands the next step, the primary CTA is visible and logical, layout does not break on reviewed viewports, inputs and bottom actions are not blocked by keyboard/sheets, loading/empty/error/success states are understandable, the flow ends in the expected domain state, and the UI feels like one calm premium-lite Fitaly product. No Blocker or Major issue may remain.

## Issue Classification

- Blocker: flow cannot be completed, crash, failed save, dead end, broken entitlement/account deletion, critical screen cannot be closed, or core data does not propagate.
- Major: flow works but with clear friction, unclear or hidden CTA, misleading copy, broken Home/History/Statistics propagation, redundant blocking sheet/modal, difficult layout, unclear state, or noticeably unfinished UI.
- Minor: small layout inconsistency, spacing/copy/feedback issue, component works but is not fully consistent.
- Polish: microcopy, subtle spacing/rhythm/color/radius/typography refinement that improves perceived quality.
- Environment Blocker: verification blocked by local simulator, credentials, network, backend health, permissions, missing command, or unavailable service.

## UX/UI Checklist

- Clear visual focus and one dominant next action.
- Primary actions use olive; terracotta stays secondary/warm/AI accent.
- Warm neutral surfaces, restrained typography, no random bright colors.
- No dashboard clutter, aggressive fitness tone, temporary-looking cards, or developer placeholders.
- CTA placement is visible, logical, and reachable.
- Inputs have adequate touch targets and keyboard-safe behavior.
- Empty/loading/error/success states feel designed and helpful.
- Modals/sheets have clear purpose, closure, height, spacing, and actions.
- Copy is short, calm, functional, non-judgmental, and natural.
- Data presentation is clean, legible, and consistent with macro color semantics.

## Technical Checklist

- Inspect real files, imports, tests, scripts, configs, and existing patterns before edits.
- Confirm canonical path and check duplicate/legacy/fallback code before changing behavior.
- Keep fixes local and small unless architecture requires owner decision.
- Use existing components, i18n keys, theme tokens, and stable semantic `testID`s.
- Do not hardcode colors when tokens exist.
- Do not add hidden fallbacks to old architecture.
- Run relevant typecheck/lint/tests and targeted Maestro after changes when environment allows.
- Check no unused code, debug UI, or `console.log` remains.
- For Add Meal, preserve `entry -> processing/lookup -> Review Meal -> save`.
- For meal propagation, preserve local-first/dayKey/shared selector canonical model.

## Screenshot Review Checklist

- Clear point of gravity and next step.
- CTA visible without hunting.
- No clipped text, broken long Polish words, or crowded typography.
- Keyboard does not cover inputs or CTA.
- Sheet/modal spacing and actions are clean.
- Empty state looks designed, not missing.
- Loading state communicates progress.
- Error state gives a route out.
- Buttons expose pressed/disabled/loading state.
- Header, content, and bottom actions have balanced proportions.
- Touch targets are large enough.
- No duplicated icons, buttons, or messages.
- Screen matches Fitaly premium-lite visual direction.

## Score Integrity Rules

A 9/10 score must be earned, not assigned by default.

During final review:

- Re-score each path independently.
- Do not preserve previous 9/10 scores automatically.
- If a screen is functionally correct but visually average, score it 8/10 or 8.5/10.
- If a screen has accepted Minor/Polish issues that affect perceived premium quality, it cannot remain 9/10.
- If the path has only non-visible technical/test polish, it may remain 9/10.
- If the path contains visible accepted polish, explain why it does not reduce premium perception.

Use the following interpretation:

- 10/10: exceptional, store-screenshot quality, no meaningful polish left.
- 9/10: launch-ready premium-lite quality; only invisible or truly negligible polish remains.
- 8/10: functionally ready but visible polish still needed before premium-quality launch.
- 7/10 or lower: not launch-ready.

## Anti-Confirmation Bias Instruction

During Path 18, do not use previous Ready statuses as evidence that the app is ready.

Previous path notes are historical context only. They may help identify changed files and known risk areas, but they must not justify keeping a 9/10 score.

The final verdict must be based on:

- fresh final test results,
- fresh final screenshots,
- current repository state,
- current shared-component behavior,
- strict premium visual review.

If the fresh final evidence contradicts previous path notes, trust the fresh evidence.

## Accepted Visible Polish

This section must remain empty until Path 18 has completed fresh final screenshot review.

Do not pre-fill this section from historical path notes.

A visible polish issue may be accepted only if it is genuinely negligible and does not weaken trust, readability, hierarchy, perceived premium quality, or launch presentation.

For each accepted item, document:

- screen/path,
- screenshot path,
- issue,
- classification,
- why it is accepted,
- whether it affects App Store / launch screenshots,
- whether it should be fixed before public launch or can wait.

Do not mark the final UX/UI release gate as Go if any accepted visible polish weakens perceived premium quality.

## Shared Component Regression Map

Before final Go/No-Go, list every shared component changed during the loop and all paths that may be affected.

Examples:

- Button / TextInput / SettingsRow
- Modal / bottom sheet
- IngredientEditor / IngredientEditorModal
- WeekStrip
- Statistics cards
- Share composer canvas/dock
- Chat keyboard layout
- E2E fixtures
- run-e2e-local.sh
- visual-audit suite map

For each changed shared component:

- affected paths,
- targeted verification command,
- screenshot evidence,
- final status.

## Active Task For Codex

Start now with Path 18 and continue autonomously until you reach Go, No-Go, or a documented Environment Blocker. Do not stop at intermediate progress unless a terminal condition is reached.

Do not continue path-by-path work for paths 1–17 unless Path 18 reopens a path based on fresh evidence.

Use this document as the control document and update it as work proceeds.

First run the required final checks. Then review fresh screenshots. Then update final results, shared component regression map, accepted visible polish, and Go / No-Go verdict.

## Path Order And Coverage

All statuses and scores for paths 1–17 are provisional. They are historical results from path-by-path work and must not be treated as final evidence during Path 18.

| #   | Path                                                   | Canonical Maestro/visual coverage                                                                                                                                                                                                                                                                                                           | Status              | Score              |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------ |
| 1   | Auth entry / login / register                          | `e2e/maestro/visual-audit/auth-entry.yaml`, `e2e/maestro/release-gate/auth-login-validation.yaml`, `e2e/maestro/release-gate/auth-register-onboarding.yaml`, `e2e/maestro/smoke/login.yaml`, `e2e/maestro/smoke/register-conflict.yaml`                                                                                                     | Provisionally Ready | Provisionally 9/10 |
| 2   | Onboarding                                             | `e2e/maestro/visual-audit/auth-entry.yaml`, `e2e/maestro/release-gate/auth-register-onboarding.yaml`                                                                                                                                                                                                                                        | Provisionally Ready | Provisionally 9/10 |
| 3   | Home / Today empty state                               | `e2e/maestro/visual-audit/core-meal-home-history-statistics.yaml`                                                                                                                                                                                                                                                                           | Provisionally Ready | Provisionally 9/10 |
| 4   | Home / Today filled state                              | `e2e/maestro/visual-audit/core-meal-home-history-statistics.yaml`, `e2e/maestro/release-gate/home-history-statistics-after-save.yaml`                                                                                                                                                                                                       | Provisionally Ready | Provisionally 9/10 |
| 5   | Add Meal - text flow                                   | `e2e/maestro/visual-audit/core-meal-home-history-statistics.yaml`, `e2e/maestro/release-gate/add-meal-text-save-propagates.yaml`, `e2e/maestro/nightly-regression/text-meal-ai-failure.yaml`, `e2e/maestro/platform-layout/text-meal-keyboard.yaml`                                                                                         | Provisionally Ready | Provisionally 9/10 |
| 6   | Add Meal - photo flow                                  | `e2e/maestro/visual-audit/add-meal-photo.yaml`, `e2e/maestro/release-gate/add-meal-photo-save-propagates.yaml`                                                                                                                                                                                                                              | Provisionally Ready | Provisionally 9/10 |
| 7   | Add Meal - barcode flow                                | `e2e/maestro/visual-audit/add-meal-barcode.yaml`, `e2e/maestro/release-gate/add-meal-barcode-save-propagates.yaml`, `e2e/maestro/nightly-regression/barcode-not-found.yaml`, `e2e/maestro/platform-layout/barcode-manual-sheet.yaml`                                                                                                        | Provisionally Ready | Provisionally 9/10 |
| 8   | Add Meal - saved meal / template flow                  | `e2e/maestro/release-gate/add-meal-saved-template.yaml`, `e2e/maestro/visual-audit/add-meal-saved-template.yaml`                                                                                                                                                                                                                            | Provisionally Ready | Provisionally 9/10 |
| 9   | Review Meal / Edit Meal / Save                         | `e2e/maestro/visual-audit/core-meal-home-history-statistics.yaml`, `e2e/maestro/visual-audit/review-edit-save.yaml`, `e2e/maestro/release-gate/review-edit-layout.yaml`, `e2e/maestro/release-gate/add-meal-manual-edit-save-propagates.yaml`                                                                                               | Provisionally Ready | Provisionally 9/10 |
| 10  | History / meal details / edit / delete                 | `e2e/maestro/visual-audit/core-meal-home-history-statistics.yaml`, `e2e/maestro/visual-audit/history-details-edit-delete.yaml`, `e2e/maestro/release-gate/history-edit-delete.yaml`                                                                                                                                                         | Provisionally Ready | Provisionally 9/10 |
| 11  | Statistics                                             | `e2e/maestro/visual-audit/core-meal-home-history-statistics.yaml`, `e2e/maestro/release-gate/home-history-statistics-after-save.yaml`                                                                                                                                                                                                       | Provisionally Ready | Provisionally 9/10 |
| 12  | AI Chat                                                | `e2e/maestro/visual-audit/chat-premium-notifications.yaml`, `e2e/maestro/release-gate/chat-basic-history.yaml`, `e2e/maestro/nightly-regression/chat-error-state.yaml`, `e2e/maestro/nightly-regression/chat-no-credits.yaml`, `e2e/maestro/platform-layout/chat-long-input-keyboard.yaml`                                                  | Provisionally Ready | Provisionally 9/10 |
| 13  | Premium / Paywall / subscription state                 | `e2e/maestro/visual-audit/chat-premium-notifications.yaml`, `e2e/maestro/release-gate/premium-paywall-restore.yaml`, `e2e/maestro/nightly-regression/billing-entitlement-states.yaml`, `e2e/maestro/nightly-regression/billing-restore-failure.yaml`, `e2e/maestro/platform-layout/paywall-open-layout.yaml`                                | Provisionally Ready | Provisionally 9/10 |
| 14  | Notifications / reminders settings                     | `e2e/maestro/visual-audit/chat-premium-notifications.yaml`, `e2e/maestro/release-gate/notifications-preferences.yaml`, `e2e/maestro/nightly-regression/reminders-disabled-state.yaml`                                                                                                                                                       | Provisionally Ready | Provisionally 9/10 |
| 15  | Settings / legal / account deletion                    | `e2e/maestro/smoke/account-launch.yaml`, `e2e/maestro/release-gate/account-delete-cancel.yaml`, `e2e/maestro/nightly-regression/account-delete-disposable-user.yaml`                                                                                                                                                                        | Provisionally Ready | Provisionally 9/10 |
| 16  | Share flow                                             | `e2e/maestro/release-gate/share-save-and-share.yaml`, `e2e/maestro/nightly-regression/share-customize-basic.yaml`, `e2e/maestro/nightly-regression/share-export-error.yaml`, `e2e/maestro/nightly-regression/share-invalid-no-photo.yaml`                                                                                                   | Provisionally Ready | Provisionally 9/10 |
| 17  | Small-screen / keyboard / platform layout visual audit | `e2e/maestro/visual-audit/platform-layout.yaml`, `e2e/maestro/platform-layout/small-screen-forms.yaml`, `e2e/maestro/platform-layout/text-meal-keyboard.yaml`, `e2e/maestro/platform-layout/chat-long-input-keyboard.yaml`, `e2e/maestro/platform-layout/barcode-manual-sheet.yaml`, `e2e/maestro/platform-layout/paywall-open-layout.yaml` | Provisionally Ready | Provisionally 9/10 |
| 18  | Final cross-path review / UX release gate              | `npm run typecheck`, `npm run lint`, `npm run e2e:visual-audit`, `npm run e2e:release-gate`, targeted reruns for any changed shared component                                                                                                                                                                                               | Not started         | TBD                |

## Final Cross-Path Review / UX Release Gate

After all individual paths are marked Ready, run a final cross-path review before declaring UX/UI release readiness.

Goal:
Confirm that fixes made in later paths did not regress earlier paths, shared components, screenshots, routing, keyboard behavior, copy, canonical local-first propagation, or the perceived premium quality of the app.

This is not only a functional regression pass. This is also a strict final visual-quality pass.

Required final checks:

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run e2e:visual-audit`.
- Run `npm run e2e:release-gate`.
- If time/environment allows, run `npm run e2e:full-review`.
- Review the latest visual-audit screenshots path by path.
- Re-open any path where screenshots show a regression, even if it was previously marked Ready.
- Re-check all changed shared components against the paths that use them.
- Confirm there are no new raw i18n keys, clipped Polish labels, hidden CTAs, keyboard/sheet overlaps, duplicate actions, or dead ends.
- Confirm Home/History/Statistics still propagate saved/edited/deleted meals from canonical local-first state.
- Confirm Add Meal still follows `entry -> processing/lookup -> Review Meal -> save`.
- Confirm no legacy fallback, duplicate screen, or temporary test-only behavior leaked into production paths.
- Confirm all Environment Blockers are documented and do not mask real product issues.
- Confirm all remaining Minor/Polish items are explicitly accepted and do not reduce perceived quality below 9/10.

## Autonomous Execution Rules

Work continuously until Path 18 reaches one of these terminal states:

1. Go.

2. No-Go with unresolved Blocker/Major issues that cannot be safely fixed within this Path 18 scope.

   This is terminal only if:
   - the fix would change product scope, pricing, subscription semantics, data deletion semantics, privacy/legal wording, backend contract, or canonical architecture,
   - the fix is high-risk and cannot be validated locally,
   - the issue requires an owner decision,
   - the required external service/environment is unavailable and prevents meaningful verification,
   - or repeated reasonable fix attempts failed and further changes would become speculative.

3. Environment Blocker that prevents further meaningful verification.

Do not treat the first discovered Blocker/Major as a terminal No-Go.

If a Blocker or Major is found:

- document it,
- classify it,
- identify the root cause,
- fix it if it can be fixed safely within the current scope,
- rerun the targeted test/flow,
- rerun affected visual/release checks,
- update the control document,
- continue Path 18.

Only leave the final verdict as No-Go if a Blocker/Major remains unresolved after reasonable fix attempts or requires owner decision.

Do not stop after the first failing command unless the failure prevents all further work.

If a command fails:

- inspect the failure,
- classify it as product, test, or environment,
- identify the smallest safe fix that actually solves the root cause,
- rerun the targeted command,
- continue with the remaining final checks when possible.

Fixes are allowed at different depths depending on the issue:

1. Small local fixes are allowed for copy, spacing, clipped text, testIDs, test flow reliability, screenshots, and obvious state presentation issues.

2. Medium visual/layout fixes are allowed when the current screen is functionally correct but visually not launch-ready. This includes restructuring a section, card, modal, bottom sheet, banner, empty state, loading state, keyboard layout, CTA area, or visual hierarchy if the change stays within the same canonical screen and does not alter product semantics.

3. Larger local component refactors are allowed when necessary to reach premium-lite launch quality, provided that:
   - the canonical user flow stays the same,
   - no new parallel screen or legacy fallback is introduced,
   - no pricing, subscription, deletion, privacy/legal, backend contract, or data model semantics are changed,
   - existing design-system tokens/components are reused where possible,
   - affected paths are rerun and screenshot-reviewed after the change.

Do not use “smallest fix” to mean superficial patching. Use the smallest fix that removes the real UX/UI problem without creating hidden debt or preserving a broken layout.

Do not ask the owner for confirmation unless:

- the required fix changes product scope, pricing, subscription semantics, data deletion semantics, privacy/legal wording, backend contract, or canonical architecture,
- the fix would introduce a new flow, new screen concept, new monetization behavior, or new data persistence rule,
- the fix is high-risk and cannot be safely validated locally,
- multiple valid product decisions exist and choosing one would materially affect launch behavior.

For visual polish:

- fix low-risk and medium-risk visual polish immediately if it affects perceived premium quality,
- perform a larger local layout/component refactor if the screen cannot honestly reach 9/10 without it,
- document truly negligible polish as accepted only if it does not weaken trust, readability, hierarchy, or launch presentation,
- do not pause to ask whether to accept minor polish unless it affects product positioning, launch screenshots, or product semantics.

If a larger local layout/component refactor is needed:

- state the reason in the control document,
- list affected components and paths,
- keep the change scoped to the problematic surface,
- rerun typecheck, lint, targeted tests, targeted Maestro, and affected visual screenshots,
- add the component to the Shared Component Regression Map.

If `npm run e2e:full-review` is too slow, unstable, or blocked:

- document why it was not completed,
- do not stop the whole review,
- continue with typecheck, lint, visual-audit, release-gate, targeted reruns, and screenshot review.

If the environment becomes unstable:

- attempt reasonable cleanup once, such as checking/killing stale Expo/Metro processes or rerunning the affected command sequentially,
- document the exact cleanup attempted,
- continue if the environment recovers,
- if it does not recover, mark Environment Blocker with exact command, error, affected coverage, and what remains unverified.

Keep updating the control document as work proceeds. The final response must not be just a progress update. It must include the terminal verdict or the exact blocker that prevented reaching one.

## Final Premium Visual Review

For each captured screen, perform a strict aesthetic review as a senior mobile product designer.

Do not ask only: “Does this work?”
Ask: “Does this look like a polished, premium-lite product ready for public launch?”

Review every screenshot against these criteria:

### 1. First impression

- Does the screen feel intentionally designed, not merely assembled?
- Does it look calm, refined, and consistent with Fitaly?
- Would this screen be acceptable in App Store / Google Play screenshots without embarrassment?
- Does it avoid a developer-tool, MVP, placeholder, or debug-build feeling?

### 2. Visual hierarchy

- Is there one clear point of gravity?
- Is the primary action visually dominant but not aggressive?
- Are secondary actions clearly secondary?
- Is the user’s next step obvious within 2 seconds?
- Are titles, helper text, cards, and CTAs ordered by importance?

### 3. Layout and proportions

- Are vertical proportions balanced?
- Is there too much empty space that should be used better?
- Is any area visually cramped?
- Are large cards, banners, modals, sheets, inputs, and preview areas proportionate to their importance?
- Does the screen avoid both dashboard clutter and excessive emptiness?
- Are bottom actions placed naturally and reachable?

### 4. Spacing rhythm

- Is spacing consistent between related elements?
- Are sections separated clearly without creating dead zones?
- Do cards and sheets have enough internal padding?
- Are rows, chips, inputs, and helper texts aligned cleanly?
- Does the layout feel calm rather than loose or accidental?

### 5. Typography

- Are font sizes appropriate for Polish copy length?
- Are long Polish words handled without shrinking the whole layout into awkwardness?
- Are labels, helper text, metadata, and numbers readable?
- Are numeric values visually stable and easy to scan?
- Does the type hierarchy feel intentional?

### 6. Color and brand consistency

- Are primary actions olive?
- Is terracotta used only as a secondary warm/AI/accent color?
- Are warm neutral surfaces dominant?
- Are macro colors consistent: protein blue, carbs green, fat warm gold, calories olive?
- Are error/destructive states semantically distinct from warm brand accents?
- Are there any random, overly bright, muddy, or non-token colors?
- Does the screen feel like one Fitaly system rather than several styles mixed together?

### 7. Components and surface quality

- Do modals and bottom sheets feel premium, focused, and purposeful?
- Are cards visually coherent across screens?
- Do inputs match the rest of the app?
- Do buttons have proper visual states: default, disabled, loading, pressed?
- Do empty/loading/error/success states look designed?
- Are there redundant banners, duplicate rows, repeated labels, or unnecessary helper blocks?

### 8. Copy and tone

- Does the copy sound natural in Polish?
- Does it avoid technical, stiff, translated, or artificial phrasing?
- Does it avoid pressure, shame, fitness aggression, and infantilized friendliness?
- Is the message useful, short, and supportive?
- Does every visible text have a reason to exist?

### 9. Screenshot-level polish

- Check the screenshot as a whole, not only individual components.
- If the screen technically passes but visually feels unfinished, reopen the path.
- If a modal, sheet, banner, CTA, input, card, empty state, or loading state weakens perceived quality, fix it if low/medium risk.
- If a screen would make the app feel less premium to a first-time user, do not keep the 9/10 score.

### 10. Regression from shared components

Re-check screens affected by shared components changed during the loop, especially:

- buttons,
- inputs,
- modals,
- bottom sheets,
- ingredient editor,
- meal review,
- week strip,
- statistics cards,
- macro cards,
- loading/status banners,
- empty states,
- keyboard-aware layouts,
- e2e fixtures and visual-audit flows.

Final reviewer instruction:
Be stricter in the final review than during individual path work. Do not rubber-stamp previous 9/10 scores. Treat every Ready score as provisional until the final cross-path review confirms both functional readiness and premium visual quality.

If any Blocker or Major appears:

- mark the affected path as Not Ready,
- fix it,
- rerun the relevant targeted Maestro flow,
- rerun the final affected visual/release checks,
- update this document.

If a screen works but does not feel premium:

- classify the issue as Visual Major if it weakens trust, hierarchy, readability, or launch quality,
- classify it as Polish only if it is genuinely cosmetic and does not reduce perceived product quality,
- fix it if low/medium risk,
- otherwise document it as accepted post-launch polish with a clear reason.

If only Minor/Polish remains:

- decide whether it affects perceived premium quality,
- fix it if low-risk,
- otherwise record it as accepted post-launch polish.

Final output:

- Overall UX/UI release readiness: Go / No-Go.
- Final score.
- Paths confirmed Ready.
- Paths reopened.
- Screens reopened for visual polish.
- Remaining accepted Minor/Polish.
- Remaining Environment Blockers.
- Needs Owner Decision.
- Test commands run.
- Screenshot artifact locations.
- Final visual-quality verdict.

## Historical Path Summary

Paths 1–17 were reviewed and provisionally marked Ready during path-by-path work.

These results are not final release evidence.

Major fixes made during the loop included:

- added missing visual-audit screenshots for several paths,
- fixed keyboard-hidden CTAs in Add Meal, Chat, Barcode, and Ingredient Editor,
- fixed raw i18n keys in History,
- fixed zero-nutrition E2E photo flow,
- fixed Premium fixture/subscription state mismatch,
- fixed Notifications disabled-state presentation,
- fixed Share photo/localization/composer issues,
- fixed small-screen Maestro coverage instability.

For detailed historical notes, see `./ux-ui-maestro-loop-archive.md`.

Path 18 must verify all of this again using fresh final runs.

## Running Log

## Needs Owner Decision

- None recorded yet.
