import { getDB } from "@/services/offline/db";
import type {
  IngredientProductUserRecordRow,
  IngredientProductUserRecordSyncState,
} from "@/services/offline/types";
import {
  INGREDIENT_PRODUCT_SEARCH_MAX_LIMIT,
  normalizeIngredientProductSearchQuery,
  normalizeIngredientProductSearchRow,
} from "@/services/foodLibrary/ingredientProductSearchApi";
import type {
  IngredientProductPulledRecord,
  IngredientProductSearchRow,
} from "@/types/foodLibrary";

const MAX_USER_RECORD_JSON_CHARS = 16_384;
const MAX_USER_RECORD_SEARCH_ROWS = 500;

function nowMs(): number {
  return Date.now();
}

function serializeBoundedJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.length > MAX_USER_RECORD_JSON_CHARS) {
    throw new Error("Ingredient/Product user record payload exceeds local limit");
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

function sourceClientMutationId(item: IngredientProductSearchRow): string | null {
  return item.sourceAttribution.sourceType === "user_created"
    ? item.sourceAttribution.sourceId
    : null;
}

function rowToItem(row: IngredientProductUserRecordRow): IngredientProductSearchRow | null {
  return normalizeIngredientProductSearchRow(parseJson<unknown>(row.payload));
}

export type IngredientProductUserRecordProjection = {
  item: IngredientProductSearchRow;
  syncState: IngredientProductUserRecordSyncState;
  updatedAt: string;
  lastSyncedAt: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

function searchableText(item: IngredientProductSearchRow): string {
  return [
    item.displayName,
    item.ingredientName,
    item.brandName,
    item.packageName,
    item.category,
  ]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeIngredientProductSearchQuery)
    .join(" ");
}

function searchRank(
  item: IngredientProductSearchRow,
  normalizedQuery: string,
): number | null {
  const normalizedDisplayName = normalizeIngredientProductSearchQuery(item.displayName);
  if (normalizedDisplayName === normalizedQuery) return 0;
  if (normalizedDisplayName.startsWith(normalizedQuery)) return 1;
  if (searchableText(item).includes(normalizedQuery)) return 2;
  return null;
}

function itemForLocalSearch(
  row: IngredientProductUserRecordRow,
): IngredientProductSearchRow | null {
  if (
    row.sync_state !== "synced" &&
    row.sync_state !== "pending" &&
    row.sync_state !== "pending_update"
  ) {
    return null;
  }
  const item = rowToItem(row);
  if (!item || item.recordScope !== "user_scoped") return null;
  if (row.sync_state !== "pending" && row.sync_state !== "pending_update") {
    return item;
  }

  return {
    ...item,
    warningReasonCodes: Array.from(
      new Set([...item.warningReasonCodes, "pending_user_record"]),
    ),
    rankingSignals: Array.from(
      new Set([...item.rankingSignals, "user_scoped", "pending_user_record"]),
    ),
    cacheState: "pending_local",
  };
}

function projectionFromRow(
  row: IngredientProductUserRecordRow,
): IngredientProductUserRecordProjection | null {
  const item = rowToItem(row);
  if (!item) return null;
  return {
    item,
    syncState: row.sync_state,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
  };
}

function itemForConflictSearch(
  row: IngredientProductUserRecordRow,
): IngredientProductSearchRow | null {
  if (row.sync_state !== "conflict") return null;
  const item = rowToItem(row);
  if (!item || item.recordScope !== "user_scoped") return null;
  return item;
}

export async function readIngredientProductUserRecord(params: {
  uid: string;
  ingredientProductId: string;
}): Promise<IngredientProductUserRecordProjection | null> {
  const db = getDB();
  const row = db.getFirstSync(
    `SELECT *
     FROM ingredient_product_user_records
     WHERE user_uid=? AND ingredient_product_id=?
     LIMIT 1`,
    [params.uid, params.ingredientProductId],
  ) as IngredientProductUserRecordRow | null;
  if (!row) return null;
  return projectionFromRow(row);
}

export async function searchIngredientProductUserRecords(params: {
  uid: string;
  query: string;
  limit?: number;
}): Promise<IngredientProductSearchRow[]> {
  const normalizedQuery = normalizeIngredientProductSearchQuery(params.query);
  if (!normalizedQuery) return [];

  const db = getDB();
  const rows = db.getAllSync(
    `SELECT *
     FROM ingredient_product_user_records
     WHERE user_uid=?
       AND sync_state IN ('pending', 'pending_update', 'synced')
     ORDER BY updated_at DESC, display_name COLLATE NOCASE ASC, ingredient_product_id ASC
     LIMIT ?`,
    [params.uid, MAX_USER_RECORD_SEARCH_ROWS],
  ) as IngredientProductUserRecordRow[];

  const ranked = rows
    .map((row) => {
      const item = itemForLocalSearch(row);
      if (!item || item.ownerUserId !== params.uid) return null;
      const rank = searchRank(item, normalizedQuery);
      if (rank === null) return null;
      return { item, rank };
    })
    .filter(
      (entry): entry is { item: IngredientProductSearchRow; rank: number } =>
        entry !== null,
    )
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      const nameOrder = left.item.displayName.localeCompare(
        right.item.displayName,
        undefined,
        { sensitivity: "base" },
      );
      if (nameOrder !== 0) return nameOrder;
      return left.item.ingredientProductId.localeCompare(
        right.item.ingredientProductId,
      );
    });

  return ranked
    .slice(0, params.limit ?? INGREDIENT_PRODUCT_SEARCH_MAX_LIMIT)
    .map((entry) => entry.item);
}

export async function searchIngredientProductUserRecordConflicts(params: {
  uid: string;
  query: string;
  limit?: number;
}): Promise<IngredientProductUserRecordProjection[]> {
  const normalizedQuery = normalizeIngredientProductSearchQuery(params.query);
  if (!normalizedQuery) return [];

  const db = getDB();
  const rows = db.getAllSync(
    `SELECT *
     FROM ingredient_product_user_records
     WHERE user_uid=?
       AND sync_state='conflict'
     ORDER BY updated_at DESC, display_name COLLATE NOCASE ASC, ingredient_product_id ASC
     LIMIT ?`,
    [params.uid, MAX_USER_RECORD_SEARCH_ROWS],
  ) as IngredientProductUserRecordRow[];

  const ranked = rows
    .map((row) => {
      const item = itemForConflictSearch(row);
      const projection = projectionFromRow(row);
      if (!item || !projection || item.ownerUserId !== params.uid) return null;
      const rank = searchRank(item, normalizedQuery);
      if (rank === null) return null;
      return { projection, rank };
    })
    .filter(
      (
        entry,
      ): entry is {
        projection: IngredientProductUserRecordProjection;
        rank: number;
      } => entry !== null,
    )
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      const nameOrder = left.projection.item.displayName.localeCompare(
        right.projection.item.displayName,
        undefined,
        { sensitivity: "base" },
      );
      if (nameOrder !== 0) return nameOrder;
      return left.projection.item.ingredientProductId.localeCompare(
        right.projection.item.ingredientProductId,
      );
    });

  return ranked
    .slice(0, params.limit ?? INGREDIENT_PRODUCT_SEARCH_MAX_LIMIT)
    .map((entry) => entry.projection);
}

export async function readIngredientProductUserRecordDeleteIds(params: {
  uid: string;
  ingredientProductIds: string[];
}): Promise<Set<string>> {
  const ids = Array.from(
    new Set(
      params.ingredientProductIds
        .map((ingredientProductId) => ingredientProductId.trim())
        .filter(Boolean),
    ),
  );
  if (!ids.length) return new Set();

  const placeholders = ids.map(() => "?").join(", ");
  const db = getDB();
  const rows = db.getAllSync(
    `SELECT ingredient_product_id
     FROM ingredient_product_user_records
     WHERE user_uid=?
       AND sync_state IN ('pending_delete', 'delete_failed')
       AND ingredient_product_id IN (${placeholders})`,
    [params.uid, ...ids],
  ) as Array<Pick<IngredientProductUserRecordRow, "ingredient_product_id">>;

  return new Set(
    rows
      .map((row) => row.ingredient_product_id)
      .filter((ingredientProductId) => ids.includes(ingredientProductId)),
  );
}

export async function readIngredientProductUserRecordNonSearchableIds(params: {
  uid: string;
  ingredientProductIds: string[];
}): Promise<Set<string>> {
  const ids = Array.from(
    new Set(
      params.ingredientProductIds
        .map((ingredientProductId) => ingredientProductId.trim())
        .filter(Boolean),
    ),
  );
  if (!ids.length) return new Set();

  const placeholders = ids.map(() => "?").join(", ");
  const db = getDB();
  const rows = db.getAllSync(
    `SELECT ingredient_product_id
     FROM ingredient_product_user_records
     WHERE user_uid=?
       AND sync_state IN ('failed', 'conflict', 'pending_delete', 'delete_failed')
       AND ingredient_product_id IN (${placeholders})`,
    [params.uid, ...ids],
  ) as Array<Pick<IngredientProductUserRecordRow, "ingredient_product_id">>;

  return new Set(
    rows
      .map((row) => row.ingredient_product_id)
      .filter((ingredientProductId) => ids.includes(ingredientProductId)),
  );
}

export async function removeIngredientProductUserRecord(params: {
  uid: string;
  ingredientProductId: string;
}): Promise<void> {
  const db = getDB();
  db.runSync(
    `DELETE FROM ingredient_product_user_records
     WHERE user_uid=? AND ingredient_product_id=?`,
    [params.uid, params.ingredientProductId],
  );
}

async function markIngredientProductUserRecordDeleteState(params: {
  uid: string;
  ingredientProductId: string;
  updatedAt: string;
  syncState: Extract<
    IngredientProductUserRecordSyncState,
    "pending_delete" | "delete_failed"
  >;
  fallbackItem?: IngredientProductSearchRow | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}): Promise<void> {
  const existing = await readIngredientProductUserRecord({
    uid: params.uid,
    ingredientProductId: params.ingredientProductId,
  });
  const item = existing?.item ?? params.fallbackItem ?? null;
  if (!item) return;
  if (item.ingredientProductId !== params.ingredientProductId) return;

  await upsertLocalIngredientProductUserRecord({
    uid: params.uid,
    item: {
      ...item,
      lifecycleState: "rejected",
      cacheState: "stale",
    },
    syncState: params.syncState,
    updatedAt: params.updatedAt,
    lastSyncedAt: existing?.lastSyncedAt ?? 0,
    lastErrorCode: params.lastErrorCode ?? null,
    lastErrorMessage: params.lastErrorMessage ?? null,
  });
}

export async function markIngredientProductUserRecordDeletePending(params: {
  uid: string;
  ingredientProductId: string;
  updatedAt: string;
  fallbackItem?: IngredientProductSearchRow | null;
}): Promise<void> {
  await markIngredientProductUserRecordDeleteState({
    ...params,
    syncState: "pending_delete",
  });
}

export async function markIngredientProductUserRecordDeleteFailed(params: {
  uid: string;
  ingredientProductId: string;
  updatedAt: string;
  fallbackItem?: IngredientProductSearchRow | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}): Promise<void> {
  await markIngredientProductUserRecordDeleteState({
    ...params,
    syncState: "delete_failed",
  });
}

export async function upsertLocalIngredientProductUserRecord(params: {
  uid: string;
  item: IngredientProductSearchRow;
  syncState: IngredientProductUserRecordSyncState;
  updatedAt: string;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastSyncedAt?: number;
}): Promise<void> {
  if (params.item.recordScope !== "user_scoped") return;
  if (params.item.ownerUserId !== params.uid) return;

  const db = getDB();
  db.runSync(
    `INSERT INTO ingredient_product_user_records (
       user_uid,
       ingredient_product_id,
       display_name,
       payload,
       source_client_mutation_id,
       updated_at,
       last_synced_at,
       sync_state,
       last_error_code,
       last_error_message
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_uid, ingredient_product_id) DO UPDATE SET
       display_name=excluded.display_name,
       payload=excluded.payload,
       source_client_mutation_id=excluded.source_client_mutation_id,
       updated_at=excluded.updated_at,
       last_synced_at=excluded.last_synced_at,
       sync_state=excluded.sync_state,
       last_error_code=excluded.last_error_code,
       last_error_message=excluded.last_error_message`,
    [
      params.uid,
      params.item.ingredientProductId,
      params.item.displayName,
      serializeBoundedJson(params.item),
      sourceClientMutationId(params.item),
      params.updatedAt,
      params.lastSyncedAt ?? (params.syncState === "synced" ? nowMs() : 0),
      params.syncState,
      params.lastErrorCode ?? null,
      params.lastErrorMessage ?? null,
    ],
  );
}

export async function applyPulledIngredientProductUserRecord(params: {
  uid: string;
  record: IngredientProductPulledRecord;
  pulledAt?: number;
}): Promise<"synced" | "conflict" | "ignored"> {
  const { item } = params.record;
  if (item.recordScope !== "user_scoped" || item.ownerUserId !== params.uid) {
    return "ignored";
  }

  const existing = await readIngredientProductUserRecord({
    uid: params.uid,
    ingredientProductId: item.ingredientProductId,
  });
  const remoteMutationId =
    params.record.creationClientMutationId ?? sourceClientMutationId(item);
  const localMutationId = existing ? sourceClientMutationId(existing.item) : null;

  if (
    existing &&
    existing.syncState === "pending" &&
    localMutationId &&
    remoteMutationId &&
    localMutationId !== remoteMutationId
  ) {
    await upsertLocalIngredientProductUserRecord({
      uid: params.uid,
      item: existing.item,
      syncState: "conflict",
      updatedAt: existing.updatedAt,
      lastSyncedAt: existing.lastSyncedAt,
      lastErrorCode: "food-library/conflict",
      lastErrorMessage: "Remote Product/Ingredient record conflicts with pending local create.",
    });
    return "conflict";
  }

  if (existing && existing.syncState === "pending_update") {
    await upsertLocalIngredientProductUserRecord({
      uid: params.uid,
      item: {
        ...existing.item,
        cacheState: "stale",
        warningReasonCodes: Array.from(
          new Set([
            ...existing.item.warningReasonCodes,
            "pending_user_record" as const,
            "backend_degraded" as const,
          ]),
        ),
        rankingSignals: Array.from(
          new Set([
            ...existing.item.rankingSignals,
            "user_scoped" as const,
            "pending_user_record" as const,
          ]),
        ),
      },
      syncState: "conflict",
      updatedAt: existing.updatedAt,
      lastSyncedAt: existing.lastSyncedAt,
      lastErrorCode: "food-library/conflict",
      lastErrorMessage: "Remote Product/Ingredient record conflicts with pending local update.",
    });
    return "conflict";
  }

  await upsertLocalIngredientProductUserRecord({
    uid: params.uid,
    item,
    syncState: "synced",
    updatedAt: params.record.updatedAt,
    lastSyncedAt: params.pulledAt ?? nowMs(),
  });
  return "synced";
}
