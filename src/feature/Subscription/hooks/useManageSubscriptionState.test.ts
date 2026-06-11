import { act, renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { useManageSubscriptionState } from "@/feature/Subscription/hooks/useManageSubscriptionState";

const mockStartOrRenewSubscription =
  jest.fn<(uid?: string | null) => Promise<unknown>>();
const mockRestorePurchases = jest.fn<(uid?: string | null) => Promise<unknown>>();
const mockEmit = jest.fn();

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

jest.mock("@/services/core/events", () => {
  const on = jest.fn(() => jest.fn());

  return {
    emit: (...args: unknown[]) => mockEmit(...args),
    on,
  };
});

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
      tone: "info",
      title: "Subscription activation in progress",
      source: "purchase",
      feedbackState: "activation-pending",
      restoreState: "confirmation-pending",
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

    expect(result.current.actionFeedback).toBeNull();
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      text: "Subscription active.",
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "entitlement_confirmed",
      { source: "purchase" },
    );
  });

  it("keeps confirmed restore success available for the focused restore state", async () => {
    const confirmPremiumEntitlement = jest.fn(async () => ({ confirmed: true }));
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams({ confirmPremiumEntitlement })),
    );

    await act(async () => {
      await result.current.tryRestore();
    });

    expect(mockRestorePurchases).toHaveBeenCalledWith("user-1");
    expect(result.current.actionFeedback).toMatchObject({
      tone: "success",
      title: "Purchases restored",
      source: "restore",
    });
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      text: "Purchases restored and premium is active.",
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "restore_succeeded",
      { confirmed: true },
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
      tone: "info",
      title: "Subscription activation in progress",
      source: "purchase",
      feedbackState: "activation-pending",
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
      tone: "info",
      title: "Subscription activation in progress",
      source: "restore",
      feedbackState: "activation-pending",
      restoreState: "confirmation-pending",
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "restore_succeeded",
      { confirmed: false },
    );
  });

  it("treats no restored entitlement as a calm no-purchase-found state", async () => {
    mockRestorePurchases.mockResolvedValue({
      status: "error",
      errorCode: "entitlement_inactive",
    });
    const confirmPremiumEntitlement = jest.fn(async () => ({ confirmed: true }));
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams({ confirmPremiumEntitlement })),
    );

    await act(async () => {
      await result.current.tryRestore();
    });

    expect(mockRestorePurchases).toHaveBeenCalledWith("user-1");
    expect(confirmPremiumEntitlement).not.toHaveBeenCalled();
    expect(result.current.actionFeedback).toMatchObject({
      tone: "neutral",
      title: "No active subscription found",
      source: "restore",
      feedbackState: "no-purchase",
      restoreState: "no-purchase",
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "restore_failed",
      { reason: "entitlement_inactive" },
    );
  });

  it("keeps purchase entitlement-inactive feedback in activation pending recovery", async () => {
    mockStartOrRenewSubscription.mockResolvedValue({
      status: "error",
      errorCode: "entitlement_inactive",
    });
    const confirmPremiumEntitlement = jest.fn(async () => ({ confirmed: true }));
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams({ confirmPremiumEntitlement })),
    );

    await act(async () => {
      await result.current.trySubscribe();
    });

    expect(confirmPremiumEntitlement).not.toHaveBeenCalled();
    expect(result.current.actionFeedback).toMatchObject({
      tone: "info",
      title: "Subscription activation in progress",
      source: "purchase",
      feedbackState: "activation-pending",
      restoreState: "confirmation-pending",
    });
    expect(result.current.actionFeedback?.title).not.toBe("Subscription unavailable");
  });

  it("keeps true restore system failures as retryable restore failures", async () => {
    mockRestorePurchases.mockResolvedValue({
      status: "error",
      errorCode: "network",
    });
    const { result } = renderHook(() =>
      useManageSubscriptionState(makeParams()),
    );

    await act(async () => {
      await result.current.tryRestore();
    });

    expect(result.current.actionFeedback).toMatchObject({
      tone: "error",
      title: "Restore failed",
      source: "restore",
      feedbackState: "restore-failed",
    });
    expect(result.current.actionFeedback?.title).not.toBe(
      "Subscription activation in progress",
    );
    expect(mockTrack).toHaveBeenCalledWith(
      "restore_failed",
      { reason: "network" },
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
      title: "Access refresh did not finish",
      source: "manage",
      feedbackState: "entitlement-refresh-failed",
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
