import AsyncStorage from "@react-native-async-storage/async-storage";
import { emit } from "@/services/core/events";
import { get } from "@/services/core/apiClient";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { createServiceError } from "@/services/contracts/serviceError";
import { isE2EModeEnabled } from "@/services/e2e/config";
import { getDraftKey, getScreenKey } from "@/context/MealDraftContext";
import { resetOfflineStorage } from "@/services/offline/db";
import {
  getAllMealsLocal,
  upsertMealLocal,
} from "@/services/offline/meals.repo";
import { pullSmartMemoryChanges } from "@/services/offline/sync.engine";
import { saveMealTransaction } from "@/services/meals/mealSaveTransaction";
import { upsertMyMealLocal } from "@/services/meals/myMealService";
import {
  fetchMealsPageRemote,
  markMealDeletedRemote,
  saveMealRemote,
} from "@/services/meals/mealsRepository";
import {
  flush as flushTelemetry,
  setTelemetryUserId,
  track as trackTelemetry,
} from "@/services/telemetry/telemetryClient";
import type {
  TelemetryEventName,
  TelemetryProps,
} from "@/services/telemetry/telemetryTypes";
import { fetchKnownPatternCandidatesRemote } from "@/services/knownPatterns/knownPatternCandidatesApi";
import {
  createPlannedMealRemote,
  deletePlannedMealRemote,
  fetchPlannedMealsRemote,
} from "@/services/plannedMeals/plannedMealsApi";
import { upsertLocalIngredientProductUserRecord } from "@/services/foodLibrary/ingredientProductUserRecordProjectionRepository";
import { getSampleMealUri } from "@/utils/devSamples";
import type { AccessFeatureKey, AccessState } from "@/services/access/accessState";
import type {
  AiCreditsStatus,
  AiPhotoAnalyzeResponse,
  AiTextMealAnalyzeResponse,
} from "@/services/ai/contracts";
import type { BarcodeLookupResult } from "@/services/barcode/barcodeService";
import type {
  ReminderDecision,
  ReminderDecisionResult,
} from "@/services/reminders/reminderTypes";
import type {
  WeeklyReport,
  WeeklyReportResult,
} from "@/services/weeklyReport/weeklyReportTypes";
import {
  markSmartMemoryCandidatePending,
  markSmartMemoryItemPending,
  markSmartMemoryProjectionSyncFailed,
  upsertSmartMemoryCandidateProjection,
  upsertSmartMemoryItemProjection,
  upsertSmartMemorySettingsProjection,
} from "@/services/smartMemory/smartMemoryProjectionRepository";
import type { Ingredient, Meal } from "@/types/meal";
import type { IngredientProductSearchRow } from "@/types/foodLibrary";
import type {
  SmartMemoryCandidate,
  SmartMemoryCandidateUpsertInput,
  SmartMemoryItem,
  SmartMemorySettings,
} from "@/types/smartMemory";
import type { UserAiConsent } from "@/types/user";

export type E2EFixtureName =
  | "activated-user-empty"
  | "user-with-synced-meal"
  | "user-with-today-meal"
  | "user-with-photo-meal"
  | "user-with-saved-meals"
  | "user-with-draft"
  | "user-with-failed-meal"
  | "user-with-conflict-meal"
  | "user-with-private-product-conflict";
export type E2ECreditsSeed = "ok" | "low" | "none";
export type E2EAiSeed =
  | "textSuccess"
  | "textSlow"
  | "photoSuccess"
  | "photoSlow"
  | "failure"
  | "timeout"
  | "insufficientCredits";
export type E2EBarcodeSeed = "known" | "unknown" | "invalid" | "offline";
export type E2EBillingSeed =
  | "free"
  | "premium"
  | "restoreSuccess"
  | "restorePending"
  | "restoreFailure"
  | "restoreSlowFailure"
  | "restoreError";
export type E2EChatSeed = "success" | "failure";
export type E2EShareExportSeed =
  | "success"
  | "failure"
  | "permissionDenied"
  | "shareUnavailable";
export type E2ENotificationPermissionSeed = "allowed" | "denied";
export type E2EReminderSeed = "send" | "suppress" | "noop" | "disabled";
export type E2EWeeklyReportSeed =
  | "available"
  | "unavailable"
  | "disabled"
  | "forbidden";
export type E2EAiConsentSeed = "granted" | "notGranted" | "revoked";
export type E2EAiConsentGrantSeed = "success" | "failure";
export type E2EAiConsentRevokeSeed = "success" | "failure" | "failureOnce";
export type E2ESmartMemorySeed =
  | "emptyEnabled"
  | "emptyDisabled"
  | "active"
  | "reviewActive"
  | "reviewCandidate"
  | "reviewDisabledActive"
  | "muted"
  | "sourceDeleted"
  | "pending"
  | "syncFailed"
  | "backendPull";
export type E2EKnownPatternSeed = "candidate";
export type E2EPlanningSeed = "empty" | "reviewReady";
export type E2EHistoryAssert =
  | "noRecipeReviewDraft"
  | "noPlanningReviewDraft";
export type E2ETelemetryEventAssert =
  | "homeNextActionStarted"
  | "knownPatternCandidateDismissed"
  | "memoryDeleted"
  | "plannedMealConfirmed";
export type E2ETelemetryRuntimeAssert =
  | "smartMemoryEnabled"
  | "telemetryEnabled"
  | "knownPatternsEnabled"
  | "planningEnabled";

export type E2ESeedCommand = {
  fixture?: E2EFixtureName;
  credits?: E2ECreditsSeed;
  ai?: E2EAiSeed;
  barcode?: E2EBarcodeSeed;
  billing?: E2EBillingSeed;
  chat?: E2EChatSeed;
  shareExport?: E2EShareExportSeed;
  notificationPermission?: E2ENotificationPermissionSeed;
  reminder?: E2EReminderSeed;
  weeklyReport?: E2EWeeklyReportSeed;
  aiConsent?: E2EAiConsentSeed;
  aiConsentGrant?: E2EAiConsentGrantSeed;
  aiConsentRevoke?: E2EAiConsentRevokeSeed;
  smartMemory?: E2ESmartMemorySeed;
  knownPattern?: E2EKnownPatternSeed;
  planning?: E2EPlanningSeed;
  historyAssert?: E2EHistoryAssert;
  telemetryBaseline?: E2ETelemetryEventAssert;
  telemetryAssert?: E2ETelemetryEventAssert;
  telemetryEmit?: E2ETelemetryEventAssert;
  telemetryRuntime?: E2ETelemetryRuntimeAssert;
};

type E2EFixtureState = E2ESeedCommand;

const VALID_FIXTURES = new Set<E2EFixtureName>([
  "activated-user-empty",
  "user-with-synced-meal",
  "user-with-today-meal",
  "user-with-photo-meal",
  "user-with-saved-meals",
  "user-with-draft",
  "user-with-failed-meal",
  "user-with-conflict-meal",
  "user-with-private-product-conflict",
]);
const VALID_CREDITS = new Set<E2ECreditsSeed>(["ok", "low", "none"]);
const VALID_AI = new Set<E2EAiSeed>([
  "textSuccess",
  "textSlow",
  "photoSuccess",
  "photoSlow",
  "failure",
  "timeout",
  "insufficientCredits",
]);
const VALID_BARCODE = new Set<E2EBarcodeSeed>([
  "known",
  "unknown",
  "invalid",
  "offline",
]);
const VALID_BILLING = new Set<E2EBillingSeed>([
  "free",
  "premium",
  "restoreSuccess",
  "restorePending",
  "restoreFailure",
  "restoreSlowFailure",
  "restoreError",
]);
const VALID_CHAT = new Set<E2EChatSeed>(["success", "failure"]);
const VALID_SHARE_EXPORT = new Set<E2EShareExportSeed>([
  "success",
  "failure",
  "permissionDenied",
  "shareUnavailable",
]);
const VALID_NOTIFICATION_PERMISSION =
  new Set<E2ENotificationPermissionSeed>(["allowed", "denied"]);
const VALID_REMINDER = new Set<E2EReminderSeed>([
  "send",
  "suppress",
  "noop",
  "disabled",
]);
const VALID_WEEKLY_REPORT = new Set<E2EWeeklyReportSeed>([
  "available",
  "unavailable",
  "disabled",
  "forbidden",
]);
const VALID_AI_CONSENT = new Set<E2EAiConsentSeed>([
  "granted",
  "notGranted",
  "revoked",
]);
const VALID_AI_CONSENT_GRANT = new Set<E2EAiConsentGrantSeed>([
  "success",
  "failure",
]);
const VALID_AI_CONSENT_REVOKE = new Set<E2EAiConsentRevokeSeed>([
  "success",
  "failure",
  "failureOnce",
]);
const VALID_SMART_MEMORY = new Set<E2ESmartMemorySeed>([
  "emptyEnabled",
  "emptyDisabled",
  "active",
  "reviewActive",
  "reviewCandidate",
  "reviewDisabledActive",
  "muted",
  "sourceDeleted",
  "pending",
  "syncFailed",
  "backendPull",
]);
const VALID_KNOWN_PATTERN = new Set<E2EKnownPatternSeed>(["candidate"]);
const VALID_PLANNING = new Set<E2EPlanningSeed>(["empty", "reviewReady"]);
const VALID_HISTORY_ASSERT = new Set<E2EHistoryAssert>([
  "noRecipeReviewDraft",
  "noPlanningReviewDraft",
]);
const VALID_TELEMETRY_EVENT_ASSERT = new Set<E2ETelemetryEventAssert>([
  "homeNextActionStarted",
  "knownPatternCandidateDismissed",
  "memoryDeleted",
  "plannedMealConfirmed",
]);
const VALID_TELEMETRY_RUNTIME_ASSERT = new Set<E2ETelemetryRuntimeAssert>([
  "smartMemoryEnabled",
  "telemetryEnabled",
  "knownPatternsEnabled",
  "planningEnabled",
]);

const E2E_FIXTURE_STATE_KEY = "e2e_fixture_state";
const E2E_AI_CONSENT_GRANTED_AT = "2026-05-01T10:00:00.000Z";
const E2E_AI_CONSENT_REVOKED_AT = "2026-05-02T10:00:00.000Z";
let fixtureState: E2EFixtureState = {};
let aiConsentRevokeFailureOnceConsumed = new Set<string>();
let aiConsentSeedByUid = new Map<string, UserAiConsent>();
let knownPatternSeedCounter = 0;
let telemetryBaselineCounts = new Map<string, number>();

const KNOWN_PATTERN_SEED_VERIFY_ATTEMPTS = 10;
const KNOWN_PATTERN_SEED_VERIFY_DELAY_MS = 750;
const KNOWN_PATTERN_SEED_DAY_OFFSETS = [-4, -3, -2, -1, 0] as const;
const KNOWN_PATTERN_E2E_MEAL_NAME_PREFIX = "Znany wzorzec QA ";
const HISTORY_ASSERT_PAGE_LIMIT = 25;
const HISTORY_ASSERT_MEAL_NAMES: Record<E2EHistoryAssert, string> = {
  noRecipeReviewDraft: "Salmon rice plate",
  noPlanningReviewDraft: "E2E Planning Bowl",
};
const TELEMETRY_ASSERT_EVENT_NAMES: Record<
  E2ETelemetryEventAssert,
  TelemetryEventName
> = {
  homeNextActionStarted: "home_next_action_started",
  knownPatternCandidateDismissed: "known_pattern_candidate_dismissed",
  memoryDeleted: "memory_deleted",
  plannedMealConfirmed: "planned_meal_confirmed",
};
const TELEMETRY_ASSERT_ATTEMPTS = 10;
const TELEMETRY_ASSERT_DELAY_MS = 750;

type KnownPatternSeedExpectation = {
  firstSeenAt: string;
  lastSeenAt: string;
};

function todayDayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function e2eNowISO(): string {
  return `${todayDayKey()}T10:30:00.000Z`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoFromTodayOffset(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function asValid<T extends string>(
  raw: string | undefined,
  allowed: Set<T>,
): T | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim();
  return allowed.has(normalized as T) ? (normalized as T) : undefined;
}

export function parseE2ESeedCommand(
  params: Record<string, string>,
): E2ESeedCommand {
  return {
    fixture: asValid(params.fixture, VALID_FIXTURES),
    credits: asValid(params.credits, VALID_CREDITS),
    ai: asValid(params.ai, VALID_AI),
    barcode: asValid(params.barcode, VALID_BARCODE),
    billing: asValid(params.billing, VALID_BILLING),
    chat: asValid(params.chat, VALID_CHAT),
    shareExport: asValid(params.shareExport, VALID_SHARE_EXPORT),
    notificationPermission: asValid(
      params.notificationPermission,
      VALID_NOTIFICATION_PERMISSION,
    ),
    reminder: asValid(params.reminder, VALID_REMINDER),
    weeklyReport: asValid(params.weeklyReport, VALID_WEEKLY_REPORT),
    aiConsent: asValid(params.aiConsent, VALID_AI_CONSENT),
    aiConsentGrant: asValid(params.aiConsentGrant, VALID_AI_CONSENT_GRANT),
    aiConsentRevoke: asValid(params.aiConsentRevoke, VALID_AI_CONSENT_REVOKE),
    smartMemory: asValid(params.smartMemory, VALID_SMART_MEMORY),
    knownPattern: asValid(params.knownPattern, VALID_KNOWN_PATTERN),
    planning: asValid(params.planning, VALID_PLANNING),
    historyAssert: asValid(params.historyAssert, VALID_HISTORY_ASSERT),
    telemetryBaseline: asValid(
      params.telemetryBaseline,
      VALID_TELEMETRY_EVENT_ASSERT,
    ),
    telemetryAssert: asValid(params.telemetryAssert, VALID_TELEMETRY_EVENT_ASSERT),
    telemetryEmit: asValid(params.telemetryEmit, VALID_TELEMETRY_EVENT_ASSERT),
    telemetryRuntime: asValid(
      params.telemetryRuntime,
      VALID_TELEMETRY_RUNTIME_ASSERT,
    ),
  };
}

function hasSeedCommand(command: E2ESeedCommand): boolean {
  return Boolean(
    command.fixture ||
      command.credits ||
      command.ai ||
      command.barcode ||
      command.billing ||
      command.chat ||
      command.shareExport ||
      command.notificationPermission ||
      command.reminder ||
      command.weeklyReport ||
      command.aiConsent ||
      command.aiConsentGrant ||
      command.aiConsentRevoke ||
      command.smartMemory ||
      command.knownPattern ||
      command.planning ||
      command.historyAssert ||
      command.telemetryBaseline ||
      command.telemetryAssert ||
      command.telemetryEmit ||
      command.telemetryRuntime,
  );
}

function seedMarkers(command: E2ESeedCommand): string[] {
  const markers: string[] = [];
  if (command.fixture) markers.push(`fixture-${command.fixture}`);
  if (command.credits) markers.push(`credits-${command.credits}`);
  if (command.ai) markers.push(`ai-${command.ai}`);
  if (command.barcode) markers.push(`barcode-${command.barcode}`);
  if (command.billing) markers.push(`billing-${command.billing}`);
  if (command.chat) markers.push(`chat-${command.chat}`);
  if (command.shareExport) markers.push(`shareExport-${command.shareExport}`);
  if (command.notificationPermission) {
    markers.push(`notificationPermission-${command.notificationPermission}`);
  }
  if (command.reminder) markers.push(`reminder-${command.reminder}`);
  if (command.weeklyReport) markers.push(`weeklyReport-${command.weeklyReport}`);
  if (command.aiConsent) markers.push(`aiConsent-${command.aiConsent}`);
  if (command.aiConsentGrant) {
    markers.push(`aiConsentGrant-${command.aiConsentGrant}`);
  }
  if (command.aiConsentRevoke) {
    markers.push(`aiConsentRevoke-${command.aiConsentRevoke}`);
  }
  if (command.smartMemory) markers.push(`smartMemory-${command.smartMemory}`);
  if (command.knownPattern) markers.push(`knownPattern-${command.knownPattern}`);
  if (command.planning) markers.push(`planning-${command.planning}`);
  if (command.historyAssert) {
    markers.push(`historyAssert-${command.historyAssert}`);
  }
  if (command.telemetryBaseline) {
    markers.push(`telemetryBaseline-${command.telemetryBaseline}`);
  }
  if (command.telemetryAssert) {
    markers.push(`telemetryAssert-${command.telemetryAssert}`);
  }
  if (command.telemetryEmit) {
    markers.push(`telemetryEmit-${command.telemetryEmit}`);
  }
  if (command.telemetryRuntime) {
    markers.push(`telemetryRuntime-${command.telemetryRuntime}`);
  }
  return markers;
}

function aiConsentForSeed(seed: E2EAiConsentSeed): UserAiConsent {
  if (seed === "granted") {
    return {
      status: "granted",
      grantedAt: E2E_AI_CONSENT_GRANTED_AT,
      revokedAt: null,
    };
  }

  if (seed === "revoked") {
    return {
      status: "revoked",
      grantedAt: E2E_AI_CONSENT_GRANTED_AT,
      revokedAt: E2E_AI_CONSENT_REVOKED_AT,
    };
  }

  return {
    status: "not_granted",
    grantedAt: null,
    revokedAt: null,
  };
}

function copyAiConsent(aiConsent: UserAiConsent): UserAiConsent {
  return { ...aiConsent };
}

function smartMemorySettings(
  uid: string,
  enabled: boolean,
): SmartMemorySettings {
  const updatedAt = e2eNowISO();
  return {
    ownerUserId: uid,
    enabled,
    disabledAt: enabled ? null : updatedAt,
    updatedAt,
    serverRevision: 1,
    clientMutationId: null,
  };
}

function smartMemoryItem(
  uid: string,
  overrides: Partial<SmartMemoryItem> = {},
): SmartMemoryItem {
  const updatedAt = e2eNowISO();
  return {
    memoryItemId: "e2e-memory-portion-yogurt",
    ownerUserId: uid,
    schemaVersion: 1,
    memoryType: "typical_portion",
    state: "active",
    stateReason: "threshold_met",
    subject: { kind: "ingredient_alias", aliasHash: "e2e-yogurt" },
    userValue: { amount: 200, unit: "g" },
    evidenceSummary: { observationCount: 4, distinctDayCount: 3 },
    sourceRefs: [{ kind: "meal_review", sourceHash: "e2e-source" }],
    threshold: { minObservations: 3 },
    confidence: { level: "medium" },
    confidenceReasonCodes: ["distinct_days_met"],
    control: {},
    createdAt: updatedAt,
    updatedAt,
    lastEvaluatedAt: updatedAt,
    mutedAt: null,
    deletedAt: null,
    editedAt: null,
    restoredAt: null,
    sourceDeletedAt: null,
    serverRevision: 2,
    ...overrides,
  };
}

function smartMemoryCandidateInput(): SmartMemoryCandidateUpsertInput {
  const updatedAt = e2eNowISO();
  return {
    candidateId: "e2e-memory-candidate-portion",
    memoryType: "typical_portion",
    subject: { kind: "ingredient_alias", aliasHash: "e2e-candidate" },
    evidenceSummary: { observationCount: 1 },
    sourceRefs: [{ kind: "meal_review", sourceHash: "e2e-candidate-source" }],
    confidenceReasonCodes: ["single_observation"],
    suppressionChecks: { settingsEnabled: true },
    firstSeenAt: updatedAt,
    lastSeenAt: updatedAt,
  };
}

function smartMemoryCandidate(
  uid: string,
  overrides: Partial<SmartMemoryCandidate> = {},
): SmartMemoryCandidate {
  const updatedAt = e2eNowISO();
  return {
    candidateId: "e2e-memory-candidate-portion",
    ownerUserId: uid,
    schemaVersion: 1,
    memoryType: "typical_portion",
    state: "candidate",
    subject: {
      displayLabel: "Kurczak grillowany",
      kind: "ingredient_alias",
      aliasHash: "e2e-review-candidate-chicken",
    },
    evidenceSummary: { observationCount: 1 },
    sourceRefs: [{ kind: "meal_review", sourceHash: "e2e-candidate-source" }],
    confidenceReasonCodes: ["single_observation"],
    suppressionChecks: { settingsEnabled: true },
    createdAt: updatedAt,
    updatedAt,
    firstSeenAt: updatedAt,
    lastSeenAt: updatedAt,
    serverRevision: 1,
    ...overrides,
  };
}

async function applySmartMemoryFixture(
  uid: string,
  seed: E2ESmartMemorySeed,
): Promise<void> {
  await upsertSmartMemorySettingsProjection(
    uid,
    smartMemorySettings(
      uid,
      seed !== "emptyDisabled" && seed !== "reviewDisabledActive",
    ),
  );

  if (seed === "emptyEnabled" || seed === "emptyDisabled") return;

  if (seed === "pending") {
    const updatedAt = e2eNowISO();
    await markSmartMemoryCandidatePending({
      uid,
      input: smartMemoryCandidateInput(),
      clientMutationId:
        `smart-memory:candidate_upsert:${uid}:e2e-memory-candidate-portion:e2e`,
      updatedAt,
    });
    return;
  }

  if (seed === "reviewCandidate") {
    await upsertSmartMemoryCandidateProjection(
      uid,
      smartMemoryCandidate(uid),
    );
    return;
  }

  await upsertSmartMemoryItemProjection(
    uid,
    smartMemoryItem(
      uid,
      seed === "reviewActive" || seed === "reviewDisabledActive"
        ? {
            memoryItemId: "e2e-memory-review-portion-chicken",
            subject: {
              displayLabel: "Kurczak grillowany",
              kind: "ingredient_alias",
              aliasHash: "e2e-review-chicken",
            },
            userValue: { amount: 140, unit: "g" },
            evidenceSummary: { observationCount: 3, distinctDayCount: 2 },
          }
        : seed === "muted"
        ? {
            state: "muted",
            stateReason: "user_muted",
            mutedAt: e2eNowISO(),
          }
        : seed === "sourceDeleted"
          ? {
              state: "source_deleted",
              stateReason: "source_deleted",
              sourceDeletedAt: e2eNowISO(),
            }
        : {},
    ),
  );

  if (seed === "syncFailed") {
    const updatedAt = e2eNowISO();
    const clientMutationId =
      `smart-memory:mute:${uid}:e2e-memory-portion-yogurt:e2e`;
    await markSmartMemoryItemPending({
      uid,
      memoryItemId: "e2e-memory-portion-yogurt",
      operation: "mute",
      clientMutationId,
      updatedAt,
    });
    await markSmartMemoryProjectionSyncFailed({
      uid,
      dead: false,
      code: "api/e2e-smart-memory-failure",
      message: "E2E deterministic Smart Memory failure",
      op: {
        id: 1,
        client_mutation_id: clientMutationId,
        cloud_id: "e2e-memory-portion-yogurt",
        user_uid: uid,
        kind: "smart_memory_item_mute",
        payload: {},
        updated_at: updatedAt,
        attempts: 1,
      },
    });
  }
}

function ingredient(params: {
  id: string;
  name: string;
  amount?: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}): Ingredient {
  return {
    id: params.id,
    name: params.name,
    amount: params.amount ?? 100,
    unit: "g",
    kcal: params.kcal,
    protein: params.protein,
    carbs: params.carbs,
    fat: params.fat,
  };
}

function totals(ingredients: Ingredient[]) {
  return ingredients.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function dayKeyFromISO(value: string): string {
  return value.slice(0, 10);
}

function privateIngredientProductConflictRow(
  uid: string,
): IngredientProductSearchRow {
  return {
    ingredientProductId: "e2e-private-product-conflict",
    recordScope: "user_scoped",
    lifecycleState: "candidate",
    displayName: "Prywatny konflikt QA",
    kind: "generic_ingredient",
    defaultServing: { quantity: 100, unit: "g" },
    nutritionPer100: {
      basis: "per_100g",
      unit: "g",
      kcal: 120,
      protein: 8,
      fat: 4,
      carbs: 12,
      fiber: null,
      sugar: null,
      salt: null,
      saturatedFat: null,
    },
    confidence: {
      identity: "medium",
      nutrition: "medium",
      profile: "unknown",
    },
    sourceAttribution: {
      sourceType: "user_created",
      sourceId: "e2e-private-product-conflict-mutation",
      sourceName: "User",
      provider: null,
      license: null,
      observedAt: null,
      reviewedAt: null,
      reviewedBy: null,
    },
    profileCompatibility: {
      status: "unknown",
      dietaryFlags: [],
      allergenFlags: [],
    },
    warningReasonCodes: [],
    rankingSignals: ["user_scoped"],
    brandName: null,
    ingredientName: "Prywatny konflikt QA",
    packageName: null,
    category: null,
    servingSizes: [],
    dietaryFlags: [],
    allergenFlags: [],
    cacheState: "stale",
    ownerUserId: uid,
  };
}

function meal(params: {
  uid: string;
  id: string;
  name: string;
  timestamp?: string;
  source?: Meal["source"];
  inputMethod?: Meal["inputMethod"];
  photoUrl?: string | null;
  ingredients?: Ingredient[];
}): Meal {
  const timestamp = params.timestamp ?? e2eNowISO();
  const ingredients =
    params.ingredients ??
    [
      ingredient({
        id: `${params.id}-chicken`,
        name: "Kurczak grillowany",
        amount: 140,
        kcal: 230,
        protein: 40,
        carbs: 0,
        fat: 6,
      }),
      ingredient({
        id: `${params.id}-rice`,
        name: "Ryż gotowany",
        amount: 160,
        kcal: 210,
        protein: 4,
        carbs: 45,
        fat: 1,
      }),
      ingredient({
        id: `${params.id}-vegetables`,
        name: "Warzywa na parze",
        amount: 120,
        kcal: 70,
        protein: 3,
        carbs: 12,
        fat: 1,
      }),
    ];
  return {
    userUid: params.uid,
    mealId: params.id,
    cloudId: params.id,
    timestamp,
    dayKey: dayKeyFromISO(timestamp),
    loggedAtLocalMin: 630,
    tzOffsetMin: 0,
    type: "lunch",
    name: params.name,
    ingredients,
    createdAt: timestamp,
    updatedAt: timestamp,
    syncState: "pending",
    source: params.source ?? "manual",
    inputMethod: params.inputMethod ?? "manual",
    aiMeta:
      params.inputMethod === "photo" || params.inputMethod === "text"
        ? {
            model: "e2e-fixture",
            runId: `e2e-${params.id}`,
            confidence: 0.98,
            warnings: [],
          }
        : null,
    photoUrl: params.photoUrl ?? null,
    photoLocalPath: params.photoUrl?.startsWith("file://")
      ? params.photoUrl
      : null,
    notes: null,
    tags: [],
    deleted: false,
    totals: totals(ingredients),
  };
}

async function clearLocalFixtureData(uid: string): Promise<void> {
  resetOfflineStorage();
  await AsyncStorage.multiRemove([getDraftKey(uid), getScreenKey(uid)]);
  emit("meal:local:deleted", { uid });
  emit("mymeal:local:deleted", { uid });
}

async function seedLoggedMeal(uid: string, fixtureMeal: Meal): Promise<void> {
  await saveMealTransaction({
    uid,
    meal: fixtureMeal,
    savedTemplate: { mode: "none" },
    nowISO: fixtureMeal.updatedAt,
  });
}

async function seedVisibleMeal(uid: string, fixtureMeal: Meal): Promise<void> {
  await upsertMealLocal(fixtureMeal);
  emit("meal:local:upserted", { uid, meal: fixtureMeal });
}

async function seedSavedMeal(uid: string, fixtureMeal: Meal): Promise<void> {
  await upsertMyMealLocal(uid, {
    ...fixtureMeal,
    userUid: uid,
    source: "saved",
    inputMethod: fixtureMeal.inputMethod ?? "manual",
  });
}

async function waitForKnownPatternSeedCandidate(
  expected: KnownPatternSeedExpectation,
): Promise<void> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < KNOWN_PATTERN_SEED_VERIFY_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const response = await fetchKnownPatternCandidatesRemote(
        { limit: 10 },
        { timeout: 10000 },
      );
      if (
        response.items.some(
          (candidate) =>
            candidate.firstSeenAt === expected.firstSeenAt &&
            candidate.lastSeenAt === expected.lastSeenAt &&
            (candidate.state === "candidate" || candidate.state === "shown") &&
            candidate.suggestedAction === "open_review_draft" &&
            (candidate.sourceCountBucket === "3_4" ||
              candidate.sourceCountBucket === "5_plus") &&
            (candidate.distinctDayCountBucket === "3_4" ||
              candidate.distinctDayCountBucket === "5_plus"),
        )
      ) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(KNOWN_PATTERN_SEED_VERIFY_DELAY_MS);
  }

  throw createServiceError({
    code: "e2e/known-pattern-seed-unavailable",
    source: "E2EFixtures",
    retryable: true,
    message: "Known Pattern candidate was not available after E2E seed.",
    cause: lastError,
  });
}

async function applyKnownPatternFixture(uid: string): Promise<void> {
  await clearKnownPatternFixtureMeals(uid);

  knownPatternSeedCounter += 1;
  const seedToken = `${Date.now()}-${knownPatternSeedCounter}`;
  const name = `${KNOWN_PATTERN_E2E_MEAL_NAME_PREFIX}${seedToken}`;
  const oatsName = `Owsianka QA ${seedToken}`;
  const yogurtName = `Jogurt QA ${seedToken}`;
  const timestamps = KNOWN_PATTERN_SEED_DAY_OFFSETS.map(isoFromTodayOffset);
  const expectedCandidate: KnownPatternSeedExpectation = {
    firstSeenAt: timestamps[0],
    lastSeenAt: timestamps[timestamps.length - 1],
  };

  await Promise.all(
    timestamps.map((timestamp, index) => {
      const fixtureMeal = meal({
        uid,
        id: `e2e-known-pattern-${seedToken}-${index + 1}`,
        name,
        timestamp,
        inputMethod: "manual",
        ingredients: [
          ingredient({
            id: `e2e-known-pattern-${seedToken}-oats-${index + 1}`,
            name: oatsName,
            amount: 60,
            kcal: 230,
            protein: 8,
            carbs: 38,
            fat: 5,
          }),
          ingredient({
            id: `e2e-known-pattern-${seedToken}-yogurt-${index + 1}`,
            name: yogurtName,
            amount: 150,
            kcal: 110,
            protein: 15,
            carbs: 7,
            fat: 3,
          }),
        ],
      });

      return saveMealRemote({
        uid,
        meal: fixtureMeal,
        clientMutationId: `e2e-known-pattern:${uid}:${seedToken}:${index + 1}`,
      });
    }),
  );
  await waitForKnownPatternSeedCandidate(expectedCandidate);
}

async function clearKnownPatternFixtureMeals(uid: string): Promise<void> {
  let cursor: string | null = null;

  do {
    const page = await fetchMealsPageRemote({
      uid,
      pageSize: 100,
      cursor,
    });

    await Promise.all(
      page.items
        .filter(
          (item) =>
            !item.deleted &&
            typeof item.name === "string" &&
            item.name.startsWith(KNOWN_PATTERN_E2E_MEAL_NAME_PREFIX) &&
            item.cloudId,
        )
        .map((item) =>
          markMealDeletedRemote(uid, item.cloudId as string, item.updatedAt, {
            clientMutationId: `e2e-known-pattern-cleanup:${uid}:${item.cloudId}`,
          }),
        ),
    );

    cursor = page.nextCursor;
  } while (cursor);
}

function normalizeHistoryAssertName(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function assertNoRemoteMealByName(
  uid: string,
  targetName: string,
): Promise<void> {
  const expectedName = normalizeHistoryAssertName(targetName);
  let cursor: string | null = null;
  let pageCount = 0;

  do {
    pageCount += 1;
    const page = await fetchMealsPageRemote({
      uid,
      pageSize: 100,
      cursor,
    });
    const foundMeal = page.items.find(
      (item) =>
        !item.deleted &&
        normalizeHistoryAssertName(item.name) === expectedName,
    );

    if (foundMeal) {
      throw createServiceError({
        code: "e2e/history-assertion-failed",
        source: "E2EFixtures",
        retryable: false,
        message: `E2E history assertion failed: found saved meal "${targetName}".`,
      });
    }

    cursor = page.nextCursor;
  } while (cursor && pageCount < HISTORY_ASSERT_PAGE_LIMIT);

  if (cursor) {
    throw createServiceError({
      code: "e2e/history-assertion-incomplete",
      source: "E2EFixtures",
      retryable: true,
      message: `E2E history assertion could not scan all meal history pages for "${targetName}".`,
    });
  }
}

async function assertNoLocalMealByName(
  uid: string,
  targetName: string,
): Promise<void> {
  const expectedName = normalizeHistoryAssertName(targetName);
  const foundMeal = (await getAllMealsLocal(uid)).find(
    (item) =>
      !item.deleted &&
      normalizeHistoryAssertName(item.name) === expectedName,
  );

  if (foundMeal) {
    throw createServiceError({
      code: "e2e/local-history-assertion-failed",
      source: "E2EFixtures",
      retryable: false,
      message: `E2E local history assertion failed: found saved meal "${targetName}".`,
    });
  }
}

async function assertNoMealByName(uid: string, targetName: string): Promise<void> {
  await assertNoLocalMealByName(uid, targetName);
  await assertNoRemoteMealByName(uid, targetName);
}

type TelemetrySummaryResponse = {
  buckets?: Array<{
    eventCounts?: Array<{
      name?: string;
      count?: number;
    }>;
  }>;
};

function telemetryBaselineKey(uid: string, assertName: E2ETelemetryEventAssert) {
  return `${uid}:${assertName}`;
}

function telemetryEventName(assertName: E2ETelemetryEventAssert): TelemetryEventName {
  return TELEMETRY_ASSERT_EVENT_NAMES[assertName];
}

function telemetryEmitProps(assertName: E2ETelemetryEventAssert): TelemetryProps {
  if (assertName === "knownPatternCandidateDismissed") {
    return {
      surface: "meal_add_method",
      confidenceBucket: "medium",
      sourceCountBucket: "3_4",
      actionResult: "succeeded",
      featureState: "enabled",
    };
  }
  if (assertName === "plannedMealConfirmed") {
    return {
      sourceType: "manual",
      estimateState: "known",
      surface: "planning",
      actionResult: "succeeded",
      featureState: "enabled",
    };
  }
  if (assertName === "memoryDeleted") {
    return {
      memoryType: "typical_portion",
      surface: "memory_center",
      actionResult: "queued",
      featureState: "enabled",
    };
  }

  return {
    actionType: "confirm_known_pattern",
    ownerFlow: "MealAddMethod",
    state: "eligible",
  };
}

function assertTelemetryRuntime(assertName: E2ETelemetryRuntimeAssert): void {
  const config = getRuntimeConfig();
  const enabled =
    assertName === "telemetryEnabled"
      ? config.telemetryEnabled
      : assertName === "knownPatternsEnabled"
        ? config.knownPatternsEnabled
        : assertName === "smartMemoryEnabled"
          ? config.smartMemoryEnabled
        : config.planningEnabled;
  if (enabled) return;

  throw createServiceError({
    code: `e2e/telemetry-runtime-${assertName}-disabled`,
    source: "E2EFixtures",
    retryable: false,
    message: `E2E telemetry runtime assertion failed for "${assertName}".`,
  });
}

async function emitTelemetryEvent(
  uid: string,
  assertName: E2ETelemetryEventAssert,
): Promise<void> {
  setTelemetryUserId(uid);
  await trackTelemetry(telemetryEventName(assertName), telemetryEmitProps(assertName));
  await flushTelemetry();
}

function countTelemetryEvents(
  summary: TelemetrySummaryResponse,
  eventName: string,
): number {
  return (summary.buckets ?? []).reduce((total, bucket) => {
    const bucketCount = (bucket.eventCounts ?? []).reduce((sum, item) => {
      return item.name === eventName ? sum + Number(item.count ?? 0) : sum;
    }, 0);
    return total + bucketCount;
  }, 0);
}

async function readTelemetryEventCount(
  eventName: string,
): Promise<number> {
  await flushTelemetry();
  const summary = await get<TelemetrySummaryResponse>(
    "/api/v2/telemetry/events/summary/daily?days=1",
    { timeout: 10000 },
  );
  return countTelemetryEvents(summary, eventName);
}

async function recordTelemetryBaseline(
  uid: string,
  assertName: E2ETelemetryEventAssert,
): Promise<void> {
  setTelemetryUserId(uid);
  const count = await readTelemetryEventCount(telemetryEventName(assertName));
  telemetryBaselineCounts.set(telemetryBaselineKey(uid, assertName), count);
}

async function assertTelemetryCountIncreased(
  uid: string,
  assertName: E2ETelemetryEventAssert,
): Promise<void> {
  const baselineKey = telemetryBaselineKey(uid, assertName);
  const baselineCount = telemetryBaselineCounts.get(baselineKey);
  if (baselineCount === undefined) {
    throw createServiceError({
      code: "e2e/telemetry-baseline-missing",
      source: "E2EFixtures",
      retryable: false,
      message: `E2E telemetry baseline missing for "${assertName}".`,
    });
  }

  const eventName = telemetryEventName(assertName);
  let lastCount = baselineCount;
  let lastError: unknown = null;
  setTelemetryUserId(uid);
  for (let attempt = 0; attempt < TELEMETRY_ASSERT_ATTEMPTS; attempt += 1) {
    try {
      lastCount = await readTelemetryEventCount(eventName);
      if (lastCount > baselineCount) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(TELEMETRY_ASSERT_DELAY_MS);
  }

  throw createServiceError({
    code: "e2e/telemetry-assertion-failed",
    source: "E2EFixtures",
    retryable: true,
    message: `E2E telemetry assertion failed for "${eventName}": baseline=${baselineCount}, current=${lastCount}.`,
    cause: lastError,
  });
}

async function clearPlanningWindow(uid: string): Promise<void> {
  const response = await fetchPlannedMealsRemote(
    {
      startDate: todayDayKey(),
      days: 3,
      includeDeleted: false,
    },
    { timeout: 10000 },
  );

  await Promise.all(
    response.items
      .filter((item) => item.status !== "deleted")
      .map((item) =>
        deletePlannedMealRemote(
          item.plannedMealId,
          {
            clientMutationId: `e2e-planning-delete:${uid}:${item.plannedMealId}:${item.version}`,
            expectedVersion: item.version,
          },
          { timeout: 10000 },
        ),
      ),
  );
}

async function applyPlanningFixture(uid: string, seed: E2EPlanningSeed): Promise<void> {
  await clearPlanningWindow(uid);

  if (seed !== "reviewReady") return;

  const mutationStamp = `${Date.now()}`;
  await createPlannedMealRemote(
    {
      clientMutationId: `e2e-planning-create:${uid}:${mutationStamp}`,
      plannedMealId: `e2e-planning-${mutationStamp}`,
      dateBucket: todayDayKey(),
      timeBucket: "lunch",
      sourceType: "manual",
      sourceRef: null,
      draftSnapshot: {
        name: "E2E Planning Bowl",
        type: "lunch",
        ingredients: [
          {
            id: `e2e-planning-ingredient-${mutationStamp}`,
            name: "E2E Planning Bowl",
            amount: 1,
            kcal: 400,
            protein: 25,
            fat: 14,
            carbs: 45,
          },
        ],
        totals: {
          kcal: 400,
          protein: 25,
          fat: 14,
          carbs: 45,
        },
        notes: null,
        tags: [],
      },
      nutritionEstimate: {
        state: "known",
        totals: {
          kcal: 400,
          protein: 25,
          fat: 14,
          carbs: 45,
        },
        missingFields: [],
        confidence: "medium",
      },
    },
    { timeout: 10000 },
  );
}

async function applyNamedFixture(
  uid: string,
  fixture: E2EFixtureName,
): Promise<void> {
  await clearLocalFixtureData(uid);

  if (fixture === "activated-user-empty") return;

  if (fixture === "user-with-today-meal") {
    await seedLoggedMeal(
      uid,
      meal({
        uid,
        id: "e2e-today-meal",
        name: "Jogurt z owocami i granolą",
        inputMethod: "manual",
        ingredients: [
          ingredient({
            id: "e2e-today-greek-yogurt",
            name: "Jogurt grecki",
            amount: 200,
            kcal: 150,
            protein: 14,
            carbs: 10,
            fat: 5,
          }),
          ingredient({
            id: "e2e-today-blueberries",
            name: "Borówki",
            amount: 80,
            kcal: 45,
            protein: 1,
            carbs: 11,
            fat: 0,
          }),
          ingredient({
            id: "e2e-today-granola",
            name: "Granola",
            amount: 40,
            kcal: 180,
            protein: 5,
            carbs: 28,
            fat: 7,
          }),
        ],
      }),
    );
    return;
  }

  if (fixture === "user-with-synced-meal") {
    await seedVisibleMeal(
      uid,
      {
        ...meal({
          uid,
          id: "e2e-synced-meal",
          name: "Jogurt z owocami i granolą",
          inputMethod: "manual",
          ingredients: [
            ingredient({
              id: "e2e-synced-greek-yogurt",
              name: "Jogurt grecki",
              amount: 200,
              kcal: 150,
              protein: 14,
              carbs: 10,
              fat: 5,
            }),
            ingredient({
              id: "e2e-synced-blueberries",
              name: "Borówki",
              amount: 80,
              kcal: 45,
              protein: 1,
              carbs: 11,
              fat: 0,
            }),
            ingredient({
              id: "e2e-synced-granola",
              name: "Granola",
              amount: 40,
              kcal: 180,
              protein: 5,
              carbs: 28,
              fat: 7,
            }),
          ],
        }),
        syncState: "synced",
      },
    );
    return;
  }

  if (fixture === "user-with-failed-meal") {
    await seedVisibleMeal(
      uid,
      {
        ...meal({
          uid,
          id: "e2e-failed-meal",
          name: "Kanapka z jajkiem",
          inputMethod: "manual",
          ingredients: [
            ingredient({
              id: "e2e-failed-bread",
              name: "Pieczywo pełnoziarniste",
              amount: 80,
              kcal: 190,
              protein: 8,
              carbs: 34,
              fat: 3,
            }),
            ingredient({
              id: "e2e-failed-eggs",
              name: "Jajka gotowane",
              amount: 100,
              kcal: 155,
              protein: 13,
              carbs: 1,
              fat: 11,
            }),
            ingredient({
              id: "e2e-failed-tomato",
              name: "Pomidor",
              amount: 60,
              kcal: 12,
              protein: 1,
              carbs: 3,
              fat: 0,
            }),
          ],
        }),
        syncState: "failed",
      },
    );
    return;
  }

  if (fixture === "user-with-conflict-meal") {
    await seedVisibleMeal(
      uid,
      {
        ...meal({
          uid,
          id: "e2e-conflict-meal",
          name: "Makaron z pomidorami",
          inputMethod: "manual",
          ingredients: [
            ingredient({
              id: "e2e-conflict-pasta",
              name: "Makaron gotowany",
              amount: 180,
              kcal: 280,
              protein: 9,
              carbs: 56,
              fat: 2,
            }),
            ingredient({
              id: "e2e-conflict-sauce",
              name: "Sos pomidorowy",
              amount: 120,
              kcal: 80,
              protein: 2,
              carbs: 14,
              fat: 2,
            }),
            ingredient({
              id: "e2e-conflict-parmesan",
              name: "Parmesan",
              amount: 20,
              kcal: 80,
              protein: 7,
              carbs: 1,
              fat: 6,
            }),
          ],
        }),
        syncState: "conflict",
      },
    );
    return;
  }

  if (fixture === "user-with-private-product-conflict") {
    await upsertLocalIngredientProductUserRecord({
      uid,
      item: privateIngredientProductConflictRow(uid),
      syncState: "conflict",
      updatedAt: e2eNowISO(),
      lastSyncedAt: 0,
      lastErrorCode: "food-library/conflict",
      lastErrorMessage:
        "Remote Product/Ingredient record conflicts with pending local create.",
    });
    return;
  }

  if (fixture === "user-with-photo-meal") {
    const sampleMealUri = await getSampleMealUri();
    await seedLoggedMeal(
      uid,
      meal({
        uid,
        id: "e2e-photo-meal",
        name: "Talerz z kurczakiem",
        source: "ai",
        inputMethod: "photo",
        photoUrl: sampleMealUri,
        ingredients: [
          ingredient({
            id: "e2e-photo-chicken",
            name: "Kurczak grillowany",
            amount: 150,
            kcal: 245,
            protein: 43,
            carbs: 0,
            fat: 6,
          }),
          ingredient({
            id: "e2e-photo-potatoes",
            name: "Pieczone ziemniaki",
            amount: 160,
            kcal: 210,
            protein: 4,
            carbs: 38,
            fat: 5,
          }),
          ingredient({
            id: "e2e-photo-salad",
            name: "Sałatka z ogórka i pomidora",
            amount: 120,
            kcal: 45,
            protein: 2,
            carbs: 8,
            fat: 1,
          }),
        ],
      }),
    );
    return;
  }

  if (fixture === "user-with-saved-meals") {
    await seedSavedMeal(
      uid,
      meal({
        uid,
        id: "e2e-saved-meal-1",
        name: "Miska z kaszą i warzywami",
        source: "saved",
        inputMethod: "manual",
        ingredients: [
          ingredient({
            id: "e2e-saved-bulgur",
            name: "Kasza bulgur",
            amount: 160,
            kcal: 170,
            protein: 6,
            carbs: 37,
            fat: 0,
          }),
          ingredient({
            id: "e2e-saved-chickpeas",
            name: "Ciecierzyca",
            amount: 100,
            kcal: 165,
            protein: 9,
            carbs: 27,
            fat: 3,
          }),
          ingredient({
            id: "e2e-saved-vegetables",
            name: "Pieczone warzywa",
            amount: 140,
            kcal: 90,
            protein: 3,
            carbs: 16,
            fat: 2,
          }),
        ],
      }),
    );
    await seedSavedMeal(
      uid,
      meal({
        uid,
        id: "e2e-saved-meal-2",
        name: "Koktajl białkowy z owocami",
        source: "saved",
        inputMethod: "manual",
        ingredients: [
          ingredient({
            id: "e2e-smoothie-yogurt",
            name: "Jogurt grecki",
            amount: 180,
            kcal: 135,
            protein: 17,
            carbs: 7,
            fat: 4,
          }),
          ingredient({
            id: "e2e-smoothie-berries",
            name: "Owoce jagodowe",
            amount: 120,
            kcal: 65,
            protein: 1,
            carbs: 15,
            fat: 0,
          }),
          ingredient({
            id: "e2e-smoothie-banana",
            name: "Banana",
            amount: 90,
            kcal: 80,
            protein: 1,
            carbs: 21,
            fat: 0,
          }),
        ],
      }),
    );
    return;
  }

  if (fixture === "user-with-draft") {
    const draft = meal({
      uid,
      id: "e2e-draft-meal",
      name: "Kurczak z ryżem",
      source: "manual",
      inputMethod: "manual",
    });
    await AsyncStorage.setItem(getDraftKey(uid), JSON.stringify(draft));
    await AsyncStorage.setItem(getScreenKey(uid), "AddMeal");
  }
}

async function persistFixtureState(): Promise<void> {
  await AsyncStorage.setItem(E2E_FIXTURE_STATE_KEY, JSON.stringify(fixtureState));
}

export async function applyE2ESeedCommand(params: {
  uid: string | null | undefined;
  command: E2ESeedCommand;
}): Promise<string[]> {
  if (!isE2EModeEnabled()) return [];
  if (!hasSeedCommand(params.command)) return [];

  const appliedCommand =
    !params.uid
      ? {
          ...params.command,
          fixture: undefined,
          aiConsent: undefined,
          smartMemory: undefined,
          knownPattern: undefined,
          planning: undefined,
          historyAssert: undefined,
          telemetryBaseline: undefined,
          telemetryAssert: undefined,
          telemetryEmit: undefined,
        }
      : params.command;
  if (!hasSeedCommand(appliedCommand)) return [];

  if ("aiConsentRevoke" in appliedCommand) {
    aiConsentRevokeFailureOnceConsumed = new Set<string>();
  }

  fixtureState = {
    ...fixtureState,
    ...appliedCommand,
  };
  await persistFixtureState();

  if (params.uid && appliedCommand.fixture) {
    await applyNamedFixture(params.uid, appliedCommand.fixture);
  }

  if (params.uid && appliedCommand.planning) {
    await applyPlanningFixture(params.uid, appliedCommand.planning);
  }

  if (params.uid && appliedCommand.aiConsent) {
    const aiConsent = aiConsentForSeed(appliedCommand.aiConsent);
    aiConsentSeedByUid.set(params.uid, aiConsent);
    emit("e2e:aiConsentSeeded", {
      uid: params.uid,
      aiConsent,
    });
  }

  if (params.uid && appliedCommand.smartMemory) {
    if (appliedCommand.smartMemory === "backendPull") {
      await pullSmartMemoryChanges(params.uid);
    } else {
      await applySmartMemoryFixture(params.uid, appliedCommand.smartMemory);
    }
  }

  if (params.uid && appliedCommand.knownPattern) {
    await applyKnownPatternFixture(params.uid);
  }

  if (params.uid && appliedCommand.historyAssert) {
    await assertNoMealByName(
      params.uid,
      HISTORY_ASSERT_MEAL_NAMES[appliedCommand.historyAssert],
    );
  }

  if (params.uid && appliedCommand.telemetryBaseline) {
    await recordTelemetryBaseline(params.uid, appliedCommand.telemetryBaseline);
  }

  if (params.uid && appliedCommand.telemetryAssert) {
    await assertTelemetryCountIncreased(params.uid, appliedCommand.telemetryAssert);
  }

  if (params.uid && appliedCommand.telemetryEmit) {
    await emitTelemetryEvent(params.uid, appliedCommand.telemetryEmit);
  }

  if (appliedCommand.telemetryRuntime) {
    assertTelemetryRuntime(appliedCommand.telemetryRuntime);
  }

  emit("e2e:seeded", fixtureState);
  return seedMarkers(appliedCommand);
}

export function getE2EFixtureState(): E2EFixtureState | null {
  if (!isE2EModeEnabled()) return null;
  return fixtureState;
}

export function resolveE2EAiConsentSeed(uid: string): UserAiConsent | null {
  if (!isE2EModeEnabled()) return null;
  const aiConsent = aiConsentSeedByUid.get(uid);
  return aiConsent ? copyAiConsent(aiConsent) : null;
}

function creditsStatus(uid: string, credits: E2ECreditsSeed): AiCreditsStatus {
  const premium =
    fixtureState.billing === "premium" || fixtureState.billing === "restoreSuccess";
  const balance = credits === "ok" ? 20 : credits === "low" ? 1 : 0;
  return {
    userId: uid,
    tier: premium ? "premium" : "free",
    balance,
    allocation: premium ? 800 : 20,
    periodStartAt: "2026-05-01T00:00:00.000Z",
    periodEndAt: "2026-06-01T00:00:00.000Z",
    costs: { chat: 1, textMeal: 1, photo: 1 },
    renewalAnchorSource: "e2e",
    revenueCatEntitlementId: premium ? "premium" : null,
    revenueCatExpirationAt: premium ? "2026-06-01T00:00:00.000Z" : null,
    lastRevenueCatEventId: null,
  };
}

function feature(
  enabled: boolean,
  requiredCredits: number | null,
  remainingCredits: number | null,
) {
  return {
    enabled,
    status: enabled ? "enabled" as const : "disabled" as const,
    reason: enabled ? null : "insufficient_credits" as const,
    requiredCredits,
    remainingCredits,
  };
}

export function getE2EAccessState(uid: string): AccessState | null {
  if (!isE2EModeEnabled()) return null;

  const billing = fixtureState.billing ?? "free";
  const credits = creditsStatus(uid, fixtureState.credits ?? "ok");
  const premium = billing === "premium" || billing === "restoreSuccess";
  const hasAiCredit = credits.balance >= 1;
  const premiumFeature = {
    enabled: premium,
    status: premium ? "enabled" as const : "disabled" as const,
    reason: premium ? null : "requires_premium" as const,
    requiredCredits: null,
    remainingCredits: credits.balance,
  };
  const aiFeature = feature(hasAiCredit, 1, credits.balance);
  const features: AccessState["features"] = {
    aiChat: { ...aiFeature },
    photoAnalysis: { ...aiFeature },
    textMealAnalysis: { ...aiFeature },
    weeklyReport: { ...premiumFeature },
    fullHistory: { ...premiumFeature },
    cloudBackup: { ...premiumFeature },
  };

  return {
    tier: premium ? "premium" : "free",
    entitlementStatus: premium ? "active" : "inactive",
    credits,
    features: Object.keys(features).reduce((acc, key) => {
      acc[key as AccessFeatureKey] = features[key as AccessFeatureKey];
      return acc;
    }, {} as AccessState["features"]),
    refreshedAt: e2eNowISO(),
  };
}

export function resolveE2EChatRun(): { reply: string } | { error: Error } | null {
  if (!isE2EModeEnabled()) return null;
  switch (fixtureState.chat) {
    case "success":
      return {
        reply:
          "Wygląda na to, że najważniejszy kolejny krok to spokojnie dopilnować białka i nawodnienia.",
      };
    case "failure":
      return {
        error: createServiceError({
          code: "api/e2e-chat-failure",
          source: "E2EChatService",
          retryable: true,
          message: "E2E deterministic chat failure",
        }),
      };
    default:
      return null;
  }
}

function aiConsentGrantedFrom(
  currentAiConsent: UserAiConsent | null | undefined,
): UserAiConsent {
  if (
    currentAiConsent?.status === "granted" &&
    currentAiConsent.grantedAt &&
    currentAiConsent.revokedAt === null
  ) {
    return { ...currentAiConsent };
  }

  return {
    status: "granted",
    grantedAt: E2E_AI_CONSENT_GRANTED_AT,
    revokedAt: null,
  };
}

function aiConsentRevokedFrom(
  currentAiConsent: UserAiConsent | null | undefined,
): UserAiConsent {
  return {
    status: "revoked",
    grantedAt: currentAiConsent?.grantedAt ?? E2E_AI_CONSENT_GRANTED_AT,
    revokedAt: currentAiConsent?.revokedAt ?? E2E_AI_CONSENT_REVOKED_AT,
  };
}

function aiConsentMutationError(action: "grant" | "revoke"): Error {
  return createServiceError({
    code: `ai-consent/e2e-${action}-failure`,
    source: "E2EAiConsentFixture",
    retryable: action === "revoke",
    message: `E2E deterministic AI consent ${action} failure`,
  });
}

export function resolveE2EAiConsentGrant(
  uid: string,
  currentAiConsent: UserAiConsent | null | undefined,
): { aiConsent: UserAiConsent } | { error: Error } | null {
  void uid;
  if (!isE2EModeEnabled() || !fixtureState.aiConsentGrant) return null;

  if (fixtureState.aiConsentGrant === "failure") {
    return { error: aiConsentMutationError("grant") };
  }

  const aiConsent = aiConsentGrantedFrom(currentAiConsent);
  aiConsentSeedByUid.set(uid, aiConsent);
  return { aiConsent };
}

export function resolveE2EAiConsentRevoke(
  uid: string,
  currentAiConsent: UserAiConsent | null | undefined,
): { aiConsent: UserAiConsent } | { error: Error } | null {
  if (!isE2EModeEnabled() || !fixtureState.aiConsentRevoke) return null;

  if (fixtureState.aiConsentRevoke === "failure") {
    return { error: aiConsentMutationError("revoke") };
  }

  if (fixtureState.aiConsentRevoke === "failureOnce") {
    const key = `${uid}:revoke`;
    if (!aiConsentRevokeFailureOnceConsumed.has(key)) {
      aiConsentRevokeFailureOnceConsumed.add(key);
      return { error: aiConsentMutationError("revoke") };
    }
  }

  const aiConsent = aiConsentRevokedFrom(currentAiConsent);
  aiConsentSeedByUid.set(uid, aiConsent);
  return { aiConsent };
}

function aiCreditsResponse(uid: string): AiTextMealAnalyzeResponse {
  return {
    version: "e2e",
    persistence: "backend_owned",
    model: "e2e-fixture",
    runId: "e2e-ai-success",
    confidence: 0.98,
    warnings: [],
    ...creditsStatus(uid, fixtureState.credits ?? "ok"),
    ingredients: [
      {
        name: "Kurczak z ryżem",
        amount: 380,
        kcal: 520,
        protein: 38,
        carbs: 58,
        fat: 14,
      },
    ],
  };
}

function e2eAiIngredient(): Ingredient {
  return ingredient({
    id: "e2e-ai-ingredient",
    name: "Kurczak z ryżem",
    amount: 380,
    kcal: 520,
    protein: 38,
    carbs: 58,
    fat: 14,
  });
}

function addDaysToDayKey(dayKey: string, offset: number): string {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function e2eUtc(dayKey: string, hour: number): string {
  return `${dayKey}T${String(hour).padStart(2, "0")}:00:00Z`;
}

export function resolveE2ENotificationPermission():
  | { granted: boolean; status: "granted" | "denied"; canAskAgain: boolean }
  | null {
  if (!isE2EModeEnabled()) return null;
  if (fixtureState.notificationPermission === "allowed") {
    return { granted: true, status: "granted", canAskAgain: true };
  }
  if (fixtureState.notificationPermission === "denied") {
    return { granted: false, status: "denied", canAskAgain: false };
  }
  return null;
}

export function resolveE2EReminderDecision(
  uid: string | null | undefined,
  dayKey: string,
): ReminderDecisionResult | null {
  if (!isE2EModeEnabled() || !fixtureState.reminder) return null;

  if (fixtureState.reminder === "disabled") {
    return {
      decision: null,
      source: "disabled",
      status: "disabled",
      enabled: false,
      error: null,
    };
  }

  if (!uid) {
    return {
      decision: null,
      source: "fallback",
      status: "no_user",
      enabled: true,
      error: null,
    };
  }

  const base = {
    dayKey,
    computedAt: e2eUtc(dayKey, 9),
    confidence: 0.92,
    validUntil: e2eUtc(dayKey, 23),
  };
  let decision: ReminderDecision;

  if (fixtureState.reminder === "send") {
    decision = {
      ...base,
      decision: "send",
      kind: "log_next_meal",
      reasonCodes: ["day_partially_logged"],
      scheduledAtUtc: e2eUtc(dayKey, 12),
    };
  } else if (fixtureState.reminder === "suppress") {
    decision = {
      ...base,
      decision: "suppress",
      kind: null,
      reasonCodes: ["already_logged_recently"],
      scheduledAtUtc: null,
    };
  } else {
    decision = {
      ...base,
      decision: "noop",
      kind: null,
      reasonCodes: ["insufficient_signal"],
      scheduledAtUtc: null,
    };
  }

  return {
    decision,
    source: "remote",
    status: "live_success",
    enabled: true,
    error: null,
  };
}

function e2eWeeklyReport(weekEnd: string): WeeklyReport {
  return {
    status: "ready",
    period: {
      startDay: addDaysToDayKey(weekEnd, -6),
      endDay: weekEnd,
    },
    summary: "E2E: kalorie i białko utrzymały stabilny rytm.",
    insights: [
      {
        type: "consistency",
        importance: "high",
        tone: "positive",
        title: "Regularne wpisy",
        body: "Większość posiłków została dodana blisko planowanych pór dnia.",
        reasonCodes: ["e2e_consistency"],
      },
      {
        type: "logging_coverage",
        importance: "medium",
        tone: "neutral",
        title: "Pełniejszy obraz dnia",
        body: "Lunch i kolacja dają już wystarczający sygnał do krótkiego przeglądu.",
        reasonCodes: ["e2e_coverage"],
      },
    ],
    priorities: [
      {
        type: "maintain_consistency",
        text: "Dodawaj pierwszy posiłek przed południem.",
        reasonCodes: ["e2e_priority"],
      },
      {
        type: "increase_logging_coverage",
        text: "Uzupełniaj przekąski, gdy zmieniają dzienną sumę.",
        reasonCodes: ["e2e_snacks"],
      },
    ],
  };
}

export function resolveE2EWeeklyReport(
  uid: string | null | undefined,
  weekEnd: string,
): WeeklyReportResult | null {
  if (!isE2EModeEnabled() || !fixtureState.weeklyReport) return null;

  if (!uid) {
    return {
      report: e2eWeeklyReport(weekEnd),
      source: "fallback",
      status: "no_user",
      enabled: true,
      error: null,
    };
  }

  if (fixtureState.weeklyReport === "available") {
    return {
      report: e2eWeeklyReport(weekEnd),
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    };
  }

  const report: WeeklyReport = {
    ...e2eWeeklyReport(weekEnd),
    status: "not_available",
    summary: null,
    insights: [],
    priorities: [],
  };
  const status =
    fixtureState.weeklyReport === "forbidden"
      ? "premium_required"
      : fixtureState.weeklyReport === "disabled"
        ? "feature_disabled"
        : "service_unavailable";

  return {
    report,
    source: fixtureState.weeklyReport === "disabled" ? "disabled" : "fallback",
    status,
    enabled: fixtureState.weeklyReport !== "disabled",
    error: new Error(`E2E weekly report ${fixtureState.weeklyReport}`),
  };
}

export function resolveE2EShareExport(
  destination: "gallery" | "share_sheet",
):
  | { status: "success"; assetUri: string }
  | { status: "error"; code: "permission" | "share_unavailable" | "failure" }
  | null {
  if (!isE2EModeEnabled() || !fixtureState.shareExport) return null;
  if (fixtureState.shareExport === "success") {
    return {
      status: "success",
      assetUri: `file:///tmp/fitaly-e2e-share-${destination}.png`,
    };
  }
  if (fixtureState.shareExport === "permissionDenied") {
    return { status: "error", code: "permission" };
  }
  if (fixtureState.shareExport === "shareUnavailable") {
    return { status: "error", code: "share_unavailable" };
  }
  return { status: "error", code: "failure" };
}

const E2E_TEXT_SLOW_ANALYSIS_DELAY_MS = 4000;
const E2E_PHOTO_SLOW_ANALYSIS_DELAY_MS = 4000;
const E2E_BILLING_RESTORE_SLOW_DELAY_MS = 5000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function insufficientCreditsError(source: string): Error {
  const error = createServiceError({
    code: "ai/insufficient-credits",
    source,
    retryable: false,
    message: "E2E insufficient credits",
  }) as Error & { status?: number };
  error.status = 402;
  return error;
}

function timeoutError(source: string): Error {
  return createServiceError({
    code: "api/timeout",
    source,
    retryable: true,
    message: "E2E timeout",
  });
}

export async function resolveE2ETextMealAnalysis(
  uid: string,
): Promise<{ ingredients: Ingredient[]; credits: AiTextMealAnalyzeResponse } | null> {
  if (!isE2EModeEnabled()) return null;
  const ai = fixtureState.ai;
  if (!ai || ai === "photoSuccess" || ai === "photoSlow") return null;
  if (ai === "textSlow") {
    await wait(E2E_TEXT_SLOW_ANALYSIS_DELAY_MS);
  }
  if (ai === "failure") return { ingredients: [], credits: aiCreditsResponse(uid) };
  if (ai === "timeout") throw timeoutError("E2ETextMealService");
  if (ai === "insufficientCredits") throw insufficientCreditsError("E2ETextMealService");
  return { ingredients: [e2eAiIngredient()], credits: aiCreditsResponse(uid) };
}

export async function resolveE2EPhotoAnalysis(
  uid: string,
): Promise<{ ingredients: Ingredient[] | null; credits: AiPhotoAnalyzeResponse } | null> {
  if (!isE2EModeEnabled()) return null;
  const ai = fixtureState.ai;
  if (!ai || ai === "textSuccess" || ai === "textSlow") return null;
  if (ai === "photoSlow") {
    await wait(E2E_PHOTO_SLOW_ANALYSIS_DELAY_MS);
  }
  if (ai === "failure") return { ingredients: null, credits: aiCreditsResponse(uid) };
  if (ai === "timeout") throw timeoutError("E2EVisionService");
  if (ai === "insufficientCredits") throw insufficientCreditsError("E2EVisionService");
  return { ingredients: [e2eAiIngredient()], credits: aiCreditsResponse(uid) };
}

export function resolveE2EBarcodeLookup(): BarcodeLookupResult | null {
  if (!isE2EModeEnabled()) return null;
  switch (fixtureState.barcode) {
    case "known":
      return {
        kind: "found",
        name: "Jogurt naturalny",
        ingredient: ingredient({
          id: "e2e-barcode-ingredient",
          name: "Jogurt naturalny",
          kcal: 120,
          protein: 10,
          carbs: 12,
          fat: 3,
        }),
      };
    case "unknown":
      return { kind: "not_found" };
    case "invalid":
    case "offline":
      return { kind: "error" };
    default:
      return null;
  }
}

export function resolveE2EBillingPurchaseResult(
  action: "purchase" | "restore",
):
  | { status: "success"; delayMs?: number }
  | {
      status: "error";
      errorCode: "entitlement_inactive" | "network";
      message: string;
      delayMs?: number;
    }
  | null {
  if (!isE2EModeEnabled()) return null;
  const billing = fixtureState.billing;
  if (!billing) return null;

  if (billing === "premium" || billing === "restoreSuccess") {
    return { status: "success" };
  }

  if (billing === "restorePending" && action === "restore") {
    return { status: "success" };
  }

  if (billing === "restoreError" && action === "restore") {
    return {
      status: "error",
      errorCode: "network",
      message: "E2E restore could not contact the store.",
    };
  }

  if (billing === "restoreSlowFailure" && action === "restore") {
    return {
      status: "error",
      errorCode: "entitlement_inactive",
      message: "E2E delayed restore did not find an active entitlement.",
      delayMs: E2E_BILLING_RESTORE_SLOW_DELAY_MS,
    };
  }

  if (billing === "restoreFailure" || action === "restore") {
    return {
      status: "error",
      errorCode: "entitlement_inactive",
      message: "E2E restore did not find an active entitlement.",
    };
  }

  return {
    status: "error",
    errorCode: "entitlement_inactive",
    message: "E2E free billing state has no active entitlement.",
  };
}

export function __resetE2EFixturesForTests(): void {
  fixtureState = {};
  aiConsentRevokeFailureOnceConsumed = new Set<string>();
  aiConsentSeedByUid = new Map<string, UserAiConsent>();
  knownPatternSeedCounter = 0;
  telemetryBaselineCounts = new Map<string, number>();
}

export async function resetE2EFixtureState(): Promise<void> {
  if (!isE2EModeEnabled()) return;
  fixtureState = {};
  aiConsentRevokeFailureOnceConsumed = new Set<string>();
  aiConsentSeedByUid = new Map<string, UserAiConsent>();
  knownPatternSeedCounter = 0;
  telemetryBaselineCounts = new Map<string, number>();
  await AsyncStorage.removeItem(E2E_FIXTURE_STATE_KEY);
  emit("e2e:seeded", fixtureState);
}
