import { useEffect, useMemo, useState } from "react";
import type { NetInfoState } from "@react-native-community/netinfo";
import { NetInfoStateType } from "@react-native-community/netinfo";
import { useMonitoredNetInfo } from "@/services/core/connectivityMonitor";
import {
  isE2EForcedOffline,
  setE2EForcedOffline,
  subscribeE2EConnectivityOverride,
} from "@/services/e2e/connectivityOverride";

function withForcedOffline(state: NetInfoState, offline: boolean): NetInfoState {
  if (!offline) return state;
  return {
    ...state,
    type: NetInfoStateType.none,
    details: null,
    isConnected: false,
    isInternetReachable: false,
  };
}

export { isE2EForcedOffline, setE2EForcedOffline };

export function useE2ENetInfo(): NetInfoState {
  const netInfo = useMonitoredNetInfo();
  const [overrideOffline, setOverrideOffline] = useState(isE2EForcedOffline());

  useEffect(() => {
    return subscribeE2EConnectivityOverride(setOverrideOffline);
  }, []);

  return useMemo(
    () => withForcedOffline(netInfo, overrideOffline),
    [netInfo, overrideOffline]
  );
}
