import { useEffect, useState } from "react";
import { NativeModules, StyleSheet, Text, View } from "react-native";
import { isE2EModeEnabled } from "@/services/e2e/config";

export type E2EReadyTarget = string;

type E2EStatus =
  | { phase: "idle"; target: null }
  | { phase: "resetting"; target: null }
  | { phase: "ready"; target: E2EReadyTarget; targets: E2EReadyTarget[] };

type Listener = (status: E2EStatus) => void;

let currentStatus: E2EStatus = { phase: "idle", target: null };
const listeners = new Set<Listener>();
const DEV_MENU_E2E_PREFERENCES = {
  motionGestureEnabled: false,
  touchGestureEnabled: false,
  showsAtLaunch: false,
  showFloatingActionButton: false,
};

type DevMenuPreferencesModule = {
  setPreferencesAsync?: (settings: typeof DEV_MENU_E2E_PREFERENCES) => Promise<void>;
};

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

export function __resetE2EStatusForTests(): void {
  currentStatus = { phase: "idle", target: null };
  listeners.clear();
}

export function E2EStatusOverlay() {
  const [status, setStatus] = useState<E2EStatus>(currentStatus);

  useEffect(() => {
    if (!isE2EModeEnabled()) return;
    const devMenuPreferences = NativeModules.DevMenuPreferences as
      | DevMenuPreferencesModule
      | undefined;
    void devMenuPreferences?.setPreferencesAsync?.(DEV_MENU_E2E_PREFERENCES);
  }, []);

  useEffect(() => {
    const listener: Listener = (next) => {
      setStatus(next);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
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
