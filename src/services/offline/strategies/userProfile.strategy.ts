import type { UserData } from "@/types";
import { Sync } from "@/utils/debug";
import { emit } from "@/services/core/events";
import {
  updateUserProfileRemote,
  uploadUserAvatarRemote,
} from "@/services/user/userProfileRepository";
import { createServiceError } from "@/services/contracts/serviceError";
import type { QueueOp, SyncStrategy } from "../sync.strategy";

const log = Sync;

function syncEngineError(
  code: string,
  options?: { message?: string; retryable?: boolean; cause?: unknown }
) {
  return createServiceError({
    code,
    source: "SyncEngine",
    retryable: options?.retryable ?? true,
    message: options?.message,
    cause: options?.cause,
  });
}

function nowISO() {
  return new Date().toISOString();
}

export const userProfileStrategy: SyncStrategy = {
  async pull(_uid: string): Promise<number> {
    return 0;
  },

  async handlePushOp(uid: string, op: QueueOp): Promise<boolean> {
    const pushLog = log.child("push");

    if (op.kind === "update_user_profile") {
      const payload = op.payload as Record<string, unknown> | null;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw syncEngineError("sync/profile-invalid-payload", {
          message: "Missing or invalid user profile payload",
          retryable: false,
        });
      }
      if (Object.keys(payload).length === 0) {
        pushLog.log("profile:update:empty", { uid, opId: op.id });
      } else {
        await updateUserProfileRemote(payload as Partial<UserData>, {
          clientMutationId: op.client_mutation_id,
        });
        pushLog.log("profile:update", {
          uid,
          keys: Object.keys(payload),
        });
        emit("user:profile:synced", { uid, updatedAt: op.updated_at });
      }
      return true;
    }

    if (op.kind === "upload_user_avatar") {
      const payload = op.payload as { localPath?: string; updatedAt?: string } | null;
      const localPath = typeof payload?.localPath === "string"
        ? payload.localPath
        : "";
      if (!localPath) {
        throw syncEngineError("sync/avatar-missing-local-path", {
          message: "Missing local avatar path for upload operation",
          retryable: false,
        });
      }
      const uploaded = await uploadUserAvatarRemote(localPath, {
        clientMutationId: op.client_mutation_id,
      });
      emit("user:avatar:synced", {
        uid,
        avatarUrl: uploaded.avatarUrl,
        avatarLocalPath: localPath,
        avatarlastSyncedAt: uploaded.avatarlastSyncedAt,
        avatarRef: uploaded.avatarRef,
        updatedAt: String(payload?.updatedAt || op.updated_at || nowISO()),
      });
      pushLog.log("avatar:upload", {
        uid,
        localPath,
      });
      return true;
    }

    return false;
  },
};
