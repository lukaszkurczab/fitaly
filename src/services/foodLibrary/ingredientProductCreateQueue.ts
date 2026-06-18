import type { QueuedOp } from "@/services/offline/queue.repo";
import type { QueueKind } from "@/services/offline/types";
import { normalizeIngredientProductSearchRow } from "@/services/foodLibrary/ingredientProductSearchApi";
import {
  readIngredientProductSearchProjectionItem,
  removeIngredientProductSearchProjectionItem,
  upsertIngredientProductSearchProjectionItem,
} from "@/services/foodLibrary/ingredientProductSearchProjectionRepository";
import {
  markIngredientProductUserRecordDeleteFailed,
  markIngredientProductUserRecordDeletePending,
  removeIngredientProductUserRecord,
  upsertLocalIngredientProductUserRecord,
} from "@/services/foodLibrary/ingredientProductUserRecordProjectionRepository";
import type {
  IngredientProductCreateRequest,
  IngredientProductSearchRow,
  IngredientProductUpdateRequest,
  IngredientProductWarningReasonCode,
} from "@/types/foodLibrary";

export type IngredientProductCreateQueuePayload = {
  request: IngredientProductCreateRequest;
  searchQuery: string;
  locale?: string | null;
};

export type IngredientProductDeleteQueuePayload = {
  ingredientProductId: string;
};

export type IngredientProductUpdateQueuePayload = {
  request: IngredientProductUpdateRequest;
  baseItem: IngredientProductSearchRow;
  searchQuery: string;
  locale?: string | null;
};

export const INGREDIENT_PRODUCT_QUEUE_KINDS: readonly QueueKind[] = [
  "ingredient_product_create",
  "ingredient_product_update",
  "ingredient_product_delete",
];

const INGREDIENT_PRODUCT_UPDATE_FIELDS = [
  "displayName",
  "kind",
  "defaultServing",
  "nutritionPer100",
  "brandName",
  "ingredientName",
  "packageName",
  "category",
  "servingSizes",
  "dietaryFlags",
  "allergenFlags",
] as const satisfies readonly (keyof Omit<
  IngredientProductUpdateRequest,
  "clientMutationId" | "ingredientProductId"
>)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOwn(value: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function hasUpdateField(
  request: Partial<IngredientProductUpdateRequest>,
  field: (typeof INGREDIENT_PRODUCT_UPDATE_FIELDS)[number],
): boolean {
  return hasOwn(request, field) && request[field] !== undefined;
}

function hasEditableUpdateField(
  request: Partial<IngredientProductUpdateRequest>,
): boolean {
  return INGREDIENT_PRODUCT_UPDATE_FIELDS.some((field) =>
    hasUpdateField(request, field),
  );
}

function isValidUpdateFieldShape(
  request: Partial<IngredientProductUpdateRequest>,
): boolean {
  if (
    hasUpdateField(request, "displayName") &&
    (typeof request.displayName !== "string" ||
      request.displayName.trim().length === 0)
  ) {
    return false;
  }
  return true;
}

function withPendingSignals(
  item: IngredientProductSearchRow,
  options?: { degraded?: boolean },
): Pick<
  IngredientProductSearchRow,
  "cacheState" | "rankingSignals" | "warningReasonCodes"
> {
  const warningReasonCodes: IngredientProductWarningReasonCode[] = Array.from(
    new Set([
      ...item.warningReasonCodes,
      "pending_user_record" as const,
      ...(options?.degraded ? (["backend_degraded"] as const) : []),
    ]),
  );
  return {
    cacheState: options?.degraded ? "stale" : "pending_local",
    warningReasonCodes,
    rankingSignals: Array.from(
      new Set([
        ...item.rankingSignals,
        "user_scoped" as const,
        "pending_user_record" as const,
      ]),
    ),
  };
}

export function ingredientProductQueueKinds(): QueueKind[] {
  return [...INGREDIENT_PRODUCT_QUEUE_KINDS];
}

export function toIngredientProductCreateQueuePayload(
  payload: unknown,
): IngredientProductCreateQueuePayload | null {
  if (!isRecord(payload) || !isRecord(payload.request)) return null;
  const request = payload.request as Partial<IngredientProductCreateRequest>;
  if (
    typeof request.clientMutationId !== "string" ||
    typeof request.ingredientProductId !== "string" ||
    typeof request.displayName !== "string" ||
    !isRecord(request.defaultServing)
  ) {
    return null;
  }
  return {
    request: request as IngredientProductCreateRequest,
    searchQuery:
      typeof payload.searchQuery === "string"
        ? payload.searchQuery
        : request.displayName,
    locale: typeof payload.locale === "string" ? payload.locale : null,
  };
}

export function toIngredientProductDeleteQueuePayload(
  payload: unknown,
): IngredientProductDeleteQueuePayload | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.ingredientProductId !== "string") return null;
  const ingredientProductId = payload.ingredientProductId.trim();
  return ingredientProductId ? { ingredientProductId } : null;
}

export function toIngredientProductUpdateQueuePayload(
  payload: unknown,
): IngredientProductUpdateQueuePayload | null {
  if (!isRecord(payload) || !isRecord(payload.request)) return null;
  const request = payload.request as Partial<IngredientProductUpdateRequest>;
  if (
    typeof request.clientMutationId !== "string" ||
    typeof request.ingredientProductId !== "string"
  ) {
    return null;
  }
  const clientMutationId = request.clientMutationId.trim();
  const ingredientProductId = request.ingredientProductId.trim();
  if (!clientMutationId || !ingredientProductId) return null;
  if (!hasEditableUpdateField(request) || !isValidUpdateFieldShape(request)) {
    return null;
  }

  const baseItem = normalizeIngredientProductSearchRow(payload.baseItem);
  if (
    !baseItem ||
    baseItem.ingredientProductId !== ingredientProductId ||
    baseItem.recordScope !== "user_scoped"
  ) {
    return null;
  }

  const searchQuery =
    typeof payload.searchQuery === "string" && payload.searchQuery.trim()
      ? payload.searchQuery
      : typeof request.displayName === "string"
        ? request.displayName
        : baseItem.displayName;

  return {
    request: {
      ...(request as IngredientProductUpdateRequest),
      clientMutationId,
      ingredientProductId,
    },
    baseItem,
    searchQuery,
    locale: typeof payload.locale === "string" ? payload.locale : null,
  };
}

export function buildPendingIngredientProductRow(params: {
  uid: string;
  request: IngredientProductCreateRequest;
  failed?: boolean;
  conflict?: boolean;
}): IngredientProductSearchRow {
  const cacheState: IngredientProductSearchRow["cacheState"] =
    params.failed || params.conflict ? "stale" : "pending_local";

  const warnings: IngredientProductWarningReasonCode[] = ["pending_user_record"];
  if (params.failed || params.conflict) {
    warnings.push("backend_degraded");
  }
  return {
    ingredientProductId: params.request.ingredientProductId,
    recordScope: "user_scoped",
    lifecycleState: "candidate",
    displayName: params.request.displayName,
    kind: params.request.kind ?? "generic_ingredient",
    defaultServing: params.request.defaultServing,
    nutritionPer100: params.request.nutritionPer100 ?? null,
    confidence: {
      identity: "medium",
      nutrition: params.request.nutritionPer100 ? "medium" : "unknown",
      profile: "unknown",
    },
    sourceAttribution: {
      sourceType: "user_created",
      sourceId: params.request.clientMutationId,
      sourceName: "User-created local record",
      provider: null,
      license: null,
      observedAt: null,
      reviewedAt: null,
      reviewedBy: null,
    },
    profileCompatibility: {
      status: "unknown",
      dietaryFlags: params.request.dietaryFlags ?? [],
      allergenFlags: params.request.allergenFlags ?? [],
    },
    warningReasonCodes: warnings,
    rankingSignals: ["user_scoped", "pending_user_record"],
    brandName: params.request.brandName ?? null,
    ingredientName: params.request.ingredientName ?? null,
    packageName: params.request.packageName ?? null,
    category: params.request.category ?? null,
    servingSizes: params.request.servingSizes ?? [],
    dietaryFlags: params.request.dietaryFlags ?? [],
    allergenFlags: params.request.allergenFlags ?? [],
    cacheState,
    ownerUserId: params.uid,
  };
}

export function applyIngredientProductUpdateRequestToLocalRow(params: {
  uid: string;
  item: IngredientProductSearchRow;
  request: IngredientProductUpdateRequest;
  failed?: boolean;
  conflict?: boolean;
}): IngredientProductSearchRow | null {
  const ingredientProductId = params.request.ingredientProductId.trim();
  if (!ingredientProductId) return null;
  if (params.item.ingredientProductId !== ingredientProductId) return null;
  if (params.item.recordScope !== "user_scoped") return null;
  if (params.item.ownerUserId !== params.uid) return null;

  const degraded = Boolean(params.failed || params.conflict);
  const dietaryFlags = hasUpdateField(params.request, "dietaryFlags")
    ? (params.request.dietaryFlags ?? [])
    : params.item.dietaryFlags;
  const allergenFlags = hasUpdateField(params.request, "allergenFlags")
    ? (params.request.allergenFlags ?? [])
    : params.item.allergenFlags;
  const pendingSignals = withPendingSignals(params.item, { degraded });

  return {
    ...params.item,
    displayName: hasUpdateField(params.request, "displayName")
      ? (params.request.displayName ?? params.item.displayName)
      : params.item.displayName,
    kind: hasUpdateField(params.request, "kind")
      ? (params.request.kind ?? params.item.kind)
      : params.item.kind,
    defaultServing: hasUpdateField(params.request, "defaultServing")
      ? (params.request.defaultServing ?? params.item.defaultServing)
      : params.item.defaultServing,
    nutritionPer100: hasUpdateField(params.request, "nutritionPer100")
      ? (params.request.nutritionPer100 ?? null)
      : params.item.nutritionPer100,
    brandName: hasUpdateField(params.request, "brandName")
      ? (params.request.brandName ?? null)
      : params.item.brandName,
    ingredientName: hasUpdateField(params.request, "ingredientName")
      ? (params.request.ingredientName ?? null)
      : params.item.ingredientName,
    packageName: hasUpdateField(params.request, "packageName")
      ? (params.request.packageName ?? null)
      : params.item.packageName,
    category: hasUpdateField(params.request, "category")
      ? (params.request.category ?? null)
      : params.item.category,
    servingSizes: hasUpdateField(params.request, "servingSizes")
      ? (params.request.servingSizes ?? [])
      : params.item.servingSizes,
    dietaryFlags,
    allergenFlags,
    profileCompatibility: {
      ...params.item.profileCompatibility,
      dietaryFlags,
      allergenFlags,
    },
    ...pendingSignals,
  };
}

export async function markQueuedIngredientProductDeletePending(params: {
  uid: string;
  ingredientProductId: string;
  updatedAt: string;
}): Promise<void> {
  const fallbackItem = await readIngredientProductSearchProjectionItem({
    uid: params.uid,
    ingredientProductId: params.ingredientProductId,
  });
  await removeIngredientProductSearchProjectionItem({
    uid: params.uid,
    ingredientProductId: params.ingredientProductId,
  });
  await markIngredientProductUserRecordDeletePending({
    ...params,
    fallbackItem,
  });
}

export async function markQueuedIngredientProductDeleted(params: {
  uid: string;
  ingredientProductId: string;
}): Promise<void> {
  await removeIngredientProductSearchProjectionItem({
    uid: params.uid,
    ingredientProductId: params.ingredientProductId,
  });
  await removeIngredientProductUserRecord({
    uid: params.uid,
    ingredientProductId: params.ingredientProductId,
  });
}

export async function upsertQueuedIngredientProductProjection(params: {
  uid: string;
  payload: IngredientProductCreateQueuePayload;
  item?: IngredientProductSearchRow;
  failed?: boolean;
  conflict?: boolean;
  syncState?: "pending" | "synced" | "failed" | "conflict";
}): Promise<IngredientProductSearchRow> {
  const item =
    params.item ??
    buildPendingIngredientProductRow({
      uid: params.uid,
      request: params.payload.request,
      failed: params.failed,
      conflict: params.conflict,
    });
  const userRecordSyncState =
    params.syncState ??
    (params.conflict ? "conflict" : params.failed ? "failed" : "synced");
  const lastErrorCode = params.conflict
    ? "food-library/conflict"
    : params.failed
      ? "food-library/sync-failed"
      : null;
  await upsertIngredientProductSearchProjectionItem({
    uid: params.uid,
    query: params.payload.searchQuery,
    locale: params.payload.locale ?? null,
    item,
    warnings: item.warningReasonCodes,
  });
  await upsertLocalIngredientProductUserRecord({
    uid: params.uid,
    item,
    syncState: userRecordSyncState,
    updatedAt: new Date().toISOString(),
    lastErrorCode,
  });
  return item;
}

export async function upsertQueuedIngredientProductUpdateProjection(params: {
  uid: string;
  payload: IngredientProductUpdateQueuePayload;
  item?: IngredientProductSearchRow;
  failed?: boolean;
  conflict?: boolean;
  syncState?: "pending_update" | "synced" | "failed" | "conflict";
  updatedAt?: string;
}): Promise<IngredientProductSearchRow | null> {
  const item =
    params.item ??
    applyIngredientProductUpdateRequestToLocalRow({
      uid: params.uid,
      item: params.payload.baseItem,
      request: params.payload.request,
      failed: params.failed,
      conflict: params.conflict,
    });
  if (!item) return null;
  if (item.recordScope !== "user_scoped" || item.ownerUserId !== params.uid) {
    return null;
  }

  const userRecordSyncState =
    params.syncState ??
    (params.conflict
      ? "conflict"
      : params.failed
        ? "failed"
        : "synced");
  const lastErrorCode = params.conflict
    ? "food-library/conflict"
    : params.failed
      ? "food-library/sync-failed"
      : null;
  await upsertIngredientProductSearchProjectionItem({
    uid: params.uid,
    query: params.payload.searchQuery,
    locale: params.payload.locale ?? null,
    item,
    warnings: item.warningReasonCodes,
  });
  await upsertLocalIngredientProductUserRecord({
    uid: params.uid,
    item,
    syncState: userRecordSyncState,
    updatedAt: params.updatedAt ?? new Date().toISOString(),
    lastErrorCode,
  });
  return item;
}

export async function markIngredientProductCreateSyncFailed(params: {
  uid: string;
  op: QueuedOp;
  dead: boolean;
  status?: number;
}): Promise<void> {
  const payload = toIngredientProductCreateQueuePayload(params.op.payload);
  if (!payload) return;
  const conflict = params.dead && params.status === 409;
  let syncState: "pending" | "failed" | "conflict" = "pending";
  if (conflict) {
    syncState = "conflict";
  } else if (params.dead) {
    syncState = "failed";
  }
  await upsertQueuedIngredientProductProjection({
    uid: params.uid,
    payload,
    failed: params.dead,
    conflict,
    syncState,
  });
}

export async function markIngredientProductUpdateSyncFailed(params: {
  uid: string;
  op: QueuedOp;
  dead: boolean;
  status?: number;
}): Promise<void> {
  const payload = toIngredientProductUpdateQueuePayload(params.op.payload);
  if (!payload) return;
  const conflict = params.dead && params.status === 409;
  let syncState: "pending_update" | "failed" | "conflict" = "pending_update";
  if (conflict) {
    syncState = "conflict";
  } else if (params.dead) {
    syncState = "failed";
  }
  await upsertQueuedIngredientProductUpdateProjection({
    uid: params.uid,
    payload,
    failed: params.dead,
    conflict,
    syncState,
    updatedAt: params.op.updated_at,
  });
}

export async function markIngredientProductQueueSyncFailed(params: {
  uid: string;
  op: QueuedOp;
  dead: boolean;
  status?: number;
}): Promise<void> {
  if (params.op.kind === "ingredient_product_create") {
    await markIngredientProductCreateSyncFailed(params);
    return;
  }
  if (params.op.kind === "ingredient_product_update") {
    await markIngredientProductUpdateSyncFailed(params);
    return;
  }
  if (params.op.kind !== "ingredient_product_delete") return;

  const payload = toIngredientProductDeleteQueuePayload(params.op.payload);
  if (!payload) return;
  await removeIngredientProductSearchProjectionItem({
    uid: params.uid,
    ingredientProductId: payload.ingredientProductId,
  });
  if (!params.dead) {
    await markIngredientProductUserRecordDeletePending({
      uid: params.uid,
      ingredientProductId: payload.ingredientProductId,
      updatedAt: params.op.updated_at,
    });
    return;
  }
  await markIngredientProductUserRecordDeleteFailed({
    uid: params.uid,
    ingredientProductId: payload.ingredientProductId,
    updatedAt: params.op.updated_at,
    lastErrorCode:
      params.status === 404
        ? "food-library/delete-not-found"
        : "food-library/delete-sync-failed",
  });
}
