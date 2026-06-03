import { describe, expect, it } from "@jest/globals";
import { buildHomeDayState } from "@/feature/Home/services/homeDaySelectors";
import {
  buildStatisticsRangeState,
  clampStatisticsRangeToFreeWindow,
} from "@/feature/Statistics/services/statisticsRangeSelectors";
import type { Meal, UserNutritionProfile } from "@/types";

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

describe("statisticsRangeSelectors", () => {
  it("builds exactly 7 canonical dayKeys for the 7d range", () => {
    const state = buildStatisticsRangeState({
      meals: [],
      activeRange: "7d",
      todayDayKey: "2026-03-18",
    });

    expect(state.dayKeys).toEqual([
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
    ]);
    expect(state.dayKeys).toHaveLength(7);
  });

  it("builds exactly 30 canonical dayKeys for the 30d range", () => {
    const state = buildStatisticsRangeState({
      meals: [],
      activeRange: "30d",
      todayDayKey: "2026-03-18",
    });

    expect(state.dayKeys[0]).toBe("2026-02-17");
    expect(state.dayKeys[29]).toBe("2026-03-18");
    expect(state.dayKeys).toHaveLength(30);
  });

  it("treats custom start and end as inclusive dayKeys", () => {
    const state = buildStatisticsRangeState({
      meals: [],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-10",
        endDayKey: "2026-03-12",
      },
    });

    expect(state.dayKeys).toEqual([
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
    ]);
  });

  it("normalizes a reversed custom range before enumerating", () => {
    const state = buildStatisticsRangeState({
      meals: [],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-12",
        endDayKey: "2026-03-10",
      },
    });

    expect(state.effectiveRange).toEqual({
      startDayKey: "2026-03-10",
      endDayKey: "2026-03-12",
    });
    expect(state.dayKeys).toEqual([
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
    ]);
  });

  it("clamps future custom effective range to today", () => {
    const state = buildStatisticsRangeState({
      meals: [],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-20",
        endDayKey: "2026-03-22",
      },
    });

    expect(state.requestedRange).toEqual({
      startDayKey: "2026-03-20",
      endDayKey: "2026-03-22",
    });
    expect(state.effectiveRange).toEqual({
      startDayKey: "2026-03-18",
      endDayKey: "2026-03-18",
    });
    expect(state.dayKeys).toEqual(["2026-03-18"]);
  });

  it("matches Home totals for a single canonical day", () => {
    const meals = [
      makeMeal({
        mealId: "breakfast",
        cloudId: "breakfast",
        totals: { kcal: 250, protein: 20, fat: 6, carbs: 30 },
      }),
      makeMeal({
        mealId: "lunch",
        cloudId: "lunch",
        totals: { kcal: 350, protein: 30, fat: 8, carbs: 42 },
      }),
      makeMeal({
        mealId: "other-day",
        cloudId: "other-day",
        dayKey: "2026-03-17",
        totals: { kcal: 999, protein: 99, fat: 99, carbs: 99 },
      }),
    ];

    const homeState = buildHomeDayState({
      meals,
      selectedDayKey: "2026-03-18",
      todayDayKey: "2026-03-18",
      nutritionProfile: userData,
    });
    const statisticsState = buildStatisticsRangeState({
      meals,
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-18",
        endDayKey: "2026-03-18",
      },
    });

    expect(statisticsState.buckets[0].dayMeals).toEqual(homeState.dayMeals);
    expect(statisticsState.totals).toEqual(homeState.consumed);
  });

  it("does not hide pending meals from buckets, totals, or series", () => {
    const state = buildStatisticsRangeState({
      meals: [
        makeMeal({
          mealId: "pending",
          cloudId: "pending",
          syncState: "pending",
          totals: { kcal: 420, protein: 31, carbs: 44, fat: 12 },
        }),
      ],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-18",
        endDayKey: "2026-03-18",
      },
    });

    expect(state.buckets[0].hasPending).toBe(true);
    expect(state.buckets[0].mealCount).toBe(1);
    expect(state.totals.kcal).toBe(420);
    expect(state.seriesByMetric.kcal).toEqual([420]);
  });

  it("does not hide failed or conflict meals from buckets, totals, or series", () => {
    const state = buildStatisticsRangeState({
      meals: [
        makeMeal({
          mealId: "failed",
          cloudId: "failed",
          syncState: "failed",
          totals: { kcal: 200, protein: 20, carbs: 24, fat: 4 },
        }),
        makeMeal({
          mealId: "conflict",
          cloudId: "conflict",
          syncState: "conflict",
          totals: { kcal: 300, protein: 30, carbs: 36, fat: 6 },
        }),
      ],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-18",
        endDayKey: "2026-03-18",
      },
    });

    expect(state.buckets[0].hasFailed).toBe(true);
    expect(state.buckets[0].hasConflict).toBe(true);
    expect(state.buckets[0].mealCount).toBe(2);
    expect(state.totals.kcal).toBe(500);
    expect(state.seriesByMetric.protein).toEqual([50]);
  });

  it("does not count deleted meals that are absent from the local read model input", () => {
    const state = buildStatisticsRangeState({
      meals: [
        makeMeal({
          mealId: "remaining",
          cloudId: "remaining",
          totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
        }),
      ],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-18",
        endDayKey: "2026-03-18",
      },
    });

    expect(state.buckets[0].dayMeals.map((meal) => meal.cloudId)).toEqual([
      "remaining",
    ]);
    expect(state.totals).toEqual({ kcal: 100, protein: 10, fat: 2, carbs: 12 });
  });

  it("keeps totals and seriesByMetric consistent", () => {
    const state = buildStatisticsRangeState({
      meals: [
        makeMeal({
          mealId: "day-1",
          cloudId: "day-1",
          dayKey: "2026-03-17",
          totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
        }),
        makeMeal({
          mealId: "day-2",
          cloudId: "day-2",
          dayKey: "2026-03-18",
          totals: { kcal: 200, protein: 20, carbs: 24, fat: 4 },
        }),
      ],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-17",
        endDayKey: "2026-03-18",
      },
    });

    expect(state.seriesByMetric).toEqual({
      kcal: [100, 200],
      protein: [10, 20],
      carbs: [12, 24],
      fat: [2, 4],
    });
    expect(state.totals).toEqual({ kcal: 300, protein: 30, carbs: 36, fat: 6 });
    expect(state.totals.kcal).toBe(
      state.seriesByMetric.kcal.reduce((sum, value) => sum + value, 0),
    );
  });

  it("separates rangeDays and loggedDays averages explicitly", () => {
    const state = buildStatisticsRangeState({
      meals: [
        makeMeal({
          mealId: "logged-day",
          cloudId: "logged-day",
          dayKey: "2026-03-18",
          totals: { kcal: 300, protein: 30, carbs: 36, fat: 6 },
        }),
      ],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-16",
        endDayKey: "2026-03-18",
      },
    });

    expect(state.averages.rangeDaysCount).toBe(3);
    expect(state.averages.loggedDaysCount).toBe(1);
    expect(state.averages.rangeDays).toEqual({
      kcal: 100,
      protein: 10,
      carbs: 12,
      fat: 2,
    });
    expect(state.averages.loggedDays).toEqual({
      kcal: 300,
      protein: 30,
      carbs: 36,
      fat: 6,
    });
  });

  it("builds previous equivalent-range kcal comparison", () => {
    const state = buildStatisticsRangeState({
      meals: [
        makeMeal({
          mealId: "previous-1",
          cloudId: "previous-1",
          dayKey: "2026-03-15",
          totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
        }),
        makeMeal({
          mealId: "previous-2",
          cloudId: "previous-2",
          dayKey: "2026-03-16",
          totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
        }),
        makeMeal({
          mealId: "current-1",
          cloudId: "current-1",
          dayKey: "2026-03-17",
          totals: { kcal: 150, protein: 15, carbs: 18, fat: 3 },
        }),
        makeMeal({
          mealId: "current-2",
          cloudId: "current-2",
          dayKey: "2026-03-18",
          totals: { kcal: 150, protein: 15, carbs: 18, fat: 3 },
        }),
      ],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-17",
        endDayKey: "2026-03-18",
      },
    });

    expect(state.comparison.previousRange).toEqual({
      startDayKey: "2026-03-15",
      endDayKey: "2026-03-16",
    });
    expect(state.comparison.hasPreviousEntries).toBe(true);
    expect(state.comparison.previousAverages?.rangeDays.kcal).toBe(100);
    expect(state.comparison.kcalAverageDelta).toBe(50);
    expect(state.comparison.kcalAverageDeltaPercent).toBe(50);
  });

  it("does not compare against days outside the free access window", () => {
    const state = buildStatisticsRangeState({
      meals: [
        makeMeal({
          mealId: "previous-outside-window",
          cloudId: "previous-outside-window",
          dayKey: "2026-03-15",
          totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
        }),
        makeMeal({
          mealId: "current",
          cloudId: "current",
          dayKey: "2026-03-18",
          totals: { kcal: 150, protein: 15, carbs: 18, fat: 3 },
        }),
      ],
      activeRange: "custom",
      todayDayKey: "2026-03-18",
      customRange: {
        startDayKey: "2026-03-17",
        endDayKey: "2026-03-18",
      },
      accessWindowDays: 3,
    });

    expect(state.comparison.previousRange).toBeNull();
    expect(state.comparison.previousAverages).toBeNull();
    expect(state.comparison.kcalAverageDelta).toBeNull();
    expect(state.comparison.kcalAverageDeltaPercent).toBeNull();
    expect(state.comparison.hasPreviousEntries).toBe(false);
  });

  it("clamps a free-window range as a separate pure function", () => {
    expect(
      clampStatisticsRangeToFreeWindow({
        range: {
          startDayKey: "2026-01-01",
          endDayKey: "2026-03-18",
        },
        accessWindowDays: 30,
        todayDayKey: "2026-03-18",
      }),
    ).toEqual({
      startDayKey: "2026-02-17",
      endDayKey: "2026-03-18",
    });
  });
});
