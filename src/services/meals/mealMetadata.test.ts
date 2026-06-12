import { describe, expect, it } from "@jest/globals";
import {
  formatMealDayKey,
  getMealAiMetaFromAiResponse,
  getMealDayKey,
  getMealsForDayKey,
  isMealInDayKeyRange,
  normalizeMealAiMeta,
  normalizeMealDayKey,
  normalizeMealInputMethod,
  parseMealAiMeta,
  serializeMealAiMeta,
} from "@/services/meals/mealMetadata";
import type { Meal } from "@/types/meal";

const makeMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-03-18T10:00:00.000Z",
  dayKey: "2026-03-18",
  type: "lunch",
  name: "Meal",
  ingredients: [],
  createdAt: "2026-03-18T10:00:00.000Z",
  updatedAt: "2026-03-18T10:00:00.000Z",
  syncState: "synced",
  source: "manual",
  ...overrides,
});

describe("mealMetadata", () => {
  it("normalizes the canonical meal input methods", () => {
    expect(normalizeMealInputMethod("photo")).toBe("photo");
    expect(normalizeMealInputMethod("saved")).toBeNull();
    expect(normalizeMealInputMethod("legacy")).toBeNull();
  });

  it("serializes and hydrates aiMeta safely", () => {
    const raw = serializeMealAiMeta({
      model: "gpt-5.4-mini",
      runId: "run-1",
      confidence: 0.92,
      warnings: ["low_confidence_ingredient"],
    });

    expect(raw).toBe(
      JSON.stringify({
        model: "gpt-5.4-mini",
        runId: "run-1",
        confidence: 0.92,
        warnings: ["low_confidence_ingredient"],
      }),
    );
    expect(parseMealAiMeta(raw)).toEqual({
      model: "gpt-5.4-mini",
      runId: "run-1",
      confidence: 0.92,
      warnings: ["low_confidence_ingredient"],
    });
  });

  it("returns null for malformed or empty aiMeta payloads", () => {
    expect(parseMealAiMeta("{bad-json")).toBeNull();
    expect(normalizeMealAiMeta({ foo: "bar" })).toBeNull();
    expect(serializeMealAiMeta(null)).toBeNull();
  });

  it("extracts aiMeta from AI responses only when supported fields exist", () => {
    expect(
      getMealAiMetaFromAiResponse({
        model: "gpt-5.4",
        runId: "run-2",
        confidence: 0.7,
        warnings: ["partial_totals"],
      }),
    ).toEqual({
      model: "gpt-5.4",
      runId: "run-2",
      confidence: 0.7,
      warnings: ["partial_totals"],
    });
    expect(
      getMealAiMetaFromAiResponse({
        version: "2026-03-01",
      }),
    ).toBeNull();
  });

  it("normalizes canonical meal day keys", () => {
    expect(normalizeMealDayKey("2026-03-18")).toBe("2026-03-18");
    expect(normalizeMealDayKey("bad-day")).toBeNull();
    expect(formatMealDayKey(new Date(2026, 2, 18, 23, 30))).toBe("2026-03-18");
  });

  it("selects a late-night meal by explicit dayKey instead of timestamp day", () => {
    const meal = makeMeal({
      mealId: "late-night",
      dayKey: "2026-03-18",
      timestamp: "2026-03-19T00:30:00.000Z",
      createdAt: "2026-03-19T00:30:00.000Z",
      updatedAt: "2026-03-19T00:30:00.000Z",
    });

    expect(getMealDayKey(meal)).toBe("2026-03-18");
    expect(getMealsForDayKey([meal], "2026-03-18")).toEqual([meal]);
    expect(getMealsForDayKey([meal], "2026-03-19")).toEqual([]);
  });

  it("does not treat timestamp-only meals as canonical day meals", () => {
    const meal = makeMeal({
      dayKey: null,
      timestamp: "2026-03-18T10:00:00.000Z",
    });

    expect(getMealDayKey(meal)).toBeNull();
    expect(getMealsForDayKey([meal], "2026-03-18")).toEqual([]);
  });

  it("rejects non-canonical dayKey values in canonical selectors", () => {
    const meal = makeMeal({
      dayKey: "2026-03-18T10:00:00.000Z",
      timestamp: "2026-03-18T10:00:00.000Z",
    });

    expect(getMealDayKey(meal)).toBeNull();
    expect(getMealsForDayKey([meal], "2026-03-18")).toEqual([]);
  });

  it("matches day-key ranges by canonical dayKey instead of timestamp day", () => {
    const meal = makeMeal({
      mealId: "timezone-boundary",
      dayKey: "2026-04-02",
      timestamp: "2026-04-01T23:30:00.000Z",
      createdAt: "2026-04-01T23:30:00.000Z",
      updatedAt: "2026-04-01T23:30:00.000Z",
    });

    expect(
      isMealInDayKeyRange(meal, {
        start: new Date(2026, 3, 2),
        end: new Date(2026, 3, 2),
      }),
    ).toBe(true);
    expect(
      isMealInDayKeyRange(meal, {
        start: new Date(2026, 3, 1),
        end: new Date(2026, 3, 1),
      }),
    ).toBe(false);
  });

  it("treats day-key range boundaries as inclusive", () => {
    const startMeal = makeMeal({
      mealId: "start",
      dayKey: "2026-04-02",
      timestamp: "2026-04-02T08:00:00.000Z",
    });
    const endMeal = makeMeal({
      mealId: "end",
      dayKey: "2026-04-04",
      timestamp: "2026-04-04T20:00:00.000Z",
    });

    const range = {
      start: new Date(2026, 3, 2),
      end: new Date(2026, 3, 4),
    };

    expect(isMealInDayKeyRange(startMeal, range)).toBe(true);
    expect(isMealInDayKeyRange(endMeal, range)).toBe(true);
  });

  it("excludes meals with missing or invalid canonical dayKey from ranges", () => {
    const missingDayKeyMeal = makeMeal({
      mealId: "missing-day-key",
      dayKey: null,
      timestamp: "2026-04-02T10:00:00.000Z",
    });
    const invalidDayKeyMeal = makeMeal({
      mealId: "invalid-day-key",
      dayKey: "2026-04-02T10:00:00.000Z",
      timestamp: "2026-04-02T10:00:00.000Z",
    });

    const range = {
      start: new Date(2026, 3, 2),
      end: new Date(2026, 3, 2),
    };

    expect(isMealInDayKeyRange(missingDayKeyMeal, range)).toBe(false);
    expect(isMealInDayKeyRange(invalidDayKeyMeal, range)).toBe(false);
  });
});
