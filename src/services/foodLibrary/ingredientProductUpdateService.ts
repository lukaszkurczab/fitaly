import NetInfo from "@react-native-community/netinfo";
import { isOfflineNetState } from "@/services/core/networkState";
import { isE2EForcedOffline } from "@/services/e2e/connectivityOverride";
import { requestSync } from "@/services/offline/sync.engine";
import { enqueueIngredientProductUpdate } from "@/services/offline/queue.repo";
import { updateIngredientProductRemote } from "@/services/foodLibrary/ingredientProductSearchApi";
import {
  toIngredientProductUpdateQueuePayload,
  upsertQueuedIngredientProductUpdateProjection,
  type IngredientProductUpdateQueuePayload,
} from "@/services/foodLibrary/ingredientProductCreateQueue";
import type {
  IngredientProductSearchRow,
  IngredientProductUpdateRequest,
} from "@/types/foodLibrary";

export type UpdateIngredientProductResult =
  | {
      status: "synced";
      item: IngredientProductSearchRow;
    }
  | {
      status: "queued";
      item: IngredientProductSearchRow;
      clientMutationId: string;
    };

function buildUpdatePayload(params: {
  uid: string;
  request: IngredientProductUpdateRequest;
  baseItem: IngredientProductSearchRow;
  searchQuery: string;
  locale?: string | null;
}): IngredientProductUpdateQueuePayload {
  const payload = toIngredientProductUpdateQueuePayload({
    request: params.request,
    baseItem: params.baseItem,
    searchQuery: params.searchQuery,
    locale: params.locale ?? null,
  });
  if (
    !payload ||
    payload.baseItem.recordScope !== "user_scoped" ||
    payload.baseItem.ownerUserId !== params.uid
  ) {
    throw new Error(
      "Ingredient/Product update payload must target a current-user record.",
    );
  }
  return payload;
}

export async function updateOrQueueIngredientProduct(params: {
  uid: string;
  request: IngredientProductUpdateRequest;
  baseItem: IngredientProductSearchRow;
  searchQuery: string;
  locale?: string | null;
}): Promise<UpdateIngredientProductResult> {
  const payload = buildUpdatePayload(params);
  const net = await NetInfo.fetch().catch(() => null);
  const shouldQueue =
    isE2EForcedOffline() || (net !== null && isOfflineNetState(net));

  if (shouldQueue) {
    const queued = await enqueueIngredientProductUpdate(params.uid, payload);
    const item = await upsertQueuedIngredientProductUpdateProjection({
      uid: params.uid,
      payload,
      syncState: "pending_update",
      updatedAt: queued.updatedAt,
    });
    if (!item) {
      throw new Error(
        "Ingredient/Product update projection could not be applied locally.",
      );
    }
    void requestSync({
      uid: params.uid,
      domain: "foodLibrary",
      reason: "local-change",
      pullAfterPush: false,
    }).catch(() => undefined);
    return {
      status: "queued",
      item,
      clientMutationId: queued.clientMutationId,
    };
  }

  const response = await updateIngredientProductRemote(payload.request);
  await upsertQueuedIngredientProductUpdateProjection({
    uid: params.uid,
    payload,
    item: response.item,
    syncState: "synced",
  });
  return {
    status: "synced",
    item: response.item,
  };
}
