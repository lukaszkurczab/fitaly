import { act, renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { useManageSubscriptionState } from "@/feature/Subscription/hooks/useManageSubscriptionState";

const mockStartOrRenewSubscription =
  jest.fn<(uid?: string | null) => Promise<unknown>>();
const mockRestorePurchases = jest.fn<(uid?: string | null) => Promise<unknown>>();

jest.mock("@/services/billing/purchase", () => ({
  openManageSubscriptions: jest.fn(async () => true),
  restorePurchases: (uid?: string | null) => mockRestorePurchases(uid),
  startOrRenewSubscription: (uid?: string | null) =>
    mockStartOrRenewSubscription(uid),
}));

jest.mock("@/services/billing/revenuecat", () => ({
  hasRevenueCatApiKey: () => true,
  isBillingDisabled: () => false,
}));

jest.mock("@/utils/legalUrls", () => ({
  getTermsUrl: () => "https://example.com/terms",
}));

jest.mock("expo-constants", () => ({
  expoConfig: { extra: { privacyUrl: "https://example.com/privacy" } },
}));

const mockTrack = jest.fn();

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackEntitlementConfirmationFailed: (...args: unknown[]) =>
    mockTrack("entitlement_confirmation_failed", ...args),
  trackEntitlementConfirmed: (...args: unknown[]) =>
    mockTrack("entitlement_confirmed", ...args),
  trackPaywallViewed: (...args: unknown[]) => mockTrack("paywall_view", ...args),
  trackPurchaseStarted: (...args: unknown[]) =>
    mockTrack("purchase_started", ...args),
  trackPurchaseSucceeded: (...args: unknown[]) =>
    mockTrack("purchase_succeeded", ...args),
  trackRestoreFailed: (...args: unknown[]) =>
    mockTrack("restore_failed", ...args),
  trackRestoreStarted: (...args: unknown[]) =>
    mockTrack("restore_started", ...args),
  trackRestoreSucceeded: (...args: unknown[]) =>
    mockTrack("restore_succeeded", ...args),
}));

function t(_key: string, options?: Record<string, unknown>): string {
  return typeof options?.defaultValue === "string" ? options.defaultValue : _key;
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-1",
    subscriptionState: "free_active",
    refreshPremium: jest.fn(async () => false),
    confirmPremiumEntitlement: jest.fn(async () => ({ confirmed: true })),
    t,
    ...overrides,
  };
}

describe("useManageSubscriptionState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartOrRenewSubscription.mockResolvedValue({ status: "success" });
    mockRestorePurchases.mockResolvedValue({ status: "success" });
  });

  it("keeps purchase success pending when backend entitlement confirmation fails", async () => {
    const confirmPremiumEntitlement = jest.fn(async () => ({
      confirmed: false,
      reason: "credits_not_premium" as const,
    }));
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams({ confirmPremiumEntitlement })),
    );

    await act(async () => {
      await result.current.trySubscribe();
    });

    expect(mockStartOrRenewSubscription).toHaveBeenCalledWith("user-1");
    expect(confirmPremiumEntitlement).toHaveBeenCalledTimes(1);
    expect(result.current.actionFeedback).toMatchObject({
      tone: "warning",
      title: "Confirmation pending",
      source: "purchase",
    });
    expect(result.current.actionFeedback?.title).not.toBe("Premium active");
    expect(mockTrack).toHaveBeenCalledWith(
      "entitlement_confirmation_failed",
      { source: "purchase", reason: "credits_not_premium" },
    );
    expect(mockTrack).not.toHaveBeenCalledWith(
      "entitlement_confirmed",
      expect.anything(),
    );
  });

  it("shows final purchase success after access-state premium active confirmation", async () => {
    const confirmPremiumEntitlement = jest.fn(async () => ({ confirmed: true }));
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams({ confirmPremiumEntitlement })),
    );

    await act(async () => {
      await result.current.trySubscribe();
    });

    expect(result.current.actionFeedback).toMatchObject({
      tone: "success",
      title: "Premium active",
      source: "purchase",
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "entitlement_confirmed",
      { source: "purchase" },
    );
  });

  it("emits sync-tier failure when purchase succeeds but confirmation call fails", async () => {
    const confirmPremiumEntitlement = jest.fn(async () => ({
      confirmed: false,
      reason: "sync_tier_failed" as const,
    }));
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams({ confirmPremiumEntitlement })),
    );

    await act(async () => {
      await result.current.trySubscribe();
    });

    expect(result.current.actionFeedback).toMatchObject({
      tone: "warning",
      title: "Confirmation pending",
      source: "purchase",
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "entitlement_confirmation_failed",
      { source: "purchase", reason: "sync_tier_failed" },
    );
    expect(mockTrack).not.toHaveBeenCalledWith(
      "entitlement_confirmed",
      expect.anything(),
    );
  });

  it("keeps restore success pending when backend entitlement confirmation fails", async () => {
    const confirmPremiumEntitlement = jest.fn(async () => ({
      confirmed: false,
      reason: "credits_not_premium" as const,
    }));
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams({ confirmPremiumEntitlement })),
    );

    await act(async () => {
      await result.current.tryRestore();
    });

    expect(mockRestorePurchases).toHaveBeenCalledWith("user-1");
    expect(result.current.actionFeedback).toMatchObject({
      tone: "warning",
      title: "Confirmation pending",
      source: "restore",
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "restore_succeeded",
      { confirmed: false },
    );
  });

  it("uses full entitlement confirmation for retry from manage subscription", async () => {
    const refreshPremium = jest.fn(async () => false);
    const confirmPremiumEntitlement = jest.fn(async () => ({
      confirmed: false,
      reason: "access_unknown_degraded" as const,
    }));
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams({
        subscriptionState: "unknown",
        refreshPremium,
        confirmPremiumEntitlement,
      })),
    );

    await act(async () => {
      await result.current.tryRefreshPremium();
    });

    expect(refreshPremium).not.toHaveBeenCalled();
    expect(confirmPremiumEntitlement).toHaveBeenCalledTimes(1);
    expect(result.current.actionFeedback).toMatchObject({
      tone: "warning",
      title: "Cannot confirm premium right now",
      source: "manage",
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "entitlement_confirmation_failed",
      { source: "manage_subscription", reason: "access_unknown_degraded" },
    );
  });

  it("tracks paywall view with source and trigger source", async () => {
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams()),
    );

    await act(async () => {
      result.current.openPaywall();
    });

    expect(mockTrack).toHaveBeenCalledWith("paywall_view", {
      source: "manage_subscription",
      triggerSource: "manage_subscription_screen",
    });
  });
});
