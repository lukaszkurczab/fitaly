import { getDB } from "@/services/offline/db";
import type { IngredientProductSearchCacheRow } from "@/services/offline/types";
import {
  INGREDIENT_PRODUCT_SEARCH_MAX_LIMIT,
  normalizeIngredientProductSearchQuery,
  normalizeIngredientProductSearchRow,
} from "@/services/foodLibrary/ingredientProductSearchApi";
import type {
  IngredientProductSearchCachePolicy,
  IngredientProductSearchQueryEcho,
  IngredientProductSearchResponse,
  IngredientProductSearchRow,
  IngredientProductWarningReasonCode,
} from "@/types/foodLibrary";
import { INGREDIENT_PRODUCT_WARNING_REASON_CODES } from "@/types/foodLibrary";

const MAX_PROJECTION_JSON_CHARS = 16_384;
const MAX_CACHED_QUERIES_PER_USER = 200;
const DEFAULT_CACHE_MAX_AGE_SECONDS = 86_400;

export type IngredientProductSearchProjection = {
  items: IngredientProductSearchRow[];
  queryEcho: IngredientProductSearchQueryEcho | null;
  cachePolicy: IngredientProductSearchCachePolicy | null;
  warnings: IngredientProductWarningReasonCode[];
  cachedAt: number | null;
  expiresAt: number | null;
  isStale: boolean;
};

function nowMs(): number {
  return Date.now();
}

function serializeBoundedJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.length > MAX_PROJECTION_JSON_CHARS) {
    throw new Error("Ingredient/Product search projection payload exceeds local cache limit");
  }
  return json;
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeWarnings(raw: string): IngredientProductWarningReasonCode[] {
  const parsed = parseJson<unknown>(raw);
  return Array.isArray(parsed)
    ? parsed.filter(
        (item): item is IngredientProductWarningReasonCode =>
          typeof item === "string" &&
          (INGREDIENT_PRODUCT_WARNING_REASON_CODES as readonly string[]).includes(item),
      )
    : [];
}

function projectionFromRows(
  rows: IngredientProductSearchCacheRow[],
  currentTimeMs: number,
): IngredientProductSearchProjection {
  const items: IngredientProductSearchRow[] = [];
  let queryEcho: IngredientProductSearchQueryEcho | null = null;
  let cachePolicy: IngredientProductSearchCachePolicy | null = null;
  let cachedAt: number | null = null;
  let expiresAt: number | null = null;
  let warnings: IngredientProductWarningReasonCode[] = [];

  for (const row of rows) {
    const item = normalizeIngredientProductSearchRow(parseJson<unknown>(row.payload));
    if (!item) continue;
    items.push(item);
    queryEcho ??= parseJson<IngredientProductSearchQueryEcho>(row.query_echo);
    cachePolicy ??= parseJson<IngredientProductSearchCachePolicy>(row.cache_policy);
    warnings = warnings.length ? warnings : normalizeWarnings(row.warnings);
    cachedAt = Math.max(cachedAt ?? 0, row.cached_at);
    expiresAt = Math.max(expiresAt ?? 0, row.expires_at);
  }

  return {
    items,
    queryEcho,
    cachePolicy,
    warnings,
    cachedAt,
    expiresAt,
    isStale: expiresAt !== null && expiresAt <= currentTimeMs,
  };
}

function cacheMaxAgeSeconds(
  cachePolicy: IngredientProductSearchCachePolicy | null,
): number {
  return cachePolicy?.maxAgeSeconds ?? DEFAULT_CACHE_MAX_AGE_SECONDS;
}

function pruneUserCacheSync(uid: string): void {
  const db = getDB();
  db.runSync(
    `DELETE FROM ingredient_product_search_cache
     WHERE user_uid=?
       AND normalized_query NOT IN (
         SELECT normalized_query
         FROM ingredient_product_search_cache
         WHERE user_uid=?
         GROUP BY normalized_query
         ORDER BY MAX(cached_at) DESC
         LIMIT ?
       )`,
    [uid, uid, MAX_CACHED_QUERIES_PER_USER],
  );
}

export async function replaceIngredientProductSearchProjection(params: {
  uid: string;
  response: IngredientProductSearchResponse;
  cachedAt?: number;
}): Promise<void> {
  const cachedAt = params.cachedAt ?? nowMs();
  const maxAgeSeconds = cacheMaxAgeSeconds(params.response.cachePolicy);
  const expiresAt = cachedAt + maxAgeSeconds * 1000;
  const normalizedQuery = normalizeIngredientProductSearchQuery(
    params.response.queryEcho.normalizedQuery,
  );
  const queryEchoJson = serializeBoundedJson(params.response.queryEcho);
  const cachePolicyJson = serializeBoundedJson(params.response.cachePolicy);
  const warningsJson = serializeBoundedJson(params.response.warnings);
  const db = getDB();

  db.execSync("BEGIN");
  try {
    db.runSync(
      `DELETE FROM ingredient_product_search_cache
       WHERE user_uid=? AND normalized_query=?`,
      [params.uid, normalizedQuery],
    );

    params.response.items.forEach((item, index) => {
      db.runSync(
        `INSERT INTO ingredient_product_search_cache (
          user_uid,
          normalized_query,
          ingredient_product_id,
          result_rank,
          display_name,
          payload,
          query_echo,
          cache_policy,
          warnings,
          cache_state,
          cached_at,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          params.uid,
          normalizedQuery,
          item.ingredientProductId,
          index,
          item.displayName,
          serializeBoundedJson(item),
          queryEchoJson,
          cachePolicyJson,
          warningsJson,
          item.cacheState,
          cachedAt,
          expiresAt,
        ],
      );
    });

    pruneUserCacheSync(params.uid);
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}

export async function upsertIngredientProductSearchProjectionItem(params: {
  uid: string;
  query: string;
  item: IngredientProductSearchRow;
  locale?: string | null;
  warnings?: IngredientProductWarningReasonCode[];
  cachedAt?: number;
}): Promise<void> {
  const normalizedQuery = normalizeIngredientProductSearchQuery(params.query);
  const existing = await readIngredientProductSearchProjection({
    uid: params.uid,
    query: normalizedQuery,
  });
  const items = [
    params.item,
    ...existing.items.filter(
      (item) => item.ingredientProductId !== params.item.ingredientProductId,
    ),
  ].slice(0, INGREDIENT_PRODUCT_SEARCH_MAX_LIMIT);
  const warnings = Array.from(
    new Set([...(params.warnings ?? []), ...existing.warnings]),
  );

  await replaceIngredientProductSearchProjection({
    uid: params.uid,
    response: {
      items,
      queryEcho: existing.queryEcho ?? {
        normalizedQuery,
        queryLength: normalizedQuery.length,
        limit: INGREDIENT_PRODUCT_SEARCH_MAX_LIMIT,
        includeUserScoped: true,
        includeGlobal: true,
        locale: params.locale ?? null,
      },
      cachePolicy: existing.cachePolicy ?? {
        cacheGeneration: "ingredient_product_search_v1",
        maxAgeSeconds: DEFAULT_CACHE_MAX_AGE_SECONDS,
      },
      warnings,
    },
    cachedAt: params.cachedAt,
  });
}

export async function removeIngredientProductSearchProjectionItem(params: {
  uid: string;
  ingredientProductId: string;
}): Promise<void> {
  const db = getDB();
  db.runSync(
    `DELETE FROM ingredient_product_search_cache
     WHERE user_uid=? AND ingredient_product_id=?`,
    [params.uid, params.ingredientProductId],
  );
}

export async function readIngredientProductSearchProjectionItem(params: {
  uid: string;
  ingredientProductId: string;
}): Promise<IngredientProductSearchRow | null> {
  const db = getDB();
  const rows = db.getAllSync(
    `SELECT *
     FROM ingredient_product_search_cache
     WHERE user_uid=? AND ingredient_product_id=?
     ORDER BY cached_at DESC, result_rank ASC, display_name COLLATE NOCASE ASC
     LIMIT 1`,
    [params.uid, params.ingredientProductId],
  ) as IngredientProductSearchCacheRow[];
  const row = rows[0];
  if (!row) return null;
  return normalizeIngredientProductSearchRow(parseJson<unknown>(row.payload));
}

export async function readIngredientProductSearchProjection(params: {
  uid: string;
  query: string;
  now?: number;
}): Promise<IngredientProductSearchProjection> {
  const db = getDB();
  const currentTimeMs = params.now ?? nowMs();
  const normalizedQuery = normalizeIngredientProductSearchQuery(params.query);
  const rows = db.getAllSync(
    `SELECT *
     FROM ingredient_product_search_cache
     WHERE user_uid=? AND normalized_query=?
     ORDER BY result_rank ASC, display_name COLLATE NOCASE ASC, ingredient_product_id ASC`,
    [params.uid, normalizedQuery],
  ) as IngredientProductSearchCacheRow[];

  return projectionFromRows(rows, currentTimeMs);
}
