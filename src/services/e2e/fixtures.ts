import AsyncStorage from "@react-native-async-storage/async-storage";
import { emit } from "@/services/core/events";
import { createServiceError } from "@/services/contracts/serviceError";
import { isE2EModeEnabled } from "@/services/e2e/config";
import { getDraftKey, getScreenKey } from "@/context/MealDraftContext";
import { resetOfflineStorage } from "@/services/offline/db";
import { saveMealTransaction } from "@/services/meals/mealSaveTransaction";
import { upsertMyMealLocal } from "@/services/meals/myMealService";
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
import type { Ingredient, Meal } from "@/types/meal";

export type E2EFixtureName =
  | "activated-user-empty"
  | "user-with-today-meal"
  | "user-with-photo-meal"
  | "user-with-saved-meals"
  | "user-with-draft";
export type E2ECreditsSeed = "ok" | "low" | "none";
export type E2EAiSeed =
  | "textSuccess"
  | "photoSuccess"
  | "failure"
  | "timeout"
  | "insufficientCredits";
export type E2EBarcodeSeed = "known" | "unknown" | "invalid" | "offline";
export type E2EBillingSeed =
  | "free"
  | "premium"
  | "restoreSuccess"
  | "restoreFailure";
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
};

type E2EFixtureState = E2ESeedCommand;

const VALID_FIXTURES = new Set<E2EFixtureName>([
  "activated-user-empty",
  "user-with-today-meal",
  "user-with-photo-meal",
  "user-with-saved-meals",
  "user-with-draft",
]);
const VALID_CREDITS = new Set<E2ECreditsSeed>(["ok", "low", "none"]);
const VALID_AI = new Set<E2EAiSeed>([
  "textSuccess",
  "photoSuccess",
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
  "restoreFailure",
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

const E2E_FIXTURE_STATE_KEY = "e2e_fixture_state";
let fixtureState: E2EFixtureState = {};

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
      command.weeklyReport,
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
  return markers;
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
        id: `${params.id}-ingredient`,
        name: "E2E grilled bowl",
        kcal: 420,
        protein: 32,
        carbs: 41,
        fat: 14,
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

async function seedSavedMeal(uid: string, fixtureMeal: Meal): Promise<void> {
  await upsertMyMealLocal(uid, {
    ...fixtureMeal,
    userUid: uid,
    source: "saved",
    inputMethod: "saved",
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
        name: "E2E Today Meal",
        inputMethod: "manual",
      }),
    );
    return;
  }

  if (fixture === "user-with-photo-meal") {
    await seedLoggedMeal(
      uid,
      meal({
        uid,
        id: "e2e-photo-meal",
        name: "E2E Photo Meal",
        source: "ai",
        inputMethod: "photo",
        photoUrl: "https://example.com/fitaly-e2e-photo-meal.jpg",
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
        name: "E2E Saved Bowl",
        source: "saved",
        inputMethod: "saved",
      }),
    );
    await seedSavedMeal(
      uid,
      meal({
        uid,
        id: "e2e-saved-meal-2",
        name: "E2E Saved Smoothie",
        source: "saved",
        inputMethod: "saved",
        ingredients: [
          ingredient({
            id: "e2e-smoothie-ingredient",
            name: "E2E protein smoothie",
            kcal: 310,
            protein: 28,
            carbs: 30,
            fat: 8,
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
      name: "E2E Draft Meal",
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
    params.command.fixture && !params.uid
      ? { ...params.command, fixture: undefined }
      : params.command;
  if (!hasSeedCommand(appliedCommand)) return [];

  fixtureState = {
    ...fixtureState,
    ...appliedCommand,
  };
  await persistFixtureState();

  if (params.uid && appliedCommand.fixture) {
    await applyNamedFixture(params.uid, appliedCommand.fixture);
  }

  emit("e2e:seeded", fixtureState);
  return seedMarkers(appliedCommand);
}

export function getE2EFixtureState(): E2EFixtureState | null {
  if (!isE2EModeEnabled()) return null;
  return fixtureState;
}

function creditsStatus(uid: string, credits: E2ECreditsSeed): AiCreditsStatus {
  const premium =
    fixtureState.billing === "premium" || fixtureState.billing === "restoreSuccess";
  const balance = credits === "ok" ? 20 : credits === "low" ? 1 : 0;
  return {
    userId: uid,
    tier: premium ? "premium" : "free",
    balance,
    allocation: premium ? 100 : 20,
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
          "E2E chat response: keep hydration consistent and plan the next meal.",
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
        name: "E2E analyzed bowl",
        amount: 100,
        kcal: 430,
        protein: 31,
        carbs: 45,
        fat: 13,
      },
    ],
  };
}

function e2eAiIngredient(): Ingredient {
  return ingredient({
    id: "e2e-ai-ingredient",
    name: "E2E analyzed bowl",
    kcal: 430,
    protein: 31,
    carbs: 45,
    fat: 13,
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
    summary: "E2E weekly report: calories and protein stayed consistent.",
    insights: [
      {
        type: "consistency",
        importance: "high",
        tone: "positive",
        title: "Consistent logging",
        body: "Most meals were logged close to the planned day windows.",
        reasonCodes: ["e2e_consistency"],
      },
      {
        type: "logging_coverage",
        importance: "medium",
        tone: "neutral",
        title: "Coverage is improving",
        body: "Lunch and dinner have enough signal for a useful review.",
        reasonCodes: ["e2e_coverage"],
      },
    ],
    priorities: [
      {
        type: "maintain_consistency",
        text: "Keep logging your first meal before noon.",
        reasonCodes: ["e2e_priority"],
      },
      {
        type: "increase_logging_coverage",
        text: "Add missing snacks when they affect your daily totals.",
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
  if (!ai || ai === "photoSuccess") return null;
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
  if (!ai || ai === "textSuccess") return null;
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
        name: "E2E Barcode Yogurt",
        ingredient: ingredient({
          id: "e2e-barcode-ingredient",
          name: "E2E Barcode Yogurt",
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
): { status: "success" } | { status: "error"; errorCode: "entitlement_inactive"; message: string } | null {
  if (!isE2EModeEnabled()) return null;
  const billing = fixtureState.billing;
  if (!billing) return null;

  if (billing === "premium" || billing === "restoreSuccess") {
    return { status: "success" };
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
}

export async function resetE2EFixtureState(): Promise<void> {
  if (!isE2EModeEnabled()) return;
  fixtureState = {};
  await AsyncStorage.removeItem(E2E_FIXTURE_STATE_KEY);
  emit("e2e:seeded", fixtureState);
}
