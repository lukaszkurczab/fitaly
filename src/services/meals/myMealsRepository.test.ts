import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@/services/core/apiClient", () => ({
  get: jest.fn(),
  post: (...args: unknown[]) => mockPost(...args),
  upload: jest.fn(),
}));

describe("myMealsRepository mutation identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({});
  });

  it("sends clientMutationId in saved meal upsert body", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { updateMyMealRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    await updateMyMealRemote(
      "user-1",
      "saved-1",
      {
        cloudId: "saved-1",
        mealId: "saved-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:30:00.000Z",
        source: "saved",
        deleted: false,
        totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
      },
      "mutation-saved-upsert-1",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/my-meals",
      expect.objectContaining({
        id: "saved-1",
        source: "saved",
        clientMutationId: "mutation-saved-upsert-1",
      }),
    );
  });

  it("sends clientMutationId in saved meal delete body", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { markMyMealDeletedRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    await markMyMealDeletedRemote(
      "user-1",
      "saved-1",
      "2026-03-03T12:30:00.000Z",
      { clientMutationId: "mutation-saved-delete-1" },
    );

    expect(mockPost).toHaveBeenCalledWith("/users/me/my-meals/saved-1/delete", {
      updatedAt: "2026-03-03T12:30:00.000Z",
      clientMutationId: "mutation-saved-delete-1",
    });
  });
});
