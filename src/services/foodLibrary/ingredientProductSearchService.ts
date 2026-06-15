import NetInfo from "@react-native-community/netinfo";
import { isOfflineNetState } from "@/services/core/networkState";
import {
  INGREDIENT_PRODUCT_SEARCH_MIN_QUERY_LENGTH,
  normalizeIngredientProductSearchQuery,
  searchIngredientProductsRemote,
} from "@/services/foodLibrary/ingredientProductSearchApi";
import {
  readIngredientProductSearchProjection,
  replaceIngredientProductSearchProjection,
  type IngredientProductSearchProjection,
} from "@/services/foodLibrary/ingredientProductSearchProjectionRepository";
import type {
  IngredientProductSearchRequest,
  IngredientProductSearchResponse,
  IngredientProductSearchResult,
  IngredientProductSearchRow,
  IngredientProductSearchStatus,
  IngredientProductWarningReasonCode,
} from "@/types/foodLibrary";

export type SearchIngredientProductsParams = IngredientProductSearchRequest & {
  uid: string;
};

function emptyResult(status: IngredientProductSearchStatus): IngredientProductSearchResult {
  return {
    status,
    items: [],
    queryEcho: null,
    warnings: [],
    cachePolicy: null,
    source: "none",
    isStale: false,
    errorCode: null,
  };
}

function hasWarning(items: IngredientProductSearchRow[]): boolean {
  return items.some((item) => item.warningReasonCodes.length > 0);
}

function hasStaleSignal(
  items: IngredientProductSearchRow[],
  warnings: IngredientProductWarningReasonCode[],
): boolean {
  return (
    warnings.includes("cache_stale") ||
    items.some((item) => item.cacheState === "stale")
  );
}

function responseStatus(
  response: IngredientProductSearchResponse,
): IngredientProductSearchStatus {
  if (response.warnings.includes("backend_degraded")) {
    return "backend_degraded";
  }
  if (!response.items.length) {
    return "no_results";
  }
  if (hasStaleSignal(response.items, response.warnings)) {
    return "stale";
  }
  if (response.warnings.length > 0 || hasWarning(response.items)) {
    return "warning";
  }
  return "results";
}

function resultFromResponse(
  response: IngredientProductSearchResponse,
): IngredientProductSearchResult {
  const status = responseStatus(response);
  return {
    status,
    items: response.items,
    queryEcho: response.queryEcho,
    warnings: response.warnings,
    cachePolicy: response.cachePolicy,
    source: "remote",
    isStale: status === "stale",
    errorCode: null,
  };
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return error instanceof Error ? error.name : null;
}

function resultFromProjection(
  projection: IngredientProductSearchProjection,
  status: IngredientProductSearchStatus,
  error: unknown = null,
): IngredientProductSearchResult {
  return {
    status,
    items: projection.items,
    queryEcho: projection.queryEcho,
    warnings: projection.warnings,
    cachePolicy: projection.cachePolicy,
    source: projection.items.length ? "cache" : "none",
    isStale: projection.isStale || status === "stale",
    errorCode: errorCode(error),
  };
}

async function readCacheResult(params: {
  uid: string;
  query: string;
  emptyStatus: IngredientProductSearchStatus;
  warmStatus: IngredientProductSearchStatus;
  error?: unknown;
}): Promise<IngredientProductSearchResult> {
  const projection = await readIngredientProductSearchProjection({
    uid: params.uid,
    query: params.query,
  });

  if (!projection.items.length) {
    return {
      ...emptyResult(params.emptyStatus),
      errorCode: errorCode(params.error),
    };
  }

  return resultFromProjection(
    projection,
    projection.isStale ? "stale" : params.warmStatus,
    params.error,
  );
}

export async function searchIngredientProducts(
  params: SearchIngredientProductsParams,
): Promise<IngredientProductSearchResult> {
  const normalizedQuery = normalizeIngredientProductSearchQuery(params.query);
  if (normalizedQuery.length < INGREDIENT_PRODUCT_SEARCH_MIN_QUERY_LENGTH) {
    return emptyResult("idle");
  }

  const net = await NetInfo.fetch().catch(() => null);
  if (net && isOfflineNetState(net)) {
    return readCacheResult({
      uid: params.uid,
      query: normalizedQuery,
      emptyStatus: "offline_no_cache",
      warmStatus: "offline_warm_cache",
    });
  }

  try {
    const response = await searchIngredientProductsRemote({
      query: normalizedQuery,
      locale: params.locale,
      limit: params.limit,
      includeUserScoped: params.includeUserScoped,
      includeGlobal: params.includeGlobal,
    });

    if (!response.warnings.includes("backend_degraded")) {
      await replaceIngredientProductSearchProjection({
        uid: params.uid,
        response,
      });
    }

    if (response.warnings.includes("backend_degraded")) {
      const projection = await readIngredientProductSearchProjection({
        uid: params.uid,
        query: normalizedQuery,
      });
      if (projection.items.length) {
        return resultFromProjection(projection, "backend_degraded");
      }
    }

    return resultFromResponse(response);
  } catch (error) {
    return readCacheResult({
      uid: params.uid,
      query: normalizedQuery,
      emptyStatus: "backend_degraded",
      warmStatus: "backend_degraded",
      error,
    });
  }
}
