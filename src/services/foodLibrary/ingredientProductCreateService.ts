import NetInfo from "@react-native-community/netinfo";
import { isOfflineNetState } from "@/services/core/networkState";
import { isE2EForcedOffline } from "@/services/e2e/connectivityOverride";
import { requestSync } from "@/services/offline/sync.engine";
import { enqueueIngredientProductCreate } from "@/services/offline/queue.repo";
import { createIngredientProductRemote } from "@/services/foodLibrary/ingredientProductSearchApi";
import {
  buildPendingIngredientProductRow,
  upsertQueuedIngredientProductProjection,
  type IngredientProductCreateQueuePayload,
} from "@/services/foodLibrary/ingredientProductCreateQueue";
import type {
  IngredientProductCreateRequest,
  IngredientProductSearchRow,
} from "@/types/foodLibrary";

export type CreateIngredientProductResult =
  | {
      status: "synced";
      item: IngredientProductSearchRow;
    }
  | {
      status: "queued";
      item: IngredientProductSearchRow;
      clientMutationId: string;
    };

export async function createOrQueueIngredientProduct(params: {
  uid: string;
  request: IngredientProductCreateRequest;
  searchQuery: string;
  locale?: string | null;
}): Promise<CreateIngredientProductResult> {
  const payload: IngredientProductCreateQueuePayload = {
    request: params.request,
    searchQuery: params.searchQuery,
    locale: params.locale ?? null,
  };
  const net = await NetInfo.fetch().catch(() => null);
  const shouldQueue =
    isE2EForcedOffline() || (net !== null && isOfflineNetState(net));

  if (shouldQueue) {
    const queued = await enqueueIngredientProductCreate(params.uid, payload);
    const item = buildPendingIngredientProductRow({
      uid: params.uid,
      request: params.request,
    });
    await upsertQueuedIngredientProductProjection({
      uid: params.uid,
      payload,
      item,
    });
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

  const response = await createIngredientProductRemote(params.request);
  await upsertQueuedIngredientProductProjection({
    uid: params.uid,
    payload,
    item: response.item,
  });
  return {
    status: "synced",
    item: response.item,
  };
}
