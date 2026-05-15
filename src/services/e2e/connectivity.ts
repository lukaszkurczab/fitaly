import { useEffect, useMemo, useState } from "react";
import type { NetInfoState } from "@react-native-community/netinfo";
import { NetInfoStateType } from "@react-native-community/netinfo";
import { useMonitoredNetInfo } from "@/services/core/connectivityMonitor";
import { isE2EModeEnabled } from "@/services/e2e/config";

type ConnectivityListener = (forcedOffline: boolean) => void;

const listeners = new Set<ConnectivityListener>();
let forcedOffline = false;

function emitConnectivityOverride() {
  for (const listener of listeners) {
    listener(forcedOffline);
  }
}

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

export function setE2EForcedOffline(offline: boolean) {
  const next = isE2EModeEnabled() ? offline : false;
  if (forcedOffline === next) return;
  forcedOffline = next;
  emitConnectivityOverride();
}

export function useE2ENetInfo(): NetInfoState {
  const netInfo = useMonitoredNetInfo();
  const [overrideOffline, setOverrideOffline] = useState(forcedOffline);

  useEffect(() => {
    const listener: ConnectivityListener = (next) => {
      setOverrideOffline(next);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return useMemo(
    () => withForcedOffline(netInfo, overrideOffline),
    [netInfo, overrideOffline]
  );
}
