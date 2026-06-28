import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  IngredientProductCreateRequest,
  IngredientProductSearchRow,
} from "@/types/foodLibrary";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockEnqueueIngredientProductCreate = jest.fn<
  (...args: unknown[]) => Promise<{ clientMutationId: string; updatedAt: string }>
>();
const mockCreateIngredientProductRemote = jest.fn<
  (...args: unknown[]) => Promise<{ item: IngredientProductSearchRow }>
>();
const mockUpsertQueuedIngredientProductProjection = jest.fn<
  (...args: unknown[]) => Promise<IngredientProductSearchRow>
>();
const mockRequestSync = jest.fn<(...args: unknown[]) => Promise<unknown>>();
let mockE2EForcedOffline = false;

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: () => mockNetInfoFetch(),
  },
}));

jest.mock("@/services/e2e/connectivityOverride", () => ({
  isE2EForcedOffline: () => mockE2EForcedOffline,
}));

jest.mock("@/services/offline/queue.repo", () => ({
  enqueueIngredientProductCreate: (...args: unknown[]) =>
    mockEnqueueIngredientProductCreate(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductSearchApi", () => ({
  createIngredientProductRemote: (...args: unknown[]) =>
    mockCreateIngredientProductRemote(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductCreateQueue", () => {
  const actual = jest.requireActual<
    typeof import("@/services/foodLibrary/ingredientProductCreateQueue")
  >("@/services/foodLibrary/ingredientProductCreateQueue");
  return {
    ...actual,
    upsertQueuedIngredientProductProjection: (...args: unknown[]) =>
      mockUpsertQueuedIngredientProductProjection(...args),
  };
});

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (...args: unknown[]) => mockRequestSync(...args),
}));

function sampleCreateRequest(): IngredientProductCreateRequest {
  return {
    clientMutationId: "ingredient-product:create:user-1:mutation-1",
    ingredientProductId: "user-product-1",
    displayName: "Owsianka domowa",
    kind: "generic_ingredient",
    defaultServing: { quantity: 50, unit: "g" },
    nutritionPer100: null,
  };
}

function sampleRow(
  overrides: Partial<IngredientProductSearchRow> = {},
): IngredientProductSearchRow {
  return {
    ingredientProductId: "user-product-1",
    recordScope: "user_scoped",
    lifecycleState: "candidate",
    displayName: "Owsianka domowa",
    kind: "generic_ingredient",
    defaultServing: { quantity: 50, unit: "g" },
    nutritionPer100: null,
    confidence: { identity: "medium", nutrition: "unknown", profile: "unknown" },
    sourceAttribution: {
      sourceType: "user_created",
      sourceId: "ingredient-product:create:user-1:mutation-1",
      sourceName: "manual_entry",
      provider: null,
      license: null,
      observedAt: null,
      reviewedAt: null,
      reviewedBy: null,
    },
    profileCompatibility: {
      status: "unknown",
      dietaryFlags: [],
      allergenFlags: [],
    },
    warningReasonCodes: ["pending_user_record"],
    rankingSignals: ["user_scoped", "pending_user_record"],
    brandName: null,
    ingredientName: null,
    packageName: null,
    category: null,
    servingSizes: [],
    dietaryFlags: [],
    allergenFlags: [],
    cacheState: "fresh",
    ownerUserId: "user-1",
    ...overrides,
  };
}

describe("ingredientProductCreateService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockE2EForcedOffline = false;
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockEnqueueIngredientProductCreate.mockResolvedValue({
      clientMutationId: "ingredient-product:create:user-1:mutation-1",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });
    mockCreateIngredientProductRemote.mockResolvedValue({ item: sampleRow() });
    mockUpsertQueuedIngredientProductProjection.mockImplementation(async (params) =>
      (params as { item?: IngredientProductSearchRow }).item ?? sampleRow(),
    );
    mockRequestSync.mockResolvedValue(undefined);
  });

  it("creates online through the backend and updates the local projection", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductCreateService")>(
        "./ingredientProductCreateService",
      );
    const request = sampleCreateRequest();

    const result = await service.createOrQueueIngredientProduct({
      uid: "user-1",
      request,
      searchQuery: "Owsianka domowa",
      locale: "pl-PL",
    });

    expect(result).toEqual({
      status: "synced",
      item: sampleRow(),
    });
    expect(mockCreateIngredientProductRemote).toHaveBeenCalledWith(request);
    expect(mockEnqueueIngredientProductCreate).not.toHaveBeenCalled();
    expect(mockUpsertQueuedIngredientProductProjection).toHaveBeenCalledWith({
      uid: "user-1",
      payload: {
        request,
        searchQuery: "Owsianka domowa",
        locale: "pl-PL",
      },
      item: sampleRow(),
    });
  });

  it("queues while offline and schedules a Product/Ingredient push", async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    const service =
      jest.requireActual<typeof import("./ingredientProductCreateService")>(
        "./ingredientProductCreateService",
      );
    const request = sampleCreateRequest();

    const result = await service.createOrQueueIngredientProduct({
      uid: "user-1",
      request,
      searchQuery: "Offline bowl",
      locale: null,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "queued",
        clientMutationId: "ingredient-product:create:user-1:mutation-1",
      }),
    );
    expect(mockEnqueueIngredientProductCreate).toHaveBeenCalledWith("user-1", {
      request,
      searchQuery: "Offline bowl",
      locale: null,
    });
    expect(mockCreateIngredientProductRemote).not.toHaveBeenCalled();
    expect(mockUpsertQueuedIngredientProductProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        payload: {
          request,
          searchQuery: "Offline bowl",
          locale: null,
        },
        item: expect.objectContaining({
          ingredientProductId: "user-product-1",
          cacheState: "pending_local",
          ownerUserId: "user-1",
        }),
      }),
    );
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "foodLibrary",
      reason: "local-change",
      pullAfterPush: false,
    });
  });

  it("does not silently queue online backend failures", async () => {
    const backendError = new Error("backend failed");
    mockCreateIngredientProductRemote.mockRejectedValueOnce(backendError);
    const service =
      jest.requireActual<typeof import("./ingredientProductCreateService")>(
        "./ingredientProductCreateService",
      );

    await expect(
      service.createOrQueueIngredientProduct({
        uid: "user-1",
        request: sampleCreateRequest(),
        searchQuery: "Owsianka domowa",
      }),
    ).rejects.toThrow("backend failed");
    expect(mockEnqueueIngredientProductCreate).not.toHaveBeenCalled();
    expect(mockUpsertQueuedIngredientProductProjection).not.toHaveBeenCalled();
  });
});
