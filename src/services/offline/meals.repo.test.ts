import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";

const mockRunSync = jest.fn();
const mockGetFirstSync = jest.fn();
const mockGetAllSync = jest.fn();

const planningSource = {
  plannedMealId: "planned-1",
  plannedMealVersion: 2,
  sourceType: "manual" as const,
  sourceRef: null,
  nutritionEstimateState: "unknown" as const,
  missingNutritionFields: ["fat" as const],
};

jest.mock("@/services/offline/db", () => ({
  getDB: () => ({
    runSync: (...args: unknown[]) => mockRunSync(...args),
    getFirstSync: (...args: unknown[]) => mockGetFirstSync(...args),
    getAllSync: (...args: unknown[]) => mockGetAllSync(...args),
  }),
}));

jest.mock("@/services/core/events", () => ({
  emit: jest.fn(),
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-03-18T10:00:00.000Z",
  type: "lunch",
  name: "Chicken bowl",
  ingredients: [],
  createdAt: "2026-03-18T10:00:00.000Z",
  updatedAt: "2026-03-18T10:00:00.000Z",
  syncState: "pending",
  source: "ai",
  cloudId: "cloud-1",
  inputMethod: "photo",
  aiMeta: {
    model: "gpt-5.4-mini",
    runId: "run-1",
    confidence: 0.88,
    warnings: ["partial_totals"],
  },
  dayKey: "2026-03-18",
  totals: {
    kcal: 500,
    protein: 40,
    carbs: 20,
    fat: 10,
  },
  ...overrides,
});

describe("offline meals repo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("serializes inputMethod, aiMeta and planningSource on upsert", async () => {
    const { upsertMealLocal } =
      jest.requireActual<typeof import("@/services/offline/meals.repo")>(
        "@/services/offline/meals.repo",
      );
    const { emit } = jest.requireMock("@/services/core/events") as {
      emit: jest.Mock;
    };

    await upsertMealLocal(baseMeal({ planningSource }));

    const args = mockRunSync.mock.calls[0]?.[1] as unknown[];
    expect(args).toContain("photo");
    expect(args).toContain(
      JSON.stringify({
        model: "gpt-5.4-mini",
        runId: "run-1",
        confidence: 0.88,
        warnings: ["partial_totals"],
      }),
    );
    expect(args).toContain(JSON.stringify(planningSource));
    expect(args).toContain("2026-03-18");
    expect(emit).toHaveBeenCalledWith("meal:local:upserted", {
      uid: "user-1",
      cloudId: "cloud-1",
      mealId: "meal-1",
      dayKey: "2026-03-18",
      ts: "2026-03-18T10:00:00.000Z",
    });
  });

  it("round-trips dayKey, inputMethod, aiMeta, planningSource, and totals from local persistence", async () => {
    mockGetFirstSync
      .mockReturnValueOnce({
        cloud_id: "cloud-1",
        meal_id: "meal-1",
        user_uid: "user-1",
        timestamp: "2026-03-18T10:00:00.000Z",
        day_key: "2026-03-18",
        type: "lunch",
        name: "Chicken bowl",
        ingredients: "[]",
        photo_url: null,
        image_local: null,
        image_id: null,
        totals_kcal: 500,
        totals_protein: 40,
        totals_carbs: 20,
        totals_fat: 10,
        deleted: 0,
        created_at: "2026-03-18T10:00:00.000Z",
        updated_at: "2026-03-18T10:00:00.000Z",
        last_synced_at: 0,
        sync_state: "pending",
        source: "ai",
        input_method: "text",
        ai_meta: JSON.stringify({
          model: "gpt-5.4",
          runId: "run-2",
          confidence: 0.5,
          warnings: ["low_confidence"],
        }),
        planning_source: JSON.stringify(planningSource),
        notes: null,
        tags: "[]",
      })
      .mockReturnValueOnce({
        cloud_id: "cloud-legacy",
        meal_id: "meal-legacy",
        user_uid: "user-1",
        timestamp: "2026-03-18T11:00:00.000Z",
        type: "other",
        name: "Legacy meal",
        ingredients: "[]",
        photo_url: null,
        image_local: null,
        image_id: null,
        totals_kcal: 0,
        totals_protein: 0,
        totals_carbs: 0,
        totals_fat: 0,
        deleted: 0,
        created_at: "2026-03-18T11:00:00.000Z",
        updated_at: "2026-03-18T11:00:00.000Z",
        last_synced_at: 0,
        sync_state: "pending",
        source: "manual",
        planning_source: null,
        notes: null,
        tags: "[]",
      });

    const { getMealByCloudIdLocal } =
      jest.requireActual<typeof import("@/services/offline/meals.repo")>(
        "@/services/offline/meals.repo",
      );

    await expect(getMealByCloudIdLocal("user-1", "cloud-1")).resolves.toEqual(
      expect.objectContaining({
        dayKey: "2026-03-18",
        inputMethod: "text",
        aiMeta: {
          model: "gpt-5.4",
          runId: "run-2",
          confidence: 0.5,
          warnings: ["low_confidence"],
        },
        planningSource,
        totals: {
          kcal: 500,
          protein: 40,
          carbs: 20,
          fat: 10,
        },
      }),
    );
    await expect(
      getMealByCloudIdLocal("user-1", "cloud-legacy"),
    ).resolves.toEqual(
      expect.objectContaining({
        inputMethod: null,
        aiMeta: null,
        planningSource: null,
        dayKey: null,
      }),
    );
  });

  it("emits user-scoped delete events", async () => {
    const { markDeletedLocal } =
      jest.requireActual<typeof import("@/services/offline/meals.repo")>(
        "@/services/offline/meals.repo",
      );
    const { emit } = jest.requireMock("@/services/core/events") as {
      emit: jest.Mock;
    };

    await markDeletedLocal("user-1", "cloud-1", "2026-03-18T12:00:00.000Z");

    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_uid=? AND cloud_id=?"),
      ["2026-03-18T12:00:00.000Z", "user-1", "cloud-1"],
    );
    expect(emit).toHaveBeenCalledWith("meal:local:deleted", {
      uid: "user-1",
      cloudId: "cloud-1",
      ts: "2026-03-18T12:00:00.000Z",
    });
  });

  it("filters date ranges by canonical day_key and keeps stable history ordering", async () => {
    mockGetAllSync.mockReturnValue([
      {
        cloud_id: "cloud-3",
        meal_id: "meal-3",
        user_uid: "user-1",
        timestamp: "2026-04-04T07:30:00.000Z",
        day_key: "2026-04-04",
        type: "breakfast",
        name: "Boundary meal",
        ingredients: "[]",
        photo_url: null,
        image_local: null,
        image_id: null,
        totals_kcal: 320,
        totals_protein: 18,
        totals_carbs: 24,
        totals_fat: 12,
        deleted: 0,
        created_at: "2026-04-04T07:30:00.000Z",
        updated_at: "2026-04-04T07:30:00.000Z",
        last_synced_at: 0,
        sync_state: "synced",
        source: "manual",
        input_method: null,
        ai_meta: null,
        notes: null,
        tags: "[]",
      },
    ]);

    const { getMealsPageLocalFiltered } =
      jest.requireActual<typeof import("@/services/offline/meals.repo")>(
        "@/services/offline/meals.repo",
      );

    await getMealsPageLocalFiltered("user-1", {
      limit: 25,
      cursor: "2026-04-05|2026-04-05T00:00:00.000Z|cloud-cursor",
      filters: {
        dateRange: {
          start: new Date(2026, 3, 2, 23, 30),
          end: new Date(2026, 3, 4, 0, 15),
        },
        calories: [300, 500],
        protein: [10, 30],
      },
    });

    const [sql, args] = mockGetAllSync.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain("day_key<?");
    expect(sql).toContain("timestamp<?");
    expect(sql).toContain("cloud_id<?");
    expect(sql).toContain("day_key>=?");
    expect(sql).toContain("day_key<=?");
    expect(sql).not.toContain("timestamp>=?");
    expect(sql).not.toContain("timestamp<=?");
    expect(sql).toContain(
      "ORDER BY day_key DESC, timestamp DESC, cloud_id DESC",
    );
    expect(args).toEqual([
      "user-1",
      "2026-04-05",
      "2026-04-05",
      "2026-04-05T00:00:00.000Z",
      "2026-04-05",
      "2026-04-05T00:00:00.000Z",
      "cloud-cursor",
      "2026-04-02",
      "2026-04-04",
      300,
      500,
      10,
      30,
      25,
    ]);
  });

  it("returns a composite cursor matching local history ordering", async () => {
    mockGetAllSync.mockReturnValue([
      {
        cloud_id: "cloud-3",
        meal_id: "meal-3",
        user_uid: "user-1",
        timestamp: "2026-04-04T07:30:00.000Z",
        day_key: "2026-04-04",
        type: "breakfast",
        name: "Boundary meal",
        ingredients: "[]",
        photo_url: null,
        image_local: null,
        image_id: null,
        totals_kcal: 320,
        totals_protein: 18,
        totals_carbs: 24,
        totals_fat: 12,
        deleted: 0,
        created_at: "2026-04-04T07:30:00.000Z",
        updated_at: "2026-04-04T07:30:00.000Z",
        last_synced_at: 0,
        sync_state: "synced",
        source: "manual",
        input_method: null,
        ai_meta: null,
        notes: null,
        tags: "[]",
      },
    ]);

    const { getMealsPageLocalFiltered } =
      jest.requireActual<typeof import("@/services/offline/meals.repo")>(
        "@/services/offline/meals.repo",
      );

    await expect(
      getMealsPageLocalFiltered("user-1", {
        limit: 1,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        nextCursor: "2026-04-04|2026-04-04T07:30:00.000Z|cloud-3",
      }),
    );
  });
});
