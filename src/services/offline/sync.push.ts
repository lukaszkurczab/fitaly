import NetInfo from "@react-native-community/netinfo";
import { Sync } from "@/utils/debug";
import { emit } from "@/services/core/events";
import { isOfflineNetState } from "@/services/core/networkState";
import {
  createServiceError,
  normalizeServiceError,
} from "@/services/contracts/serviceError";
import {
  nextBatch,
  markDone,
  bumpAttempts,
  moveToDeadLetter,
  MAX_QUEUE_ATTEMPTS,
} from "./queue.repo";
import { setMealSyncStateLocal } from "./meals.repo";
import { setMyMealSyncStateLocal } from "./myMeals.repo";
import {
  markSmartMemoryProjectionSyncFailed,
  smartMemoryQueueKinds,
} from "@/services/smartMemory/smartMemoryProjectionRepository";
import {
  ingredientProductQueueKinds,
} from "@/services/offline/strategies/foodLibrary.strategy";
import {
  markIngredientProductCreateSyncFailed,
} from "@/services/foodLibrary/ingredientProductCreateQueue";
import type { SyncStrategy } from "./sync.strategy";

const log = Sync;
const SMART_MEMORY_QUEUE_KINDS = new Set(smartMemoryQueueKinds());
const INGREDIENT_PRODUCT_QUEUE_KINDS = new Set(ingredientProductQueueKinds());

export type PushQueueResult = {
  processed: number;
  failed: number;
  deadLettered: number;
};

function toSyncError(error: unknown) {
  return normalizeServiceError(error, {
    code: "sync/unknown",
    source: "SyncEngine",
    retryable: true,
  });
}

export async function runPushQueue(
  uid: string,
  pushBatchSize: number,
  strategies: SyncStrategy[]
): Promise<PushQueueResult> {
  const pushLog = log.child("push");
  const net = await NetInfo.fetch();
  pushLog.log("start", { uid, isConnected: net.isConnected });
  if (isOfflineNetState(net)) {
    pushLog.log("skip:offline");
    return { processed: 0, failed: 0, deadLettered: 0 };
  }
  pushLog.time("exec");
  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (;;) {
    const batch = await nextBatch(pushBatchSize, uid);
    pushLog.log("batch:next", { size: batch.length });
    if (batch.length === 0) break;

    for (const op of batch) {
      pushLog.log("op:start", { id: op.id, kind: op.kind });
      try {
        let handled = false;
        for (const strategy of strategies) {
          if (await strategy.handlePushOp(uid, op)) {
            handled = true;
            break;
          }
        }
        if (!handled) {
          pushLog.warn("unknown_op", op.kind);
          throw createServiceError({
            code: "sync/unknown-op",
            source: "SyncEngine",
            message: `Unknown queue operation: ${op.kind}`,
            retryable: false,
          });
        }

        await markDone(op.id);
        processed++;
        pushLog.log("op:done", { id: op.id });
      } catch (e: unknown) {
        failed++;
        const err = toSyncError(e);
        const nextAttempts = op.attempts + 1;
        pushLog.error("op:fail", {
          id: op.id,
          code: err.code,
          message: err.message,
          retryable: err.retryable,
        });
        const shouldDeadLetter =
          !err.retryable || nextAttempts >= MAX_QUEUE_ATTEMPTS;
        if (shouldDeadLetter) {
          deadLettered++;
          await moveToDeadLetter(op, nextAttempts, {
            code: err.code,
            message: err.message,
          });
          pushLog.warn("op:dead_letter", {
            id: op.id,
            kind: op.kind,
            attempts: nextAttempts,
          });
          emit("sync:op:dead", {
            uid,
            opId: op.id,
            cloudId: op.cloud_id,
            kind: op.kind,
            attempts: nextAttempts,
            code: err.code,
          });
        } else {
          await bumpAttempts(op.id);
          pushLog.log("op:bump_attempts", { id: op.id, attempts: nextAttempts });
        }
        if (op.kind === "upsert") {
          await setMealSyncStateLocal({
            uid,
            cloudId: op.cloud_id,
            syncState: shouldDeadLetter ? "failed" : "pending",
            updatedAt: op.updated_at,
          });
        }
        if (op.kind === "upsert_mymeal") {
          await setMyMealSyncStateLocal({
            uid,
            cloudId: op.cloud_id,
            syncState: shouldDeadLetter ? "failed" : "pending",
            updatedAt: op.updated_at,
          });
        }
        if (SMART_MEMORY_QUEUE_KINDS.has(op.kind)) {
          await markSmartMemoryProjectionSyncFailed({
            uid,
            op,
            dead: shouldDeadLetter,
            code: err.code,
            message: err.message,
          });
        }
        if (INGREDIENT_PRODUCT_QUEUE_KINDS.has(op.kind)) {
          await markIngredientProductCreateSyncFailed({
            uid,
            op,
            dead: shouldDeadLetter,
          });
        }
        if (op.kind === "update_user_profile") {
          emit("user:profile:failed", {
            uid,
            opId: op.id,
            dead: shouldDeadLetter,
          });
        } else if (op.kind === "upload_user_avatar") {
          emit("user:avatar:failed", {
            uid,
            opId: op.id,
            dead: shouldDeadLetter,
          });
        } else if (SMART_MEMORY_QUEUE_KINDS.has(op.kind)) {
          emit("smart-memory:failed", {
            uid,
            opId: op.id,
            cloudId: op.cloud_id,
            kind: op.kind,
            dead: shouldDeadLetter,
          });
        } else if (INGREDIENT_PRODUCT_QUEUE_KINDS.has(op.kind)) {
          emit("food-library:failed", {
            uid,
            opId: op.id,
            cloudId: op.cloud_id,
            kind: op.kind,
            dead: shouldDeadLetter,
          });
        } else {
          emit("meal:failed", {
            uid,
            opId: op.id,
            cloudId: op.cloud_id,
            dead: shouldDeadLetter,
          });
        }
      }
    }

    if (batch.length < pushBatchSize) break;
  }

  pushLog.timeEnd("exec");
  pushLog.log("done", { processed, failed, deadLettered });
  return { processed, failed, deadLettered };
}
