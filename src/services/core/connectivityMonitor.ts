import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import NetInfo, {
  useNetInfo,
  type NetInfoState,
} from "@react-native-community/netinfo";

export const CONNECTIVITY_MONITOR_POLL_MS = 5000;

export function useMonitoredNetInfo(): NetInfoState {
  const netInfo = useNetInfo();
  const [monitoredNetInfo, setMonitoredNetInfo] =
    useState<NetInfoState>(netInfo);

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

  return monitoredNetInfo;
}
