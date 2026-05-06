import {
  afterEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import {
  __hasLocalMealsStoreForTests,
  __resetLocalMealsStoreForTests,
  getLocalMealsSnapshot,
  subscribeLocalMeals,
  selectLocalMealByCloudId,
  selectLocalMealsByRange,
  upsertLocalMealSnapshot,
} from "@/services/meals/localMealsStore";
import type { Meal } from "@/types/meal";

const UID = "user-1";
const UID_B = "user-2";

const makeMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: UID,
  mealId: overrides.mealId ?? "meal-1",
  cloudId: overrides.cloudId ?? overrides.mealId ?? "meal-1",
  timestamp: overrides.timestamp ?? "2026-04-02T10:00:00.000Z",
  dayKey: overrides.dayKey ?? "2026-04-02",
  type: overrides.type ?? "lunch",
  name: overrides.name ?? "Meal",
  ingredients: overrides.ingredients ?? [],
  createdAt: overrides.createdAt ?? "2026-04-02T10:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-04-02T10:00:00.000Z",
  syncState: overrides.syncState ?? "synced",
  source: overrides.source ?? "manual",
  ...overrides,
});

describe("localMealsStore range selectors", () => {
  afterEach(() => {
    __resetLocalMealsStoreForTests();
  });

  it("selects meals by canonical dayKey instead of timestamp day across timezone boundaries", () => {
    const timezoneBoundaryMeal = makeMeal({
      mealId: "timezone-boundary",
      cloudId: "timezone-boundary",
      dayKey: "2026-04-02",
      timestamp: "2026-04-01T23:30:00.000Z",
      createdAt: "2026-04-01T23:30:00.000Z",
      updatedAt: "2026-04-01T23:30:00.000Z",
    });
    const missingDayKeyMeal = makeMeal({
      mealId: "missing-day-key",
      cloudId: "missing-day-key",
      dayKey: null,
      timestamp: "2026-04-02T09:00:00.000Z",
      createdAt: "2026-04-02T09:00:00.000Z",
      updatedAt: "2026-04-02T09:00:00.000Z",
    });
    const invalidDayKeyMeal = makeMeal({
      mealId: "invalid-day-key",
      cloudId: "invalid-day-key",
      dayKey: "2026-04-02T09:00:00.000Z",
      timestamp: "2026-04-02T09:00:00.000Z",
      createdAt: "2026-04-02T09:00:00.000Z",
      updatedAt: "2026-04-02T09:00:00.000Z",
    });

    upsertLocalMealSnapshot(UID, timezoneBoundaryMeal);
    upsertLocalMealSnapshot(UID, missingDayKeyMeal);
    upsertLocalMealSnapshot(UID, invalidDayKeyMeal);

    expect(
      selectLocalMealsByRange(UID, {
        start: new Date(2026, 3, 2),
        end: new Date(2026, 3, 2),
      }).map((meal) => meal.cloudId),
    ).toEqual(["timezone-boundary"]);
    expect(
      selectLocalMealsByRange(UID, {
        start: new Date(2026, 3, 1),
        end: new Date(2026, 3, 1),
      }),
    ).toEqual([]);
  });

  it("includes both start and end dayKey boundaries", () => {
    const startMeal = makeMeal({
      mealId: "start",
      cloudId: "start",
      dayKey: "2026-04-02",
      timestamp: "2026-04-02T08:00:00.000Z",
      createdAt: "2026-04-02T08:00:00.000Z",
      updatedAt: "2026-04-02T08:00:00.000Z",
    });
    const middleMeal = makeMeal({
      mealId: "middle",
      cloudId: "middle",
      dayKey: "2026-04-03",
      timestamp: "2026-04-03T12:00:00.000Z",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z",
    });
    const endMeal = makeMeal({
      mealId: "end",
      cloudId: "end",
      dayKey: "2026-04-04",
      timestamp: "2026-04-04T20:00:00.000Z",
      createdAt: "2026-04-04T20:00:00.000Z",
      updatedAt: "2026-04-04T20:00:00.000Z",
    });

    upsertLocalMealSnapshot(UID, startMeal);
    upsertLocalMealSnapshot(UID, middleMeal);
    upsertLocalMealSnapshot(UID, endMeal);

    expect(
      selectLocalMealsByRange(UID, {
        start: new Date(2026, 3, 2),
        end: new Date(2026, 3, 4),
      }).map((meal) => meal.cloudId),
    ).toEqual(["end", "middle", "start"]);
  });

  it("selects details by canonical cloudId only", () => {
    upsertLocalMealSnapshot(
      UID,
      makeMeal({
        mealId: "legacy-meal-id",
        cloudId: "canonical-cloud-id",
      }),
    );

    expect(
      selectLocalMealByCloudId(UID, "canonical-cloud-id"),
    ).toEqual(expect.objectContaining({ cloudId: "canonical-cloud-id" }));
    expect(selectLocalMealByCloudId(UID, "legacy-meal-id")).toBeNull();
  });

  it("removes idle per-user store after unsubscribe and keeps users isolated", () => {
    upsertLocalMealSnapshot(
      UID,
      makeMeal({
        mealId: "uid-a-meal",
        cloudId: "uid-a-meal",
      }),
    );

    const unsubscribeA = subscribeLocalMeals(UID, () => undefined);

    expect(__hasLocalMealsStoreForTests(UID)).toBe(true);
    expect(getLocalMealsSnapshot(UID).meals).toEqual([
      expect.objectContaining({ cloudId: "uid-a-meal", userUid: UID }),
    ]);

    unsubscribeA();

    expect(__hasLocalMealsStoreForTests(UID)).toBe(false);
    expect(getLocalMealsSnapshot(UID)).toEqual({
      meals: [],
      loading: false,
      version: 0,
    });

    const unsubscribeB = subscribeLocalMeals(UID_B, () => undefined);
    const snapshotB = getLocalMealsSnapshot(UID_B);

    expect(__hasLocalMealsStoreForTests(UID_B)).toBe(true);
    expect(snapshotB.meals).toEqual([]);
    expect(selectLocalMealByCloudId(UID_B, "uid-a-meal")).toBeNull();

    unsubscribeB();
  });
});
