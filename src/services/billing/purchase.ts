import { Platform, Linking } from "react-native";
import Purchases from "react-native-purchases";
import {
  isBillingDisabled,
  isRevenueCatConfigured,
  rcLogIn,
} from "@/services/billing/revenuecat";
import { resolveE2EBillingPurchaseResult } from "@/services/e2e/fixtures";

export type PurchaseErrorCode =
  | "billing_not_initialized"
  | "billing_unavailable"
  | "sign_in_required"
  | "login_failed"
  | "no_offerings"
  | "entitlement_inactive"
  | "network"
  | "purchase_not_allowed"
  | "store_problem"
  | "unknown";

type PurchaseResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "unavailable"; errorCode: "billing_unavailable" }
  | { status: "error"; errorCode: PurchaseErrorCode; message?: string };

type PurchaseErrorMeta = {
  message?: string;
  code?: string | number;
  userCancelled?: boolean;
  readableErrorCode?: string;
};

function log(...args: unknown[]) {
  if (__DEV__) console.log("[IAP]", ...args);
}

function errToObj(e: unknown): PurchaseErrorMeta {
  if (!e || typeof e !== "object") return {};
  const obj = e as {
    message?: unknown;
    code?: unknown;
    userCancelled?: unknown;
    readableErrorCode?: unknown;
  };
  return {
    message: typeof obj.message === "string" ? obj.message : undefined,
    code:
      typeof obj.code === "string" || typeof obj.code === "number"
        ? obj.code
        : undefined,
    userCancelled: typeof obj.userCancelled === "boolean" ? obj.userCancelled : undefined,
    readableErrorCode:
      typeof obj.readableErrorCode === "string" ? obj.readableErrorCode : undefined,
  };
}

function normalizeErrorTag(meta: PurchaseErrorMeta): string {
  const codeText = meta.code != null ? String(meta.code).toUpperCase() : "";
  const readable = (meta.readableErrorCode || "").toUpperCase();
  return `${readable} ${codeText} ${(meta.message || "").toUpperCase()}`;
}

function mapPurchaseError(meta: PurchaseErrorMeta): PurchaseErrorCode {
  const tag = normalizeErrorTag(meta);
  if (tag.includes("NETWORK")) return "network";
  if (tag.includes("PURCHASE_NOT_ALLOWED")) return "purchase_not_allowed";
  if (
    tag.includes("STORE_PROBLEM") ||
    tag.includes("INVALID_RECEIPT") ||
    tag.includes("PRODUCT_NOT_AVAILABLE") ||
    tag.includes("PURCHASE_INVALID") ||
    tag.includes("SANDBOX RECEIPT USED IN PRODUCTION")
  ) {
    return "store_problem";
  }
  return "unknown";
}

export async function startOrRenewSubscription(
  uid?: string | null,
): Promise<PurchaseResult> {
  const e2eResult = resolveE2EBillingPurchaseResult("purchase");
  if (e2eResult) return e2eResult;

  if (isBillingDisabled()) {
    return { status: "unavailable", errorCode: "billing_unavailable" };
  }

  if (!uid) {
    return {
      status: "error",
      errorCode: "sign_in_required",
      message: "You must be signed in to start a subscription.",
    };
  }

  const loggedIn = await rcLogIn(uid);
  if (!loggedIn) {
    return {
      status: "error",
      errorCode: "login_failed",
      message: "Unable to sign in to billing. Please try again.",
    };
  }

  if (!isRevenueCatConfigured()) {
    return {
      status: "error",
      errorCode: "billing_not_initialized",
      message: "Billing not initialized (RevenueCat not configured).",
    };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    log("getOfferings", {
      hasCurrent: !!current,
      packages: current?.availablePackages.map((p) => ({
        id: p.identifier,
        type: p.packageType,
        productId: p.product?.identifier,
        price: p.product?.priceString,
      })),
    });

    if (!current || current.availablePackages.length === 0) {
      return {
        status: "error",
        errorCode: "no_offerings",
        message: "No offerings available.",
      };
    }

    const selected =
      current.availablePackages.find((p) => p.packageType === "MONTHLY") ??
      current.availablePackages[0];

    const { customerInfo } = await Purchases.purchasePackage(selected);
    const premium = !!customerInfo.entitlements.active["premium"];

    log("purchase result", {
      premium,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    });

    if (!premium) {
      return {
        status: "error",
        errorCode: "entitlement_inactive",
        message: "Purchase completed but entitlement not active.",
      };
    }

    return { status: "success" };
  } catch (e: unknown) {
    const meta = errToObj(e);
    log("purchase FAILED", meta);
    if (meta.userCancelled) return { status: "cancelled" };
    return {
      status: "error",
      errorCode: mapPurchaseError(meta),
      message: meta.message,
    };
  }
}

export async function restorePurchases(
  uid?: string | null,
): Promise<PurchaseResult> {
  const e2eResult = resolveE2EBillingPurchaseResult("restore");
  if (e2eResult) return e2eResult;

  if (isBillingDisabled()) {
    return { status: "unavailable", errorCode: "billing_unavailable" };
  }

  if (!uid) {
    return {
      status: "error",
      errorCode: "sign_in_required",
      message: "You must be signed in to restore purchases.",
    };
  }

  const loggedIn = await rcLogIn(uid);
  if (!loggedIn) {
    return {
      status: "error",
      errorCode: "login_failed",
      message: "Unable to sign in to billing. Please try again.",
    };
  }

  if (!isRevenueCatConfigured()) {
    return {
      status: "error",
      errorCode: "billing_not_initialized",
      message: "Billing not initialized (RevenueCat not configured).",
    };
  }

  try {
    const info = await Purchases.restorePurchases();
    const premium = !!info.entitlements.active["premium"];

    if (premium) {
      return { status: "success" };
    }

    return {
      status: "error",
      errorCode: "entitlement_inactive",
      message: "No active premium entitlement after restore.",
    };
  } catch (e: unknown) {
    const meta = errToObj(e);
    if (meta.userCancelled) return { status: "cancelled" };
    return {
      status: "error",
      errorCode: mapPurchaseError(meta),
      message: meta.message,
    };
  }
}

export async function openManageSubscriptions(): Promise<boolean> {
  try {
    if (Platform.OS === "ios") {
      await Linking.openURL("https://apps.apple.com/account/subscriptions");
      return true;
    }
    await Linking.openURL(
      "https://play.google.com/store/account/subscriptions",
    );
    return true;
  } catch {
    return false;
  }
}
