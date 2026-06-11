import type { Meal, MealAiMeta, MealInputMethod } from "@/types/meal";

export const MEAL_INPUT_METHODS = [
  "manual",
  "photo",
  "barcode",
  "text",
] as const satisfies readonly MealInputMethod[];

const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

type MealDateFields = {
  dayKey?: unknown;
  timestamp?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeMealInputMethod(
  value: unknown,
): MealInputMethod | null {
  return typeof value === "string" &&
    MEAL_INPUT_METHODS.includes(value as MealInputMethod)
    ? (value as MealInputMethod)
    : null;
}

export function normalizeMealAiMeta(value: unknown): MealAiMeta | null {
  if (!isRecord(value)) return null;

  const model = typeof value.model === "string" ? value.model : null;
  const runId = typeof value.runId === "string" ? value.runId : null;
  const confidence =
    typeof value.confidence === "number" && Number.isFinite(value.confidence)
      ? value.confidence
      : null;
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter(
        (warning): warning is string => typeof warning === "string",
      )
    : null;

  if (
    model === null &&
    runId === null &&
    confidence === null &&
    warnings === null
  ) {
    return null;
  }

  return {
    model,
    runId,
    confidence,
    warnings,
  };
}

export function parseMealAiMeta(raw: string | null | undefined): MealAiMeta | null {
  if (!raw) return null;
  try {
    return normalizeMealAiMeta(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeMealAiMeta(
  value: MealAiMeta | null | undefined,
): string | null {
  const normalized = normalizeMealAiMeta(value);
  return normalized ? JSON.stringify(normalized) : null;
}

export function getMealAiMetaFromAiResponse(value: unknown): MealAiMeta | null {
  return normalizeMealAiMeta(value);
}

export function isCanonicalMealDayKey(value: unknown): value is string {
  return typeof value === "string" && DAY_KEY_REGEX.test(value);
}

export function formatMealDayKey(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function normalizeMealDayKey(value: unknown): string | null {
  if (isCanonicalMealDayKey(value)) return value;

  if (value instanceof Date) {
    return formatMealDayKey(value);
  }

  if (typeof value === "number") {
    const date = new Date(value < 1e12 ? value * 1000 : value);
    return formatMealDayKey(date);
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isCanonicalMealDayKey(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  return formatMealDayKey(parsed);
}

export function getMealDayKey(
  meal: MealDateFields,
): string | null {
  return isCanonicalMealDayKey(meal.dayKey) ? meal.dayKey : null;
}

export function deriveMealDayKey(
  meal: MealDateFields,
): string | null {
  return (
    normalizeMealDayKey(meal.dayKey) ??
    normalizeMealDayKey(meal.timestamp) ??
    normalizeMealDayKey(meal.createdAt) ??
    normalizeMealDayKey(meal.updatedAt)
  );
}

export function getMealSortTimestamp(
  meal: Pick<MealDateFields, "timestamp" | "createdAt" | "updatedAt">,
): number {
  const raw = meal.timestamp || meal.updatedAt || meal.createdAt;
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
  const parsed = Date.parse(String(raw ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getMealsForDayKey(
  meals: Meal[],
  dayKey: string | null | undefined,
  order: "asc" | "desc" = "asc",
): Meal[] {
  if (!isCanonicalMealDayKey(dayKey)) return [];

  return meals
    .filter((meal) => getMealDayKey(meal) === dayKey)
    .sort((left, right) => {
      const delta = getMealSortTimestamp(left) - getMealSortTimestamp(right);
      return order === "asc" ? delta : -delta;
    });
}

function dayKeyToLocalDate(dayKey: string): Date | null {
  if (!isCanonicalMealDayKey(dayKey)) return null;
  const [year, month, day] = dayKey.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isMealInDayKeyRange(
  meal: MealDateFields,
  range: { start: Date; end: Date },
): boolean {
  const mealDayKey = getMealDayKey(meal);
  const startDayKey = formatMealDayKey(range.start);
  const endDayKey = formatMealDayKey(range.end);
  if (!mealDayKey || !startDayKey || !endDayKey) return false;
  return mealDayKey >= startDayKey && mealDayKey <= endDayKey;
}

export function getMealDayIndex(
  meal: MealDateFields,
  rangeStart: Date,
): number | null {
  const mealDayKey = getMealDayKey(meal);
  if (!mealDayKey) return null;

  const mealDate = dayKeyToLocalDate(mealDayKey);
  const startDayKey = formatMealDayKey(rangeStart);
  const startDate = startDayKey ? dayKeyToLocalDate(startDayKey) : null;
  if (!mealDate || !startDate) return null;

  return Math.floor((mealDate.getTime() - startDate.getTime()) / DAY_MS);
}

export function deriveMealTimingMetadata(
  timestamp: string | null | undefined,
): { loggedAtLocalMin: number | null; tzOffsetMin: number | null } {
  if (!timestamp) {
    return { loggedAtLocalMin: null, tzOffsetMin: null };
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return { loggedAtLocalMin: null, tzOffsetMin: null };
  }

  return {
    loggedAtLocalMin: parsed.getHours() * 60 + parsed.getMinutes(),
    tzOffsetMin: -parsed.getTimezoneOffset(),
  };
}
