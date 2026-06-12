import AsyncStorage from "@react-native-async-storage/async-storage";
import { get } from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import {
  asBoolean,
  asNumber,
  asString,
  isRecord,
} from "@/services/contracts/guards";
import { debugScope } from "@/utils/debug";
import type {
  NutritionAiCosts,
  NutritionAiSummary,
  NutritionBehavior,
  NutritionCoachPriority,
  NutritionComponentState,
  NutritionConsumed,
  NutritionDataQuality,
  NutritionDayCoverage14,
  NutritionHabitsSummary,
  NutritionOverTarget,
  NutritionMealTypeCoverage14,
  NutritionMealTypeFrequency14,
  NutritionProteinDaysHit14,
  NutritionQuality,
  NutritionRemaining,
  NutritionState,
  NutritionStateMeta,
  NutritionStateResult,
  NutritionTimingPatterns14,
  NutritionTopRisk,
  NutritionTargets,
} from "@/services/nutritionState/nutritionStateTypes";

const log = debugScope("NutritionStateService");
const NUTRITION_STATE_ENDPOINT = withV2("/users/me/state");

export const NUTRITION_STATE_STORAGE_KEY_PREFIX = "nutrition-state:last:v1";

const memoryCacheByKey = new Map<string, NutritionState>();
const inFlightByKey = new Map<
  string,
  { promise: Promise<NutritionStateResult> }
>();
const cacheGenerationByKey = new Map<string, number>();

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentNutritionStateDayKey(now: Date = new Date()): string {
  return toDayKey(now);
}

function normalizeDayKey(dayKey?: string | null): string {
  const normalized = dayKey?.trim();
  return normalized || getCurrentNutritionStateDayKey();
}

function toNullableNumber(value: unknown): number | null {
  return asNumber(value) ?? null;
}

function toClampedNumber(
  value: unknown,
  fallback: number,
  { min, max }: { min?: number; max?: number } = {},
): number {
  const next = asNumber(value);
  if (next === undefined) {
    return fallback;
  }

  if (min !== undefined && next < min) {
    return min;
  }

  if (max !== undefined && next > max) {
    return max;
  }

  return next;
}

function toTier(value: unknown): "free" | "premium" | null {
  return value === "free" || value === "premium" ? value : null;
}

function toTopRisk(value: unknown): NutritionTopRisk {
  switch (value) {
    case "under_logging":
    case "low_protein_consistency":
    case "high_unknown_meal_details":
    case "calorie_under_target":
      return value;
    default:
      return "none";
  }
}

function toCoachPriority(value: unknown): NutritionCoachPriority {
  switch (value) {
    case "logging_foundation":
    case "protein_consistency":
    case "meal_detail_quality":
    case "calorie_adherence":
      return value;
    default:
      return "maintain";
  }
}

function createFallbackTargets(): NutritionTargets {
  return {
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  };
}

function createFallbackConsumed(): NutritionConsumed {
  return {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
}

function createFallbackRemaining(): NutritionRemaining {
  return {
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  };
}

function createFallbackOverTarget(): NutritionOverTarget {
  return {
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  };
}

function createFallbackQuality(): NutritionQuality {
  return {
    mealsLogged: 0,
    missingNutritionMeals: 0,
    dataCompletenessScore: 0,
  };
}

function createFallbackMealTypeCoverage14(): NutritionMealTypeCoverage14 {
  return {
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false,
    other: false,
    coveredCount: 0,
  };
}

function createFallbackMealTypeFrequency14(): NutritionMealTypeFrequency14 {
  return {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
    other: 0,
  };
}

function createFallbackDayCoverage14(): NutritionDayCoverage14 {
  return {
    loggedDays: 0,
    validLoggedDays: 0,
  };
}

function createFallbackProteinDaysHit14(): NutritionProteinDaysHit14 {
  return {
    hitDays: 0,
    eligibleDays: 0,
    unknownDays: 0,
    ratio: null,
  };
}

function createFallbackTimingPatterns14(): NutritionTimingPatterns14 {
  return {
    available: false,
    observedDays: 0,
    firstMealMedianHour: null,
    lastMealMedianHour: null,
    eatingWindowHoursMedian: null,
    breakfastMedianHour: null,
    lunchMedianHour: null,
    dinnerMedianHour: null,
    snackMedianHour: null,
    otherMedianHour: null,
  };
}

function createFallbackBehavior(): NutritionBehavior {
  return {
    loggingDays7: 0,
    validLoggingDays7: 0,
    loggingConsistency28: 0,
    validLoggingConsistency28: 0,
    avgMealsPerLoggedDay14: 0,
    avgValidMealsPerValidLoggedDay14: 0,
    mealTypeCoverage14: createFallbackMealTypeCoverage14(),
    mealTypeFrequency14: createFallbackMealTypeFrequency14(),
    dayCoverage14: createFallbackDayCoverage14(),
    kcalAdherence14: null,
    kcalUnderTargetRatio14: null,
    proteinDaysHit14: createFallbackProteinDaysHit14(),
    timingPatterns14: createFallbackTimingPatterns14(),
  };
}

function createFallbackDataQuality(): NutritionDataQuality {
  return {
    daysWithUnknownMealDetails14: 0,
    daysUsingTimestampDayFallback14: 0,
    daysUsingTimestampTimingFallback14: 0,
  };
}

function createFallbackComponentStatus(): NutritionStateMeta["componentStatus"] {
  return {
    habits: "disabled",
    streak: "disabled",
    ai: "disabled",
  };
}

function createFallbackMeta(): NutritionStateMeta {
  return {
    isDegraded: false,
    componentStatus: createFallbackComponentStatus(),
  };
}

function createFallbackHabitsSummary(): NutritionHabitsSummary {
  return {
    available: false,
    behavior: createFallbackBehavior(),
    dataQuality: createFallbackDataQuality(),
    topRisk: "none",
    coachPriority: "maintain",
  };
}

function createFallbackAiCosts(): NutritionAiCosts {
  return {
    chat: 0,
    textMeal: 0,
    photo: 0,
  };
}

function createFallbackAiSummary(): NutritionAiSummary {
  return {
    available: false,
    tier: null,
    balance: null,
    allocation: null,
    usedThisPeriod: null,
    periodStartAt: null,
    periodEndAt: null,
    costs: createFallbackAiCosts(),
  };
}

function createComputedAt(): string {
  return new Date().toISOString();
}

export function createFallbackNutritionState(dayKey?: string | null): NutritionState {
  return {
    computedAt: createComputedAt(),
    dayKey: normalizeDayKey(dayKey),
    targets: createFallbackTargets(),
    consumed: createFallbackConsumed(),
    remaining: createFallbackRemaining(),
    overTarget: createFallbackOverTarget(),
    quality: createFallbackQuality(),
    habits: createFallbackHabitsSummary(),
    streak: {
      available: false,
      current: 0,
      lastDate: null,
    },
    ai: createFallbackAiSummary(),
    meta: createFallbackMeta(),
  };
}

function createCacheKey(uid: string, dayKey: string): string {
  return `${uid}:${dayKey}`;
}

function createStorageKey(uid: string, dayKey: string): string {
  return `${NUTRITION_STATE_STORAGE_KEY_PREFIX}:${uid}:${dayKey}`;
}

function createStorageKeyPrefix(uid: string): string {
  return `${NUTRITION_STATE_STORAGE_KEY_PREFIX}:${uid}:`;
}

function getCacheGeneration(cacheKey: string): number {
  return cacheGenerationByKey.get(cacheKey) ?? 0;
}

function bumpCacheGeneration(cacheKey: string): void {
  cacheGenerationByKey.set(cacheKey, getCacheGeneration(cacheKey) + 1);
}

function isCacheGenerationCurrent(cacheKey: string, generation: number): boolean {
  return getCacheGeneration(cacheKey) === generation;
}

function buildEndpoint(dayKey: string): string {
  return `${NUTRITION_STATE_ENDPOINT}?day=${encodeURIComponent(dayKey)}`;
}

function normalizeTargets(value: unknown): NutritionTargets {
  const payload = isRecord(value) ? value : {};
  return {
    kcal: toNullableNumber(payload.kcal),
    protein: toNullableNumber(payload.protein),
    carbs: toNullableNumber(payload.carbs),
    fat: toNullableNumber(payload.fat),
  };
}

function normalizeConsumed(value: unknown): NutritionConsumed {
  const payload = isRecord(value) ? value : {};
  return {
    kcal: toClampedNumber(payload.kcal, 0, { min: 0 }),
    protein: toClampedNumber(payload.protein, 0, { min: 0 }),
    carbs: toClampedNumber(payload.carbs, 0, { min: 0 }),
    fat: toClampedNumber(payload.fat, 0, { min: 0 }),
  };
}

function normalizeRemaining(value: unknown): NutritionRemaining {
  const payload = isRecord(value) ? value : {};
  return {
    kcal: toNullableNumber(payload.kcal),
    protein: toNullableNumber(payload.protein),
    carbs: toNullableNumber(payload.carbs),
    fat: toNullableNumber(payload.fat),
  };
}

function normalizeOverTarget(value: unknown): NutritionOverTarget {
  const payload = isRecord(value) ? value : {};
  return {
    kcal: toNullableNumber(payload.kcal),
    protein: toNullableNumber(payload.protein),
    carbs: toNullableNumber(payload.carbs),
    fat: toNullableNumber(payload.fat),
  };
}

function normalizeQuality(value: unknown): NutritionQuality {
  const payload = isRecord(value) ? value : {};
  return {
    mealsLogged: toClampedNumber(payload.mealsLogged, 0, { min: 0 }),
    missingNutritionMeals: toClampedNumber(payload.missingNutritionMeals, 0, {
      min: 0,
    }),
    dataCompletenessScore: toClampedNumber(payload.dataCompletenessScore, 0, {
      min: 0,
      max: 1,
    }),
  };
}

function normalizeMealTypeCoverage14(value: unknown): NutritionMealTypeCoverage14 {
  const payload = isRecord(value) ? value : {};
  return {
    breakfast: asBoolean(payload.breakfast) ?? false,
    lunch: asBoolean(payload.lunch) ?? false,
    dinner: asBoolean(payload.dinner) ?? false,
    snack: asBoolean(payload.snack) ?? false,
    other: asBoolean(payload.other) ?? false,
    coveredCount: toClampedNumber(payload.coveredCount, 0, { min: 0, max: 5 }),
  };
}

function normalizeMealTypeFrequency14(value: unknown): NutritionMealTypeFrequency14 {
  const payload = isRecord(value) ? value : {};
  return {
    breakfast: toClampedNumber(payload.breakfast, 0, { min: 0, max: 14 }),
    lunch: toClampedNumber(payload.lunch, 0, { min: 0, max: 14 }),
    dinner: toClampedNumber(payload.dinner, 0, { min: 0, max: 14 }),
    snack: toClampedNumber(payload.snack, 0, { min: 0, max: 14 }),
    other: toClampedNumber(payload.other, 0, { min: 0, max: 14 }),
  };
}

function normalizeDayCoverage14(value: unknown): NutritionDayCoverage14 {
  const payload = isRecord(value) ? value : {};
  return {
    loggedDays: toClampedNumber(payload.loggedDays, 0, { min: 0, max: 14 }),
    validLoggedDays: toClampedNumber(payload.validLoggedDays, 0, {
      min: 0,
      max: 14,
    }),
  };
}

function normalizeProteinDaysHit14(value: unknown): NutritionProteinDaysHit14 {
  const payload = isRecord(value) ? value : {};
  return {
    hitDays: toClampedNumber(payload.hitDays, 0, { min: 0 }),
    eligibleDays: toClampedNumber(payload.eligibleDays, 0, { min: 0 }),
    unknownDays: toClampedNumber(payload.unknownDays, 0, { min: 0 }),
    ratio: toNullableNumber(payload.ratio),
  };
}

function normalizeTimingPatterns14(value: unknown): NutritionTimingPatterns14 {
  const payload = isRecord(value) ? value : {};
  return {
    available: asBoolean(payload.available) ?? false,
    observedDays: toClampedNumber(payload.observedDays, 0, { min: 0, max: 14 }),
    firstMealMedianHour: toNullableNumber(payload.firstMealMedianHour),
    lastMealMedianHour: toNullableNumber(payload.lastMealMedianHour),
    eatingWindowHoursMedian: toNullableNumber(payload.eatingWindowHoursMedian),
    breakfastMedianHour: toNullableNumber(payload.breakfastMedianHour),
    lunchMedianHour: toNullableNumber(payload.lunchMedianHour),
    dinnerMedianHour: toNullableNumber(payload.dinnerMedianHour),
    snackMedianHour: toNullableNumber(payload.snackMedianHour),
    otherMedianHour: toNullableNumber(payload.otherMedianHour),
  };
}

function normalizeBehavior(value: unknown): NutritionBehavior {
  const payload = isRecord(value) ? value : {};
  return {
    loggingDays7: toClampedNumber(payload.loggingDays7, 0, { min: 0, max: 7 }),
    validLoggingDays7: toClampedNumber(payload.validLoggingDays7, 0, {
      min: 0,
      max: 7,
    }),
    loggingConsistency28: toClampedNumber(payload.loggingConsistency28, 0, {
      min: 0,
      max: 1,
    }),
    validLoggingConsistency28: toClampedNumber(payload.validLoggingConsistency28, 0, {
      min: 0,
      max: 1,
    }),
    avgMealsPerLoggedDay14: toClampedNumber(payload.avgMealsPerLoggedDay14, 0, {
      min: 0,
    }),
    avgValidMealsPerValidLoggedDay14: toClampedNumber(
      payload.avgValidMealsPerValidLoggedDay14,
      0,
      { min: 0 },
    ),
    mealTypeCoverage14: normalizeMealTypeCoverage14(payload.mealTypeCoverage14),
    mealTypeFrequency14: normalizeMealTypeFrequency14(payload.mealTypeFrequency14),
    dayCoverage14: normalizeDayCoverage14(payload.dayCoverage14),
    kcalAdherence14: toNullableNumber(payload.kcalAdherence14),
    kcalUnderTargetRatio14: toNullableNumber(payload.kcalUnderTargetRatio14),
    proteinDaysHit14: normalizeProteinDaysHit14(payload.proteinDaysHit14),
    timingPatterns14: normalizeTimingPatterns14(payload.timingPatterns14),
  };
}

function normalizeDataQuality(value: unknown): NutritionDataQuality {
  const payload = isRecord(value) ? value : {};
  return {
    daysWithUnknownMealDetails14: toClampedNumber(
      payload.daysWithUnknownMealDetails14,
      0,
      { min: 0, max: 14 },
    ),
    daysUsingTimestampDayFallback14: toClampedNumber(
      payload.daysUsingTimestampDayFallback14,
      0,
      { min: 0, max: 14 },
    ),
    daysUsingTimestampTimingFallback14: toClampedNumber(
      payload.daysUsingTimestampTimingFallback14,
      0,
      { min: 0, max: 14 },
    ),
  };
}

function normalizeHabitsSummary(value: unknown): NutritionHabitsSummary {
  const payload = isRecord(value) ? value : {};
  return {
    available: asBoolean(payload.available) ?? false,
    behavior: normalizeBehavior(payload.behavior),
    dataQuality: normalizeDataQuality(payload.dataQuality),
    topRisk: toTopRisk(payload.topRisk),
    coachPriority: toCoachPriority(payload.coachPriority),
  };
}

function normalizeAiCosts(value: unknown): NutritionAiCosts {
  const payload = isRecord(value) ? value : {};
  return {
    chat: toClampedNumber(payload.chat, 0, { min: 0 }),
    textMeal: toClampedNumber(payload.textMeal, 0, { min: 0 }),
    photo: toClampedNumber(payload.photo, 0, { min: 0 }),
  };
}

function normalizeAiSummary(value: unknown): NutritionAiSummary {
  const payload = isRecord(value) ? value : {};
  return {
    available: asBoolean(payload.available) ?? false,
    tier: toTier(payload.tier),
    balance: toNullableNumber(payload.balance),
    allocation: toNullableNumber(payload.allocation),
    usedThisPeriod: toNullableNumber(payload.usedThisPeriod),
    periodStartAt: asString(payload.periodStartAt) ?? null,
    periodEndAt: asString(payload.periodEndAt) ?? null,
    costs: normalizeAiCosts(payload.costs),
  };
}

function toComponentState(value: unknown): NutritionComponentState {
  switch (value) {
    case "ok":
    case "disabled":
    case "error":
      return value;
    default:
      return "disabled";
  }
}

function normalizeMeta(value: unknown): NutritionStateMeta {
  const payload = isRecord(value) ? value : {};
  const componentStatus = isRecord(payload.componentStatus)
    ? payload.componentStatus
    : {};
  return {
    isDegraded: asBoolean(payload.isDegraded) ?? false,
    componentStatus: {
      habits: toComponentState(componentStatus.habits),
      streak: toComponentState(componentStatus.streak),
      ai: toComponentState(componentStatus.ai),
    },
  };
}

export function normalizeNutritionState(
  value: unknown,
  fallbackDayKey?: string | null,
): NutritionState | null {
  if (!isRecord(value)) {
    return null;
  }

  const dayKey = asString(value.dayKey) ?? normalizeDayKey(fallbackDayKey);
  return {
    computedAt: asString(value.computedAt) ?? createComputedAt(),
    dayKey,
    targets: normalizeTargets(value.targets),
    consumed: normalizeConsumed(value.consumed),
    remaining: normalizeRemaining(value.remaining),
    overTarget: normalizeOverTarget(value.overTarget),
    quality: normalizeQuality(value.quality),
    habits: normalizeHabitsSummary(value.habits),
    streak: {
      available: asBoolean(isRecord(value.streak) ? value.streak.available : undefined) ?? false,
      current: toClampedNumber(
        isRecord(value.streak) ? value.streak.current : undefined,
        0,
        { min: 0 },
      ),
      lastDate: asString(isRecord(value.streak) ? value.streak.lastDate : undefined) ?? null,
    },
    ai: normalizeAiSummary(value.ai),
    meta: normalizeMeta(value.meta),
  };
}

async function persistState(uid: string, dayKey: string, state: NutritionState): Promise<void> {
  try {
    await AsyncStorage.setItem(createStorageKey(uid, dayKey), JSON.stringify(state));
  } catch {
    // Ignore storage write failures for best-effort cache.
  }
}

async function readPersistedState(
  uid: string,
  dayKey: string,
): Promise<NutritionState | null> {
  try {
    const raw = await AsyncStorage.getItem(createStorageKey(uid, dayKey));
    if (!raw) {
      return null;
    }

    return normalizeNutritionState(JSON.parse(raw) as unknown, dayKey);
  } catch {
    return null;
  }
}

export async function getNutritionState(
  uid: string | null | undefined,
  options?: { dayKey?: string | null; force?: boolean },
): Promise<NutritionStateResult> {
  const dayKey = normalizeDayKey(options?.dayKey);
  const fallbackState = createFallbackNutritionState(dayKey);

  if (!uid) {
    return {
      state: fallbackState,
      source: "fallback",
      enabled: true,
      isStale: true,
      error: null,
    };
  }

  const cacheKey = createCacheKey(uid, dayKey);
  if (!options?.force) {
    const memory = memoryCacheByKey.get(cacheKey);
    if (memory) {
      return {
        state: memory,
        source: "memory",
        enabled: true,
        isStale: false,
        error: null,
      };
    }

    const existing = inFlightByKey.get(cacheKey);
    if (existing) {
      return existing.promise;
    }
  }

  const entry = {} as { promise: Promise<NutritionStateResult> };
  const generation = getCacheGeneration(cacheKey);
  entry.promise = (async (): Promise<NutritionStateResult> => {
    try {
      const payload = await get<unknown>(buildEndpoint(dayKey), { timeout: 15_000 });
      const normalized = normalizeNutritionState(payload, dayKey);
      if (!normalized) {
        throw new Error("Invalid nutrition state payload");
      }

      if (isCacheGenerationCurrent(cacheKey, generation)) {
        memoryCacheByKey.set(cacheKey, normalized);
        await persistState(uid, dayKey, normalized);
      }

      return {
        state: normalized,
        source: "remote",
        enabled: true,
        isStale: false,
        error: null,
      };
    } catch (error) {
      log.warn("getNutritionState backend error", { uid, dayKey, error });

      const memory = memoryCacheByKey.get(cacheKey);
      if (memory) {
        return {
          state: memory,
          source: "memory",
          enabled: true,
          isStale: true,
          error,
        };
      }

      const persisted = await readPersistedState(uid, dayKey);
      if (persisted) {
        if (isCacheGenerationCurrent(cacheKey, generation)) {
          memoryCacheByKey.set(cacheKey, persisted);
        }
        return {
          state: persisted,
          source: "storage",
          enabled: true,
          isStale: true,
          error,
        };
      }

      return {
        state: fallbackState,
        source: "fallback",
        enabled: true,
        isStale: true,
        error,
      };
    } finally {
      const current = inFlightByKey.get(cacheKey);
      if (current === entry) {
        inFlightByKey.delete(cacheKey);
      }
    }
  })();

  inFlightByKey.set(cacheKey, entry);
  return entry.promise;
}

export function refreshNutritionState(
  uid: string | null | undefined,
  options?: { dayKey?: string | null },
): Promise<NutritionStateResult> {
  return getNutritionState(uid, { ...options, force: true });
}

export async function invalidateNutritionStateCache(
  uid: string | null | undefined,
  options?: { dayKey?: string | null },
): Promise<void> {
  if (!uid) {
    return;
  }

  const normalizedDayKey = options?.dayKey?.trim();
  if (normalizedDayKey) {
    const cacheKey = createCacheKey(uid, normalizedDayKey);
    bumpCacheGeneration(cacheKey);
    memoryCacheByKey.delete(cacheKey);
    inFlightByKey.delete(cacheKey);
    try {
      await AsyncStorage.removeItem(createStorageKey(uid, normalizedDayKey));
    } catch {
      // Ignore cache invalidation failures for best-effort refresh behavior.
    }
    return;
  }

  for (const cacheKey of Array.from(memoryCacheByKey.keys())) {
    if (cacheKey.startsWith(`${uid}:`)) {
      bumpCacheGeneration(cacheKey);
      memoryCacheByKey.delete(cacheKey);
    }
  }
  for (const cacheKey of Array.from(inFlightByKey.keys())) {
    if (cacheKey.startsWith(`${uid}:`)) {
      bumpCacheGeneration(cacheKey);
      inFlightByKey.delete(cacheKey);
    }
  }

  try {
    const storageKeys = await AsyncStorage.getAllKeys();
    const matchingKeys = storageKeys.filter((key) =>
      key.startsWith(createStorageKeyPrefix(uid)),
    );
    if (matchingKeys.length > 0) {
      await AsyncStorage.multiRemove(matchingKeys);
    }
  } catch {
    // Ignore cache invalidation failures for best-effort refresh behavior.
  }
}

export function __resetNutritionStateServiceForTests(): void {
  memoryCacheByKey.clear();
  inFlightByKey.clear();
  cacheGenerationByKey.clear();
}
