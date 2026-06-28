import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  IngredientProductSearchResponse,
  IngredientProductSearchRow,
} from "@/types/foodLibrary";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockSearchRemote = jest.fn<(...args: unknown[]) => Promise<IngredientProductSearchResponse>>();
const mockReadProjection = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockReplaceProjection = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockSearchUserRecords = jest.fn<
  (...args: unknown[]) => Promise<IngredientProductSearchRow[]>
>();
const mockSearchUserRecordConflicts = jest.fn<
  (...args: unknown[]) => Promise<unknown[]>
>();
const mockReadUserRecordNonSearchableIds = jest.fn<
  (...args: unknown[]) => Promise<Set<string>>
>();
let mockE2EForcedOffline = false;

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: () => mockNetInfoFetch(),
  },
}));

jest.mock("./ingredientProductSearchApi", () => {
  const actual = jest.requireActual<
    typeof import("./ingredientProductSearchApi")
  >("./ingredientProductSearchApi");
  return {
    ...actual,
    searchIngredientProductsRemote: (...args: unknown[]) => mockSearchRemote(...args),
  };
});

jest.mock("./ingredientProductSearchProjectionRepository", () => ({
  readIngredientProductSearchProjection: (...args: unknown[]) =>
    mockReadProjection(...args),
  replaceIngredientProductSearchProjection: (...args: unknown[]) =>
    mockReplaceProjection(...args),
}));

jest.mock("./ingredientProductUserRecordProjectionRepository", () => ({
  readIngredientProductUserRecordNonSearchableIds: (...args: unknown[]) =>
    mockReadUserRecordNonSearchableIds(...args),
  searchIngredientProductUserRecordConflicts: (...args: unknown[]) =>
    mockSearchUserRecordConflicts(...args),
  searchIngredientProductUserRecords: (...args: unknown[]) =>
    mockSearchUserRecords(...args),
}));

jest.mock("@/services/e2e/connectivityOverride", () => ({
  isE2EForcedOffline: () => mockE2EForcedOffline,
}));

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
    nutritionPer100: null,
    confidence: { identity: "verified", nutrition: "unknown", profile: "unknown" },
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
  overrides: Partial<IngredientProductSearchResponse> = {},
): IngredientProductSearchResponse {
  return {
    items: [sampleSearchRow()],
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
    warnings: [],
    ...overrides,
  };
}

function sampleProjection(overrides: Record<string, unknown> = {}) {
  return {
    items: [sampleSearchRow({ cacheState: "offline" })],
    queryEcho: sampleResponse().queryEcho,
    cachePolicy: sampleResponse().cachePolicy,
    warnings: ["offline_cache"],
    cachedAt: 1_000,
    expiresAt: 61_000,
    isStale: false,
    ...overrides,
  };
}

describe("ingredientProductSearchService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockE2EForcedOffline = false;
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockReadProjection.mockResolvedValue(sampleProjection({ items: [] }));
    mockSearchUserRecords.mockResolvedValue([]);
    mockSearchUserRecordConflicts.mockResolvedValue([]);
    mockReadUserRecordNonSearchableIds.mockResolvedValue(new Set());
    mockReplaceProjection.mockResolvedValue(undefined);
  });

  it("returns idle without network work for short queries", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );

    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "o" }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: "idle",
        items: [],
        source: "none",
      }),
    );
    expect(mockNetInfoFetch).not.toHaveBeenCalled();
    expect(mockSearchRemote).not.toHaveBeenCalled();
  });

  it("returns remote results and writes projection cache", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockSearchRemote.mockResolvedValueOnce(sampleResponse());

    const result = await service.searchIngredientProducts({
      uid: "user-1",
      query: " Owies ",
      limit: 12,
    });

    expect(result.status).toBe("results");
    expect(result.source).toBe("remote");
    expect(mockSearchRemote).toHaveBeenCalledWith({
      query: "owies",
      locale: undefined,
      limit: 12,
      includeUserScoped: undefined,
      includeGlobal: undefined,
    });
    expect(mockReplaceProjection).toHaveBeenCalledWith({
      uid: "user-1",
      response: sampleResponse(),
    });
  });

  it("filters locally non-searchable user records from online search before caching", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    const visibleSeed = sampleSearchRow({
      ingredientProductId: "catalog-oats",
      displayName: "Owies seed",
    });
    const pendingDeleted = sampleSearchRow({
      ingredientProductId: "user-oats-deleting",
      recordScope: "user_scoped",
      displayName: "Owies user deleting",
      ownerUserId: "user-1",
      rankingSignals: ["user_scoped"],
    });
    mockSearchRemote.mockResolvedValueOnce(
      sampleResponse({ items: [pendingDeleted, visibleSeed] }),
    );
    mockReadUserRecordNonSearchableIds.mockResolvedValueOnce(
      new Set(["user-oats-deleting"]),
    );

    const result = await service.searchIngredientProducts({
      uid: "user-1",
      query: "owies",
    });

    expect(mockReadUserRecordNonSearchableIds).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductIds: ["user-oats-deleting", "catalog-oats"],
    });
    expect(result.items).toEqual([
      expect.objectContaining({ ingredientProductId: "catalog-oats" }),
    ]);
    expect(mockReplaceProjection).toHaveBeenCalledWith({
      uid: "user-1",
      response: expect.objectContaining({
        items: [visibleSeed],
      }),
    });
  });

  it("exposes local conflict rows separately from autocomplete results", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    const conflictItem = sampleSearchRow({
      ingredientProductId: "user-oats-conflict",
      recordScope: "user_scoped",
      displayName: "Owies konflikt",
      ownerUserId: "user-1",
      rankingSignals: ["user_scoped"],
      sourceAttribution: {
        sourceType: "user_created",
        sourceId: "local-mutation-1",
        sourceName: "User",
        provider: null,
        license: null,
        observedAt: null,
        reviewedAt: null,
        reviewedBy: null,
      },
    });
    mockSearchRemote.mockResolvedValueOnce(sampleResponse({ items: [] }));
    mockSearchUserRecordConflicts.mockResolvedValueOnce([
      {
        item: conflictItem,
        updatedAt: "2026-06-16T10:00:00.000Z",
        lastErrorCode: "food-library/conflict",
        lastErrorMessage: "Remote record conflicts with pending local create.",
      },
    ]);

    const result = await service.searchIngredientProducts({
      uid: "user-1",
      query: "owies",
    });

    expect(result.status).toBe("no_results");
    expect(result.items).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({
          ingredientProductId: "user-oats-conflict",
        }),
        lastErrorCode: "food-library/conflict",
      }),
    ]);
    expect(mockSearchUserRecordConflicts).toHaveBeenCalledWith({
      uid: "user-1",
      query: "owies",
      limit: undefined,
    });
  });

  it("filters cached conflict rows from offline autocomplete items", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    const conflictItem = sampleSearchRow({
      ingredientProductId: "user-oats-conflict",
      recordScope: "user_scoped",
      displayName: "Owies konflikt",
      ownerUserId: "user-1",
      rankingSignals: ["user_scoped"],
      sourceAttribution: {
        sourceType: "user_created",
        sourceId: "local-mutation-1",
        sourceName: "User",
        provider: null,
        license: null,
        observedAt: null,
        reviewedAt: null,
        reviewedBy: null,
      },
    });
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    mockReadProjection.mockResolvedValueOnce(
      sampleProjection({ items: [conflictItem] }),
    );
    mockReadUserRecordNonSearchableIds.mockResolvedValueOnce(
      new Set(["user-oats-conflict"]),
    );
    mockSearchUserRecordConflicts.mockResolvedValueOnce([
      {
        item: conflictItem,
        updatedAt: "2026-06-16T10:00:00.000Z",
        lastErrorCode: "food-library/conflict",
        lastErrorMessage: "Remote record conflicts with pending local create.",
      },
    ]);

    const result = await service.searchIngredientProducts({
      uid: "user-1",
      query: "owies",
    });

    expect(result.status).toBe("offline_no_cache");
    expect(result.items).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({
          ingredientProductId: "user-oats-conflict",
        }),
      }),
    ]);
    expect(mockSearchRemote).not.toHaveBeenCalled();
  });

  it("distinguishes no-results from backend degraded", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockSearchRemote.mockResolvedValueOnce(sampleResponse({ items: [] }));
    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "owies" }),
    ).resolves.toEqual(expect.objectContaining({ status: "no_results" }));

    mockSearchRemote.mockResolvedValueOnce(
      sampleResponse({ items: [], warnings: ["backend_degraded"] }),
    );
    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "owies" }),
    ).resolves.toEqual(expect.objectContaining({ status: "backend_degraded" }));
  });

  it("uses pulled user records when backend returns an explicit degraded response", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockSearchRemote.mockResolvedValueOnce(
      sampleResponse({ items: [], warnings: ["backend_degraded"] }),
    );
    mockReadProjection.mockResolvedValueOnce(sampleProjection({ items: [] }));
    mockSearchUserRecords.mockResolvedValueOnce([
      sampleSearchRow({
        ingredientProductId: "user-oats-pulled",
        recordScope: "user_scoped",
        displayName: "Owsianka z pull",
        rankingSignals: ["user_scoped"],
        ownerUserId: "user-1",
      }),
    ]);

    const result = await service.searchIngredientProducts({
      uid: "user-1",
      query: "owsianka",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "backend_degraded",
        source: "cache",
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({ ingredientProductId: "user-oats-pulled" }),
    ]);
  });

  it("returns warning or stale states from remote metadata", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockSearchRemote.mockResolvedValueOnce(
      sampleResponse({
        items: [sampleSearchRow({ warningReasonCodes: ["profile_unknown"] })],
      }),
    );
    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "owies" }),
    ).resolves.toEqual(expect.objectContaining({ status: "warning" }));

    mockSearchRemote.mockResolvedValueOnce(
      sampleResponse({
        items: [sampleSearchRow({ cacheState: "stale" })],
        warnings: ["cache_stale"],
      }),
    );
    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "owies" }),
    ).resolves.toEqual(
      expect.objectContaining({ status: "stale", isStale: true }),
    );
  });

  it("uses only same uid/query cache while offline", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    mockReadProjection.mockResolvedValueOnce(sampleProjection());

    const result = await service.searchIngredientProducts({
      uid: "user-1",
      query: "OWIES",
    });

    expect(result.status).toBe("offline_warm_cache");
    expect(result.source).toBe("cache");
    expect(mockReadProjection).toHaveBeenCalledWith({
      uid: "user-1",
      query: "owies",
    });
    expect(mockSearchUserRecords).toHaveBeenCalledWith({
      uid: "user-1",
      query: "owies",
    });
    expect(mockSearchRemote).not.toHaveBeenCalled();
  });

  it("uses pulled user records for offline local search when query cache is empty", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    mockReadProjection.mockResolvedValueOnce(sampleProjection({ items: [] }));
    mockSearchUserRecords.mockResolvedValueOnce([
      sampleSearchRow({
        ingredientProductId: "user-oats-pulled",
        recordScope: "user_scoped",
        displayName: "Owsianka z pull",
        rankingSignals: ["user_scoped"],
        ownerUserId: "user-1",
      }),
    ]);

    const result = await service.searchIngredientProducts({
      uid: "user-1",
      query: "owsianka",
    });

    expect(result.status).toBe("offline_warm_cache");
    expect(result.source).toBe("cache");
    expect(result.items).toEqual([
      expect.objectContaining({ ingredientProductId: "user-oats-pulled" }),
    ]);
    expect(result.queryEcho).toEqual(
      expect.objectContaining({ normalizedQuery: "owsianka" }),
    );
    expect(mockSearchRemote).not.toHaveBeenCalled();
  });

  it("makes offline no-cache explicit and marks stale cached rows", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    mockReadProjection.mockResolvedValueOnce(sampleProjection({ items: [] }));
    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "owies" }),
    ).resolves.toEqual(expect.objectContaining({ status: "offline_no_cache" }));

    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    mockReadProjection.mockResolvedValueOnce(sampleProjection({ isStale: true }));
    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "owies" }),
    ).resolves.toEqual(
      expect.objectContaining({ status: "stale", source: "cache", isStale: true }),
    );
  });

  it("honors the e2e forced-offline override for deterministic offline evidence", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockE2EForcedOffline = true;
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: true });
    mockReadProjection.mockResolvedValueOnce(sampleProjection({ items: [] }));

    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "missing" }),
    ).resolves.toEqual(expect.objectContaining({ status: "offline_no_cache" }));

    expect(mockReadProjection).toHaveBeenCalledWith({
      uid: "user-1",
      query: "missing",
    });
    expect(mockSearchRemote).not.toHaveBeenCalled();
  });

  it("falls back to cache when remote fails", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockSearchRemote.mockRejectedValueOnce(
      Object.assign(new Error("unavailable"), { code: "api/http-error" }),
    );
    mockReadProjection.mockResolvedValueOnce(sampleProjection());
    mockSearchUserRecords.mockResolvedValueOnce([
      sampleSearchRow({
        ingredientProductId: "user-oats-pulled",
        recordScope: "user_scoped",
        displayName: "Owsianka z pull",
        rankingSignals: ["user_scoped"],
        ownerUserId: "user-1",
      }),
    ]);

    const result = await service.searchIngredientProducts({
      uid: "user-1",
      query: "owies",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "backend_degraded",
        source: "cache",
        errorCode: "api/http-error",
      }),
    );
    expect(result.items.map((item) => item.ingredientProductId)).toEqual([
      "user-oats-pulled",
      "ingredient-product-1",
    ]);
  });
});
