import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { IngredientProductUserRecordRow } from "@/services/offline/types";
import type { IngredientProductSearchRow } from "@/types/foodLibrary";

const mockRunSync = jest.fn<(sql: string, params?: unknown[]) => void>();
const mockGetFirstSync = jest.fn<(sql: string, params?: unknown[]) => unknown>();
const mockGetAllSync = jest.fn<(sql: string, params?: unknown[]) => unknown[]>();

let rows = new Map<string, IngredientProductUserRecordRow>();

jest.mock("@/services/offline/db", () => ({
  getDB: () => ({
    runSync: mockRunSync,
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
  }),
}));

function rowKey(uid: string, productId: string): string {
  return `${uid}:${productId}`;
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
      sourceId: "mutation-1",
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
    cacheState: "pending_local",
    ownerUserId: "user-1",
    ...overrides,
  };
}

function applyRunSync(_sql: string, params: unknown[] = []): void {
  if (_sql.includes("DELETE FROM ingredient_product_user_records")) {
    rows.delete(rowKey(String(params[0]), String(params[1])));
    return;
  }

  const [
    uid,
    productId,
    displayName,
    payload,
    sourceClientMutationId,
    updatedAt,
    lastSyncedAt,
    syncState,
    lastErrorCode,
    lastErrorMessage,
  ] = params;
  rows.set(rowKey(String(uid), String(productId)), {
    user_uid: String(uid),
    ingredient_product_id: String(productId),
    display_name: String(displayName),
    payload: String(payload),
    source_client_mutation_id:
      typeof sourceClientMutationId === "string" ? sourceClientMutationId : null,
    updated_at: String(updatedAt),
    last_synced_at: Number(lastSyncedAt),
    sync_state: syncState as IngredientProductUserRecordRow["sync_state"],
    last_error_code: typeof lastErrorCode === "string" ? lastErrorCode : null,
    last_error_message: typeof lastErrorMessage === "string" ? lastErrorMessage : null,
  });
}

function applyGetFirstSync(_sql: string, params: unknown[] = []): unknown {
  return rows.get(rowKey(String(params[0]), String(params[1]))) ?? null;
}

function applyGetAllSync(sql: string, params: unknown[] = []): unknown[] {
  const uid = String(params[0]);
  if (sql.includes("ingredient_product_id IN")) {
    const ids = new Set(params.slice(1).map(String));
    const nonSearchableStates = sql.includes("'failed', 'conflict'")
      ? new Set<IngredientProductUserRecordRow["sync_state"]>([
          "failed",
          "conflict",
          "pending_delete",
          "delete_failed",
        ])
      : new Set<IngredientProductUserRecordRow["sync_state"]>([
          "pending_delete",
          "delete_failed",
        ]);
    return Array.from(rows.values()).filter(
      (row) =>
        row.user_uid === uid &&
        ids.has(row.ingredient_product_id) &&
        nonSearchableStates.has(row.sync_state),
    );
  }

  return Array.from(rows.values()).filter((row) => row.user_uid === uid);
}

describe("ingredientProductUserRecordProjectionRepository", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    rows = new Map();
    mockRunSync.mockImplementation(applyRunSync);
    mockGetFirstSync.mockImplementation(applyGetFirstSync);
    mockGetAllSync.mockImplementation(applyGetAllSync);
  });

  it("upserts only current-user scoped Product/Ingredient records", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow(),
      syncState: "pending",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "global-1", recordScope: "global_seed" }),
      syncState: "synced",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "other-1", ownerUserId: "other-user" }),
      syncState: "pending",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        syncState: "pending",
        item: expect.objectContaining({ ingredientProductId: "user-product-1" }),
      }),
    );
    expect(rows.size).toBe(1);
  });

  it("removes only the matching current-user Product/Ingredient record", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "shared-product" }),
      syncState: "synced",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "other-product" }),
      syncState: "synced",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-2",
      item: sampleRow({
        ingredientProductId: "shared-product",
        ownerUserId: "user-2",
      }),
      syncState: "synced",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });

    await repo.removeIngredientProductUserRecord({
      uid: "user-1",
      ingredientProductId: "shared-product",
    });

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "shared-product",
      }),
    ).resolves.toBeNull();
    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "other-product",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        item: expect.objectContaining({ ingredientProductId: "other-product" }),
      }),
    );
    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-2",
        ingredientProductId: "shared-product",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        item: expect.objectContaining({ ownerUserId: "user-2" }),
      }),
    );
  });

  it("marks pending local create as conflict when pulled remote mutation differs", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ sourceAttribution: { ...sampleRow().sourceAttribution, sourceId: "local-mutation" } }),
      syncState: "pending",
      updatedAt: "2026-06-16T09:00:00.000Z",
    });

    await expect(
      repo.applyPulledIngredientProductUserRecord({
        uid: "user-1",
        record: {
          item: sampleRow({
            displayName: "Remote owsianka",
            sourceAttribution: {
              ...sampleRow().sourceAttribution,
              sourceId: "remote-mutation",
            },
          }),
          updatedAt: "2026-06-16T10:00:00.000Z",
          creationClientMutationId: "remote-mutation",
        },
        pulledAt: 1_000,
      }),
    ).resolves.toBe("conflict");

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        syncState: "conflict",
        updatedAt: "2026-06-16T09:00:00.000Z",
        lastErrorCode: "food-library/conflict",
        item: expect.objectContaining({ displayName: "Owsianka domowa" }),
      }),
    );
  });

  it("replaces matching pending create with pulled synced record", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow(),
      syncState: "pending",
      updatedAt: "2026-06-16T09:00:00.000Z",
    });

    await expect(
      repo.applyPulledIngredientProductUserRecord({
        uid: "user-1",
        record: {
          item: sampleRow({ displayName: "Remote owsianka", cacheState: "fresh" }),
          updatedAt: "2026-06-16T10:00:00.000Z",
          creationClientMutationId: "mutation-1",
        },
        pulledAt: 1_000,
      }),
    ).resolves.toBe("synced");

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        syncState: "synced",
        updatedAt: "2026-06-16T10:00:00.000Z",
        lastSyncedAt: 1_000,
        item: expect.objectContaining({ displayName: "Remote owsianka" }),
      }),
    );
  });

  it("preserves pending local updates as explicit conflicts when remote pull arrives", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({
        displayName: "Local edited owsianka",
        cacheState: "pending_local",
        warningReasonCodes: ["pending_user_record"],
        rankingSignals: ["user_scoped", "pending_user_record"],
      }),
      syncState: "pending_update",
      updatedAt: "2026-06-16T09:30:00.000Z",
      lastSyncedAt: 500,
    });

    await expect(
      repo.applyPulledIngredientProductUserRecord({
        uid: "user-1",
        record: {
          item: sampleRow({
            displayName: "Remote edited owsianka",
            cacheState: "fresh",
          }),
          updatedAt: "2026-06-16T10:00:00.000Z",
          creationClientMutationId: "mutation-1",
        },
        pulledAt: 1_000,
      }),
    ).resolves.toBe("conflict");

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        syncState: "conflict",
        updatedAt: "2026-06-16T09:30:00.000Z",
        lastSyncedAt: 500,
        lastErrorCode: "food-library/conflict",
        lastErrorMessage:
          "Remote Product/Ingredient record conflicts with pending local update.",
        item: expect.objectContaining({
          displayName: "Local edited owsianka",
          cacheState: "stale",
          warningReasonCodes: ["pending_user_record", "backend_degraded"],
        }),
      }),
    );
    await expect(
      repo.searchIngredientProductUserRecords({
        uid: "user-1",
        query: "local",
      }),
    ).resolves.toEqual([]);
    await expect(
      repo.searchIngredientProductUserRecordConflicts({
        uid: "user-1",
        query: "local",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        syncState: "conflict",
        item: expect.objectContaining({
          displayName: "Local edited owsianka",
        }),
      }),
    ]);
  });

  it("removes only the exact current-user Product/Ingredient projection", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "target-product" }),
      syncState: "conflict",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "other-product" }),
      syncState: "conflict",
      updatedAt: "2026-06-16T11:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "other-user",
      item: sampleRow({
        ingredientProductId: "target-product",
        ownerUserId: "other-user",
      }),
      syncState: "conflict",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });

    await repo.removeIngredientProductUserRecord({
      uid: "user-1",
      ingredientProductId: "target-product",
    });

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "target-product",
      }),
    ).resolves.toBeNull();
    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "other-product",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        item: expect.objectContaining({ ingredientProductId: "other-product" }),
      }),
    );
    await expect(
      repo.readIngredientProductUserRecord({
        uid: "other-user",
        ingredientProductId: "target-product",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        item: expect.objectContaining({
          ingredientProductId: "target-product",
          ownerUserId: "other-user",
        }),
      }),
    );
  });

  it("searches pulled user records without exposing failed or conflict rows", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({
        ingredientProductId: "synced-pulled",
        displayName: "Śmietana domowa",
        cacheState: "fresh",
      }),
      syncState: "synced",
      updatedAt: "2026-06-16T10:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({
        ingredientProductId: "pending-local",
        displayName: "Smietana pending",
      }),
      syncState: "pending",
      updatedAt: "2026-06-16T11:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({
        ingredientProductId: "pending-update-local",
        displayName: "Smietana pending update",
      }),
      syncState: "pending_update",
      updatedAt: "2026-06-16T11:30:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({
        ingredientProductId: "failed-local",
        displayName: "Smietana failed",
      }),
      syncState: "failed",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({
        ingredientProductId: "conflict-local",
        displayName: "Smietana conflict",
      }),
      syncState: "conflict",
      updatedAt: "2026-06-16T13:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({
        ingredientProductId: "pending-delete",
        displayName: "Smietana pending delete",
      }),
      syncState: "pending_delete",
      updatedAt: "2026-06-16T14:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({
        ingredientProductId: "delete-failed",
        displayName: "Smietana delete failed",
      }),
      syncState: "delete_failed",
      updatedAt: "2026-06-16T15:00:00.000Z",
    });

    await expect(
      repo.searchIngredientProductUserRecords({
        uid: "user-1",
        query: "smietana",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        ingredientProductId: "synced-pulled",
      }),
      expect.objectContaining({
        ingredientProductId: "pending-local",
        cacheState: "pending_local",
      }),
      expect.objectContaining({
        ingredientProductId: "pending-update-local",
        cacheState: "pending_local",
      }),
    ]);

    await expect(
      repo.searchIngredientProductUserRecordConflicts({
        uid: "user-1",
        query: "smietana",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        syncState: "conflict",
        item: expect.objectContaining({
          ingredientProductId: "conflict-local",
        }),
        lastErrorCode: null,
      }),
    ]);

    await expect(
      repo.readIngredientProductUserRecordNonSearchableIds({
        uid: "user-1",
        ingredientProductIds: [
          "synced-pulled",
          "pending-local",
          "pending-update-local",
          "failed-local",
          "conflict-local",
          "pending-delete",
          "delete-failed",
        ],
      }),
    ).resolves.toEqual(
      new Set([
        "failed-local",
        "conflict-local",
        "pending-delete",
        "delete-failed",
      ]),
    );
  });

  it("marks local Product/Ingredient deletes as hidden pending or failed tombstones", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "user-product-delete" }),
      syncState: "synced",
      updatedAt: "2026-06-16T10:00:00.000Z",
      lastSyncedAt: 1_000,
    });

    await repo.markIngredientProductUserRecordDeletePending({
      uid: "user-1",
      ingredientProductId: "user-product-delete",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "user-product-delete",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        syncState: "pending_delete",
        updatedAt: "2026-06-16T12:00:00.000Z",
        lastSyncedAt: 1_000,
        item: expect.objectContaining({
          lifecycleState: "rejected",
          cacheState: "stale",
        }),
      }),
    );
    await expect(
      repo.searchIngredientProductUserRecords({
        uid: "user-1",
        query: "delete",
      }),
    ).resolves.toEqual([]);

    await repo.markIngredientProductUserRecordDeleteFailed({
      uid: "user-1",
      ingredientProductId: "user-product-delete",
      updatedAt: "2026-06-16T13:00:00.000Z",
      lastErrorCode: "food-library/delete-sync-failed",
    });

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "user-product-delete",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        syncState: "delete_failed",
        updatedAt: "2026-06-16T13:00:00.000Z",
        lastErrorCode: "food-library/delete-sync-failed",
      }),
    );
  });

  it("creates hidden delete tombstones from a cached user-scoped fallback item", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.markIngredientProductUserRecordDeletePending({
      uid: "user-1",
      ingredientProductId: "cached-only-product",
      updatedAt: "2026-06-16T12:00:00.000Z",
      fallbackItem: sampleRow({
        ingredientProductId: "cached-only-product",
        displayName: "Cached only",
        cacheState: "fresh",
      }),
    });

    await expect(
      repo.readIngredientProductUserRecord({
        uid: "user-1",
        ingredientProductId: "cached-only-product",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        syncState: "pending_delete",
        lastSyncedAt: 0,
        item: expect.objectContaining({
          lifecycleState: "rejected",
          cacheState: "stale",
        }),
      }),
    );
    await expect(
      repo.searchIngredientProductUserRecords({
        uid: "user-1",
        query: "cached",
      }),
    ).resolves.toEqual([]);
  });

  it("returns only requested local delete tombstone ids", async () => {
    const repo = jest.requireActual<
      typeof import("./ingredientProductUserRecordProjectionRepository")
    >("./ingredientProductUserRecordProjectionRepository");

    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "pending-delete" }),
      syncState: "pending_delete",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "delete-failed" }),
      syncState: "delete_failed",
      updatedAt: "2026-06-16T13:00:00.000Z",
    });
    await repo.upsertLocalIngredientProductUserRecord({
      uid: "user-1",
      item: sampleRow({ ingredientProductId: "still-visible" }),
      syncState: "synced",
      updatedAt: "2026-06-16T14:00:00.000Z",
    });

    await expect(
      repo.readIngredientProductUserRecordDeleteIds({
        uid: "user-1",
        ingredientProductIds: [
          "pending-delete",
          "delete-failed",
          "still-visible",
          "other",
        ],
      }),
    ).resolves.toEqual(new Set(["pending-delete", "delete-failed"]));
  });
});
