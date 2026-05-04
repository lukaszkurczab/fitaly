import { useCallback, useEffect, useRef, useState } from "react";
import { on } from "@/services/core/events";
import {
  createFallbackCoachResponse,
  getCoach,
  getCurrentCoachDayKey,
  invalidateCoachCache,
  refreshCoach,
} from "@/services/coach/coachService";
import type {
  CoachResponse,
  CoachResponseSource,
  CoachResultStatus,
} from "@/services/coach/coachTypes";

const COACH_MUTATION_REFRESH_DELAY_MS = 1_000;

type UseCoachParams = {
  uid: string | null | undefined;
  dayKey?: string | null;
  active?: boolean;
};

type UseCoachResult = {
  coach: CoachResponse;
  loading: boolean;
  enabled: boolean;
  source: CoachResponseSource;
  status: CoachResultStatus;
  isStale: boolean;
  error: unknown | null;
  refresh: () => Promise<CoachResponse>;
};

type CoachMutationEvent = {
  uid?: string | null;
};

function resolveDayKey(dayKey?: string | null): string {
  return dayKey?.trim() || getCurrentCoachDayKey();
}

export function useCoach({
  uid,
  dayKey,
  active: isActive = true,
}: UseCoachParams): UseCoachResult {
  const resolvedDayKey = resolveDayKey(dayKey);
  const [coach, setCoach] = useState<CoachResponse>(() =>
    createFallbackCoachResponse(resolvedDayKey),
  );
  const [loading, setLoading] = useState<boolean>(!!uid && isActive);
  const [enabled, setEnabled] = useState<boolean>(isActive);
  const [source, setSource] = useState<CoachResponseSource>(
    isActive ? "fallback" : "disabled",
  );
  const [status, setStatus] = useState<CoachResultStatus>(
    isActive ? "no_user" : "disabled",
  );
  const [isStale, setIsStale] = useState<boolean>(true);
  const [error, setError] = useState<unknown | null>(null);
  const requestIdRef = useRef(0);
  const mutationRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestScopeKey = `${uid ?? ""}:${resolvedDayKey}:${isActive ? "active" : "inactive"}`;
  const requestScopeKeyRef = useRef(requestScopeKey);

  useEffect(() => {
    requestScopeKeyRef.current = requestScopeKey;
    requestIdRef.current += 1;
  }, [requestScopeKey]);

  const applyResult = useCallback((result: {
    coach: CoachResponse;
    enabled: boolean;
    source: CoachResponseSource;
    status: CoachResultStatus;
    isStale: boolean;
    error: unknown | null;
  }) => {
    setCoach(result.coach);
    setEnabled(result.enabled);
    setSource(result.source);
    setStatus(result.status);
    setIsStale(result.isStale);
    setError(result.error);
  }, []);

  const clearPendingMutationRefresh = useCallback(() => {
    if (mutationRefreshTimeoutRef.current !== null) {
      clearTimeout(mutationRefreshTimeoutRef.current);
      mutationRefreshTimeoutRef.current = null;
    }
  }, []);

  const runRefreshRequest = useCallback(async (options?: { invalidateFirst?: boolean }) => {
    const requestId = ++requestIdRef.current;
    const requestScope = requestScopeKey;

    if (options?.invalidateFirst) {
      await invalidateCoachCache(uid, { dayKey: resolvedDayKey });
    }

    const result = await refreshCoach(uid, { dayKey: resolvedDayKey });
    if (
      requestIdRef.current === requestId &&
      requestScopeKeyRef.current === requestScope
    ) {
      applyResult(result);
      setLoading(false);
    }
    return result.coach;
  }, [applyResult, requestScopeKey, resolvedDayKey, uid]);

  useEffect(() => clearPendingMutationRefresh, [clearPendingMutationRefresh, requestScopeKey]);

  useEffect(() => {
    let mounted = true;

    if (!uid || !isActive) {
      setCoach(createFallbackCoachResponse(resolvedDayKey));
      setLoading(false);
      setEnabled(isActive);
      setSource(uid ? "disabled" : "fallback");
      setStatus(uid ? "disabled" : "no_user");
      setIsStale(true);
      setError(null);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    const requestId = ++requestIdRef.current;
    const requestScope = requestScopeKey;

    void getCoach(uid, { dayKey: resolvedDayKey }).then((result) => {
      if (
        !mounted ||
        requestIdRef.current !== requestId ||
        requestScopeKeyRef.current !== requestScope
      ) {
        return;
      }

      applyResult(result);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [applyResult, isActive, requestScopeKey, uid, resolvedDayKey]);

  useEffect(() => {
    if (!uid || !isActive) {
      return () => undefined;
    }

    let active = true;

    const handleMealMutation = (event?: CoachMutationEvent) => {
      if (!active || event?.uid !== uid) {
        return;
      }

      clearPendingMutationRefresh();
      setLoading(true);
      mutationRefreshTimeoutRef.current = setTimeout(() => {
        mutationRefreshTimeoutRef.current = null;
        if (!active) {
          return;
        }

        void runRefreshRequest({ invalidateFirst: true });
      }, COACH_MUTATION_REFRESH_DELAY_MS);
    };

    const unsubscribers = [
      on<CoachMutationEvent>("meal:added", handleMealMutation),
      on<CoachMutationEvent>("meal:updated", handleMealMutation),
      on<CoachMutationEvent>("meal:delete:committed", handleMealMutation),
    ];

    return () => {
      active = false;
      clearPendingMutationRefresh();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [clearPendingMutationRefresh, isActive, requestScopeKey, runRefreshRequest, uid]);

  const refresh = useCallback(async () => {
    clearPendingMutationRefresh();
    if (!isActive) {
      const fallbackCoach = createFallbackCoachResponse(resolvedDayKey);
      applyResult({
        coach: fallbackCoach,
        enabled: false,
        source: "disabled",
        status: "disabled",
        isStale: true,
        error: null,
      });
      setLoading(false);
      return fallbackCoach;
    }

    setLoading(true);
    return runRefreshRequest();
  }, [applyResult, clearPendingMutationRefresh, isActive, resolvedDayKey, runRefreshRequest]);

  return {
    coach,
    loading,
    enabled,
    source,
    status,
    isStale,
    error,
    refresh,
  };
}
