import { v4 as uuidv4 } from "uuid";
import {
  deriveMealTimingMetadata,
  formatMealDayKey,
} from "@/services/meals/mealMetadata";
import type { Ingredient, Meal, MealType, Nutrients } from "@/types/meal";
import type {
  PlannedMealCreateRequest,
  PlannedMealDraftSnapshot,
  PlannedMealItem,
  PlannedMealNutritionEstimate,
  PlannedMealTimeBucket,
  PlannedMealUpdateRequest,
} from "@/types/plannedMeals";

export const PLANNING_MAX_DAYS = 3;
export const PLANNING_MIN_DAYS = 1;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MANUAL_TOTALS: Nutrients = {
  kcal: 400,
  protein: 25,
  fat: 14,
  carbs: 45,
};

const TIME_BUCKET_TO_MEAL_TYPE: Record<PlannedMealTimeBucket, MealType> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
  any: "other",
};

const TIME_BUCKET_TO_LOCAL_TIME: Record<PlannedMealTimeBucket, [number, number]> = {
  breakfast: [8, 0],
  lunch: [12, 30],
  dinner: [18, 0],
  snack: [15, 30],
  any: [12, 0],
};

export function isPlanningDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function formatPlanningDateKey(date = new Date()): string {
  return formatMealDayKey(date) ?? "1970-01-01";
}

export function clampPlanningDays(value: number): 1 | 2 | 3 {
  if (value <= 1) return 1;
  if (value >= PLANNING_MAX_DAYS) return 3;
  return 2;
}

function parsePlanningDateKey(value: string): Date | null {
  if (!isPlanningDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDaysToPlanningDateKey(value: string, days: number): string {
  const date = parsePlanningDateKey(value) ?? new Date();
  const next = new Date(date.getTime() + days * DAY_MS);
  return formatPlanningDateKey(next);
}

function cleanName(value: string | null | undefined, fallback = "Planned meal"): string {
  return value?.trim() || fallback;
}

function roundNutrient(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(3));
}

function manualIngredient(name: string): Ingredient {
  return {
    id: uuidv4(),
    name,
    amount: 1,
    kcal: DEFAULT_MANUAL_TOTALS.kcal,
    protein: DEFAULT_MANUAL_TOTALS.protein,
    fat: DEFAULT_MANUAL_TOTALS.fat,
    carbs: DEFAULT_MANUAL_TOTALS.carbs,
  };
}

export function buildManualPlanningSnapshot(params: {
  name: string;
  timeBucket: PlannedMealTimeBucket;
}): PlannedMealDraftSnapshot {
  const name = cleanName(params.name);

  return {
    name,
    type: TIME_BUCKET_TO_MEAL_TYPE[params.timeBucket],
    ingredients: [manualIngredient(name)],
    totals: { ...DEFAULT_MANUAL_TOTALS },
    notes: null,
    tags: [],
  };
}

export function buildKnownManualPlanningEstimate(): PlannedMealNutritionEstimate {
  return {
    state: "known",
    totals: { ...DEFAULT_MANUAL_TOTALS },
    missingFields: [],
    confidence: "medium",
  };
}

export function buildCreatePlannedMealRequest(params: {
  name: string;
  dateBucket: string;
  timeBucket: PlannedMealTimeBucket;
}): PlannedMealCreateRequest {
  return {
    clientMutationId: `planning:create:${uuidv4()}`,
    plannedMealId: `planned-${uuidv4()}`,
    dateBucket: params.dateBucket,
    timeBucket: params.timeBucket,
    sourceType: "manual",
    sourceRef: null,
    draftSnapshot: buildManualPlanningSnapshot({
      name: params.name,
      timeBucket: params.timeBucket,
    }),
    nutritionEstimate: buildKnownManualPlanningEstimate(),
  };
}

export function buildEditPlannedMealRequest(params: {
  item: PlannedMealItem;
  name: string;
  dateBucket: string;
  timeBucket: PlannedMealTimeBucket;
}): PlannedMealUpdateRequest {
  return {
    clientMutationId: `planning:update:${params.item.plannedMealId}:${uuidv4()}`,
    expectedVersion: params.item.version,
    dateBucket: params.dateBucket,
    timeBucket: params.timeBucket,
    draftSnapshot: {
      ...params.item.draftSnapshot,
      name: cleanName(params.name),
      type: TIME_BUCKET_TO_MEAL_TYPE[params.timeBucket],
    },
  };
}

export function buildRescheduleNextDayRequest(
  item: PlannedMealItem,
): PlannedMealUpdateRequest {
  return {
    clientMutationId: `planning:reschedule:${item.plannedMealId}:${uuidv4()}`,
    expectedVersion: item.version,
    dateBucket: addDaysToPlanningDateKey(item.dateBucket, 1),
  };
}

export function buildDeletePlannedMealRequest(item: PlannedMealItem) {
  return {
    clientMutationId: `planning:delete:${item.plannedMealId}:${uuidv4()}`,
    expectedVersion: item.version,
  };
}

function buildTimestamp(
  dateBucket: string,
  timeBucket: PlannedMealTimeBucket | null,
): string {
  const date = parsePlanningDateKey(dateBucket) ?? new Date();
  const [hour, minute] = TIME_BUCKET_TO_LOCAL_TIME[timeBucket ?? "any"];
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function normalizeIngredients(ingredients: Ingredient[], fallbackName: string) {
  if (ingredients.length > 0) {
    return ingredients.map((ingredient) => ({
      ...ingredient,
      id: ingredient.id || uuidv4(),
      name: ingredient.name.trim() || fallbackName,
      kcal: roundNutrient(ingredient.kcal),
      protein: roundNutrient(ingredient.protein),
      fat: roundNutrient(ingredient.fat),
      carbs: roundNutrient(ingredient.carbs),
    }));
  }

  return [manualIngredient(fallbackName)];
}

export function buildReviewDraftFromPlannedMeal(params: {
  item: PlannedMealItem;
  uid: string;
  now?: Date;
  fallbackName?: string;
  reviewNotes?: string[];
}): Meal {
  const { item, uid, now = new Date() } = params;
  const name = cleanName(item.draftSnapshot.name, params.fallbackName);
  const timestamp = buildTimestamp(item.dateBucket, item.timeBucket);
  const timing = deriveMealTimingMetadata(timestamp);
  const ingredients = normalizeIngredients(item.draftSnapshot.ingredients, name);
  const notes = [item.draftSnapshot.notes, ...(params.reviewNotes ?? [])]
    .filter(Boolean)
    .join("\n");
  const totals =
    item.nutritionEstimate.state === "unknown"
      ? null
      : item.nutritionEstimate.totals ?? item.draftSnapshot.totals;

  return {
    mealId: uuidv4(),
    userUid: uid,
    savedMealRefId: null,
    timestamp,
    dayKey: item.dateBucket,
    loggedAtLocalMin: timing.loggedAtLocalMin,
    tzOffsetMin: timing.tzOffsetMin,
    type: item.draftSnapshot.type,
    name,
    ingredients,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    syncState: "pending",
    source: "manual",
    inputMethod: "manual",
    aiMeta: null,
    imageRef: null,
    imageId: null,
    photoLocalPath: null,
    photoUrl: null,
    localPhotoUrl: null,
    notes,
    tags: item.draftSnapshot.tags,
    deleted: false,
    cloudId: undefined,
    ...(totals ? { totals } : {}),
  };
}
