import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useAuthContext } from "@/context/AuthContext";
import { useAiCreditsContext } from "@/context/AiCreditsContext";
import { useAccessContext } from "@/context/AccessContext";
import Purchases from "react-native-purchases";
import type { Subscription } from "@/types/subscription";
import { post } from "@/services/core/apiClient";
import { type AiCreditsResponse } from "@/services/ai/contracts";
import {
  hasConfirmedPremiumAccess,
  type AccessState,
} from "@/services/access/accessState";
import {
  isBillingDisabled,
  isRevenueCatConfigured,
  rcLogIn,
  rcLogOut,
  rcSetAttributes,
} from "@/services/billing/revenuecat";
import {
  getE2EAccessState,
  getE2EFixtureState,
} from "@/services/e2e/fixtures";
import { useProductReadiness } from "@/hooks/useProductReadiness";
import {
  hasPremiumAccess,
  mapPendingPremiumConfirmationToSubscription,
  mapUnknownSubscription,
  mapPremiumToSubscription,
  resolveSubscriptionFromRevenueCat,
} from "@/services/billing/subscriptionStateMachine";
import { logWarning } from "@/services/core/errorLogger";

export type PremiumEntitlementFailureReason =
  | "rc_not_configured"
  | "no_active_entitlement"
  | "sync_tier_failed"
  | "access_unknown_degraded"
  | "credits_missing"
  | "uid_mismatch"
  | "credits_not_premium";

type PremiumContextType = {
  isPremium: boolean | null;
  subscription: Subscription | null;
  premiumIssueReason: PremiumEntitlementFailureReason | null;
  refreshPremium: () => Promise<boolean>;
  confirmPremiumEntitlement: () => Promise<{
    confirmed: boolean;
    reason?: PremiumEntitlementFailureReason;
  }>;
};

const PREMIUM_ACTIVE_REFRESH_THROTTLE_MS = 30_000;
const PREMIUM_SYNC_TIER_TTL_MS = 15 * 60_000;

type SyncTierPolicy = "force" | "if-stale";

const PremiumContext = createContext<PremiumContextType>({
  isPremium: null,
  subscription: null,
  premiumIssueReason: null,
  refreshPremium: async () => false,
  confirmPremiumEntitlement: async () => ({ confirmed: false }),
});

export const PremiumProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { uid, email } = useAuthContext();
  const { uid: productReadyUid } = useProductReadiness();
  const { applyCreditsFromResponse } = useAiCreditsContext();
  const { refreshAccess } = useAccessContext();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [premiumIssueReason, setPremiumIssueReason] =
    useState<PremiumEntitlementFailureReason | null>(null);
  const lastActiveRefreshAtRef = useRef(0);
  const lastSyncTierAtRef = useRef(0);
  const revenueCatActivePremiumRef = useRef(false);
  const revenueCatUserIdRef = useRef<string | null>(null);
  const accessRefreshInFlightRef = useRef<{
    uid: string | null;
    promise: Promise<boolean>;
  } | null>(null);
  const entitlementConfirmationInFlightRef = useRef<Promise<{
    confirmed: boolean;
    reason?: PremiumEntitlementFailureReason;
  }> | null>(null);

  const setSubscriptionState = useCallback((next: Subscription) => {
    const premium = hasPremiumAccess(next.state);
    setIsPremium(premium);
    setSubscription(next);
    setPremiumIssueReason(null);
  }, []);

  const setSubscriptionFromPremium = useCallback((premium: boolean) => {
    setSubscriptionState(mapPremiumToSubscription(premium));
  }, [setSubscriptionState]);

  const setSubscriptionUnknown = useCallback(() => {
    setIsPremium(null);
    setSubscription(mapUnknownSubscription());
  }, []);

  const setSubscriptionPendingConfirmation = useCallback((
    reason: PremiumEntitlementFailureReason,
  ) => {
    setIsPremium(null);
    setSubscription(mapPendingPremiumConfirmationToSubscription());
    setPremiumIssueReason(reason);
  }, []);

  const applyAccessCredits = useCallback(
    (accessState: AccessState | null) => {
      if (accessState?.credits) {
        applyCreditsFromResponse(accessState);
      }
    },
    [applyCreditsFromResponse],
  );

  const resolveAccessFailureReason = useCallback((
    accessState: AccessState | null,
  ): PremiumEntitlementFailureReason => {
    if (!accessState) return "access_unknown_degraded";
    if (
      accessState.tier === "unknown"
      || accessState.entitlementStatus === "degraded"
      || accessState.entitlementStatus === "unknown"
    ) {
      return "access_unknown_degraded";
    }
    if (!accessState.credits) return "credits_missing";
    if (
      accessState.tier === "premium"
      || accessState.entitlementStatus === "active"
      || revenueCatActivePremiumRef.current
    ) {
      return "credits_not_premium";
    }
    return "credits_not_premium";
  }, []);

  const setSubscriptionFromAccessState = useCallback(
    (accessState: AccessState | null, options?: { preserveRevenueCatPremium?: boolean }): boolean => {
      if (
        !accessState
        || accessState.tier === "unknown"
        || accessState.entitlementStatus === "degraded"
        || accessState.entitlementStatus === "unknown"
      ) {
        if (options?.preserveRevenueCatPremium && revenueCatActivePremiumRef.current) {
          setSubscriptionPendingConfirmation(resolveAccessFailureReason(accessState));
        } else {
          setSubscriptionUnknown();
          setPremiumIssueReason(resolveAccessFailureReason(accessState));
        }
        return false;
      }
      const premium = hasConfirmedPremiumAccess(accessState);
      if (!premium && options?.preserveRevenueCatPremium && revenueCatActivePremiumRef.current) {
        setSubscriptionPendingConfirmation(resolveAccessFailureReason(accessState));
        return false;
      }
      setSubscriptionFromPremium(premium);
      return premium;
    },
    [
      resolveAccessFailureReason,
      setSubscriptionFromPremium,
      setSubscriptionPendingConfirmation,
      setSubscriptionUnknown,
    ],
  );

  const getRevenueCatDiagnostics = useCallback((
    customerInfo: unknown,
  ): {
    appUserId: string | null;
    activePremium: boolean;
    activeEntitlements: string[];
  } => {
    const info =
      customerInfo && typeof customerInfo === "object"
        ? (customerInfo as Record<string, unknown>)
        : {};
    const rawAppUserId =
      info.originalAppUserId ?? info.original_app_user_id ?? info.appUserID;
    const entitlements =
      info.entitlements && typeof info.entitlements === "object"
        ? (info.entitlements as Record<string, unknown>)
        : {};
    const active =
      entitlements.active && typeof entitlements.active === "object"
        ? (entitlements.active as Record<string, unknown>)
        : {};
    const activeEntitlements = Object.keys(active);
    return {
      appUserId:
        typeof rawAppUserId === "string" && rawAppUserId.trim()
          ? rawAppUserId.trim()
          : null,
      activePremium: Boolean(active.premium),
      activeEntitlements,
    };
  }, []);

  const setSubscriptionFromRevenueCat = useCallback((input: {
    customerInfo: unknown;
    uid: string;
  }): { confirmedAccess: boolean; reason?: PremiumEntitlementFailureReason } => {
    const diagnostics = getRevenueCatDiagnostics(input.customerInfo);
    revenueCatActivePremiumRef.current = diagnostics.activePremium;
    revenueCatUserIdRef.current = diagnostics.appUserId;

    if (
      diagnostics.appUserId
      && diagnostics.appUserId !== input.uid
      && diagnostics.activePremium
    ) {
      logWarning("revenuecat uid mismatch for active entitlement", {
        expectedUid: input.uid,
        revenueCatUid: diagnostics.appUserId,
      });
      setSubscriptionPendingConfirmation("uid_mismatch");
      return { confirmedAccess: false, reason: "uid_mismatch" };
    }

    const resolved = resolveSubscriptionFromRevenueCat({
      customerInfo: input.customerInfo,
    });
    const revenueCatPremium = hasPremiumAccess(resolved.state);
    if (revenueCatPremium) {
      setSubscriptionPendingConfirmation("sync_tier_failed");
      return { confirmedAccess: false };
    }
    setSubscriptionState(resolved);
    return { confirmedAccess: false, reason: "no_active_entitlement" };
  }, [
    getRevenueCatDiagnostics,
    setSubscriptionPendingConfirmation,
    setSubscriptionState,
  ]);

  const checkPremiumStatus = useCallback(async (): Promise<boolean> => {
    if (!productReadyUid) {
      setSubscriptionFromPremium(false);
      revenueCatActivePremiumRef.current = false;
      revenueCatUserIdRef.current = null;
      return false;
    }

    const e2eAccess = getE2EAccessState(productReadyUid);
    if (e2eAccess) {
      const premium = hasConfirmedPremiumAccess(e2eAccess);
      revenueCatActivePremiumRef.current = premium;
      revenueCatUserIdRef.current = premium ? productReadyUid : null;
      applyAccessCredits(e2eAccess);
      return setSubscriptionFromAccessState(e2eAccess);
    }

    if (isBillingDisabled()) {
      setSubscriptionUnknown();
      setPremiumIssueReason("rc_not_configured");
      return false;
    }

    const loggedIn = await rcLogIn(productReadyUid);
    if (!loggedIn || !isRevenueCatConfigured()) {
      setSubscriptionUnknown();
      setPremiumIssueReason("rc_not_configured");
      return false;
    }

    try {
      const info = await Purchases.getCustomerInfo();
      const resolved = setSubscriptionFromRevenueCat({
        customerInfo: info,
        uid: productReadyUid,
      });
      if (resolved.reason) {
        setPremiumIssueReason(resolved.reason);
      }
      return resolved.confirmedAccess;
    } catch (error) {
      logWarning("premium status check failed", null, error);
      setSubscriptionUnknown();
      setPremiumIssueReason("access_unknown_degraded");
      return false;
    }
  }, [
    applyAccessCredits,
    setSubscriptionFromPremium,
    setSubscriptionFromAccessState,
    setSubscriptionFromRevenueCat,
    setSubscriptionUnknown,
    productReadyUid,
  ]);

  const shouldRunSyncTier = useCallback((policy: SyncTierPolicy): boolean => {
    if (policy === "force") return true;
    return Date.now() - lastSyncTierAtRef.current >= PREMIUM_SYNC_TIER_TTL_MS;
  }, []);

  const confirmPremiumEntitlement = useCallback((): Promise<{
    confirmed: boolean;
    reason?: PremiumEntitlementFailureReason;
  }> => {
    const inFlight = entitlementConfirmationInFlightRef.current;
    if (inFlight) {
      return inFlight;
    }

    const promise: Promise<{
      confirmed: boolean;
      reason?: PremiumEntitlementFailureReason;
    }> = (async () => {
      if (!productReadyUid) {
        setSubscriptionFromPremium(false);
        return { confirmed: false, reason: "sync_tier_failed" as const };
      }

      const e2eBilling = getE2EFixtureState()?.billing;
      const e2eAccess = getE2EAccessState(productReadyUid);
      if (e2eAccess) {
        const shouldConfirm =
          e2eBilling === "premium" || e2eBilling === "restoreSuccess";
        revenueCatActivePremiumRef.current = shouldConfirm;
        revenueCatUserIdRef.current = shouldConfirm ? productReadyUid : null;
        applyAccessCredits(e2eAccess);
        const confirmed =
          shouldConfirm && setSubscriptionFromAccessState(e2eAccess);
        if (!confirmed) {
          const reason =
            e2eBilling === "restoreFailure"
              ? "no_active_entitlement"
              : resolveAccessFailureReason(e2eAccess);
          setPremiumIssueReason(reason);
          return { confirmed: false, reason };
        }
        return { confirmed: true };
      }

      await checkPremiumStatus();
      if (
        revenueCatActivePremiumRef.current
        && revenueCatUserIdRef.current
        && revenueCatUserIdRef.current !== productReadyUid
      ) {
        setSubscriptionPendingConfirmation("uid_mismatch");
        return { confirmed: false, reason: "uid_mismatch" as const };
      }
      if (!revenueCatActivePremiumRef.current) {
        const reason: PremiumEntitlementFailureReason = !isRevenueCatConfigured()
          ? "rc_not_configured"
          : premiumIssueReason === "uid_mismatch"
            ? premiumIssueReason
            : "no_active_entitlement";
        setPremiumIssueReason(reason);
        return { confirmed: false, reason };
      }

      if (accessRefreshInFlightRef.current?.uid === productReadyUid) {
        await accessRefreshInFlightRef.current.promise;
      }

      try {
        await post<AiCreditsResponse>("/ai/credits/sync-tier");
        lastSyncTierAtRef.current = Date.now();
      } catch (error) {
        logWarning("premium entitlement confirmation sync failed", null, error);
        setSubscriptionPendingConfirmation("sync_tier_failed");
        return { confirmed: false, reason: "sync_tier_failed" as const };
      }

      const access = await refreshAccess({ force: true });
      applyAccessCredits(access);
      const confirmed = setSubscriptionFromAccessState(access, {
        preserveRevenueCatPremium: true,
      });
      const reason = resolveAccessFailureReason(access);
      return {
        confirmed,
        ...(confirmed ? {} : { reason }),
      };
    })().finally(() => {
      if (entitlementConfirmationInFlightRef.current === promise) {
        entitlementConfirmationInFlightRef.current = null;
      }
    });

    entitlementConfirmationInFlightRef.current = promise;
    return promise;
  }, [
    applyAccessCredits,
    refreshAccess,
    checkPremiumStatus,
    premiumIssueReason,
    resolveAccessFailureReason,
    setSubscriptionFromAccessState,
    setSubscriptionPendingConfirmation,
    setSubscriptionFromPremium,
    productReadyUid,
  ]);

  const runAccessRefresh = useCallback(
    (params: { syncTier: SyncTierPolicy }): Promise<boolean> => {
      const requestUid = productReadyUid;
      const inFlight = accessRefreshInFlightRef.current;
      if (inFlight?.uid === requestUid) {
        return inFlight.promise;
      }

      const promise = (async () => {
        if (!requestUid) {
          setSubscriptionFromPremium(false);
          return false;
        }

        await checkPremiumStatus();
        if (
          revenueCatActivePremiumRef.current
          && revenueCatUserIdRef.current
          && revenueCatUserIdRef.current !== requestUid
        ) {
          setSubscriptionPendingConfirmation("uid_mismatch");
          return false;
        }

        if (shouldRunSyncTier(params.syncTier)) {
          try {
            await post<AiCreditsResponse>("/ai/credits/sync-tier");
            lastSyncTierAtRef.current = Date.now();
          } catch (error) {
            logWarning("ai credits tier sync failed", null, error);
          }
        }

        const access = await refreshAccess({ force: true });
        applyAccessCredits(access);
        return setSubscriptionFromAccessState(access, {
          preserveRevenueCatPremium: true,
        });
      })().finally(() => {
        if (accessRefreshInFlightRef.current?.promise === promise) {
          accessRefreshInFlightRef.current = null;
        }
      });

      accessRefreshInFlightRef.current = { uid: requestUid, promise };
      return promise;
    },
    [
      applyAccessCredits,
      checkPremiumStatus,
      refreshAccess,
      setSubscriptionFromAccessState,
      setSubscriptionPendingConfirmation,
      setSubscriptionFromPremium,
      shouldRunSyncTier,
      productReadyUid,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!uid || !productReadyUid) {
          await rcLogOut();
        } else {
          await rcLogIn(productReadyUid);
        }
      } finally {
        if (!cancelled) {
          await runAccessRefresh({ syncTier: "force" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    productReadyUid,
    uid,
    checkPremiumStatus,
    runAccessRefresh,
  ]);

  useEffect(() => {
    if (!uid || !productReadyUid || !email) return;
    void rcSetAttributes({
      email,
      locale: Intl.DateTimeFormat().resolvedOptions().locale || "en",
    });
  }, [email, productReadyUid, uid]);

  const refreshPremium = useCallback(
    async () => {
      return runAccessRefresh({ syncTier: "force" });
    },
    [
      runAccessRefresh,
    ],
  );

  const refreshPremiumIfStale = useCallback(async (): Promise<void> => {
    const now = Date.now();
    if (now - lastActiveRefreshAtRef.current < PREMIUM_ACTIVE_REFRESH_THROTTLE_MS) {
      return;
    }
    lastActiveRefreshAtRef.current = now;
    await runAccessRefresh({ syncTier: "if-stale" });
  }, [runAccessRefresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshPremiumIfStale();
      }
    });

    return () => {
      sub.remove();
    };
  }, [refreshPremiumIfStale]);

  const value = useMemo(
    () => ({
      isPremium,
      subscription,
      premiumIssueReason,
      refreshPremium,
      confirmPremiumEntitlement,
    }),
    [
      isPremium,
      subscription,
      premiumIssueReason,
      refreshPremium,
      confirmPremiumEntitlement,
    ],
  );

  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  );
};

export const usePremiumContext = () => useContext(PremiumContext);
