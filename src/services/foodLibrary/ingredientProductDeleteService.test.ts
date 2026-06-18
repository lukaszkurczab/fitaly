import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockEnqueueIngredientProductDelete = jest.fn<
  (...args: unknown[]) => Promise<{ clientMutationId: string; updatedAt: string }>
>();
const mockDeleteIngredientProductRemote = jest.fn<
  (...args: unknown[]) => Promise<{
    ingredientProductId: string;
    updatedAt: string;
    updated: boolean;
  }>
>();
const mockMarkQueuedIngredientProductDeleted = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockMarkQueuedIngredientProductDeletePending = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockRequestSync = jest.fn<(...args: unknown[]) => Promise<unknown>>();
let mockE2EForcedOffline = false;

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: () => mockNetInfoFetch(),
  },
}));

jest.mock("uuid", () => ({
  v4: () => "uuid-generated",
}));

jest.mock("@/services/e2e/connectivityOverride", () => ({
  isE2EForcedOffline: () => mockE2EForcedOffline,
}));

jest.mock("@/services/offline/queue.repo", () => ({
  enqueueIngredientProductDelete: (...args: unknown[]) =>
    mockEnqueueIngredientProductDelete(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductSearchApi", () => ({
  deleteIngredientProductRemote: (...args: unknown[]) =>
    mockDeleteIngredientProductRemote(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductCreateQueue", () => ({
  markQueuedIngredientProductDeleted: (...args: unknown[]) =>
    mockMarkQueuedIngredientProductDeleted(...args),
  markQueuedIngredientProductDeletePending: (...args: unknown[]) =>
    mockMarkQueuedIngredientProductDeletePending(...args),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (...args: unknown[]) => mockRequestSync(...args),
}));

describe("ingredientProductDeleteService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockE2EForcedOffline = false;
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockEnqueueIngredientProductDelete.mockResolvedValue({
      clientMutationId: "ingredient-product:delete:user-1:user-product-1:uuid",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    mockDeleteIngredientProductRemote.mockResolvedValue({
      ingredientProductId: "user-product-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
      updated: true,
    });
    mockMarkQueuedIngredientProductDeleted.mockResolvedValue();
    mockMarkQueuedIngredientProductDeletePending.mockResolvedValue();
    mockRequestSync.mockResolvedValue(undefined);
  });

  it("deletes online through the backend and removes local projections", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductDeleteService")>(
        "./ingredientProductDeleteService",
      );

    await expect(
      service.deleteOrQueueIngredientProduct({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual({
      status: "synced",
      ingredientProductId: "user-product-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });

    expect(mockDeleteIngredientProductRemote).toHaveBeenCalledWith({
      ingredientProductId: "user-product-1",
      clientMutationId:
        "ingredient-product:delete:user-1:user-product-1:uuid-generated",
    });
    expect(mockEnqueueIngredientProductDelete).not.toHaveBeenCalled();
    expect(mockMarkQueuedIngredientProductDeleted).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
  });

  it("queues while offline, hides the local record, and schedules sync", async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    const service =
      jest.requireActual<typeof import("./ingredientProductDeleteService")>(
        "./ingredientProductDeleteService",
      );

    await expect(
      service.deleteOrQueueIngredientProduct({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual({
      status: "queued",
      ingredientProductId: "user-product-1",
      clientMutationId: "ingredient-product:delete:user-1:user-product-1:uuid",
    });

    expect(mockEnqueueIngredientProductDelete).toHaveBeenCalledWith(
      "user-1",
      "user-product-1",
    );
    expect(mockDeleteIngredientProductRemote).not.toHaveBeenCalled();
    expect(mockMarkQueuedIngredientProductDeletePending).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "foodLibrary",
      reason: "local-change",
      pullAfterPush: false,
    });
  });

  it("does not silently queue online backend delete failures", async () => {
    mockDeleteIngredientProductRemote.mockRejectedValueOnce(
      new Error("backend failed"),
    );
    const service =
      jest.requireActual<typeof import("./ingredientProductDeleteService")>(
        "./ingredientProductDeleteService",
      );

    await expect(
      service.deleteOrQueueIngredientProduct({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).rejects.toThrow("backend failed");
    expect(mockEnqueueIngredientProductDelete).not.toHaveBeenCalled();
    expect(mockMarkQueuedIngredientProductDeleted).not.toHaveBeenCalled();
  });
});
