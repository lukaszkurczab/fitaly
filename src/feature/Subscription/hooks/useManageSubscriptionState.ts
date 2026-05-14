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
  hasRevenueCatApiKey,
  isBillingDisabled,
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
import type { PremiumEntitlementFailureReason } from "@/context/PremiumContext";

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
  reason?: PremiumEntitlementFailureReason;
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
    "premium_pending_confirmation",
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
  premiumIssueReason?: PremiumEntitlementFailureReason | null;
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
    || state === "premium_pending_confirmation"
    || state === "unknown";
  const showRenew = PREMIUM_RECOVERY_STATES.has(state);
  const showConfirmationRetry =
    state === "unknown" || state === "premium_pending_confirmation";
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
                : state === "premium_pending_confirmation"
                  ? params.t("manageSubscription.premiumPendingConfirmation", {
                      defaultValue: "Premium confirming",
                    })
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

  const confirmationFailureMessage = useCallback(
    (reason: PremiumEntitlementFailureReason | undefined): string => {
      switch (reason) {
        case "rc_not_configured":
          return params.t("manageSubscription.reasonRcNotConfigured", {
            defaultValue:
              "RevenueCat is not configured for this build. Check the production iOS/Android API key.",
          });
        case "no_active_entitlement":
          return params.t("manageSubscription.reasonNoActiveEntitlement", {
            defaultValue:
              "The store account did not return an active Premium entitlement for this user.",
          });
        case "uid_mismatch":
          return params.t("manageSubscription.reasonUidMismatch", {
            defaultValue:
              "The store entitlement is attached to a different account ID. Sign in to the original account or restore purchases again.",
          });
        case "sync_tier_failed":
          return params.t("manageSubscription.reasonSyncTierFailed", {
            defaultValue:
              "Premium was found in billing, but backend credit synchronization failed.",
          });
        case "access_unknown_degraded":
          return params.t("manageSubscription.reasonAccessDegraded", {
            defaultValue:
              "Backend access state is unavailable or degraded, so Premium cannot be confirmed yet.",
          });
        case "credits_missing":
          return params.t("manageSubscription.reasonCreditsMissing", {
            defaultValue:
              "Backend access was returned without an AI Credits balance.",
          });
        case "credits_not_premium":
          return params.t("manageSubscription.reasonCreditsNotPremium", {
            defaultValue:
              "Backend credits are still not on the Premium tier.",
          });
        default:
          return params.t("manageSubscription.reasonUnknown", {
            defaultValue:
              "Premium could not be confirmed across billing, backend access, and credits.",
          });
      }
    },
    [params],
  );

  useEffect(() => {
    setBillingAvailability(
      isBillingDisabled()
        ? "disabled"
        : hasRevenueCatApiKey()
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
      const confirmation = await params.confirmPremiumEntitlement();
      if (confirmation.confirmed) {
        void trackEntitlementConfirmed({ source: "manage_subscription" });
        setActionFeedback({
          tone: "success",
          title: params.t("manageSubscription.purchaseSuccessTitle", {
            defaultValue: "Premium active",
          }),
          message: params.t("manageSubscription.purchaseSuccess", {
            defaultValue: "Subscription active.",
          }),
          source: "manage",
        });
      } else {
        const reason =
          confirmation.reason
          ?? params.premiumIssueReason
          ?? "access_unknown_degraded";
        void trackEntitlementConfirmationFailed({
          source: "manage_subscription",
          reason,
        });
        setActionFeedback({
          tone: "warning",
          title: params.t("manageSubscription.subscriptionUnknownTitle", {
            defaultValue: "Cannot confirm premium right now",
          }),
          message: confirmationFailureMessage(reason),
          source: "manage",
        });
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }, [confirmationFailureMessage, params, requireAuthOrAlert]);

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
            message: confirmationFailureMessage(confirmation.reason),
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
    confirmationFailureMessage,
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
            message: confirmationFailureMessage(confirmation.reason),
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
    confirmationFailureMessage,
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
