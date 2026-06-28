import NetInfo from "@react-native-community/netinfo";
import { isOfflineNetState } from "@/services/core/networkState";
import { isE2EForcedOffline } from "@/services/e2e/connectivityOverride";
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
import {
  readIngredientProductUserRecordNonSearchableIds,
  searchIngredientProductUserRecordConflicts,
  searchIngredientProductUserRecords,
} from "@/services/foodLibrary/ingredientProductUserRecordProjectionRepository";
import type {
  IngredientProductSearchConflict,
  IngredientProductSearchQueryEcho,
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

async function filterLocallyNonSearchableUserRecords(params: {
  uid: string;
  items: IngredientProductSearchRow[];
}): Promise<IngredientProductSearchRow[]> {
  if (!params.items.length) return params.items;
  const nonSearchableIds = await readIngredientProductUserRecordNonSearchableIds({
    uid: params.uid,
    ingredientProductIds: params.items.map((item) => item.ingredientProductId),
  });
  if (!nonSearchableIds.size) return params.items;
  return params.items.filter(
    (item) => !nonSearchableIds.has(item.ingredientProductId),
  );
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return error instanceof Error ? error.name : null;
}

function localQueryEcho(params: {
  query: string;
  limit?: number;
  includeUserScoped?: boolean;
  includeGlobal?: boolean;
  locale?: string | null;
}): IngredientProductSearchQueryEcho {
  return {
    normalizedQuery: params.query,
    queryLength: params.query.length,
    limit: params.limit ?? 8,
    includeUserScoped: params.includeUserScoped ?? true,
    includeGlobal: params.includeGlobal ?? true,
    locale: params.locale ?? null,
  };
}

function withConflicts(
  result: IngredientProductSearchResult,
  conflicts: IngredientProductSearchConflict[],
): IngredientProductSearchResult {
  return conflicts.length ? { ...result, conflicts } : result;
}

async function searchLocalConflicts(params: {
  uid: string;
  query: string;
  limit?: number;
}): Promise<IngredientProductSearchConflict[]> {
  const conflicts = await searchIngredientProductUserRecordConflicts({
    uid: params.uid,
    query: params.query,
    limit: params.limit,
  });
  return conflicts.map((conflict) => ({
    item: conflict.item,
    updatedAt: conflict.updatedAt,
    lastErrorCode: conflict.lastErrorCode,
    lastErrorMessage: conflict.lastErrorMessage,
  }));
}

function mergeLocalItems(
  userItems: IngredientProductSearchRow[],
  projectionItems: IngredientProductSearchRow[],
): IngredientProductSearchRow[] {
  const seen = new Set<string>();
  const merged: IngredientProductSearchRow[] = [];
  for (const item of [...userItems, ...projectionItems]) {
    if (seen.has(item.ingredientProductId)) continue;
    seen.add(item.ingredientProductId);
    merged.push(item);
  }
  return merged;
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
  const [projection, userItems, conflicts] = await Promise.all([
    readIngredientProductSearchProjection({
      uid: params.uid,
      query: params.query,
    }),
    searchIngredientProductUserRecords({
      uid: params.uid,
      query: params.query,
    }),
    searchLocalConflicts({
      uid: params.uid,
      query: params.query,
    }),
  ]);
  const projectionItems = await filterLocallyNonSearchableUserRecords({
    uid: params.uid,
    items: projection.items,
  });
  const items = mergeLocalItems(userItems, projectionItems);

  if (!items.length) {
    return withConflicts(
      {
        ...emptyResult(params.emptyStatus),
        errorCode: errorCode(params.error),
      },
      conflicts,
    );
  }

  return withConflicts(
    resultFromProjection(
      {
        ...projection,
        items,
        queryEcho:
          (projectionItems.length ? projection.queryEcho : null) ??
          localQueryEcho({
            query: params.query,
          }),
      },
      projection.isStale ? "stale" : params.warmStatus,
      params.error,
    ),
    conflicts,
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
  if (isE2EForcedOffline() || (net && isOfflineNetState(net))) {
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
    const visibleItems = await filterLocallyNonSearchableUserRecords({
      uid: params.uid,
      items: response.items,
    });
    const visibleResponse =
      visibleItems === response.items
        ? response
        : { ...response, items: visibleItems };

    if (!visibleResponse.warnings.includes("backend_degraded")) {
      await replaceIngredientProductSearchProjection({
        uid: params.uid,
        response: visibleResponse,
      });
    }

    if (visibleResponse.warnings.includes("backend_degraded")) {
      return readCacheResult({
        uid: params.uid,
        query: normalizedQuery,
        emptyStatus: "backend_degraded",
        warmStatus: "backend_degraded",
      });
    }

    return withConflicts(
      resultFromResponse(visibleResponse),
      await searchLocalConflicts({
        uid: params.uid,
        query: normalizedQuery,
        limit: params.limit,
      }),
    );
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
