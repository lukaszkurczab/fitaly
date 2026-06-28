import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  IngredientProductSearchRow,
  IngredientProductUpdateRequest,
} from "@/types/foodLibrary";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockEnqueueIngredientProductUpdate = jest.fn<
  (...args: unknown[]) => Promise<{ clientMutationId: string; updatedAt: string }>
>();
const mockUpdateIngredientProductRemote = jest.fn<
  (...args: unknown[]) => Promise<{ item: IngredientProductSearchRow }>
>();
const mockUpsertQueuedIngredientProductUpdateProjection = jest.fn<
  (...args: unknown[]) => Promise<IngredientProductSearchRow | null>
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
  enqueueIngredientProductUpdate: (...args: unknown[]) =>
    mockEnqueueIngredientProductUpdate(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductSearchApi", () => {
  const actual = jest.requireActual<
    typeof import("@/services/foodLibrary/ingredientProductSearchApi")
  >("@/services/foodLibrary/ingredientProductSearchApi");
  return {
    ...actual,
    updateIngredientProductRemote: (...args: unknown[]) =>
      mockUpdateIngredientProductRemote(...args),
  };
});

jest.mock("@/services/foodLibrary/ingredientProductCreateQueue", () => {
  const actual = jest.requireActual<
    typeof import("@/services/foodLibrary/ingredientProductCreateQueue")
  >("@/services/foodLibrary/ingredientProductCreateQueue");
  return {
    ...actual,
    upsertQueuedIngredientProductUpdateProjection: (...args: unknown[]) =>
      mockUpsertQueuedIngredientProductUpdateProjection(...args),
  };
});

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (...args: unknown[]) => mockRequestSync(...args),
}));

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
    warningReasonCodes: [],
    rankingSignals: ["user_scoped"],
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

function sampleUpdateRequest(
  overrides: Partial<IngredientProductUpdateRequest> = {},
): IngredientProductUpdateRequest {
  return {
    clientMutationId: "ingredient-product:update:user-1:mutation-1",
    ingredientProductId: "user-product-1",
    displayName: "Owsianka nocna",
    brandName: null,
    ...overrides,
  };
}

describe("ingredientProductUpdateService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockE2EForcedOffline = false;
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockEnqueueIngredientProductUpdate.mockResolvedValue({
      clientMutationId: "ingredient-product:update:user-1:mutation-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    mockUpdateIngredientProductRemote.mockResolvedValue({
      item: sampleRow({ displayName: "Owsianka nocna" }),
    });
    mockUpsertQueuedIngredientProductUpdateProjection.mockImplementation(
      async (params) =>
        (params as { item?: IngredientProductSearchRow }).item ??
        sampleRow({
          displayName: "Owsianka nocna",
          cacheState: "pending_local",
          warningReasonCodes: ["pending_user_record"],
          rankingSignals: ["user_scoped", "pending_user_record"],
        }),
    );
    mockRequestSync.mockResolvedValue(undefined);
  });

  it("updates online through the backend and marks the local projection synced", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductUpdateService")>(
        "./ingredientProductUpdateService",
      );
    const request = sampleUpdateRequest();
    const baseItem = sampleRow();
    const result = await service.updateOrQueueIngredientProduct({
      uid: "user-1",
      request,
      baseItem,
      searchQuery: "Owsianka",
      locale: "pl-PL",
    });

    expect(result).toEqual({
      status: "synced",
      item: sampleRow({ displayName: "Owsianka nocna" }),
    });
    expect(mockUpdateIngredientProductRemote).toHaveBeenCalledWith(request);
    expect(mockEnqueueIngredientProductUpdate).not.toHaveBeenCalled();
    expect(mockUpsertQueuedIngredientProductUpdateProjection).toHaveBeenCalledWith({
      uid: "user-1",
      payload: {
        request,
        baseItem,
        searchQuery: "Owsianka",
        locale: "pl-PL",
      },
      item: sampleRow({ displayName: "Owsianka nocna" }),
      syncState: "synced",
    });
  });

  it("queues while offline, applies pending update projection, and schedules sync", async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    const service =
      jest.requireActual<typeof import("./ingredientProductUpdateService")>(
        "./ingredientProductUpdateService",
      );
    const request = sampleUpdateRequest();
    const baseItem = sampleRow();

    await expect(
      service.updateOrQueueIngredientProduct({
        uid: "user-1",
        request,
        baseItem,
        searchQuery: "Owsianka",
        locale: null,
      }),
    ).resolves.toEqual({
      status: "queued",
      item: sampleRow({
        displayName: "Owsianka nocna",
        cacheState: "pending_local",
        warningReasonCodes: ["pending_user_record"],
        rankingSignals: ["user_scoped", "pending_user_record"],
      }),
      clientMutationId: "ingredient-product:update:user-1:mutation-1",
    });

    expect(mockEnqueueIngredientProductUpdate).toHaveBeenCalledWith("user-1", {
      request,
      baseItem,
      searchQuery: "Owsianka",
      locale: null,
    });
    expect(mockUpdateIngredientProductRemote).not.toHaveBeenCalled();
    expect(mockUpsertQueuedIngredientProductUpdateProjection).toHaveBeenCalledWith({
      uid: "user-1",
      payload: {
        request,
        baseItem,
        searchQuery: "Owsianka",
        locale: null,
      },
      syncState: "pending_update",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "foodLibrary",
      reason: "local-change",
      pullAfterPush: false,
    });
  });

  it("does not silently queue online backend update failures", async () => {
    mockUpdateIngredientProductRemote.mockRejectedValueOnce(
      new Error("backend failed"),
    );
    const service =
      jest.requireActual<typeof import("./ingredientProductUpdateService")>(
        "./ingredientProductUpdateService",
      );

    await expect(
      service.updateOrQueueIngredientProduct({
        uid: "user-1",
        request: sampleUpdateRequest(),
        baseItem: sampleRow(),
        searchQuery: "Owsianka",
      }),
    ).rejects.toThrow("backend failed");
    expect(mockEnqueueIngredientProductUpdate).not.toHaveBeenCalled();
    expect(mockUpsertQueuedIngredientProductUpdateProjection).not.toHaveBeenCalled();
  });

  it("rejects non-current-user update context before remote or queue work", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductUpdateService")>(
        "./ingredientProductUpdateService",
      );

    await expect(
      service.updateOrQueueIngredientProduct({
        uid: "user-1",
        request: sampleUpdateRequest(),
        baseItem: sampleRow({ ownerUserId: "other-user" }),
        searchQuery: "Owsianka",
      }),
    ).rejects.toThrow(
      "Ingredient/Product update payload must target a current-user record.",
    );
    expect(mockUpdateIngredientProductRemote).not.toHaveBeenCalled();
    expect(mockEnqueueIngredientProductUpdate).not.toHaveBeenCalled();
  });
});
