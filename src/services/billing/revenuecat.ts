import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import * as Device from "expo-device";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { logWarning } from "@/services/core/errorLogger";

let configured = false;
let configuredAppUserId: string | null = null;

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

export function hasRevenueCatApiKey(): boolean {
  const extra = getExtra();
  const apiKey = Platform.OS === "ios"
    ? extra.revenuecatIosKey
    : extra.revenuecatAndroidKey;
  return Boolean(apiKey);
}

export function initRevenueCat(appUserID?: string | null) {
  if (configured) {
    log("initRevenueCat: already configured", { configuredAppUserId });
    return;
  }

  const extra = getExtra();
  const disabled = isBillingDisabled();

  const iosKey = extra.revenuecatIosKey;
  const androidKey = extra.revenuecatAndroidKey;

  const apiKey = Platform.OS === "ios" ? iosKey : androidKey;

  const normalizedAppUserID =
    typeof appUserID === "string" && appUserID.trim()
      ? appUserID.trim()
      : null;

  log("initRevenueCat: start", {
    platform: Platform.OS,
    isDevice: Device.isDevice,
    __DEV__,
    billingDisabled: disabled,
    iosKeyLen: iosKey?.length ?? 0,
    androidKeyLen: androidKey?.length ?? 0,
    hasSelectedKey: !!apiKey,
    hasAppUserID: !!normalizedAppUserID,
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
    configuredAppUserId = null;
    return;
  }

  if (!normalizedAppUserID) {
    log("RevenueCat configure skipped until authenticated uid is available");
    configured = false;
    configuredAppUserId = null;
    return;
  }

  try {
    Purchases.configure({
      apiKey,
      appUserID: normalizedAppUserID,
    });

    configured = true;
    configuredAppUserId = normalizedAppUserID;
    log("✅ Purchases.configure OK", { appUserID: normalizedAppUserID });
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
  const normalizedUid = uid.trim();
  if (!normalizedUid) return false;

  initRevenueCat(normalizedUid);
  if (!isRevenueCatConfigured()) return false;

  if (configuredAppUserId === normalizedUid) {
    log("rcLogIn skipped; already configured for uid", { uid: normalizedUid });
    return true;
  }

  try {
    await Purchases.logIn(normalizedUid);
    configuredAppUserId = normalizedUid;
    log("rcLogIn OK", { uid: normalizedUid });
    return true;
  } catch (e: unknown) {
    const meta = getErrorMeta(e);
    logWarning("revenuecat login failed", { uid: normalizedUid, code: meta.code }, e);
    log("rcLogIn FAILED", { message: meta.message, code: meta.code });
    return false;
  }
}

export async function rcLogOut(): Promise<void> {
  log("rcLogOut skipped; authenticated RevenueCat users are switched with rcLogIn");
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
