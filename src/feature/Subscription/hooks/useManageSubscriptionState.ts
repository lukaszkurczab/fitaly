import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";
import Constants from "expo-constants";
import { getTermsUrl } from "@/utils/legalUrls";
import {
  openManageSubscriptions,
  restorePurchases,
  startOrRenewSubscription,
} from "@/services/billing/purchase";
import { resolvePurchaseErrorMessage } from "@/services/billing/purchaseErrorMessage";
import {
  initRevenueCat,
  isBillingDisabled,
  isRevenueCatConfigured,
} from "@/services/billing/revenuecat";
import { hasPremiumAccess } from "@/services/billing/subscriptionStateMachine";
import {
  trackEntitlementConfirmationFailed,
  trackEntitlementConfirmed,
  trackPaywallViewed,
  trackPurchaseStarted,
  trackPurchaseSucceeded,
  trackRestoreFailed,
  trackRestoreStarted,
  trackRestoreSucceeded,
} from "@/services/telemetry/telemetryInstrumentation";
import type { SubscriptionState } from "@/types/subscription";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type SubscriptionBusyAction =
  | "restore"
  | "purchase"
  | "manage"
  | null;

export type SubscriptionActionFeedback = {
  tone: "success" | "warning" | "error";
  title: string;
  message: string;
  source: Exclude<SubscriptionBusyAction, null>;
} | null;

type PremiumEntitlementConfirmationResult = {
  confirmed: boolean;
  reason?: "credits_not_premium" | "sync_tier_failed";
};

const PREMIUM_RECOVERY_STATES = new Set<SubscriptionState>([
  "premium_expired",
  "premium_paused",
  "premium_refunded",
]);

function normalizeSubscriptionState(input: {
  rawState: string;
}): SubscriptionState {
  const knownStates: SubscriptionState[] = [
    "premium_active",
    "premium_trial",
    "premium_grace",
    "premium_pending_downgrade",
    "premium_paused",
    "premium_refunded",
    "premium_expired",
    "free_active",
    "free_expired",
    "unknown",
  ];
  const raw = input.rawState as SubscriptionState;
  if (knownStates.includes(raw)) {
    return raw;
  }
  return input.rawState.startsWith("premium_") ? "premium_expired" : "free_active";
}

export function useManageSubscriptionState(params: {
  uid: string | null | undefined;
  subscriptionState?: string | null;
  refreshPremium: () => Promise<unknown>;
  confirmPremiumEntitlement: () => Promise<PremiumEntitlementConfirmationResult>;
  t: Translate;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [busyAction, setBusyAction] = useState<SubscriptionBusyAction>(null);
  const [actionFeedback, setActionFeedback] =
    useState<SubscriptionActionFeedback>(null);
  const [billingAvailability, setBillingAvailability] = useState<
    "ready" | "disabled" | "not_ready"
  >("not_ready");

  const extra = (Constants.expoConfig?.extra ?? {}) as {
    privacyUrl?: unknown;
  };
  const termsUrl = getTermsUrl();
  const privacyUrl =
    typeof extra.privacyUrl === "string" ? extra.privacyUrl : "";

  const refundUrl = useMemo(() => {
    const url = params.t("manageSubscription.refundLink", { defaultValue: "" });
    return typeof url === "string" ? url.trim() : "";
  }, [params]);

  const baseState = (params.subscriptionState || "free_active").trim();
  const isPremiumComputed = hasPremiumAccess(baseState);
  const state = normalizeSubscriptionState({
    rawState: baseState,
  });

  const showManageInStore =
    state === "premium_active"
    || state === "premium_trial"
    || state === "premium_grace"
    || state === "premium_pending_downgrade"
    || state === "unknown";
  const showRenew = PREMIUM_RECOVERY_STATES.has(state);
  const showConfirmationRetry = state === "unknown";
  const showStart = !showConfirmationRetry && !showManageInStore && !showRenew;

  const headerStatus =
    state === "premium_trial"
      ? params.t("manageSubscription.premiumTrial", {
          defaultValue: "Premium (trial)",
        })
      : state === "premium_grace"
        ? params.t("manageSubscription.premiumGrace", {
            defaultValue: "Premium (grace period)",
          })
        : state === "premium_pending_downgrade"
          ? params.t("manageSubscription.premiumPendingDowngrade", {
              defaultValue: "Premium (ending soon)",
            })
          : state === "premium_paused"
            ? params.t("manageSubscription.premiumPaused", {
                defaultValue: "Premium (paused)",
              })
            : state === "premium_refunded"
              ? params.t("manageSubscription.premiumRefunded", {
                  defaultValue: "Premium (refunded)",
                })
              : state === "premium_expired"
                ? `${params.t("manageSubscription.premium")} (${params.t("manageSubscription.expired", { defaultValue: "expired" })})`
                : state === "unknown"
                  ? params.t("manageSubscription.subscriptionUnknown", {
                      defaultValue: "Cannot confirm premium",
                    })
                  : state === "premium_active"
                  ? params.t("manageSubscription.premium")
                  : params.t("manageSubscription.free");

  const priceText = params.t("paywall.priceText", {
    defaultValue: "29,99 zł / month",
  });

  const alertBillingUnavailable = params.t(
    "manageSubscription.billingUnavailable",
    {
      defaultValue: "Billing is unavailable on this device.",
    },
  );

  useEffect(() => {
    initRevenueCat();
    setBillingAvailability(
      isBillingDisabled()
        ? "disabled"
        : isRevenueCatConfigured()
          ? "ready"
          : "not_ready",
    );
  }, []);

  const setFeedbackForError = useCallback(
    (
      source: Exclude<SubscriptionBusyAction, null>,
      message: string,
      title?: string,
    ) => {
      setActionFeedback({
        tone: "error",
        title:
          title ??
          params.t("manageSubscription.issueTitle", {
            defaultValue: "Subscription issue",
          }),
        message,
        source,
      });
    },
    [params],
  );

  const requireAuthOrAlert = useCallback(
    (source: Exclude<SubscriptionBusyAction, null>): boolean => {
      if (params.uid) return true;
      setFeedbackForError(
        source,
        params.t("manageSubscription.signInRequired", {
          defaultValue: "Please sign in to manage subscriptions.",
        }),
      );
      return false;
    },
    [params, setFeedbackForError],
  );

  const tryOpenManage = useCallback(async () => {
    setBusy(true);
    setBusyAction("manage");
    try {
      const ok = await openManageSubscriptions();
      if (!ok) {
        setFeedbackForError("manage", alertBillingUnavailable);
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }, [alertBillingUnavailable, setFeedbackForError]);

  const tryRefreshPremium = useCallback(async () => {
    if (!requireAuthOrAlert("manage")) return;

    setBusy(true);
    setBusyAction("manage");
    try {
      const confirmed = await params.refreshPremium();
      if (confirmed !== true) {
        setActionFeedback({
          tone: "warning",
          title: params.t("manageSubscription.subscriptionUnknownTitle", {
            defaultValue: "Cannot confirm premium right now",
          }),
          message: params.t("manageSubscription.subscriptionUnknownBody", {
            defaultValue:
              "We could not confirm premium with billing and backend credits. Try again, restore purchases, or manage your store subscription.",
          }),
          source: "manage",
        });
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }, [params, requireAuthOrAlert]);

  const tryRestore = useCallback(async () => {
    if (!requireAuthOrAlert("restore")) return;
    if (!params.uid) return;

    setBusy(true);
    setBusyAction("restore");
    try {
      void trackRestoreStarted();
      const res = await restorePurchases(params.uid);
      if (res.status === "success") {
        const confirmation = await params.confirmPremiumEntitlement();
        void trackRestoreSucceeded({ confirmed: confirmation.confirmed });
        if (confirmation.confirmed) {
          void trackEntitlementConfirmed({ source: "restore" });
          setActionFeedback({
            tone: "success",
            title: params.t("manageSubscription.restoreSuccessTitle", {
              defaultValue: "Premium active",
            }),
            message: params.t("manageSubscription.restoreSuccess", {
              defaultValue: "Purchases restored and premium is active.",
            }),
            source: "restore",
          });
        } else {
          void trackEntitlementConfirmationFailed({
            source: "restore",
            reason: confirmation.reason ?? "sync_tier_failed",
          });
          setActionFeedback({
            tone: "warning",
            title: params.t("manageSubscription.confirmationPendingTitle", {
              defaultValue: "Confirmation pending",
            }),
            message: params.t("manageSubscription.confirmationPending", {
              defaultValue:
                "Purchase was restored, but premium is still waiting for backend confirmation. Please try again shortly.",
            }),
            source: "restore",
          });
        }
      } else if (res.status === "cancelled") {
        return;
      } else {
        void trackRestoreFailed({ reason: res.errorCode });
        const fallback = params.t("manageSubscription.restoreFailed", {
          defaultValue: "Restore failed. Try again later.",
        });
        setFeedbackForError(
          "restore",
          resolvePurchaseErrorMessage(params.t, res.errorCode, fallback),
          params.t("manageSubscription.restoreFailedTitle", {
            defaultValue: "Restore failed",
          }),
        );
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }, [
    params,
    requireAuthOrAlert,
    setFeedbackForError,
  ]);

  const trySubscribe = useCallback(async () => {
    if (!requireAuthOrAlert("purchase")) return;
    if (!params.uid) return;

    setBusy(true);
    setBusyAction("purchase");
    try {
      void trackPurchaseStarted();
      const res = await startOrRenewSubscription(params.uid);
      if (res.status === "success") {
        void trackPurchaseSucceeded();
        const confirmation = await params.confirmPremiumEntitlement();
        if (confirmation.confirmed) {
          void trackEntitlementConfirmed({ source: "purchase" });
          setPaywallVisible(false);
          setActionFeedback({
            tone: "success",
            title: params.t("manageSubscription.purchaseSuccessTitle", {
              defaultValue: "Premium active",
            }),
            message: params.t("manageSubscription.purchaseSuccess", {
              defaultValue: "Subscription active.",
            }),
            source: "purchase",
          });
        } else {
          void trackEntitlementConfirmationFailed({
            source: "purchase",
            reason: confirmation.reason ?? "sync_tier_failed",
          });
          setActionFeedback({
            tone: "warning",
            title: params.t("manageSubscription.confirmationPendingTitle", {
              defaultValue: "Confirmation pending",
            }),
            message: params.t("manageSubscription.confirmationPending", {
              defaultValue:
                "Purchase succeeded, but premium is still waiting for backend confirmation. Please try again shortly.",
            }),
            source: "purchase",
          });
        }
      } else if (res.status === "cancelled") {
        return;
      } else {
        const fallback = params.t("manageSubscription.purchaseFailed", {
          defaultValue: "Purchase failed.",
        });
        setFeedbackForError(
          "purchase",
          resolvePurchaseErrorMessage(params.t, res.errorCode, fallback),
          params.t("manageSubscription.purchaseFailedTitle", {
            defaultValue: "Subscription unavailable",
          }),
        );
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }, [
    params,
    requireAuthOrAlert,
    setFeedbackForError,
  ]);

  const tryOpenRefundPolicy = useCallback(async () => {
    const url = refundUrl;
    if (!url || !(url.startsWith("http://") || url.startsWith("https://"))) {
      setFeedbackForError(
        "manage",
        params.t("manageSubscription.refundLinkUnavailable", {
          defaultValue: "Refund policy link is unavailable.",
        }),
      );
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      setFeedbackForError(
        "manage",
        params.t("manageSubscription.refundLinkUnavailable", {
          defaultValue: "Refund policy link is unavailable.",
        }),
      );
    }
  }, [params, refundUrl, setFeedbackForError]);

  const openPaywall = useCallback(() => {
    setActionFeedback(null);
    setPaywallVisible(true);
    void trackPaywallViewed({
      source: "manage_subscription",
      triggerSource: "manage_subscription_screen",
    });
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => (prev === key ? null : key));
  }, []);

  const openTerms = useCallback(async () => {
    if (!termsUrl) return;
    await Linking.openURL(termsUrl);
  }, [termsUrl]);

  const openPrivacy = useCallback(async () => {
    if (!privacyUrl) return;
    await Linking.openURL(privacyUrl);
  }, [privacyUrl]);

  return {
    expanded,
    busy,
    paywallVisible,
    termsUrl,
    privacyUrl,
    refundUrl,
    priceText,
    state,
    showRenew,
    showStart,
    showConfirmationRetry,
    showManageInStore,
    headerStatus,
    isPremiumComputed,
    billingAvailability,
    busyAction,
    actionFeedback,
    toggleExpanded,
    tryOpenManage,
    tryRefreshPremium,
    tryRestore,
    trySubscribe,
    tryOpenRefundPolicy,
    openPaywall,
    closePaywall,
    openTerms,
    openPrivacy,
    clearActionFeedback: () => setActionFeedback(null),
  };
}
