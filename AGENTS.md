## Project Context

- Stack: Expo SDK 55, React Native 0.83.6, React 19.2, TypeScript 5.9.
- Backend/services: Firebase (auth, firestore, storage), RevenueCat (react-native-purchases), i18next.
- Tooling: ESLint v8, tsc typecheck.

### Architecture Principles

- **Feature modules as the default:** new functionality goes into `feature/<FeatureName>/` which contains its own `screens/`, `components/`, `hooks/`, `services/`, `types/` (as needed). Code inside a feature is **private by default** and should not be imported by other features.
- **Global code is opt-in:** only move code to global folders (`components/`, `hooks/`, `services/`, `utils/`, `theme/`, `navigation/`, `types/`) if it is reused by **2+ features** or is a true app-wide concern (e.g., design system, auth, analytics, core navigation).
- **No feature-to-feature imports:** features must not import from other features directly. If shared logic/UI emerges, extract to the appropriate global layer and import from there.
- **Clear ownership:** a file belongs either to exactly one feature module **or** to the global layer—avoid “half-shared” code living in a feature but used globally.
- **Stable boundaries:** public surface of global modules should be small and typed; features can change internally without breaking the rest of the app.

### Naming, Imports, and Boundaries

- **Path aliases:** prefer `@/` alias imports over relative imports for cross-folder references (e.g., `@/components/...`, `@/services/...`, `@/feature/<FeatureName>/...`).
- **Import direction:** `screens` -> `feature/*` internals -> global layers -> SDKs. Never import `screens` from anywhere.
- **Feature privacy:** only import from inside the same `feature/<FeatureName>/...` unless extracting to global.
- **Cross-feature reuse rule:** if code is needed in another feature, extract it to a global folder; do not “reach into” another feature’s internals.
- **Naming conventions:**
  - React components: `PascalCase` (e.g., `MealCameraScreen.tsx`, `MacroChart.tsx`)
  - Hooks: `useXxx` (e.g., `useMeals.ts`, `usePremiumStatus.ts`)
  - Services: `xxxService.ts` (e.g., `streakService.ts`, `nutritionTableService.ts`)
  - Types: `types/*.ts` or `feature/<Feature>/types/*.ts` with explicit exported types
- **Export policy:** prefer named exports; use default export for screens and top-level components only when consistent with the codebase.
- **Barrels:** avoid `index.ts` barrel exports unless already established in the repo; explicit imports reduce accidental coupling.

## Operating Mode

- For any non-trivial task (>= 3 steps, architectural choice, or ambiguous requirements): start with a short plan (bullets).
- If something goes sideways or assumptions change: stop, re-plan, and explain.
- Prefer the smallest correct change. Avoid refactors unless requested.

## Refactor Loop (required)

Applies to any non-trivial task (>= 3 steps), architectural change, refactor, boundary cleanup, or import-graph change.

### Refactor trigger keywords

A task is considered a refactor if it includes any of:

- "refactor", "boundary", "imports", "architecture", "extract", "move file", "decouple"

### Execution

- Implement **PR1 only** (smallest correct change). Do not start PR2 unless the user says **"continue"**.
- Keep diffs small and behavior unchanged unless explicitly requested.

### Quality Gate

Choose validation by risk:

- Tier 0 — documentation/copy-only: no runtime tests required unless copy affects legal, billing, or health-sensitive flows. Run `npm run lint` / `npm run typecheck` only if source files changed.
- Tier 1 — simple UI/layout polish: run `npm run typecheck` and `npm run lint`; do not run Maestro by default. Include manual visual check instructions.
- Tier 2 — component logic or shared component changes: run `npm run typecheck`, `npm run lint`, and relevant unit/component tests if present. Run targeted Maestro only if the component affects a critical flow.
- Tier 3 — critical flow changes: run targeted Maestro plus lint/typecheck and relevant tests. Critical flows include auth/session routing, onboarding completion, add meal save, local-first sync, premium/restore, reminders, account deletion, and navigation.
- Tier 4 — release gate/full app review: run smoke or full relevant Maestro suites before release candidates, larger merges, full visual/product review, or explicit user request.

For small visual/layout/copy tasks, Codex must not run E2E unless the prompt explicitly asks for it or the code change affects navigation, state, or business logic. If Codex decides to run E2E anyway, explain why before running it. Prefer targeted Maestro package scripts over full suites. Any `e2e-full` wrapper or equivalent full-suite run is for full visual/product review, not every patch.

If a gate fails: fix and re-run (max 3 attempts). If still failing: stop and report the top blockers with file/line and a minimal next step.

## Codebase First

- Search the repo for existing patterns (navigation, hooks, services, theme, i18n) and follow them.
- Do not introduce new dependencies or native modules unless explicitly requested.

## TypeScript / Quality Gates

- Do not weaken types to “make it compile” (avoid `any`, broad `as`, disabling rules) unless there is no alternative—then isolate and justify.
- Keep exports and public APIs stable; avoid breaking changes unless requested.
- If code touches cross-feature logic, prefer extracting to `services/` or `utils/` consistent with existing structure.

## React Native / Expo Constraints

- Prefer Expo-compatible APIs and existing dependencies; avoid adding custom native code.
- When touching camera/media/filesystem: respect platform permissions and failure states (denied, restricted, limited).
- Be mindful of performance: avoid unnecessary re-renders, heavy work on render path, and large images in memory.

## Firebase Rules

- Never log or persist secrets. Do not hardcode API keys or service credentials.
- Firestore: prefer predictable document shapes, explicit typing, and minimal reads/writes.
- Handle offline/latency: assume network can fail; provide user-safe fallbacks where relevant.

## RevenueCat Rules

- Do not change entitlement/offerings naming assumptions without checking existing constants/usages.
- Subscription state handling must be consistent and resilient (cache vs remote, sandbox vs prod).

## i18n Rules

- All user-facing strings must be translated via i18next (no hardcoded UI strings), unless explicitly stated otherwise.
- When adding keys: keep naming consistent, and update all required locales.

## Verification Before Done

- Never claim “done” without verification.
- Use the Quality Gate tiers above instead of reflexively running expensive checks.
- Run tests proportionally:
  - For isolated changes, run only targeted tests for touched files/features (e.g., `npm run test -- src/hooks/__tests__/useMeals.test.ts`).
  - When running only part of the test suite with coverage enabled, scope coverage to touched source files using `--collectCoverageFrom` (e.g., `npm run test -- src/hooks/__tests__/useMeals.test.ts --collectCoverageFrom=src/hooks/useMeals.ts`).
  - Run full test suite for cross-feature changes, refactors, release prep, or when unsure about blast radius.
- If tests exist for the touched area: run them; otherwise provide a short manual verification checklist.
- For UI flows: list the exact screens/steps verified manually or via targeted Maestro (iOS + Android if relevant).

## Bug-Fix Protocol

- Given a log/error: identify root cause and fix it (no band-aids).
- If multiple plausible causes: state top 1–2 hypotheses and the quickest confirmation path.
- Add a regression test when feasible; otherwise document reproducible steps.

## Communication (IDE)

For each change-set, include:

- What changed (1–3 bullets)
- Why
- How verified (commands run / steps)

## Guardrails

- No destructive actions (delete/migrate/overwrite data, breaking schema changes) without explicit confirmation.
- No output of personal data from logs/screenshots; redact identifiers.
- No secrets in code or logs. Never ask for or output API keys.

# Firebase

Durign work with firebase check firebaseRules.md and if it is necessery suggerst changes

## Backend sync

During tasks check if changes require other changes on backend part (fitaly-backend).

### Cross-repo contract checklist

When a change touches any of the surfaces below, **both repos must be updated**:

1. **Did this change alter a cross-repo contract?**
   - Meal type definitions (`MealType`, `MealSyncState`, `MealInputMethod`, `MealSource` in `types/meal.ts`)
   - NutritionState type shape (`nutritionStateTypes.ts`)
   - Gateway reject reasons (`GATEWAY_REJECT_REASONS` in `useChatHistory.ts`)
   - Habit signal enums (`NutritionTopRisk`, `NutritionCoachPriority`)
   - AI response types (`contracts.ts`)

2. **Were paired contract fixtures updated?**
   - Mobile: `src/__contract_fixtures__/*.json`
   - Backend: `tests/contract_fixtures/*.json`
   - These files must stay identical — copy after editing.

3. **Were paired tests updated?**
   - Mobile: `src/__contract_fixtures__/contractAlignment.test.ts`
   - Backend: `tests/test_contract_alignment.py`

4. **Verification:**
   - Mobile: `npx jest contractAlignment`
   - Backend: `pytest tests/test_contract_alignment.py`

# After

After finishig task suggest if there is still something to do or this part is done
