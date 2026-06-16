import type { QueuedOp } from "@/services/offline/queue.repo";
import type { QueueKind } from "@/services/offline/types";
import {
  upsertIngredientProductSearchProjectionItem,
} from "@/services/foodLibrary/ingredientProductSearchProjectionRepository";
import type {
  IngredientProductCreateRequest,
  IngredientProductSearchRow,
  IngredientProductWarningReasonCode,
} from "@/types/foodLibrary";

export type IngredientProductCreateQueuePayload = {
  request: IngredientProductCreateRequest;
  searchQuery: string;
  locale?: string | null;
};

export const INGREDIENT_PRODUCT_QUEUE_KINDS: readonly QueueKind[] = [
  "ingredient_product_create",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

export function buildPendingIngredientProductRow(params: {
  uid: string;
  request: IngredientProductCreateRequest;
  failed?: boolean;
}): IngredientProductSearchRow {
  const warnings: IngredientProductWarningReasonCode[] = params.failed
    ? ["pending_user_record", "backend_degraded"]
    : ["pending_user_record"];
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
    cacheState: params.failed ? "stale" : "pending_local",
    ownerUserId: params.uid,
  };
}

export async function upsertQueuedIngredientProductProjection(params: {
  uid: string;
  payload: IngredientProductCreateQueuePayload;
  item?: IngredientProductSearchRow;
  failed?: boolean;
}): Promise<IngredientProductSearchRow> {
  const item =
    params.item ??
    buildPendingIngredientProductRow({
      uid: params.uid,
      request: params.payload.request,
      failed: params.failed,
    });
  await upsertIngredientProductSearchProjectionItem({
    uid: params.uid,
    query: params.payload.searchQuery,
    locale: params.payload.locale ?? null,
    item,
    warnings: item.warningReasonCodes,
  });
  return item;
}

export async function markIngredientProductCreateSyncFailed(params: {
  uid: string;
  op: QueuedOp;
  dead: boolean;
}): Promise<void> {
  const payload = toIngredientProductCreateQueuePayload(params.op.payload);
  if (!payload) return;
  await upsertQueuedIngredientProductProjection({
    uid: params.uid,
    payload,
    failed: params.dead,
  });
}
