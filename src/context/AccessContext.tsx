import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuthContext } from "@/context/AuthContext";
import { get } from "@/services/core/apiClient";
import { logWarning } from "@/services/core/errorLogger";
import {
  buildDegradedAccessState,
  getAccessFeature,
  parseAccessState,
  type AccessFeatureKey,
  type AccessFeatureState,
  type AccessState,
} from "@/services/access/accessState";
import { useProductReadiness } from "@/hooks/useProductReadiness";
import { on } from "@/services/core/events";
import { getE2EAccessState } from "@/services/e2e/fixtures";
import { isE2EModeEnabled } from "@/services/e2e/config";

type AccessContextValue = {
  accessState: AccessState | null;
  loading: boolean;
  refreshAccess: (options?: { force?: boolean }) => Promise<AccessState | null>;
  applyAccessFromResponse: (value: unknown) => AccessState | null;
  canUseFeature: (feature: AccessFeatureKey) => boolean;
  getFeature: (feature: AccessFeatureKey) => AccessFeatureState | null;
};

const AccessContext = createContext<AccessContextValue>({
  accessState: null,
  loading: false,
  refreshAccess: async () => null,
  applyAccessFromResponse: () => null,
  canUseFeature: () => false,
  getFeature: () => null,
});

function accessChanged(a: AccessState | null, b: AccessState | null): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { uid } = useAuthContext();
  const { uid: productReadyUid } = useProductReadiness();
  const [accessState, setAccessState] = useState<AccessState | null>(null);
  const [loading, setLoading] = useState(false);
  const accessRef = useRef(accessState);
  const uidRef = useRef(uid);
  const refreshInFlightRef = useRef<{
    uid: string;
    token: object;
    promise: Promise<AccessState | null>;
  } | null>(null);

  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  const updateAccess = useCallback((next: AccessState | null) => {
    if (!accessChanged(accessRef.current, next)) return;
    accessRef.current = next;
    setAccessState(next);
  }, []);

  const applyAccessFromResponse = useCallback((value: unknown): AccessState | null => {
    const parsedAccess = parseAccessState(value);
    if (!parsedAccess) return null;
    updateAccess(parsedAccess);
    return parsedAccess;
  }, [updateAccess]);

  const refreshAccess = useCallback((
    options?: { force?: boolean },
  ): Promise<AccessState | null> => {
    if (!uid || !productReadyUid) {
      updateAccess(null);
      return Promise.resolve(null);
    }

    const inFlight = refreshInFlightRef.current;
    if (!options?.force && inFlight?.uid === productReadyUid) {
      return inFlight.promise;
    }

    setLoading(true);
    const requestUid = productReadyUid;
    const token = {};
    const promise = (async () => {
      try {
        const e2eAccessState = getE2EAccessState(requestUid);
        if (e2eAccessState) {
          if (
            uidRef.current === requestUid
            && refreshInFlightRef.current?.token === token
          ) {
            updateAccess(e2eAccessState);
          }
          return e2eAccessState;
        }

        const response = await get<unknown>("/billing/access-state");
        const parsed = parseAccessState(response);
        if (!parsed) return null;
        if (
          uidRef.current === requestUid
          && refreshInFlightRef.current?.token === token
        ) {
          updateAccess(parsed);
        }
        return parsed;
      } catch (error) {
        logWarning("access state refresh failed", null, error);
        if (
          uidRef.current === requestUid
          && refreshInFlightRef.current?.token === token
        ) {
          updateAccess(buildDegradedAccessState());
        }
        return null;
      } finally {
        if (refreshInFlightRef.current?.token === token) {
          refreshInFlightRef.current = null;
          setLoading(false);
        }
      }
    })();

    refreshInFlightRef.current = { uid: requestUid, token, promise };
    return promise;
  }, [productReadyUid, uid, updateAccess]);

  useEffect(() => {
    if (!uid || !productReadyUid) {
      updateAccess(null);
      return;
    }

    void refreshAccess();
  }, [productReadyUid, refreshAccess, uid, updateAccess]);

  useEffect(() => {
    if (!isE2EModeEnabled()) return undefined;
    const unsubscribe = on("e2e:seeded", () => {
      void refreshAccess({ force: true });
    });
    return () => {
      unsubscribe();
    };
  }, [refreshAccess]);

  const getFeature = useCallback(
    (feature: AccessFeatureKey) => getAccessFeature(accessState, feature),
    [accessState],
  );

  const canUseFeature = useCallback(
    (feature: AccessFeatureKey) => getFeature(feature)?.enabled === true,
    [getFeature],
  );

  const value = useMemo<AccessContextValue>(
    () => ({
      accessState,
      loading,
      refreshAccess,
      applyAccessFromResponse,
      canUseFeature,
      getFeature,
    }),
    [
      accessState,
      loading,
      refreshAccess,
      applyAccessFromResponse,
      canUseFeature,
      getFeature,
    ],
  );

  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  );
}

export function useAccessContext(): AccessContextValue {
  return useContext(AccessContext);
}
