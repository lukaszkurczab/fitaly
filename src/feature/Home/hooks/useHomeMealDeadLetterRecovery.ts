import { useCallback, useEffect, useRef, useState } from "react";
import { emit, on } from "@/services/core/events";
import {
  getDeadLetterOps,
  getSyncCounts,
  retryDeadLetterOps,
  type QueueKind,
} from "@/services/offline/queue.repo";
import { requestSync } from "@/services/offline/sync.engine";

const HOME_MEAL_DEAD_LETTER_KINDS: QueueKind[] = [
  "upsert",
  "delete",
  "upsert_mymeal",
  "delete_mymeal",
];

type HomeMealDeadLetterDiagnostics = {
  dead: number;
  pending: number;
  lastFailedKind: QueueKind | null;
};

const EMPTY_DIAGNOSTICS: HomeMealDeadLetterDiagnostics = {
  dead: 0,
  pending: 0,
  lastFailedKind: null,
};

function areDiagnosticsEqual(
  left: HomeMealDeadLetterDiagnostics,
  right: HomeMealDeadLetterDiagnostics,
): boolean {
  return (
    left.dead === right.dead &&
    left.pending === right.pending &&
    left.lastFailedKind === right.lastFailedKind
  );
}

export function useHomeMealDeadLetterRecovery(
  uid: string | null | undefined,
) {
  const currentUidRef = useRef(uid);
  const diagnosticsUidRef = useRef<string | null>(null);
  const diagnosticsRef = useRef<HomeMealDeadLetterDiagnostics>(EMPTY_DIAGNOSTICS);
  const refreshSeqRef = useRef(0);
  const retryInFlightRef = useRef(false);
  const [diagnostics, setDiagnostics] =
    useState<HomeMealDeadLetterDiagnostics>(EMPTY_DIAGNOSTICS);
  const [retrying, setRetrying] = useState(false);

  currentUidRef.current = uid;

  const applyDiagnostics = useCallback(
    (next: HomeMealDeadLetterDiagnostics, ownerUid: string | null) => {
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
          kinds: HOME_MEAL_DEAD_LETTER_KINDS,
        }),
        getDeadLetterOps({
          uid: targetUid,
          kinds: HOME_MEAL_DEAD_LETTER_KINDS,
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

    const refreshForUid = (event?: { uid?: string }) => {
      const eventUid = typeof event?.uid === "string" ? event.uid : uid;
      if (eventUid !== uid) return;
      void refreshDiagnostics();
    };

    const unsubs = [
      on<{ uid?: string }>("sync:op:dead", refreshForUid),
      on<{ uid?: string }>("sync:op:retried", refreshForUid),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [refreshDiagnostics, uid]);

  const retryDeadLetters = useCallback(async () => {
    if (!uid || retryInFlightRef.current) return;

    retryInFlightRef.current = true;
    setRetrying(true);

    try {
      const retried = await retryDeadLetterOps({
        uid,
        kinds: HOME_MEAL_DEAD_LETTER_KINDS,
      });
      await refreshDiagnostics();

      if (retried > 0) {
        emit("ui:toast", {
          key: "history.deadLetterRetryQueued",
          ns: "meals",
          options: { count: retried },
        });
        await Promise.all([
          requestSync({
            uid,
            domain: "meals",
            reason: "retry",
          }),
          requestSync({
            uid,
            domain: "myMeals",
            reason: "retry",
          }),
        ]);
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
  };
}
