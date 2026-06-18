import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { IngredientProductSearchCacheRow } from "@/services/offline/types";
import type {
  IngredientProductSearchResponse,
  IngredientProductSearchRow,
} from "@/types/foodLibrary";

const mockRunSync = jest.fn<(sql: string, params?: unknown[]) => void>();
const mockGetAllSync = jest.fn<(sql: string, params?: unknown[]) => unknown[]>();
const mockExecSync = jest.fn<(sql: string) => void>();

let rows = new Map<string, IngredientProductSearchCacheRow>();

jest.mock("@/services/offline/db", () => ({
  getDB: () => ({
    runSync: mockRunSync,
    getAllSync: mockGetAllSync,
    execSync: mockExecSync,
  }),
}));

function rowKey(uid: string, query: string, productId: string): string {
  return `${uid}:${query}:${productId}`;
}

function sampleSearchRow(
  overrides: Partial<IngredientProductSearchRow> = {},
): IngredientProductSearchRow {
  return {
    ingredientProductId: "ingredient-product-1",
    recordScope: "global_seed",
    lifecycleState: "verified",
    displayName: "Owies",
    kind: "generic_ingredient",
    defaultServing: { quantity: 50, unit: "g" },
    nutritionPer100: {
      basis: "per_100g",
      unit: "g",
      kcal: 389,
      protein: 16.9,
      fat: 6.9,
      carbs: 66.3,
      fiber: null,
      sugar: null,
      salt: null,
      saturatedFat: null,
    },
    confidence: { identity: "verified", nutrition: "high", profile: "unknown" },
    sourceAttribution: {
      sourceType: "internal_seed",
      sourceId: "seed-1",
      sourceName: "Fitaly seed",
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
    rankingSignals: ["verified_seed"],
    brandName: null,
    ingredientName: null,
    packageName: null,
    category: null,
    servingSizes: [],
    dietaryFlags: [],
    allergenFlags: [],
    cacheState: "fresh",
    ownerUserId: null,
    ...overrides,
  };
}

function sampleResponse(
  items: IngredientProductSearchRow[] = [sampleSearchRow()],
): IngredientProductSearchResponse {
  return {
    items,
    queryEcho: {
      normalizedQuery: "owies",
      queryLength: 5,
      limit: 8,
      includeUserScoped: true,
      includeGlobal: true,
      locale: null,
    },
    cachePolicy: {
      cacheGeneration: "ingredient_product_search_v1",
      maxAgeSeconds: 60,
    },
    warnings: ["profile_unknown"],
  };
}

function applyRunSync(sql: string, params: unknown[] = []): void {
  if (sql.includes("DELETE FROM ingredient_product_search_cache")) {
    if (sql.includes("ingredient_product_id=?")) {
      const uid = String(params[0]);
      const productId = String(params[1]);
      for (const [key, row] of rows.entries()) {
        if (row.user_uid === uid && row.ingredient_product_id === productId) {
          rows.delete(key);
        }
      }
      return;
    }
    if (sql.includes("normalized_query=?")) {
      const uid = String(params[0]);
      const query = String(params[1]);
      for (const key of rows.keys()) {
        if (key.startsWith(`${uid}:${query}:`)) rows.delete(key);
      }
    }
    return;
  }

  if (sql.includes("INSERT INTO ingredient_product_search_cache")) {
    const [
      uid,
      query,
      ingredientProductId,
      resultRank,
      displayName,
      payload,
      queryEcho,
      cachePolicy,
      warnings,
      cacheState,
      cachedAt,
      expiresAt,
    ] = params;
    rows.set(rowKey(String(uid), String(query), String(ingredientProductId)), {
      user_uid: String(uid),
      normalized_query: String(query),
      ingredient_product_id: String(ingredientProductId),
      result_rank: Number(resultRank),
      display_name: String(displayName),
      payload: String(payload),
      query_echo: String(queryEcho),
      cache_policy: String(cachePolicy),
      warnings: String(warnings),
      cache_state: typeof cacheState === "string" ? cacheState : null,
      cached_at: Number(cachedAt),
      expires_at: Number(expiresAt),
    });
  }
}

function applyGetAllSync(sql: string, params: unknown[] = []): unknown[] {
  const uid = String(params[0]);
  if (sql.includes("ingredient_product_id=?")) {
    const productId = String(params[1]);
    return Array.from(rows.values())
      .filter(
        (row) =>
          row.user_uid === uid && row.ingredient_product_id === productId,
      )
      .sort((a, b) => {
        if (a.cached_at !== b.cached_at) return b.cached_at - a.cached_at;
        return a.result_rank - b.result_rank;
      })
      .slice(0, 1);
  }

  const query = String(params[1]);
  return Array.from(rows.values())
    .filter((row) => row.user_uid === uid && row.normalized_query === query)
    .sort((a, b) => a.result_rank - b.result_rank);
}

describe("ingredientProductSearchProjectionRepository", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    rows = new Map();
    mockRunSync.mockImplementation(applyRunSync);
    mockGetAllSync.mockImplementation(applyGetAllSync);
  });

  it("replaces per-query projection rows with bounded TTL metadata", async () => {
    const repo =
      jest.requireActual<typeof import("./ingredientProductSearchProjectionRepository")>(
        "./ingredientProductSearchProjectionRepository",
      );

    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: sampleResponse(),
      cachedAt: 1_000,
    });

    const projection = await repo.readIngredientProductSearchProjection({
      uid: "user-1",
      query: " OWIES ",
      now: 10_000,
    });

    expect(projection.items).toEqual([
      expect.objectContaining({ ingredientProductId: "ingredient-product-1" }),
    ]);
    expect(projection.warnings).toEqual(["profile_unknown"]);
    expect(projection.cachedAt).toBe(1_000);
    expect(projection.expiresAt).toBe(61_000);
    expect(projection.isStale).toBe(false);
  });

  it("replaces only the current user's current query cache rows", async () => {
    const repo =
      jest.requireActual<typeof import("./ingredientProductSearchProjectionRepository")>(
        "./ingredientProductSearchProjectionRepository",
      );

    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: sampleResponse([
        sampleSearchRow({ ingredientProductId: "user-1-old-owies" }),
      ]),
      cachedAt: 1_000,
    });
    await repo.replaceIngredientProductSearchProjection({
      uid: "user-2",
      response: sampleResponse([
        sampleSearchRow({ ingredientProductId: "user-2-owies" }),
      ]),
      cachedAt: 1_100,
    });
    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: {
        ...sampleResponse([
          sampleSearchRow({ ingredientProductId: "user-1-smietana" }),
        ]),
        queryEcho: {
          ...sampleResponse().queryEcho,
          normalizedQuery: "smietana",
          queryLength: 8,
        },
      },
      cachedAt: 1_200,
    });

    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: sampleResponse([
        sampleSearchRow({ ingredientProductId: "user-1-new-owies" }),
      ]),
      cachedAt: 2_000,
    });

    await expect(
      repo.readIngredientProductSearchProjection({
        uid: "user-1",
        query: "owies",
        now: 2_000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ ingredientProductId: "user-1-new-owies" })],
      }),
    );
    await expect(
      repo.readIngredientProductSearchProjection({
        uid: "user-2",
        query: "owies",
        now: 2_000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ ingredientProductId: "user-2-owies" })],
      }),
    );
    await expect(
      repo.readIngredientProductSearchProjection({
        uid: "user-1",
        query: "smietana",
        now: 2_000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ ingredientProductId: "user-1-smietana" })],
      }),
    );
  });

  it("removes a product from all cached queries for only the matching user", async () => {
    const repo =
      jest.requireActual<typeof import("./ingredientProductSearchProjectionRepository")>(
        "./ingredientProductSearchProjectionRepository",
      );

    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: sampleResponse([
        sampleSearchRow({ ingredientProductId: "user-product-1" }),
        sampleSearchRow({ ingredientProductId: "catalog-oats" }),
      ]),
      cachedAt: 1_000,
    });
    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: {
        ...sampleResponse([
          sampleSearchRow({ ingredientProductId: "user-product-1" }),
        ]),
        queryEcho: {
          ...sampleResponse().queryEcho,
          normalizedQuery: "owsianka",
          queryLength: 8,
        },
      },
      cachedAt: 1_000,
    });
    await repo.replaceIngredientProductSearchProjection({
      uid: "user-2",
      response: sampleResponse([
        sampleSearchRow({ ingredientProductId: "user-product-1" }),
      ]),
      cachedAt: 1_000,
    });

    await repo.removeIngredientProductSearchProjectionItem({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });

    await expect(
      repo.readIngredientProductSearchProjection({
        uid: "user-1",
        query: "owies",
        now: 2_000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ ingredientProductId: "catalog-oats" })],
      }),
    );
    await expect(
      repo.readIngredientProductSearchProjection({
        uid: "user-1",
        query: "owsianka",
        now: 2_000,
      }),
    ).resolves.toEqual(expect.objectContaining({ items: [] }));
    await expect(
      repo.readIngredientProductSearchProjection({
        uid: "user-2",
        query: "owies",
        now: 2_000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ ingredientProductId: "user-product-1" })],
      }),
    );
  });

  it("reads a cached product by id before delete projection removal", async () => {
    const repo =
      jest.requireActual<typeof import("./ingredientProductSearchProjectionRepository")>(
        "./ingredientProductSearchProjectionRepository",
      );

    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: sampleResponse([
        sampleSearchRow({
          ingredientProductId: "user-product-1",
          recordScope: "user_scoped",
          ownerUserId: "user-1",
        }),
      ]),
      cachedAt: 1_000,
    });

    await expect(
      repo.readIngredientProductSearchProjectionItem({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ingredientProductId: "user-product-1",
        recordScope: "user_scoped",
      }),
    );
    await expect(
      repo.readIngredientProductSearchProjectionItem({
        uid: "user-2",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toBeNull();
  });

  it("uses backend-compatible accent folding for offline cache lookups", async () => {
    const repo =
      jest.requireActual<typeof import("./ingredientProductSearchProjectionRepository")>(
        "./ingredientProductSearchProjectionRepository",
      );

    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: {
        ...sampleResponse(),
        queryEcho: {
          ...sampleResponse().queryEcho,
          normalizedQuery: "smietana",
          queryLength: 8,
        },
      },
      cachedAt: 1_000,
    });

    const projection = await repo.readIngredientProductSearchProjection({
      uid: "user-1",
      query: " Śmietana ",
      now: 10_000,
    });

    expect(projection.items).toEqual([
      expect.objectContaining({ ingredientProductId: "ingredient-product-1" }),
    ]);
  });

  it("upserts queued user records into only the matching uid and query projection", async () => {
    const repo =
      jest.requireActual<typeof import("./ingredientProductSearchProjectionRepository")>(
        "./ingredientProductSearchProjectionRepository",
      );

    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: sampleResponse([
        sampleSearchRow({ ingredientProductId: "catalog-oats" }),
        sampleSearchRow({ ingredientProductId: "user-product-1" }),
      ]),
      cachedAt: 1_000,
    });
    await repo.replaceIngredientProductSearchProjection({
      uid: "user-2",
      response: sampleResponse([
        sampleSearchRow({ ingredientProductId: "other-user-product" }),
      ]),
      cachedAt: 1_000,
    });

    await repo.upsertIngredientProductSearchProjectionItem({
      uid: "user-1",
      query: " Owies ",
      locale: "pl-PL",
      item: sampleSearchRow({
        ingredientProductId: "user-product-1",
        recordScope: "user_scoped",
        displayName: "Owsianka domowa",
        cacheState: "pending_local",
        ownerUserId: "user-1",
        warningReasonCodes: ["pending_user_record"],
      }),
      warnings: ["pending_user_record"],
      cachedAt: 2_000,
    });

    await expect(
      repo.readIngredientProductSearchProjection({
        uid: "user-1",
        query: "owies",
        now: 2_000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            ingredientProductId: "user-product-1",
            displayName: "Owsianka domowa",
            cacheState: "pending_local",
          }),
          expect.objectContaining({ ingredientProductId: "catalog-oats" }),
        ],
        warnings: expect.arrayContaining(["profile_unknown", "pending_user_record"]),
      }),
    );
    await expect(
      repo.readIngredientProductSearchProjection({
        uid: "user-2",
        query: "owies",
        now: 2_000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({ ingredientProductId: "other-user-product" }),
        ],
      }),
    );
  });

  it("marks projection stale after cache expiry", async () => {
    const repo =
      jest.requireActual<typeof import("./ingredientProductSearchProjectionRepository")>(
        "./ingredientProductSearchProjectionRepository",
      );

    await repo.replaceIngredientProductSearchProjection({
      uid: "user-1",
      response: sampleResponse(),
      cachedAt: 1_000,
    });

    const projection = await repo.readIngredientProductSearchProjection({
      uid: "user-1",
      query: "owies",
      now: 61_001,
    });

    expect(projection.items).toHaveLength(1);
    expect(projection.isStale).toBe(true);
  });

  it("rejects oversized projection payloads", async () => {
    const repo =
      jest.requireActual<typeof import("./ingredientProductSearchProjectionRepository")>(
        "./ingredientProductSearchProjectionRepository",
      );

    await expect(
      repo.replaceIngredientProductSearchProjection({
        uid: "user-1",
        response: sampleResponse([
          sampleSearchRow({ displayName: "x".repeat(20_000) }),
        ]),
        cachedAt: 1_000,
      }),
    ).rejects.toThrow("projection payload exceeds local cache limit");
    expect(mockExecSync).toHaveBeenCalledWith("ROLLBACK");
  });
});
