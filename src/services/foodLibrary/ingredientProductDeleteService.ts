import NetInfo from "@react-native-community/netinfo";
import { v4 as uuidv4 } from "uuid";
import { isOfflineNetState } from "@/services/core/networkState";
import { isE2EForcedOffline } from "@/services/e2e/connectivityOverride";
import { requestSync } from "@/services/offline/sync.engine";
import { enqueueIngredientProductDelete } from "@/services/offline/queue.repo";
import { deleteIngredientProductRemote } from "@/services/foodLibrary/ingredientProductSearchApi";
import {
  markQueuedIngredientProductDeleted,
  markQueuedIngredientProductDeletePending,
} from "@/services/foodLibrary/ingredientProductCreateQueue";

export type DeleteIngredientProductResult =
  | {
      status: "synced";
      ingredientProductId: string;
      updatedAt: string;
    }
  | {
      status: "queued";
      ingredientProductId: string;
      clientMutationId: string;
    };

export async function deleteOrQueueIngredientProduct(params: {
  uid: string;
  ingredientProductId: string;
}): Promise<DeleteIngredientProductResult> {
  const ingredientProductId = params.ingredientProductId.trim();
  if (!ingredientProductId) {
    throw new Error("ingredientProductId must be non-empty");
  }
  const net = await NetInfo.fetch().catch(() => null);
  const shouldQueue =
    isE2EForcedOffline() || (net !== null && isOfflineNetState(net));

  if (shouldQueue) {
    const queued = await enqueueIngredientProductDelete(
      params.uid,
      ingredientProductId,
    );
    await markQueuedIngredientProductDeletePending({
      uid: params.uid,
      ingredientProductId,
      updatedAt: queued.updatedAt,
    });
    void requestSync({
      uid: params.uid,
      domain: "foodLibrary",
      reason: "local-change",
      pullAfterPush: false,
    }).catch(() => undefined);
    return {
      status: "queued",
      ingredientProductId,
      clientMutationId: queued.clientMutationId,
    };
  }

  const response = await deleteIngredientProductRemote({
    ingredientProductId,
    clientMutationId: `ingredient-product:delete:${params.uid}:${ingredientProductId}:${uuidv4()}`,
  });
  await markQueuedIngredientProductDeleted({
    uid: params.uid,
    ingredientProductId: response.ingredientProductId,
  });
  return {
    status: "synced",
    ingredientProductId: response.ingredientProductId,
    updatedAt: response.updatedAt,
  };
}
