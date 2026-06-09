import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";

const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@/services/core/apiClient", () => ({
  get: jest.fn(),
  post: (...args: unknown[]) => mockPost(...args),
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
    mockPost.mockResolvedValue({});
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
