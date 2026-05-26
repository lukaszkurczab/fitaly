import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp } from "@react-native-firebase/app";
import { getAuth, signOut } from "@react-native-firebase/auth";
import { resetNavigation } from "@/navigation/navigate";
import {
  runReconnectReconcile,
  stopSyncLoop,
} from "@/services/offline/sync.engine";
import { resetOfflineStorage } from "@/services/offline/db";
import { setE2EForcedOffline } from "@/services/e2e/connectivity";
import { isE2EModeEnabled } from "@/services/e2e/config";
import {
  markE2ESeedReady,
  markE2EResetReady,
  markE2EResetStarted,
  type E2EReadyTarget,
} from "@/services/e2e/status";
import {
  applyE2ESeedCommand,
  parseE2ESeedCommand,
  resetE2EFixtureState,
} from "@/services/e2e/fixtures";

type ResetOptions = {
  forceOffline: boolean;
  logout: boolean;
};

const RESET_PATH = "fitaly://e2e/reset";
const SEED_PATH = "fitaly://e2e/seed";
const CONNECTIVITY_PATH = "fitaly://e2e/connectivity";

function parseBoolFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parseQueryParams(url: string): Record<string, string> {
  const qIndex = url.indexOf("?");
  if (qIndex < 0 || qIndex >= url.length - 1) return {};
  const query = url.slice(qIndex + 1);
  return query.split("&").reduce<Record<string, string>>((acc, pair) => {
    if (!pair) return acc;
    const [rawKey, rawValue = ""] = pair.split("=");
    const key = decodeURIComponent(rawKey || "").trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rawValue);
    return acc;
  }, {});
}

function isResetDeepLink(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized.startsWith(RESET_PATH);
}

function isSeedDeepLink(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized.startsWith(SEED_PATH);
}

function isConnectivityDeepLink(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized.startsWith(CONNECTIVITY_PATH);
}

function resolveNavigationTarget(logout: boolean): "Login" | "Home" {
  const auth = getAuth(getApp());
  return logout || !auth.currentUser ? "Login" : "Home";
}

function resetToAuthOrHome(logout: boolean): "Login" | "Home" {
  const target = resolveNavigationTarget(logout);
  if (target === "Home") {
    resetNavigation(target);
  }
  return target;
}

function toReadyTarget(
  navigationTarget: "Login" | "Home",
  forceOffline: boolean,
): E2EReadyTarget {
  if (forceOffline) return "offline";
  return navigationTarget === "Login" ? "login" : "home";
}

async function runReset(options: ResetOptions) {
  markE2EResetStarted();
  stopSyncLoop();
  setE2EForcedOffline(false);

  try {
    resetOfflineStorage();
  } catch {
    // Local db reset is best-effort and should not block flow.
  }

  try {
    await AsyncStorage.clear();
  } catch {
    // Async storage reset is best-effort for E2E runs.
  }

  try {
    await resetE2EFixtureState();
  } catch {
    // Fixture reset is best-effort and should not block existing reset flows.
  }

  if (options.logout) {
    try {
      await signOut(getAuth(getApp()));
    } catch {
      // Sign-out can fail when there is no active session.
    }
  }

  setE2EForcedOffline(options.forceOffline);
  const navigationTarget = resetToAuthOrHome(options.logout);
  markE2EResetReady(toReadyTarget(navigationTarget, options.forceOffline));
}

export async function handleE2EDeepLink(url: string): Promise<boolean> {
  if (!isE2EModeEnabled()) return false;

  if (isResetDeepLink(url)) {
    const params = parseQueryParams(url);
    const forceOffline = parseBoolFlag(params.offline, false);
    const logout = parseBoolFlag(params.logout, true);

    await runReset({ forceOffline, logout });
    return true;
  }

  if (isSeedDeepLink(url)) {
    const params = parseQueryParams(url);
    const auth = getAuth(getApp());
    const markers = await applyE2ESeedCommand({
      uid: auth.currentUser?.uid ?? null,
      command: parseE2ESeedCommand(params),
    });
    if (markers.length === 0) return false;
    markE2ESeedReady(markers);
    return true;
  }

  if (isConnectivityDeepLink(url)) {
    const params = parseQueryParams(url);
    const forceOffline = parseBoolFlag(params.offline, false);
    const auth = getAuth(getApp());
    setE2EForcedOffline(forceOffline);
    const navigationTarget = resolveNavigationTarget(false);
    if (!forceOffline && auth.currentUser?.uid) {
      try {
        await runReconnectReconcile(auth.currentUser.uid);
      } catch {
        // E2E readiness should still update so assertions can expose stale pending UI.
      }
    }
    markE2EResetReady(toReadyTarget(navigationTarget, forceOffline));
    return true;
  }

  return false;
}
