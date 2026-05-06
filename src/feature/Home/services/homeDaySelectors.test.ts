import { describe, expect, it } from "@jest/globals";
import type { Meal, UserNutritionProfile } from "@/types";
import { buildHomeDayState } from "@/feature/Home/services/homeDaySelectors";

const makeMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  cloudId: "meal-1",
  timestamp: "2026-03-18T10:00:00.000Z",
  dayKey: "2026-03-18",
  type: "lunch",
  name: "Meal",
  ingredients: [],
  createdAt: "2026-03-18T10:00:00.000Z",
  updatedAt: "2026-03-18T10:00:00.000Z",
  syncState: "synced",
  source: "manual",
  totals: { kcal: 100, protein: 10, fat: 2, carbs: 12 },
  ...overrides,
});

const userData = {
  calorieTarget: 1000,
  preferences: ["balanced"],
  goal: "maintain",
} as UserNutritionProfile;

describe("homeDaySelectors", () => {
  it("builds meal list, kcal progress and macro progress from the same canonical dayKey source", () => {
    const meals = [
      makeMeal({
        mealId: "pending",
        cloudId: "pending",
        syncState: "pending",
        totals: { kcal: 100, protein: 10, fat: 2, carbs: 12 },
      }),
      makeMeal({
        mealId: "failed",
        cloudId: "failed",
        syncState: "failed",
        totals: { kcal: 200, protein: 20, fat: 4, carbs: 24 },
      }),
      makeMeal({
        mealId: "conflict",
        cloudId: "conflict",
        syncState: "conflict",
        totals: { kcal: 300, protein: 30, fat: 6, carbs: 36 },
      }),
      makeMeal({
        mealId: "legacy-timestamp-only",
        cloudId: "legacy-timestamp-only",
        dayKey: null,
        timestamp: "2026-03-18T12:00:00.000Z",
        totals: { kcal: 999, protein: 99, fat: 99, carbs: 99 },
      }),
      makeMeal({
        mealId: "other-day",
        cloudId: "other-day",
        dayKey: "2026-03-17",
        totals: { kcal: 400, protein: 40, fat: 8, carbs: 48 },
      }),
    ];

    const state = buildHomeDayState({
      meals,
      selectedDayKey: "2026-03-18",
      todayDayKey: "2026-03-18",
      nutritionProfile: userData,
    });

    expect(state.dayKey).toBe("2026-03-18");
    expect(state.dayMeals.map((meal) => meal.cloudId)).toEqual([
      "pending",
      "failed",
      "conflict",
    ]);
    expect(state.mealCount).toBe(3);
    expect(state.consumed).toEqual({
      kcal: 600,
      protein: 60,
      fat: 12,
      carbs: 72,
    });
    expect(state.kcalProgress).toBe(0.6);
    expect(state.macroTargets).toEqual(
      expect.objectContaining({
        proteinGrams: 65,
        fatGrams: 35,
        carbsGrams: 115,
      }),
    );
    expect(state.status).toBe("in_progress");
  });
});
