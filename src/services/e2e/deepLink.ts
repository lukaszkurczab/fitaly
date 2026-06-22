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
  markE2ESeedError,
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
import {
  clearE2EAuthSession,
  establishE2EAuthSession,
  getE2EAuthSession,
  restoreE2EAuthSession,
} from "@/services/e2e/authSession";
import { setE2EThemeMode } from "@/theme/ThemeProvider";
import type { ThemeMode } from "@/theme/themes";

type ResetOptions = {
  forceOffline: boolean;
  logout: boolean;
  themeMode: ThemeMode | null;
};

const RESET_PATH = "fitaly://e2e/reset";
const LOGIN_PATH = "fitaly://e2e/login";
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

function parseThemeMode(value: string | undefined): ThemeMode | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "light" || normalized === "dark") {
    return normalized;
  }
  return null;
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

function isLoginDeepLink(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized.startsWith(LOGIN_PATH);
}

function isConnectivityDeepLink(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized.startsWith(CONNECTIVITY_PATH);
}

function errorTarget(scope: string, error: unknown): E2EReadyTarget {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : null;
  if (typeof code !== "string") return scope;

  const normalized = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized ? `${scope}-${normalized}` : scope;
}

function seedErrorTarget(error: unknown): E2EReadyTarget {
  return errorTarget("seed", error);
}

function loginErrorTarget(error: unknown): E2EReadyTarget {
  return errorTarget("login", error);
}

function resolveNavigationTarget(logout: boolean): "Login" | "Home" {
  const auth = getAuth(getApp());
  const e2eSession = getE2EAuthSession();
  return logout || (!auth.currentUser && !e2eSession) ? "Login" : "Home";
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
  const preservedE2ESession = options.logout ? null : getE2EAuthSession();

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
  if (preservedE2ESession) {
    try {
      await restoreE2EAuthSession(preservedE2ESession);
    } catch {
      // Session restoration errors should surface through the final navigation marker.
    }
  }

  if (options.themeMode) {
    setE2EThemeMode(options.themeMode);
  }

  try {
    await resetE2EFixtureState();
  } catch {
    // Fixture reset is best-effort and should not block existing reset flows.
  }

  if (options.logout) {
    await clearE2EAuthSession();
    try {
      await signOut(getAuth(getApp()));
    } catch {
      // Sign-out can fail when there is no active session.
    }
  }

  setE2EForcedOffline(options.forceOffline);
  const navigationTarget = resetToAuthOrHome(options.logout);
  const readyTarget = toReadyTarget(navigationTarget, options.forceOffline);
  if (readyTarget !== "home") {
    markE2EResetReady(readyTarget);
  }
}

async function runLogin(params: Record<string, string>): Promise<boolean> {
  const email = params.email?.trim() ?? "";
  const password = params.password ?? undefined;
  if (!email) {
    markE2ESeedError("login-missing-email");
    return false;
  }

  markE2EResetStarted();
  try {
    await establishE2EAuthSession(email, password);
  } catch (error) {
    markE2ESeedError(loginErrorTarget(error));
    return false;
  }

  return true;
}

export async function handleE2EDeepLink(url: string): Promise<boolean> {
  if (!isE2EModeEnabled()) return false;

  if (isResetDeepLink(url)) {
    const params = parseQueryParams(url);
    const forceOffline = parseBoolFlag(params.offline, false);
    const logout = parseBoolFlag(params.logout, true);
    const themeMode = parseThemeMode(params.theme);

    await runReset({ forceOffline, logout, themeMode });
    return true;
  }

  if (isLoginDeepLink(url)) {
    return runLogin(parseQueryParams(url));
  }

  if (isSeedDeepLink(url)) {
    const params = parseQueryParams(url);
    const auth = getAuth(getApp());
    const e2eSession = getE2EAuthSession();
    let markers: string[];
    try {
      markers = await applyE2ESeedCommand({
        uid: auth.currentUser?.uid ?? e2eSession?.uid ?? null,
        command: parseE2ESeedCommand(params),
      });
    } catch (error) {
      markE2ESeedError(seedErrorTarget(error));
      return false;
    }
    if (markers.length === 0) {
      markE2ESeedError("seed-empty");
      return false;
    }
    markE2ESeedReady(markers);
    return true;
  }

  if (isConnectivityDeepLink(url)) {
    const params = parseQueryParams(url);
    const forceOffline = parseBoolFlag(params.offline, false);
    const auth = getAuth(getApp());
    const e2eSession = getE2EAuthSession();
    const uid = auth.currentUser?.uid ?? e2eSession?.uid ?? null;
    setE2EForcedOffline(forceOffline);
    const navigationTarget = resolveNavigationTarget(false);
    if (!forceOffline && uid) {
      try {
        await runReconnectReconcile(uid);
      } catch {
        // E2E readiness should still update so assertions can expose stale pending UI.
      }
    }
    markE2EResetReady(toReadyTarget(navigationTarget, forceOffline));
    return true;
  }

  return false;
}
