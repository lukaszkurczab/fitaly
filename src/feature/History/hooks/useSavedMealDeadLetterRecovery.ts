import { useCallback, useEffect, useRef, useState } from "react";
import { emit, on } from "@/services/core/events";
import {
  getDeadLetterOps,
  getSyncCounts,
  retryDeadLetterOps,
  type QueueKind,
} from "@/services/offline/queue.repo";
import { requestSync } from "@/services/offline/sync.engine";

const SAVED_MEAL_DEAD_LETTER_KINDS: QueueKind[] = [
  "upsert_mymeal",
  "delete_mymeal",
];

export type SavedMealDeadLetterDiagnostics = {
  dead: number;
  pending: number;
  lastFailedKind: QueueKind | null;
};

const EMPTY_DIAGNOSTICS: SavedMealDeadLetterDiagnostics = {
  dead: 0,
  pending: 0,
  lastFailedKind: null,
};

type SyncQueueEvent = {
  uid?: string;
  kind?: string;
  ops?: Array<{ kind?: string }>;
};

function isSavedMealKind(kind: string | undefined): boolean {
  return kind === "upsert_mymeal" || kind === "delete_mymeal";
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
    left.lastFailedKind === right.lastFailedKind
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
          limit: 1,
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

  return {
    diagnostics,
    retrying,
    retryDeadLetters,
    refreshDiagnostics,
  };
}
