import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Meal, UserNutritionProfile } from "@/types";
import { useStatisticsState } from "@/feature/Statistics/hooks/useStatisticsState";
import { useMeals } from "@/hooks/useMeals";
import { buildHomeDayState } from "@/feature/Home/services/homeDaySelectors";
import * as statisticsRangeSelectors from "@/feature/Statistics/services/statisticsRangeSelectors";

jest.mock("@/hooks/useMeals", () => ({
  useMeals: jest.fn(),
}));

const useMealsMock = useMeals as jest.MockedFunction<typeof useMeals>;

const makeMeal = (overrides: Partial<Meal> = {}): Meal =>
  ({
    userUid: "user-1",
    mealId: "meal-1",
    cloudId: "meal-1",
    timestamp: "2026-03-10T10:00:00.000Z",
    dayKey: "2026-03-10",
    type: "lunch",
    name: "Meal",
    ingredients: [],
    createdAt: "2026-03-10T10:00:00.000Z",
    updatedAt: "2026-03-10T10:00:00.000Z",
    syncState: "synced",
    source: "manual",
    totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
    ...overrides,
  }) as Meal;

const mockUseMeals = (meals: Meal[], loading = false) => {
  const api = {
    meals,
    getMeals: jest.fn(async () => undefined),
    loading,
    addMeal: jest.fn(),
    updateMeal: jest.fn(),
    deleteMeal: jest.fn(),
    duplicateMeal: jest.fn(),
    getUnsyncedMeals: jest.fn(),
    refresh: jest.fn(),
    loadMore: jest.fn(),
    hasMore: false,
  };

  useMealsMock.mockReturnValue(api as never);
  return api;
};

describe("useStatisticsState", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 10, 12, 0, 0, 0));
    mockUseMeals([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("relies on useMeals as the local loader and returns default 7-day state", async () => {
    const mealsApi = mockUseMeals([]);

    const { result } = renderHook(() =>
      useStatisticsState({ uid: "user-1", calorieTarget: 2000 }),
    );

    await waitFor(() => {
      expect(result.current.days).toBe(7);
    });

    expect(useMealsMock).toHaveBeenCalledWith("user-1");
    expect(mealsApi.getMeals).not.toHaveBeenCalled();
    expect(mealsApi.refresh).not.toHaveBeenCalled();
    expect(result.current.active).toBe("7d");
    expect(result.current.metric).toBe("kcal");
    expect(result.current.emptyKind).toBe("no_history");
    expect(result.current.days).toBe(7);
  });

  it("returns totals, series, selectedSeries and averages from the canonical selector", () => {
    const meals = [
      makeMeal({
        mealId: "ingredients",
        ingredients: [
          {
            id: "ing-1",
            name: "Egg",
            amount: 1,
            kcal: 120,
            protein: 12,
            fat: 6,
            carbs: 1,
          },
        ],
      }),
      makeMeal({
        mealId: "totals",
        cloudId: "totals",
        totals: { kcal: 180, protein: 18, carbs: 9, fat: 5 },
      }),
    ];
    mockUseMeals(meals);

    const canonical = statisticsRangeSelectors.buildStatisticsRangeState({
      meals,
      activeRange: "7d",
      todayDayKey: "2026-03-10",
      accessWindowDays: undefined,
    });

    const { result } = renderHook(() =>
      useStatisticsState({ uid: "user-1", calorieTarget: 2000 }),
    );

    expect(result.current.totals).toEqual(canonical.totals);
    expect(result.current.seriesByMetric).toEqual(canonical.seriesByMetric);
    expect(result.current.selectedSeries).toEqual(canonical.seriesByMetric.kcal);
    expect(result.current.avgKcal).toBe(canonical.averages.rangeDays.kcal);
    expect(result.current.avgProtein).toBe(canonical.averages.rangeDays.protein);
    expect(result.current.avgCarbs).toBe(canonical.averages.rangeDays.carbs);
    expect(result.current.avgFat).toBe(canonical.averages.rangeDays.fat);
    expect(result.current.avgLoggedProtein).toBe(
      canonical.averages.loggedDays.protein,
    );
    expect(result.current.avgLoggedCarbs).toBe(canonical.averages.loggedDays.carbs);
    expect(result.current.avgLoggedFat).toBe(canonical.averages.loggedDays.fat);
    expect(result.current.loggedDaysCount).toBe(canonical.averages.loggedDaysCount);
    expect(result.current.rangeDaysCount).toBe(canonical.averages.rangeDaysCount);
    expect(result.current.calorieTarget).toBe(2000);
    expect(result.current.calorieComparison).toEqual(canonical.comparison);

    act(() => {
      result.current.setMetric("protein");
    });

    expect(result.current.selectedSeries).toEqual(canonical.seriesByMetric.protein);
  });

  it("recomputes the active range without precomputing inactive ranges", () => {
    const selectorSpy = jest.spyOn(
      statisticsRangeSelectors,
      "buildStatisticsRangeState",
    );
    mockUseMeals([
      makeMeal({
        mealId: "today",
        cloudId: "today",
        dayKey: "2026-03-10",
        totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
      }),
      makeMeal({
        mealId: "older",
        cloudId: "older",
        dayKey: "2026-03-01",
        timestamp: "2026-03-01T10:00:00.000Z",
        totals: { kcal: 400, protein: 40, carbs: 48, fat: 8 },
      }),
    ]);

    const { result } = renderHook(() =>
      useStatisticsState({ uid: "user-1", calorieTarget: 2000 }),
    );

    expect(result.current.days).toBe(7);
    expect(result.current.totals.kcal).toBe(100);
    selectorSpy.mockClear();

    act(() => {
      result.current.setActive("30d");
    });

    expect(result.current.days).toBe(30);
    expect(result.current.totals.kcal).toBe(500);
    expect(selectorSpy).toHaveBeenCalled();
    expect(
      selectorSpy.mock.calls.every(([params]) => params.activeRange === "30d"),
    ).toBe(true);
  });

  it("preserves the requested custom range and clamps only the effective free window", () => {
    mockUseMeals([
      makeMeal({
        mealId: "old",
        cloudId: "old",
        dayKey: "2026-01-15",
        timestamp: "2026-01-15T10:00:00.000Z",
      }),
    ]);

    const { result } = renderHook(() =>
      useStatisticsState({
        uid: "user-1",
        calorieTarget: null,
        accessWindowDays: 30,
      }),
    );

    act(() => {
      result.current.setActive("custom");
      result.current.setCustomRange({
        start: new Date(2026, 0, 1, 0, 0, 0, 0),
        end: new Date(2026, 0, 15, 0, 0, 0, 0),
      });
    });

    expect(result.current.customRange.start).toEqual(new Date(2026, 0, 1));
    expect(result.current.customRange.end).toEqual(new Date(2026, 0, 15));
    expect(result.current.selectedRange.start).toEqual(new Date(2026, 0, 1));
    expect(result.current.selectedRange.end).toEqual(new Date(2026, 0, 15));
    expect(result.current.effectiveRange.start).toEqual(new Date(2026, 1, 9));
    expect(result.current.effectiveRange.end).toEqual(new Date(2026, 1, 9));
    expect(result.current.emptyKind).toBe("limited_by_free_window");
    expect(result.current.isWindowLimited).toBe(true);
  });

  it("keeps no_entries_in_range when the user has history inside the local read model but not in the effective range", () => {
    mockUseMeals([
      makeMeal({
        mealId: "old",
        cloudId: "old",
        dayKey: "2026-02-10",
        timestamp: "2026-02-10T10:00:00.000Z",
      }),
    ]);

    const { result } = renderHook(() =>
      useStatisticsState({ uid: "user-1", calorieTarget: null }),
    );

    expect(result.current.emptyKind).toBe("no_entries_in_range");
    expect(result.current.hasAnyMeals).toBe(true);
    expect(result.current.hasEntriesInRange).toBe(false);
    expect(result.current.isWindowLimited).toBe(false);
  });

  it("uses limited_by_free_window instead of no_entries_in_range when the request exceeds the free window", () => {
    mockUseMeals([
      makeMeal({
        mealId: "old",
        cloudId: "old",
        dayKey: "2026-01-15",
        timestamp: "2026-01-15T10:00:00.000Z",
      }),
    ]);

    const { result } = renderHook(() =>
      useStatisticsState({
        uid: "user-1",
        calorieTarget: null,
        accessWindowDays: 30,
      }),
    );

    act(() => {
      result.current.setActive("custom");
      result.current.setCustomRange({
        start: new Date(2026, 0, 1),
        end: new Date(2026, 0, 15),
      });
    });

    expect(result.current.emptyKind).toBe("limited_by_free_window");
    expect(result.current.hasAnyMeals).toBe(true);
    expect(result.current.hasEntriesInRange).toBe(false);
    expect(result.current.isWindowLimited).toBe(true);
  });

  it("does not limit premium users for older custom ranges", () => {
    mockUseMeals([
      makeMeal({
        mealId: "old",
        cloudId: "old",
        dayKey: "2026-01-15",
        timestamp: "2026-01-15T10:00:00.000Z",
      }),
    ]);

    const { result } = renderHook(() =>
      useStatisticsState({ uid: "user-1", calorieTarget: null }),
    );

    act(() => {
      result.current.setActive("custom");
      result.current.setCustomRange({
        start: new Date(2026, 0, 1),
        end: new Date(2026, 0, 15),
      });
    });

    expect(result.current.emptyKind).toBe("none");
    expect(result.current.hasEntriesInRange).toBe(true);
    expect(result.current.isWindowLimited).toBe(false);
  });

  it("keeps analytics visible for free users when the accessible part of the range contains entries", () => {
    mockUseMeals([
      makeMeal({
        mealId: "window-meal",
        cloudId: "window-meal",
        dayKey: "2026-02-20",
        timestamp: "2026-02-20T10:00:00.000Z",
        totals: { kcal: 320, protein: 30, carbs: 25, fat: 10 },
      }),
    ]);

    const { result } = renderHook(() =>
      useStatisticsState({
        uid: "user-1",
        calorieTarget: null,
        accessWindowDays: 30,
      }),
    );

    act(() => {
      result.current.setActive("custom");
      result.current.setCustomRange({
        start: new Date(2026, 0, 1),
        end: new Date(2026, 1, 20),
      });
    });

    expect(result.current.emptyKind).toBe("none");
    expect(result.current.hasEntriesInRange).toBe(true);
    expect(result.current.isWindowLimited).toBe(true);
    expect(result.current.selectedRange.start).toEqual(new Date(2026, 0, 1));
    expect(result.current.effectiveRange.start).toEqual(new Date(2026, 1, 9));
  });

  it("includes pending, failed and conflict meals in totals", () => {
    mockUseMeals([
      makeMeal({
        mealId: "pending",
        cloudId: "pending",
        syncState: "pending",
        totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
      }),
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
    ]);

    const { result } = renderHook(() =>
      useStatisticsState({ uid: "user-1", calorieTarget: 2000 }),
    );

    expect(result.current.emptyKind).toBe("none");
    expect(result.current.totals).toEqual({
      kcal: 600,
      protein: 60,
      carbs: 72,
      fat: 12,
    });
  });

  it("matches Home consumed totals for the same dayKey", () => {
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
        dayKey: "2026-03-09",
        timestamp: "2026-03-09T10:00:00.000Z",
        totals: { kcal: 999, protein: 99, fat: 99, carbs: 99 },
      }),
    ];
    mockUseMeals(meals);

    const homeState = buildHomeDayState({
      meals,
      selectedDayKey: "2026-03-10",
      todayDayKey: "2026-03-10",
      nutritionProfile: {
        calorieTarget: 1000,
        preferences: ["balanced"],
        goal: "maintain",
      } as UserNutritionProfile,
    });
    const { result } = renderHook(() =>
      useStatisticsState({ uid: "user-1", calorieTarget: 1000 }),
    );

    act(() => {
      result.current.setActive("custom");
      result.current.setCustomRange({
        start: new Date(2026, 2, 10),
        end: new Date(2026, 2, 10),
      });
    });

    expect(result.current.totals).toEqual(homeState.consumed);
    expect(result.current.seriesByMetric.kcal).toEqual([homeState.consumed.kcal]);
  });

  it("does not refetch backend data when the range changes", () => {
    const mealsApi = mockUseMeals([
      makeMeal({
        mealId: "today",
        cloudId: "today",
        totals: { kcal: 100, protein: 10, carbs: 12, fat: 2 },
      }),
    ]);

    const { result } = renderHook(() =>
      useStatisticsState({ uid: "user-1", calorieTarget: 1000 }),
    );

    act(() => {
      result.current.setActive("30d");
    });
    act(() => {
      result.current.setActive("custom");
      result.current.setCustomRange({
        start: new Date(2026, 2, 10),
        end: new Date(2026, 2, 10),
      });
    });

    expect(mealsApi.getMeals).not.toHaveBeenCalled();
    expect(mealsApi.refresh).not.toHaveBeenCalled();
    expect(mealsApi.loadMore).not.toHaveBeenCalled();
  });
});
