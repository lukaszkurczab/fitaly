import AsyncStorage from "@react-native-async-storage/async-storage";
import { emit } from "@/services/core/events";
import { createServiceError } from "@/services/contracts/serviceError";
import { isE2EModeEnabled } from "@/services/e2e/config";
import { getDraftKey, getScreenKey } from "@/context/MealDraftContext";
import { resetOfflineStorage } from "@/services/offline/db";
import { upsertMealLocal } from "@/services/offline/meals.repo";
import { saveMealTransaction } from "@/services/meals/mealSaveTransaction";
import { upsertMyMealLocal } from "@/services/meals/myMealService";
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
  upsertSmartMemoryItemProjection,
  upsertSmartMemorySettingsProjection,
} from "@/services/smartMemory/smartMemoryProjectionRepository";
import type { Ingredient, Meal } from "@/types/meal";
import type {
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
  | "user-with-conflict-meal";
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
  | "muted"
  | "sourceDeleted"
  | "pending"
  | "syncFailed";

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
  "muted",
  "sourceDeleted",
  "pending",
  "syncFailed",
]);

const E2E_FIXTURE_STATE_KEY = "e2e_fixture_state";
const E2E_AI_CONSENT_GRANTED_AT = "2026-05-01T10:00:00.000Z";
const E2E_AI_CONSENT_REVOKED_AT = "2026-05-02T10:00:00.000Z";
let fixtureState: E2EFixtureState = {};
let aiConsentRevokeFailureOnceConsumed = new Set<string>();
let aiConsentSeedByUid = new Map<string, UserAiConsent>();

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
      command.smartMemory,
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

async function applySmartMemoryFixture(
  uid: string,
  seed: E2ESmartMemorySeed,
): Promise<void> {
  await upsertSmartMemorySettingsProjection(
    uid,
    smartMemorySettings(uid, seed !== "emptyDisabled"),
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

  await upsertSmartMemoryItemProjection(
    uid,
    smartMemoryItem(
      uid,
      seed === "reviewActive"
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

  if (params.uid && appliedCommand.aiConsent) {
    const aiConsent = aiConsentForSeed(appliedCommand.aiConsent);
    aiConsentSeedByUid.set(params.uid, aiConsent);
    emit("e2e:aiConsentSeeded", {
      uid: params.uid,
      aiConsent,
    });
  }

  if (params.uid && appliedCommand.smartMemory) {
    await applySmartMemoryFixture(params.uid, appliedCommand.smartMemory);
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
  if (!fixtureState.credits && !fixtureState.billing) return null;

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
}

export async function resetE2EFixtureState(): Promise<void> {
  if (!isE2EModeEnabled()) return;
  fixtureState = {};
  aiConsentRevokeFailureOnceConsumed = new Set<string>();
  aiConsentSeedByUid = new Map<string, UserAiConsent>();
  await AsyncStorage.removeItem(E2E_FIXTURE_STATE_KEY);
  emit("e2e:seeded", fixtureState);
}
