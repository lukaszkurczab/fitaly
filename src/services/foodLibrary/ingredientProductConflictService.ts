import {
  readIngredientProductUserRecord,
  removeIngredientProductUserRecord,
} from "@/services/foodLibrary/ingredientProductUserRecordProjectionRepository";
import {
  discardQueuedAndDeadLetterOpsByCloudIds,
  type QueueKind,
} from "@/services/offline/queue.repo";

const INGREDIENT_PRODUCT_QUEUE_KINDS: QueueKind[] = [
  "ingredient_product_create",
  "ingredient_product_update",
  "ingredient_product_delete",
];

type DiscardSkippedReason =
  | "invalid_input"
  | "missing"
  | "not_conflict"
  | "not_current_user_record";

export type IngredientProductConflictDiscardResult =
  | {
      discarded: true;
      ingredientProductId: string;
      queuedOpsDiscarded: number;
      deadLetterOpsDiscarded: number;
    }
  | {
      discarded: false;
      ingredientProductId: string;
      reason: DiscardSkippedReason;
    };

export async function discardIngredientProductConflict(params: {
  uid: string;
  ingredientProductId: string;
}): Promise<IngredientProductConflictDiscardResult> {
  const uid = params.uid.trim();
  const ingredientProductId = params.ingredientProductId.trim();
  if (!uid || !ingredientProductId) {
    return {
      discarded: false,
      ingredientProductId,
      reason: "invalid_input",
    };
  }

  const projection = await readIngredientProductUserRecord({
    uid,
    ingredientProductId,
  });
  if (!projection) {
    return {
      discarded: false,
      ingredientProductId,
      reason: "missing",
    };
  }

  if (projection.syncState !== "conflict") {
    return {
      discarded: false,
      ingredientProductId,
      reason: "not_conflict",
    };
  }

  if (
    projection.item.ingredientProductId !== ingredientProductId ||
    projection.item.recordScope !== "user_scoped" ||
    projection.item.ownerUserId !== uid
  ) {
    return {
      discarded: false,
      ingredientProductId,
      reason: "not_current_user_record",
    };
  }

  const discardedOps = await discardQueuedAndDeadLetterOpsByCloudIds({
    uid,
    cloudIds: [ingredientProductId],
    kinds: INGREDIENT_PRODUCT_QUEUE_KINDS,
  });
  await removeIngredientProductUserRecord({ uid, ingredientProductId });

  return {
    discarded: true,
    ingredientProductId,
    queuedOpsDiscarded: discardedOps.queued,
    deadLetterOpsDiscarded: discardedOps.dead,
  };
}
