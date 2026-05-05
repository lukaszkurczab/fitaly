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
  initRevenueCat,
  isBillingDisabled,
  isRevenueCatConfigured,
  rcLogIn,
  rcLogOut,
  rcSetAttributes,
} from "@/services/billing/revenuecat";
import { useProductReadiness } from "@/hooks/useProductReadiness";
import {
  hasPremiumAccess,
  mapUnknownSubscription,
  mapPremiumToSubscription,
  resolveSubscriptionFromRevenueCat,
} from "@/services/billing/subscriptionStateMachine";
import { logWarning } from "@/services/core/errorLogger";

type PremiumContextType = {
  isPremium: boolean | null;
  subscription: Subscription | null;
  refreshPremium: () => Promise<boolean>;
  confirmPremiumEntitlement: () => Promise<{
    confirmed: boolean;
    reason?: "credits_not_premium" | "sync_tier_failed";
  }>;
};

const PREMIUM_ACTIVE_REFRESH_THROTTLE_MS = 30_000;
const PREMIUM_SYNC_TIER_TTL_MS = 15 * 60_000;

type SyncTierPolicy = "force" | "if-stale";

const PremiumContext = createContext<PremiumContextType>({
  isPremium: null,
  subscription: null,
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
  const lastActiveRefreshAtRef = useRef(0);
  const lastSyncTierAtRef = useRef(0);
  const accessRefreshInFlightRef = useRef<{
    uid: string | null;
    promise: Promise<boolean>;
  } | null>(null);
  const entitlementConfirmationInFlightRef = useRef<Promise<{
    confirmed: boolean;
    reason?: "credits_not_premium" | "sync_tier_failed";
  }> | null>(null);

  const setSubscriptionState = useCallback((next: Subscription) => {
    const premium = hasPremiumAccess(next.state);
    setIsPremium(premium);
    setSubscription(next);
  }, []);

  const setSubscriptionFromPremium = useCallback((premium: boolean) => {
    setSubscriptionState(mapPremiumToSubscription(premium));
  }, [setSubscriptionState]);

  const setSubscriptionUnknown = useCallback(() => {
    setIsPremium(null);
    setSubscription(mapUnknownSubscription());
  }, []);

  const applyAccessCredits = useCallback(
    (accessState: AccessState | null) => {
      if (accessState?.credits) {
        applyCreditsFromResponse(accessState);
      }
    },
    [applyCreditsFromResponse],
  );

  const setSubscriptionFromAccessState = useCallback(
    (accessState: AccessState | null): boolean => {
      if (
        !accessState
        || accessState.tier === "unknown"
        || accessState.entitlementStatus === "degraded"
        || accessState.entitlementStatus === "unknown"
      ) {
        setSubscriptionUnknown();
        return false;
      }
      const premium = hasConfirmedPremiumAccess(accessState);
      setSubscriptionFromPremium(premium);
      return premium;
    },
    [setSubscriptionFromPremium, setSubscriptionUnknown],
  );

  const setSubscriptionFromRevenueCat = useCallback((input: {
    customerInfo: unknown;
  }): { confirmedAccess: boolean } => {
    const resolved = resolveSubscriptionFromRevenueCat({
      customerInfo: input.customerInfo,
    });
    const revenueCatPremium = hasPremiumAccess(resolved.state);
    if (revenueCatPremium) {
      setSubscriptionUnknown();
      return { confirmedAccess: false };
    }
    setSubscriptionState(resolved);
    return { confirmedAccess: false };
  }, [setSubscriptionState, setSubscriptionUnknown]);

  const checkPremiumStatus = useCallback(async (): Promise<boolean> => {
    if (!productReadyUid) {
      setSubscriptionFromPremium(false);
      return false;
    }

    if (isBillingDisabled()) {
      setSubscriptionUnknown();
      return false;
    }

    initRevenueCat();

    if (!isRevenueCatConfigured()) {
      setSubscriptionUnknown();
      return false;
    }

    try {
      const info = await Purchases.getCustomerInfo();
      const resolved = setSubscriptionFromRevenueCat({
        customerInfo: info,
      });
      return resolved.confirmedAccess;
    } catch (error) {
      logWarning("premium status check failed", null, error);
      setSubscriptionUnknown();
      return false;
    }
  }, [
    setSubscriptionFromPremium,
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
    reason?: "credits_not_premium" | "sync_tier_failed";
  }> => {
    const inFlight = entitlementConfirmationInFlightRef.current;
    if (inFlight) {
      return inFlight;
    }

    const promise = (async () => {
      if (!productReadyUid) {
        setSubscriptionFromPremium(false);
        return { confirmed: false, reason: "sync_tier_failed" as const };
      }

      if (accessRefreshInFlightRef.current?.uid === productReadyUid) {
        await accessRefreshInFlightRef.current.promise;
      }

      try {
        await post<AiCreditsResponse>("/ai/credits/sync-tier");
        lastSyncTierAtRef.current = Date.now();
      } catch (error) {
        logWarning("premium entitlement confirmation sync failed", null, error);
        setSubscriptionFromPremium(false);
        return { confirmed: false, reason: "sync_tier_failed" as const };
      }

      const access = await refreshAccess();
      applyAccessCredits(access);
      const confirmed = setSubscriptionFromAccessState(access);
      return {
        confirmed,
        ...(confirmed ? {} : { reason: "credits_not_premium" as const }),
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
    setSubscriptionFromAccessState,
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

        if (shouldRunSyncTier(params.syncTier)) {
          try {
            await post<AiCreditsResponse>("/ai/credits/sync-tier");
            lastSyncTierAtRef.current = Date.now();
          } catch (error) {
            logWarning("ai credits tier sync failed", null, error);
          }
        }

        const access = await refreshAccess();
        applyAccessCredits(access);
        return setSubscriptionFromAccessState(access);
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
      refreshPremium,
      confirmPremiumEntitlement,
    }),
    [
      isPremium,
      subscription,
      refreshPremium,
      confirmPremiumEntitlement,
    ],
  );

  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  );
};

export const usePremiumContext = () => useContext(PremiumContext);
