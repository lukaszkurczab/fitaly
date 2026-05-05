import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCurrentReminderDecisionDayKey,
  getReminderDecision,
} from "@/services/reminders/reminderService";
import { useIsProductReady } from "@/hooks/useProductReadiness";
import type {
  ReminderDecision,
  ReminderDecisionSource,
  ReminderDecisionResultStatus,
} from "@/services/reminders/reminderTypes";

type UseReminderDecisionParams = {
  uid: string | null | undefined;
  dayKey?: string | null;
  fetchEnabled?: boolean;
};

type ReminderDecisionState = {
  decision: ReminderDecision | null;
  loading: boolean;
  enabled: boolean;
  source: ReminderDecisionSource;
  status: ReminderDecisionResultStatus;
  error: unknown | null;
};

type UseReminderDecisionResult = ReminderDecisionState & {
  refresh: () => Promise<ReminderDecision | null>;
};

const INITIAL_STATE: ReminderDecisionState = {
  decision: null,
  loading: false,
  enabled: true,
  source: "fallback",
  status: "no_user",
  error: null,
};

function resolveDayKey(dayKey?: string | null): string {
  return dayKey?.trim() || getCurrentReminderDecisionDayKey();
}

export function useReminderDecision({
  uid,
  dayKey,
  fetchEnabled = true,
}: UseReminderDecisionParams): UseReminderDecisionResult {
  const isProductReady = useIsProductReady();
  const resolvedDayKey = resolveDayKey(dayKey);
  const [state, setState] = useState<ReminderDecisionState>(
    () => ({ ...INITIAL_STATE, loading: !!uid }),
  );
  const requestIdRef = useRef(0);
  const requestScopeKey = `${uid ?? ""}:${resolvedDayKey}:${fetchEnabled ? "enabled" : "disabled"}`;
  const requestScopeKeyRef = useRef(requestScopeKey);

  useEffect(() => {
    requestScopeKeyRef.current = requestScopeKey;
    requestIdRef.current += 1;
  }, [requestScopeKey]);

  useEffect(() => {
    let active = true;

    if (!uid || !fetchEnabled) {
      setState(INITIAL_STATE);
      return () => {
        active = false;
      };
    }

    setState((prev) => ({ ...prev, loading: true }));
    const requestId = ++requestIdRef.current;
    const requestScope = requestScopeKey;

    void getReminderDecision(uid, {
      dayKey: resolvedDayKey,
      productReady: isProductReady,
    }).then((result) => {
      if (
        !active ||
        requestIdRef.current !== requestId ||
        requestScopeKeyRef.current !== requestScope
      ) {
        return;
      }

      setState({
        decision: result.decision,
        loading: false,
        enabled: result.enabled,
        source: result.source,
        status: result.status,
        error: result.error,
      });
    });

    return () => {
      active = false;
    };
  }, [fetchEnabled, isProductReady, requestScopeKey, resolvedDayKey, uid]);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const requestScope = requestScopeKey;
    const result = await getReminderDecision(uid, {
      dayKey: resolvedDayKey,
      productReady: isProductReady,
    });
    if (
      requestIdRef.current === requestId &&
      requestScopeKeyRef.current === requestScope
    ) {
      setState({
        decision: result.decision,
        loading: false,
        enabled: result.enabled,
        source: result.source,
        status: result.status,
        error: result.error,
      });
    }
    return result.decision;
  }, [isProductReady, requestScopeKey, resolvedDayKey, uid]);

  return {
    ...state,
    refresh,
  };
}
