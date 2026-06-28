import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import NetInfo, {
  NetInfoStateType,
  useNetInfo,
  type NetInfoState,
} from "@react-native-community/netinfo";
import {
  isE2EForcedOffline,
  subscribeE2EConnectivityOverride,
} from "@/services/e2e/connectivityOverride";

export const CONNECTIVITY_MONITOR_POLL_MS = 5000;

function withE2EForcedOffline(
  state: NetInfoState,
  forcedOffline: boolean,
): NetInfoState {
  if (!forcedOffline) return state;
  return {
    ...state,
    type: NetInfoStateType.none,
    details: null,
    isConnected: false,
    isInternetReachable: false,
  };
}

export function useMonitoredNetInfo(): NetInfoState {
  const netInfo = useNetInfo();
  const [monitoredNetInfo, setMonitoredNetInfo] =
    useState<NetInfoState>(netInfo);
  const [forcedOffline, setForcedOffline] = useState(isE2EForcedOffline());

  useEffect(() => {
    setMonitoredNetInfo(netInfo);
  }, [netInfo]);

  const refreshConnectivity = useCallback(async (isMounted: () => boolean) => {
    try {
      const refreshed = await NetInfo.refresh();
      if (isMounted()) {
        setMonitoredNetInfo(refreshed);
      }
    } catch {
      // Native connectivity checks can fail transiently; keep the latest known state.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const isMounted = () => mounted;

    void refreshConnectivity(isMounted);

    const pollTimer = setInterval(() => {
      void refreshConnectivity(isMounted);
    }, CONNECTIVITY_MONITOR_POLL_MS);

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshConnectivity(isMounted);
      }
    });

    return () => {
      mounted = false;
      clearInterval(pollTimer);
      appStateSub.remove();
    };
  }, [refreshConnectivity]);

  useEffect(() => {
    return subscribeE2EConnectivityOverride(setForcedOffline);
  }, []);

  return useMemo(
    () => withE2EForcedOffline(monitoredNetInfo, forcedOffline),
    [forcedOffline, monitoredNetInfo],
  );
}
