import { isE2EModeEnabled } from "@/services/e2e/config";

type ConnectivityListener = (forcedOffline: boolean) => void;

const listeners = new Set<ConnectivityListener>();
let forcedOffline = false;

function resolvedForcedOffline(): boolean {
  return isE2EModeEnabled() ? forcedOffline : false;
}

function emitConnectivityOverride() {
  const next = resolvedForcedOffline();
  for (const listener of listeners) {
    listener(next);
  }
}

export function setE2EForcedOffline(offline: boolean) {
  const next = isE2EModeEnabled() ? offline : false;
  if (forcedOffline === next) return;
  forcedOffline = next;
  emitConnectivityOverride();
}

export function isE2EForcedOffline(): boolean {
  return resolvedForcedOffline();
}

export function subscribeE2EConnectivityOverride(
  listener: ConnectivityListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
