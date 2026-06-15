import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  IngredientProductSearchResponse,
  IngredientProductSearchRow,
} from "@/types/foodLibrary";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockSearchRemote = jest.fn<(...args: unknown[]) => Promise<IngredientProductSearchResponse>>();
const mockReadProjection = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockReplaceProjection = jest.fn<(...args: unknown[]) => Promise<void>>();

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
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockReadProjection.mockResolvedValue(sampleProjection({ items: [] }));
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

  it("falls back to cache when remote fails", async () => {
    const service =
      jest.requireActual<typeof import("./ingredientProductSearchService")>(
        "./ingredientProductSearchService",
      );
    mockSearchRemote.mockRejectedValueOnce(
      Object.assign(new Error("unavailable"), { code: "api/http-error" }),
    );
    mockReadProjection.mockResolvedValueOnce(sampleProjection());

    await expect(
      service.searchIngredientProducts({ uid: "user-1", query: "owies" }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: "backend_degraded",
        source: "cache",
        errorCode: "api/http-error",
      }),
    );
  });
});
