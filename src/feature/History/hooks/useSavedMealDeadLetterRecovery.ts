import { useCallback, useEffect, useRef, useState } from "react";
import { emit, on } from "@/services/core/events";
import {
  discardDeadLetterOps,
  getDeadLetterOps,
  getSyncCounts,
  retryDeadLetterOps,
  type DeadLetterOp,
  type QueueKind,
} from "@/services/offline/queue.repo";
import { requestSync } from "@/services/offline/sync.engine";

const SAVED_MEAL_DEAD_LETTER_KINDS: QueueKind[] = [
  "upsert_mymeal",
  "delete_mymeal",
];

const SAVED_MEAL_DEAD_LETTER_DIAGNOSTIC_LIMIT = 500;

export type SavedMealDeadLetterDiagnostics = {
  dead: number;
  pending: number;
  lastFailedKind: QueueKind | null;
  hasFailedLocalPhotoUpload: boolean;
};

const EMPTY_DIAGNOSTICS: SavedMealDeadLetterDiagnostics = {
  dead: 0,
  pending: 0,
  lastFailedKind: null,
  hasFailedLocalPhotoUpload: false,
};

type SyncQueueEvent = {
  uid?: string;
  kind?: string;
  ops?: Array<{ kind?: string }>;
};

function isSavedMealKind(kind: string | undefined): boolean {
  return kind === "upsert_mymeal" || kind === "delete_mymeal";
}

function isLocalPhotoReference(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.startsWith("file:") || value.startsWith("content:"))
  );
}

function hasLocalPhotoPayloadEvidence(op: DeadLetterOp): boolean {
  if (op.kind !== "upsert_mymeal") return false;
  if (!op.payload || typeof op.payload !== "object") return false;

  const payload = op.payload as {
    photoLocalPath?: unknown;
    localPhotoUri?: unknown;
    photoUrl?: unknown;
  };

  return (
    isLocalPhotoReference(payload.photoLocalPath) ||
    isLocalPhotoReference(payload.localPhotoUri) ||
    isLocalPhotoReference(payload.photoUrl)
  );
}

function isRelevantSyncEvent(
  event: SyncQueueEvent | undefined,
  uid: string,
): boolean {
  if (event?.uid !== uid) return false;
  if (typeof event.kind === "string") return isSavedMealKind(event.kind);
  if (Array.isArray(event.ops)) {
    return event.ops.some((op) => isSavedMealKind(op.kind));
  }
  return true;
}

function areDiagnosticsEqual(
  left: SavedMealDeadLetterDiagnostics,
  right: SavedMealDeadLetterDiagnostics,
): boolean {
  return (
    left.dead === right.dead &&
    left.pending === right.pending &&
    left.lastFailedKind === right.lastFailedKind &&
    left.hasFailedLocalPhotoUpload === right.hasFailedLocalPhotoUpload
  );
}

export function useSavedMealDeadLetterRecovery(
  uid: string | null | undefined,
) {
  const currentUidRef = useRef(uid);
  const diagnosticsUidRef = useRef<string | null>(null);
  const diagnosticsRef = useRef<SavedMealDeadLetterDiagnostics>(
    EMPTY_DIAGNOSTICS,
  );
  const refreshSeqRef = useRef(0);
  const retryInFlightRef = useRef(false);
  const [diagnostics, setDiagnostics] =
    useState<SavedMealDeadLetterDiagnostics>(EMPTY_DIAGNOSTICS);
  const [retrying, setRetrying] = useState(false);

  currentUidRef.current = uid;

  const applyDiagnostics = useCallback(
    (next: SavedMealDeadLetterDiagnostics, ownerUid: string | null) => {
      diagnosticsUidRef.current = ownerUid;
      if (areDiagnosticsEqual(diagnosticsRef.current, next)) {
        return;
      }
      diagnosticsRef.current = next;
      setDiagnostics(next);
    },
    [],
  );

  const refreshDiagnostics = useCallback(async () => {
    const targetUid = uid;
    const seq = refreshSeqRef.current + 1;
    refreshSeqRef.current = seq;

    if (!targetUid) {
      applyDiagnostics(EMPTY_DIAGNOSTICS, null);
      return;
    }

    if (
      diagnosticsUidRef.current !== null &&
      diagnosticsUidRef.current !== targetUid
    ) {
      applyDiagnostics(EMPTY_DIAGNOSTICS, null);
    }

    try {
      const [syncCounts, latestDeadOps] = await Promise.all([
        getSyncCounts(targetUid, {
          kinds: SAVED_MEAL_DEAD_LETTER_KINDS,
        }),
        getDeadLetterOps({
          uid: targetUid,
          kinds: SAVED_MEAL_DEAD_LETTER_KINDS,
          limit: SAVED_MEAL_DEAD_LETTER_DIAGNOSTIC_LIMIT,
        }),
      ]);

      if (currentUidRef.current !== targetUid || refreshSeqRef.current !== seq) {
        return;
      }

      applyDiagnostics(
        {
          dead: syncCounts.dead,
          pending: syncCounts.pending,
          lastFailedKind: latestDeadOps[0]?.kind ?? null,
          hasFailedLocalPhotoUpload: latestDeadOps.some(
            hasLocalPhotoPayloadEvidence,
          ),
        },
        targetUid,
      );
    } catch {
      if (
        currentUidRef.current === targetUid &&
        refreshSeqRef.current === seq &&
        diagnosticsUidRef.current !== targetUid
      ) {
        applyDiagnostics(EMPTY_DIAGNOSTICS, targetUid);
      }
    }
  }, [applyDiagnostics, uid]);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  useEffect(() => {
    if (!uid) return;

    const refreshForUid = (event?: SyncQueueEvent) => {
      if (!isRelevantSyncEvent(event, uid)) return;
      void refreshDiagnostics();
    };

    const unsubs = [
      on<SyncQueueEvent>("sync:op:dead", refreshForUid),
      on<SyncQueueEvent>("sync:op:retried", refreshForUid),
      on<SyncQueueEvent>("sync:op:discarded", refreshForUid),
      on<SyncQueueEvent>("sync:op:retry_skipped", refreshForUid),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [refreshDiagnostics, uid]);

  const retryDeadLetters = useCallback(async () => {
    const targetUid = uid;
    if (!targetUid || retryInFlightRef.current) return;

    retryInFlightRef.current = true;
    setRetrying(true);

    try {
      const retried = await retryDeadLetterOps({
        uid: targetUid,
        kinds: SAVED_MEAL_DEAD_LETTER_KINDS,
      });
      await refreshDiagnostics();

      if (retried > 0) {
        emit("ui:toast", {
          key: "history.deadLetterRetryQueued",
          ns: "meals",
          options: { count: retried },
        });
        await requestSync({
          uid: targetUid,
          domain: "myMeals",
          reason: "retry",
        });
        await refreshDiagnostics();
      }
    } catch {
      emit("ui:toast", {
        key: "unknownError",
        ns: "common",
      });
    } finally {
      retryInFlightRef.current = false;
      setRetrying(false);
    }
  }, [refreshDiagnostics, uid]);

  const discardPhotoDeadLetters = useCallback(async () => {
    const targetUid = uid;
    if (!targetUid || retryInFlightRef.current) return;

    retryInFlightRef.current = true;
    setRetrying(true);

    try {
      const deadLetterOps = await getDeadLetterOps({
        uid: targetUid,
        kinds: ["upsert_mymeal"],
        limit: SAVED_MEAL_DEAD_LETTER_DIAGNOSTIC_LIMIT,
      });
      const photoDeadLetterIds = deadLetterOps
        .filter(hasLocalPhotoPayloadEvidence)
        .map((op) => op.id);
      const discarded = await discardDeadLetterOps({
        uid: targetUid,
        ids: photoDeadLetterIds,
        kinds: ["upsert_mymeal"],
      });
      await refreshDiagnostics();

      if (discarded > 0) {
        emit("ui:toast", {
          key: "history.savedMealPhotoUploadDiscarded",
          ns: "meals",
          options: { count: discarded },
        });
      }
    } catch {
      emit("ui:toast", {
        key: "unknownError",
        ns: "common",
      });
    } finally {
      retryInFlightRef.current = false;
      setRetrying(false);
    }
  }, [refreshDiagnostics, uid]);

  return {
    diagnostics,
    retrying,
    retryDeadLetters,
    discardPhotoDeadLetters,
    refreshDiagnostics,
  };
}
