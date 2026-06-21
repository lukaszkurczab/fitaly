import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRuntimeConfig = {
  planningEnabled: true,
};

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockRuntimeConfig,
}));

jest.mock("@/services/meals/myMealsRepository", () => ({
  updateMyMealRemote: jest.fn(),
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  cloudId: "meal-1",
  timestamp: "2026-03-03T12:00:00.000Z",
  dayKey: "2026-03-03",
  loggedAtLocalMin: 720,
  tzOffsetMin: 60,
  type: "lunch",
  name: "Chicken",
  ingredients: [],
  createdAt: "2026-03-03T12:00:00.000Z",
  updatedAt: "2026-03-03T12:30:00.000Z",
  syncState: "pending",
  source: "manual",
  imageId: null,
  photoUrl: null,
  notes: null,
  tags: [],
  deleted: false,
  totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
  ...overrides,
});

describe("mealsRepository mutation identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ items: [], nextCursor: null });
    mockPost.mockResolvedValue({});
    mockRuntimeConfig.planningEnabled = true;
  });

  it("sends clientMutationId in core meal upsert body", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveMealRemote } = require("@/services/meals/mealsRepository") as
      typeof import("@/services/meals/mealsRepository");

    await saveMealRemote({
      uid: "user-1",
      meal: baseMeal(),
      clientMutationId: "mutation-upsert-1",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/meals",
      expect.objectContaining({
        id: "meal-1",
        clientMutationId: "mutation-upsert-1",
      }),
    );
  });

  it("sends planningSource in core meal upsert body", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveMealRemote } = require("@/services/meals/mealsRepository") as
      typeof import("@/services/meals/mealsRepository");

    const planningSource = {
      plannedMealId: "planned-1",
      plannedMealVersion: 2,
      sourceType: "manual" as const,
      sourceRef: null,
      nutritionEstimateState: "unknown" as const,
      missingNutritionFields: ["kcal" as const, "protein" as const],
    };

    await saveMealRemote({
      uid: "user-1",
      meal: baseMeal({ planningSource }),
      clientMutationId: "mutation-upsert-planned-source",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/meals",
      expect.objectContaining({
        planningSource,
      }),
    );
  });

  it("blocks planned-source remote upsert when Planning is disabled", async () => {
    mockRuntimeConfig.planningEnabled = false;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveMealRemote } = require("@/services/meals/mealsRepository") as
      typeof import("@/services/meals/mealsRepository");

    await expect(
      saveMealRemote({
        uid: "user-1",
        meal: baseMeal({
          planningSource: {
            plannedMealId: "planned-disabled-1",
            plannedMealVersion: 1,
            sourceType: "manual",
            sourceRef: null,
            nutritionEstimateState: "known",
            missingNutritionFields: [],
          },
        }),
        clientMutationId: "mutation-upsert-planned-disabled",
      }),
    ).rejects.toMatchObject({
      code: "feature/planning-disabled",
      retryable: false,
    });

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("normalizes planningSource from remote meal pages", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchMealsPageRemote } = require("@/services/meals/mealsRepository") as
      typeof import("@/services/meals/mealsRepository");
    const planningSource = {
      plannedMealId: "planned-1",
      plannedMealVersion: 2,
      sourceType: "manual",
      sourceRef: null,
      nutritionEstimateState: "unknown",
      missingNutritionFields: ["kcal", "protein"],
    };
    mockGet.mockResolvedValueOnce({
      items: [
        {
          id: "meal-1",
          loggedAt: "2026-03-03T12:00:00.000Z",
          dayKey: "2026-03-03",
          type: "lunch",
          name: "Chicken",
          ingredients: [],
          createdAt: "2026-03-03T12:00:00.000Z",
          updatedAt: "2026-03-03T12:30:00.000Z",
          source: "manual",
          tags: [],
          deleted: false,
          totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          planningSource,
        },
      ],
      nextCursor: null,
    });

    const page = await fetchMealsPageRemote({
      uid: "user-1",
      pageSize: 20,
      cursor: null,
    });

    expect(page.items[0]?.planningSource).toEqual(planningSource);
  });

  it("uses owner context for meal imageRef storagePath when available", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveMealRemote } = require("@/services/meals/mealsRepository") as
      typeof import("@/services/meals/mealsRepository");

    await saveMealRemote({
      uid: "user-1",
      meal: baseMeal({
        userUid: "",
        imageId: "image-1",
        photoUrl: "https://cdn/meal.jpg",
      }),
      clientMutationId: "mutation-upsert-image-1",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/meals",
      expect.objectContaining({
        imageRef: {
          imageId: "image-1",
          storagePath: "meals/user-1/image-1.jpg",
          downloadUrl: "https://cdn/meal.jpg",
        },
      }),
    );
  });

  it("does not synthesize unknown meal imageRef storagePath", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveMealRemote } = require("@/services/meals/mealsRepository") as
      typeof import("@/services/meals/mealsRepository");

    await saveMealRemote({
      uid: "",
      meal: baseMeal({
        userUid: "",
        imageId: "image-1",
        photoUrl: "https://cdn/meal.jpg",
      }),
      clientMutationId: "mutation-upsert-image-missing-owner",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/meals",
      expect.objectContaining({
        imageRef: {
          imageId: "image-1",
          downloadUrl: "https://cdn/meal.jpg",
        },
      }),
    );
    expect(JSON.stringify(mockPost.mock.calls[0]?.[1])).not.toContain("unknown");
  });

  it("sends clientMutationId in core meal delete body", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { markMealDeletedRemote } = require("@/services/meals/mealsRepository") as
      typeof import("@/services/meals/mealsRepository");

    await markMealDeletedRemote(
      "user-1",
      "meal-1",
      "2026-03-03T12:30:00.000Z",
      { clientMutationId: "mutation-delete-1" },
    );

    expect(mockPost).toHaveBeenCalledWith("/users/me/meals/meal-1/delete", {
      updatedAt: "2026-03-03T12:30:00.000Z",
      clientMutationId: "mutation-delete-1",
    });
  });
});
