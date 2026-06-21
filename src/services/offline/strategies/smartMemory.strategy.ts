import NetInfo from "@react-native-community/netinfo";
import { Sync } from "@/utils/debug";
import { isOfflineNetState } from "@/services/core/networkState";
import { createServiceError } from "@/services/contracts/serviceError";
import {
  createRuntimeFeatureDisabledError,
  isRuntimeFeatureEnabled,
} from "@/services/core/featureFlagGuard";
import {
  deleteSmartMemoryItemRemote,
  editSmartMemoryItemRemote,
  fetchSmartMemoryCandidatesRemote,
  fetchSmartMemoryItemsRemote,
  fetchSmartMemorySettingsRemote,
  markSmartMemoryItemSourceDeletedRemote,
  muteSmartMemoryItemRemote,
  restoreSmartMemoryItemRemote,
  updateSmartMemorySettingsRemote,
  upsertSmartMemoryCandidateRemote,
} from "@/services/smartMemory/smartMemoryApi";
import {
  replaceSmartMemoryCandidatesProjection,
  replaceSmartMemoryItemsProjection,
  upsertSmartMemoryCandidateProjection,
  upsertSmartMemoryItemProjection,
  upsertSmartMemorySettingsProjection,
} from "@/services/smartMemory/smartMemoryProjectionRepository";
import { setLastSmartMemoryPullTs } from "../sync.storage";
import type {
  SmartMemoryCandidateUpsertInput,
  SmartMemoryItemEditInput,
  SmartMemorySourceDeletedInput,
} from "@/types/smartMemory";
import type { QueueOp, SyncStrategy } from "../sync.strategy";

const log = Sync;
const PULL_LIMIT = 250;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toCandidateInput(payload: unknown): SmartMemoryCandidateUpsertInput {
  if (!isRecord(payload) || typeof payload.candidateId !== "string") {
    throw syncEngineError("sync/smart-memory-candidate-missing-id", {
      retryable: false,
    });
  }
  return payload as SmartMemoryCandidateUpsertInput;
}

function toItemEditInput(payload: unknown): SmartMemoryItemEditInput {
  return isRecord(payload) ? (payload as SmartMemoryItemEditInput) : {};
}

function toSourceDeletedInput(payload: unknown): SmartMemorySourceDeletedInput {
  if (!isRecord(payload) || !isRecord(payload.sourceRef)) {
    throw syncEngineError("sync/smart-memory-source-deleted-missing-source-ref", {
      retryable: false,
    });
  }
  const { sourceRef } = payload;
  const sourceRefKeys = Object.keys(sourceRef);
  if (
    sourceRefKeys.length !== 2 ||
    !sourceRefKeys.includes("kind") ||
    !sourceRefKeys.includes("sourceHash") ||
    typeof sourceRef.kind !== "string" ||
    typeof sourceRef.sourceHash !== "string"
  ) {
    throw syncEngineError("sync/smart-memory-source-deleted-invalid-source-ref", {
      retryable: false,
    });
  }
  return payload as SmartMemorySourceDeletedInput;
}

export const smartMemoryStrategy: SyncStrategy = {
  async pull(uid: string): Promise<number> {
    if (!isRuntimeFeatureEnabled("smartMemory")) {
      return 0;
    }

    const pullLog = log.child("pull:smartMemory");
    const net = await NetInfo.fetch();
    pullLog.log("start", { uid, isConnected: net.isConnected });
    if (isOfflineNetState(net)) {
      pullLog.log("skip:offline");
      return 0;
    }

    const [itemsPage, candidatesPage, settingsResponse] = await Promise.all([
      fetchSmartMemoryItemsRemote({ limit: PULL_LIMIT }),
      fetchSmartMemoryCandidatesRemote({ limit: PULL_LIMIT }),
      fetchSmartMemorySettingsRemote(),
    ]);

    await replaceSmartMemoryItemsProjection(uid, itemsPage.items);
    await replaceSmartMemoryCandidatesProjection(uid, candidatesPage.items);
    await upsertSmartMemorySettingsProjection(uid, settingsResponse.settings, {
      preservePending: true,
    });
    await setLastSmartMemoryPullTs(uid, new Date().toISOString());

    const total = itemsPage.items.length + candidatesPage.items.length + 1;
    pullLog.log("done", {
      items: itemsPage.items.length,
      candidates: candidatesPage.items.length,
      settings: 1,
    });
    return total;
  },

  async handlePushOp(uid: string, op: QueueOp): Promise<boolean> {
    const pushLog = log.child("push:smartMemory");

    const isSmartMemoryOp =
      op.kind === "smart_memory_candidate_upsert" ||
      op.kind === "smart_memory_item_edit" ||
      op.kind === "smart_memory_item_mute" ||
      op.kind === "smart_memory_item_restore" ||
      op.kind === "smart_memory_item_delete" ||
      op.kind === "smart_memory_item_source_deleted" ||
      op.kind === "smart_memory_settings_disable" ||
      op.kind === "smart_memory_settings_enable";

    if (!isSmartMemoryOp) {
      return false;
    }

    if (!isRuntimeFeatureEnabled("smartMemory")) {
      throw createRuntimeFeatureDisabledError("smartMemory");
    }

    if (op.kind === "smart_memory_candidate_upsert") {
      const response = await upsertSmartMemoryCandidateRemote({
        clientMutationId: op.client_mutation_id,
        input: toCandidateInput(op.payload),
      });
      await upsertSmartMemoryCandidateProjection(uid, response.candidate);
      pushLog.log("candidate_upsert:ok", op.cloud_id);
      return true;
    }

    if (op.kind === "smart_memory_item_edit") {
      const response = await editSmartMemoryItemRemote({
        memoryItemId: op.cloud_id,
        clientMutationId: op.client_mutation_id,
        input: toItemEditInput(op.payload),
      });
      await upsertSmartMemoryItemProjection(uid, response.item);
      pushLog.log("item_edit:ok", op.cloud_id);
      return true;
    }

    if (op.kind === "smart_memory_item_mute") {
      const response = await muteSmartMemoryItemRemote({
        memoryItemId: op.cloud_id,
        clientMutationId: op.client_mutation_id,
      });
      await upsertSmartMemoryItemProjection(uid, response.item);
      pushLog.log("item_mute:ok", op.cloud_id);
      return true;
    }

    if (op.kind === "smart_memory_item_restore") {
      const response = await restoreSmartMemoryItemRemote({
        memoryItemId: op.cloud_id,
        clientMutationId: op.client_mutation_id,
      });
      await upsertSmartMemoryItemProjection(uid, response.item);
      pushLog.log("item_restore:ok", op.cloud_id);
      return true;
    }

    if (op.kind === "smart_memory_item_delete") {
      const response = await deleteSmartMemoryItemRemote({
        memoryItemId: op.cloud_id,
        clientMutationId: op.client_mutation_id,
      });
      await upsertSmartMemoryItemProjection(uid, response.item);
      pushLog.log("item_delete:ok", op.cloud_id);
      return true;
    }

    if (op.kind === "smart_memory_item_source_deleted") {
      const response = await markSmartMemoryItemSourceDeletedRemote({
        memoryItemId: op.cloud_id,
        clientMutationId: op.client_mutation_id,
        input: toSourceDeletedInput(op.payload),
      });
      await upsertSmartMemoryItemProjection(uid, response.item);
      pushLog.log("item_source_deleted:ok", op.cloud_id);
      return true;
    }

    if (op.kind === "smart_memory_settings_disable" || op.kind === "smart_memory_settings_enable") {
      const response = await updateSmartMemorySettingsRemote({
        enabled: op.kind === "smart_memory_settings_enable",
        clientMutationId: op.client_mutation_id,
      });
      await upsertSmartMemorySettingsProjection(uid, response.settings);
      pushLog.log(`${op.kind}:ok`, op.cloud_id);
      return true;
    }

    return false;
  },
};
