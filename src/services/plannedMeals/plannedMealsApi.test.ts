import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  PlannedMealCreateRequest,
  PlannedMealDraftSnapshot,
  PlannedMealNutritionEstimate,
} from "@/types/plannedMeals";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPatch = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
  request: (...args: unknown[]) => mockRequest(...args),
}));

function sampleDraftSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    name: "Planned oats",
    type: "breakfast",
    ingredients: [
      {
        id: "ingredient-1",
        name: "Oats",
        amount: 50,
        unit: "g",
        kcal: 180,
        protein: 6,
        fat: 3,
        carbs: 32,
      },
    ],
    totals: {
      protein: 6,
      fat: 3,
      carbs: 32,
      kcal: 180,
    },
    notes: null,
    tags: [],
    ...overrides,
  };
}

function sampleEstimate(overrides: Record<string, unknown> = {}) {
  return {
    state: "known",
    totals: {
      protein: 6,
      fat: 3,
      carbs: 32,
      kcal: 180,
    },
    missingFields: [],
    confidence: "medium",
    ...overrides,
  };
}

function sampleItem(overrides: Record<string, unknown> = {}) {
  return {
    plannedMealId: "planned-1",
    version: 1,
    dateBucket: "2026-06-19",
    timeBucket: "breakfast",
    sourceType: "manual",
    sourceRef: null,
    draftSnapshot: sampleDraftSnapshot(),
    nutritionEstimate: sampleEstimate(),
    status: "planned",
    createdAt: "2026-06-18T08:00:00.000Z",
    updatedAt: "2026-06-18T08:00:00.000Z",
    ...overrides,
  };
}

function sampleListResponse(overrides: Record<string, unknown> = {}) {
  return {
    items: [sampleItem()],
    queryEcho: {
      startDate: "2026-06-18",
      days: 3,
      includeDeleted: false,
      returnedItems: 1,
    },
    ...overrides,
  };
}

function sampleMutationResponse(overrides: Record<string, unknown> = {}) {
  return {
    item: sampleItem(),
    updated: true,
    ...overrides,
  };
}

function createPayload(): PlannedMealCreateRequest {
  return {
    clientMutationId: "create-1",
    plannedMealId: "planned-1",
    dateBucket: "2026-06-19",
    timeBucket: "breakfast",
    sourceType: "manual",
    sourceRef: null,
    draftSnapshot: sampleDraftSnapshot() as PlannedMealDraftSnapshot,
    nutritionEstimate: sampleEstimate() as PlannedMealNutritionEstimate,
  };
}

describe("plannedMealsApi", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("calls the v2 planned meals list endpoint with bounded horizon query", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");
    mockGet.mockResolvedValueOnce(sampleListResponse({ items: [] }));

    await api.fetchPlannedMealsRemote({
      startDate: "2026-06-18",
      days: 3,
      includeDeleted: true,
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/planned-meals?startDate=2026-06-18&days=3&includeDeleted=true",
      undefined,
    );
  });

  it("normalizes planned item records without logged meal fields", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");
    mockGet.mockResolvedValueOnce(sampleListResponse());

    await expect(api.fetchPlannedMealsRemote()).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            plannedMealId: "planned-1",
            status: "planned",
            sourceType: "manual",
            draftSnapshot: expect.objectContaining({
              name: "Planned oats",
            }),
          }),
        ],
      }),
    );
  });

  it("accepts explicit unknown and partial estimate states", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");
    mockGet.mockResolvedValueOnce(
      sampleListResponse({
        items: [
          sampleItem({
            plannedMealId: "unknown-1",
            nutritionEstimate: sampleEstimate({
              state: "unknown",
              totals: null,
              missingFields: ["kcal", "protein", "fat", "carbs"],
              confidence: null,
            }),
          }),
          sampleItem({
            plannedMealId: "partial-1",
            nutritionEstimate: sampleEstimate({
              state: "partial",
              totals: {
                protein: 0,
                fat: 8,
                carbs: 20,
                kcal: 200,
              },
              missingFields: ["protein"],
              confidence: "low",
            }),
          }),
        ],
      }),
    );

    await expect(api.fetchPlannedMealsRemote()).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            nutritionEstimate: expect.objectContaining({ state: "unknown" }),
          }),
          expect.objectContaining({
            nutritionEstimate: expect.objectContaining({ state: "partial" }),
          }),
        ],
      }),
    );
  });

  it("accepts backend-valid null optionals", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");
    mockGet.mockResolvedValueOnce(
      sampleListResponse({
        items: [
          sampleItem({
            sourceType: "recipe",
            sourceRef: {
              sourceId: "recipe-1",
              sourceVersion: null,
              snapshotName: null,
            },
            draftSnapshot: sampleDraftSnapshot({
              ingredients: [
                {
                  id: "ingredient-1",
                  name: "Oats",
                  amount: 50,
                  unit: null,
                  kcal: 180,
                  protein: 6,
                  fat: 3,
                  carbs: 32,
                },
              ],
            }),
          }),
        ],
      }),
    );

    await expect(api.fetchPlannedMealsRemote()).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            sourceRef: {
              sourceId: "recipe-1",
              sourceVersion: null,
              snapshotName: null,
            },
            draftSnapshot: expect.objectContaining({
              ingredients: [
                expect.not.objectContaining({
                  unit: expect.anything(),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  });

  it("rejects raw logged meal fields on planned item records", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");
    mockGet.mockResolvedValueOnce(
      sampleListResponse({
        items: [sampleItem({ mealId: "logged-meal-1" })],
      }),
    );

    await expect(api.fetchPlannedMealsRemote()).rejects.toThrow(
      "Invalid Planned Meal response.",
    );
  });

  it("creates planned meals with idempotent retry mode", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");
    mockPost.mockResolvedValueOnce(sampleMutationResponse());
    const payload = createPayload();

    await api.createPlannedMealRemote(payload);

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/users/me/planned-meals",
      payload,
      { retryMode: "idempotent" },
    );
  });

  it("updates planned meals with version guard payload", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");
    mockPatch.mockResolvedValueOnce(sampleMutationResponse());
    const payload = {
      clientMutationId: "update-1",
      expectedVersion: 1,
      sourceRef: null,
      timeBucket: null,
    };

    await api.updatePlannedMealRemote("planned-1", payload);

    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v2/users/me/planned-meals/planned-1",
      payload,
      { retryMode: "idempotent" },
    );
  });

  it("deletes planned meals through DELETE request with idempotent retry mode", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");
    mockRequest.mockResolvedValueOnce(
      sampleMutationResponse({
        item: sampleItem({ status: "deleted", version: 2 }),
      }),
    );

    await api.deletePlannedMealRemote("planned-1", {
      clientMutationId: "delete-1",
      expectedVersion: 1,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "DELETE",
      "/api/v2/users/me/planned-meals/planned-1?clientMutationId=delete-1&expectedVersion=1",
      undefined,
      { retryMode: "idempotent" },
    );
  });

  it("rejects invalid planned meal ids before remote mutation", async () => {
    const api =
      jest.requireActual<typeof import("./plannedMealsApi")>("./plannedMealsApi");

    await expect(
      api.updatePlannedMealRemote("bad/id", {
        clientMutationId: "update-1",
        expectedVersion: 1,
        dateBucket: "2026-06-20",
      }),
    ).rejects.toThrow("Invalid plannedMealId.");
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
