import { useEffect, useState } from "react";
import { NativeModules, StyleSheet, Text, View } from "react-native";
import { isE2EModeEnabled } from "@/services/e2e/config";

export type E2EReadyTarget = string;

export type E2EStatus =
  | { phase: "idle"; target: null }
  | { phase: "resetting"; target: null }
  | { phase: "ready"; target: E2EReadyTarget; targets: E2EReadyTarget[] }
  | { phase: "error"; target: E2EReadyTarget; targets: E2EReadyTarget[] };

type Listener = (status: E2EStatus) => void;

let currentStatus: E2EStatus = { phase: "idle", target: null };
const listeners = new Set<Listener>();
const DEV_MENU_E2E_PREFERENCES = {
  motionGestureEnabled: false,
  touchGestureEnabled: false,
  keyCommandsEnabled: false,
  showsAtLaunch: false,
  showFloatingActionButton: false,
};

type DevMenuPreferencesModule = {
  setPreferencesAsync?: (settings: typeof DEV_MENU_E2E_PREFERENCES) => Promise<void>;
};

type ExpoModulesGlobal = typeof globalThis & {
  expo?: {
    modules?: Record<string, unknown>;
  };
};

function getDevMenuPreferencesModule(): DevMenuPreferencesModule | undefined {
  const expoModule = (globalThis as ExpoModulesGlobal).expo?.modules
    ?.DevMenuPreferences as DevMenuPreferencesModule | undefined;
  if (expoModule?.setPreferencesAsync) {
    return expoModule;
  }

  return NativeModules.DevMenuPreferences as DevMenuPreferencesModule | undefined;
}

function emitStatus(next: E2EStatus): void {
  currentStatus = next;
  for (const listener of listeners) {
    listener(next);
  }
}

export function markE2EResetStarted(): void {
  if (!isE2EModeEnabled()) return;
  emitStatus({ phase: "resetting", target: null });
}

export function markE2EResetReady(target: E2EReadyTarget): void {
  if (!isE2EModeEnabled()) return;
  emitStatus({ phase: "ready", target, targets: [target] });
}

export function markE2ESeedReady(targets: E2EReadyTarget[]): void {
  if (!isE2EModeEnabled()) return;
  const safeTargets = targets.filter((target) => target.trim().length > 0);
  if (safeTargets.length === 0) return;
  emitStatus({ phase: "ready", target: safeTargets[0], targets: safeTargets });
}

export function markE2ESeedError(target: E2EReadyTarget): void {
  if (!isE2EModeEnabled()) return;
  const safeTarget = target.trim();
  if (!safeTarget) return;
  emitStatus({ phase: "error", target: safeTarget, targets: [safeTarget] });
}

export function getE2EStatus(): E2EStatus {
  return currentStatus;
}

export function subscribeE2EStatus(listener: Listener): () => void {
  if (!isE2EModeEnabled()) return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function __resetE2EStatusForTests(): void {
  currentStatus = { phase: "idle", target: null };
  listeners.clear();
}

export function E2EStatusOverlay() {
  const [status, setStatus] = useState<E2EStatus>(currentStatus);

  useEffect(() => {
    if (!isE2EModeEnabled()) return;
    const devMenuPreferences = getDevMenuPreferencesModule();
    void devMenuPreferences?.setPreferencesAsync?.(DEV_MENU_E2E_PREFERENCES);
  }, []);

  useEffect(() => {
    const listener: Listener = (next) => {
      setStatus(next);
    };
    return subscribeE2EStatus(listener);
  }, []);

  if (!isE2EModeEnabled()) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={styles.root}
      testID="e2e-booted"
    >
      {status.phase === "ready" && status.target ? (
        <Text testID="e2e-ready" style={[styles.text, styles.marker]}>
          {`e2e-ready:${status.target}`}
        </Text>
      ) : null}
      {status.phase === "ready"
        ? status.targets.map((target) => (
            <Text
              key={target}
              testID={`e2e-ready-${target}`}
              style={[styles.text, styles.marker]}
            >
              {`e2e-ready:${target}`}
            </Text>
          ))
        : null}
      {status.phase === "error" ? (
        <Text testID="e2e-error" style={[styles.text, styles.marker]}>
          {`e2e-error:${status.target}`}
        </Text>
      ) : null}
      {status.phase === "error"
        ? status.targets.map((target) => (
            <Text
              key={target}
              testID={`e2e-error-${target}`}
              style={[styles.text, styles.marker]}
            >
              {`e2e-error:${target}`}
            </Text>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 8,
    height: 8,
    overflow: "visible",
  },
  marker: {
    position: "absolute",
    right: 0,
    bottom: 0,
  },
  text: {
    color: "transparent",
    fontSize: 1,
    lineHeight: 1,
  },
});
