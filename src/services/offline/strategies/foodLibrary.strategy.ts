import { createServiceError } from "@/services/contracts/serviceError";
import {
  createIngredientProductRemote,
  deleteIngredientProductRemote,
  pullIngredientProductsRemote,
  updateIngredientProductRemote,
} from "@/services/foodLibrary/ingredientProductSearchApi";
import {
  ingredientProductQueueKinds,
  markQueuedIngredientProductDeleted,
  toIngredientProductCreateQueuePayload,
  toIngredientProductDeleteQueuePayload,
  toIngredientProductUpdateQueuePayload,
  upsertQueuedIngredientProductProjection,
  upsertQueuedIngredientProductUpdateProjection,
} from "@/services/foodLibrary/ingredientProductCreateQueue";
import {
  removeIngredientProductSearchProjectionItem,
} from "@/services/foodLibrary/ingredientProductSearchProjectionRepository";
import {
  applyPulledIngredientProductUserRecord,
  removeIngredientProductUserRecord,
} from "@/services/foodLibrary/ingredientProductUserRecordProjectionRepository";
import {
  getLastFoodLibraryPullTs,
  setLastFoodLibraryPullTs,
} from "../sync.storage";
import type { QueueOp, SyncStrategy } from "../sync.strategy";

const PULL_LIMIT = 100;

function syncEngineError(
  code: string,
  options?: { message?: string; retryable?: boolean; cause?: unknown },
) {
  return createServiceError({
    code,
    source: "SyncEngine",
    retryable: options?.retryable ?? true,
    message: options?.message,
    cause: options?.cause,
  });
}

export const foodLibraryStrategy: SyncStrategy = {
  async pull(uid: string): Promise<number> {
    const updatedAfter = await getLastFoodLibraryPullTs(uid);
    const response = await pullIngredientProductsRemote({
      updatedAfter,
      limit: PULL_LIMIT,
    });
    const pulledAt = Date.now();
    let applied = 0;
    for (const record of response.records) {
      const result = await applyPulledIngredientProductUserRecord({
        uid,
        record,
        pulledAt,
      });
      if (result !== "ignored") applied++;
    }
    for (const record of response.removedRecords) {
      await removeIngredientProductUserRecord({
        uid,
        ingredientProductId: record.ingredientProductId,
      });
      await removeIngredientProductSearchProjectionItem({
        uid,
        ingredientProductId: record.ingredientProductId,
      });
      applied++;
    }
    if (response.nextUpdatedAfter) {
      await setLastFoodLibraryPullTs(uid, response.nextUpdatedAfter);
    }
    return applied;
  },

  async handlePushOp(uid: string, op: QueueOp): Promise<boolean> {
    if (
      op.kind !== "ingredient_product_create" &&
      op.kind !== "ingredient_product_update" &&
      op.kind !== "ingredient_product_delete"
    ) {
      return false;
    }

    if (op.kind === "ingredient_product_update") {
      const payload = toIngredientProductUpdateQueuePayload(op.payload);
      if (!payload) {
        throw syncEngineError("sync/ingredient-product-update-invalid-payload", {
          retryable: false,
        });
      }

      const response = await updateIngredientProductRemote({
        ...payload.request,
        clientMutationId: op.client_mutation_id,
      });
      await upsertQueuedIngredientProductUpdateProjection({
        uid,
        payload,
        item: response.item,
        syncState: "synced",
      });
      return true;
    }

    if (op.kind === "ingredient_product_delete") {
      const payload = toIngredientProductDeleteQueuePayload(op.payload);
      if (!payload) {
        throw syncEngineError("sync/ingredient-product-delete-invalid-payload", {
          retryable: false,
        });
      }

      const response = await deleteIngredientProductRemote({
        ingredientProductId: payload.ingredientProductId,
        clientMutationId: op.client_mutation_id,
      });
      await markQueuedIngredientProductDeleted({
        uid,
        ingredientProductId: response.ingredientProductId,
      });
      return true;
    }

    const payload = toIngredientProductCreateQueuePayload(op.payload);
    if (!payload) {
      throw syncEngineError("sync/ingredient-product-create-invalid-payload", {
        retryable: false,
      });
    }

    const response = await createIngredientProductRemote({
      ...payload.request,
      clientMutationId: op.client_mutation_id,
    });
    await upsertQueuedIngredientProductProjection({
      uid,
      payload,
      item: response.item,
    });
    return true;
  },
};

export { ingredientProductQueueKinds };
