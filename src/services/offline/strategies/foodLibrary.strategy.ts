import { createServiceError } from "@/services/contracts/serviceError";
import { createIngredientProductRemote } from "@/services/foodLibrary/ingredientProductSearchApi";
import {
  ingredientProductQueueKinds,
  toIngredientProductCreateQueuePayload,
  upsertQueuedIngredientProductProjection,
} from "@/services/foodLibrary/ingredientProductCreateQueue";
import type { QueueOp, SyncStrategy } from "../sync.strategy";

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
  async pull(): Promise<number> {
    return 0;
  },

  async handlePushOp(uid: string, op: QueueOp): Promise<boolean> {
    if (op.kind !== "ingredient_product_create") return false;

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
