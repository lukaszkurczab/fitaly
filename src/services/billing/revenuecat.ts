import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import * as Device from "expo-device";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { logWarning } from "@/services/core/errorLogger";

let configured = false;

type RevenueCatExtra = {
  billingDisabled: boolean;
  buildProfile?: string;
  revenuecatIosKey?: string;
  revenuecatAndroidKey?: string;
};

function getExtra() {
  const config = getRuntimeConfig();
  return {
    billingDisabled: config.billingDisabled,
    buildProfile: config.buildProfile || undefined,
    revenuecatIosKey: config.revenuecatIosKey || undefined,
    revenuecatAndroidKey: config.revenuecatAndroidKey || undefined,
  } as RevenueCatExtra;
}

export function isBillingDisabled(): boolean {
  const extra = getExtra();
  if (__DEV__) return extra.billingDisabled || !Device.isDevice;
  return false;
}

function log(...args: unknown[]) {
  if (__DEV__) console.log("[RC]", ...args);
}

function getErrorMeta(err: unknown) {
  if (!err || typeof err !== "object") return { message: undefined, code: undefined };
  const obj = err as { message?: unknown; code?: unknown; userInfo?: unknown };
  return {
    message: typeof obj.message === "string" ? obj.message : undefined,
    code: typeof obj.code === "string" ? obj.code : undefined,
    userInfo: obj.userInfo,
  };
}

export function initRevenueCat() {
  if (configured) {
    log("initRevenueCat: already configured");
    return;
  }

  const extra = getExtra();
  const disabled = isBillingDisabled();

  const iosKey = extra.revenuecatIosKey;
  const androidKey = extra.revenuecatAndroidKey;

  const apiKey = Platform.OS === "ios" ? iosKey : androidKey;

  log("initRevenueCat: start", {
    platform: Platform.OS,
    isDevice: Device.isDevice,
    __DEV__,
    billingDisabled: disabled,
    iosKeyLen: iosKey?.length ?? 0,
    androidKeyLen: androidKey?.length ?? 0,
    hasSelectedKey: !!apiKey,
  });

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

  if (!apiKey) {
    log("❌ RevenueCat API key MISSING – check app.config extra + EAS env");
    logWarning("revenuecat configuration missing api key", {
      platform: Platform.OS,
      buildProfile: extra.buildProfile || "unknown",
      hasIosKey: !!iosKey,
      hasAndroidKey: !!androidKey,
    });
    configured = false;
    return;
  }

  if (disabled) {
    log("RevenueCat disabled by config");
    configured = false;
    return;
  }

  try {
    Purchases.configure({
      apiKey,
      appUserID: null,
    });

    configured = true;
    log("✅ Purchases.configure OK");
  } catch (e: unknown) {
    const meta = getErrorMeta(e);
    configured = false;
    logWarning("revenuecat configure failed", {
      platform: Platform.OS,
      code: meta.code,
      userInfo: meta.userInfo,
    }, e);
    log("❌ Purchases.configure FAILED", {
      message: meta.message,
      code: meta.code,
      userInfo: meta.userInfo,
    });
  }
}

export function isRevenueCatConfigured() {
  return configured;
}

export async function rcLogIn(uid: string): Promise<boolean> {
  initRevenueCat();
  if (!isRevenueCatConfigured()) return false;

  try {
    await Purchases.logIn(uid);
    log("rcLogIn OK", { uid });
    return true;
  } catch (e: unknown) {
    const meta = getErrorMeta(e);
    logWarning("revenuecat login failed", { uid, code: meta.code }, e);
    log("rcLogIn FAILED", { message: meta.message, code: meta.code });
    return false;
  }
}

export async function rcLogOut(): Promise<void> {
  initRevenueCat();
  if (!isRevenueCatConfigured()) return;

  try {
    await Purchases.logOut();
    log("rcLogOut OK");
  } catch (e: unknown) {
    const meta = getErrorMeta(e);
    log("rcLogOut FAILED", { message: meta.message, code: meta.code });
  }
}

export async function rcSetAttributes(
  attrs: Record<string, string | null>,
): Promise<void> {
  initRevenueCat();
  if (!isRevenueCatConfigured()) return;

  try {
    const filtered: Record<string, string> = {};
    Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (typeof v === "string" && v.length > 0) filtered[k] = v;
    });

    await Purchases.setAttributes(filtered);
    log("rcSetAttributes OK", { keys: Object.keys(filtered) });
  } catch (e: unknown) {
    const meta = getErrorMeta(e);
    log("rcSetAttributes FAILED", { message: meta.message, code: meta.code });
  }
}
