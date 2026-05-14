import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AppState } from "react-native";
import { PremiumProvider, usePremiumContext } from "@/context/PremiumContext";

type AppStateHandler = (state: string) => void;

const mockUseAuthContext = jest.fn();
const mockRefreshCredits = jest.fn<() => Promise<unknown>>();
const mockApplyCreditsFromResponse = jest.fn<(value: unknown) => unknown>();
const mockRefreshAccess = jest.fn<() => Promise<unknown>>();
const mockPost = jest.fn<(url: string) => Promise<unknown>>();
const mockGetCustomerInfo = jest.fn<() => Promise<unknown>>();
const mockRcLogIn = jest.fn<(uid: string) => Promise<boolean>>();
const mockRcLogOut = jest.fn<() => Promise<void>>();
const mockRcSetAttributes = jest.fn<
  (attrs: Record<string, string | null>) => Promise<void>
>();
const mockIsBillingDisabled = jest.fn(() => false);
const mockIsRevenueCatConfigured = jest.fn(() => true);
const mockAppStateRemove = jest.fn();
let appStateHandler: AppStateHandler | null = null;
let mockProductReadyUid: string | null = null;

function creditsSnapshot(tier: "free" | "premium") {
  return {
    userId: "user-1",
    tier,
    balance: tier === "premium" ? 800 : 50,
    allocation: tier === "premium" ? 800 : 50,
    periodStartAt: "2026-04-01T00:00:00.000Z",
    periodEndAt: "2026-05-01T00:00:00.000Z",
    costs: {
      chat: 1,
      textMeal: 5,
      photo: 10,
    },
  };
}

function accessStateSnapshot(
  tier: "free" | "premium" | "unknown",
  entitlementStatus: "active" | "inactive" | "degraded" | "unknown",
) {
  const feature = {
    enabled: tier === "premium" && entitlementStatus === "active",
    status: tier === "premium" && entitlementStatus === "active"
      ? "enabled"
      : "disabled",
    reason: tier === "premium" && entitlementStatus === "active"
      ? null
      : "requires_premium",
    requiredCredits: null,
    remainingCredits: null,
  };
  return {
    tier,
    entitlementStatus,
    credits: tier === "unknown" ? null : creditsSnapshot(tier),
    features: {
      aiChat: feature,
      photoAnalysis: feature,
      textMealAnalysis: feature,
      weeklyReport: feature,
      fullHistory: feature,
      cloudBackup: feature,
    },
    refreshedAt: "2026-04-30T10:00:00.000Z",
  };
}

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/hooks/useProductReadiness", () => ({
  useProductReadiness: () => ({
    uid: mockProductReadyUid,
  }),
}));

jest.mock("@/context/AiCreditsContext", () => ({
  useAiCreditsContext: () => ({
    applyCreditsFromResponse: mockApplyCreditsFromResponse,
    refreshCredits: mockRefreshCredits,
  }),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => ({
    refreshAccess: mockRefreshAccess,
  }),
}));

jest.mock("@/services/core/apiClient", () => ({
  post: (url: string) => mockPost(url),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
}));

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    getCustomerInfo: () => mockGetCustomerInfo(),
  },
}));

jest.mock("@/services/billing/revenuecat", () => ({
  initRevenueCat: jest.fn(),
  isBillingDisabled: () => mockIsBillingDisabled(),
  isRevenueCatConfigured: () => mockIsRevenueCatConfigured(),
  rcLogIn: (uid: string) => mockRcLogIn(uid),
  rcLogOut: () => mockRcLogOut(),
  rcSetAttributes: (attrs: Record<string, string | null>) => mockRcSetAttributes(attrs),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <PremiumProvider>{children}</PremiumProvider>;
}

describe("PremiumContext", () => {
  type AsyncStorageMock = {
    getItem: jest.MockedFunction<(key: string) => Promise<string | null>>;
  };

  const asyncStorage = (
    jest.requireMock("@react-native-async-storage/async-storage") as AsyncStorageMock
  );
  let nowMs = 1_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateHandler = null;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      appStateHandler = handler as AppStateHandler;
      return {
        remove: mockAppStateRemove,
      };
    });
    mockUseAuthContext.mockReturnValue({ uid: "user-1", email: "a@b.com" });
    mockProductReadyUid = "user-1";
    mockGetCustomerInfo.mockResolvedValue({
      entitlements: { active: { premium: { identifier: "premium" } } },
    });
    mockPost.mockResolvedValue({});
    mockRefreshAccess.mockResolvedValue(accessStateSnapshot("free", "inactive"));
    mockRefreshCredits.mockResolvedValue(null);
    mockApplyCreditsFromResponse.mockReturnValue(null);
    mockRcLogIn.mockResolvedValue(true);
    mockRcLogOut.mockResolvedValue(undefined);
    mockRcSetAttributes.mockResolvedValue(undefined);
    asyncStorage.getItem.mockResolvedValue(null);
    nowMs = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => nowMs);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("syncs ai credits tier when refreshPremium is called", async () => {
    const { result } = renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.refreshPremium();
    });

    expect(mockPost).toHaveBeenCalledWith("/ai/credits/sync-tier");
    expect(mockRefreshAccess).toHaveBeenCalled();
  });

  it("does not run premium bootstrap before product readiness", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1", email: "a@b.com" });
    mockProductReadyUid = null;

    const { result, rerender } = renderHook(() => usePremiumContext(), { wrapper });

    await act(async () => {
      await result.current.refreshPremium();
    });

    expect(mockRcLogIn).not.toHaveBeenCalled();
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockRefreshAccess).not.toHaveBeenCalled();

    mockProductReadyUid = "user-1";
    rerender(undefined);

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalled();
    });
    expect(mockRcLogIn).toHaveBeenCalledWith("user-1");
  });

  it("confirms premium only from canonical access-state after sync-tier", async () => {
    mockPost.mockResolvedValue(creditsSnapshot("premium"));
    mockRefreshAccess.mockResolvedValue(accessStateSnapshot("premium", "active"));

    const { result } = renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalled();
    });

    let confirmed = false;
    await act(async () => {
      confirmed = (await result.current.confirmPremiumEntitlement()).confirmed;
    });

    expect(confirmed).toBe(true);
    expect(mockPost).toHaveBeenCalledWith("/ai/credits/sync-tier");
    expect(mockRefreshAccess).toHaveBeenCalled();
    expect(mockApplyCreditsFromResponse).toHaveBeenCalledWith(
      accessStateSnapshot("premium", "active"),
    );
    expect(result.current.isPremium).toBe(true);
    expect(result.current.subscription?.state).toBe("premium_active");
  });

  it("does not confirm premium when sync-tier returns premium but access-state is degraded", async () => {
    mockPost.mockResolvedValue(creditsSnapshot("premium"));
    mockRefreshAccess.mockResolvedValue(accessStateSnapshot("free", "degraded"));

    const { result } = renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalled();
    });

    let confirmation: Awaited<ReturnType<typeof result.current.confirmPremiumEntitlement>>;
    await act(async () => {
      confirmation = await result.current.confirmPremiumEntitlement();
    });

    expect(confirmation!).toEqual({
      confirmed: false,
      reason: "access_unknown_degraded",
    });
    expect(result.current.isPremium).toBeNull();
    expect(result.current.subscription?.state).toBe("premium_pending_confirmation");
  });

  it("dedupes concurrent premium entitlement confirmations", async () => {
    let resolveSync: ((value: unknown) => void) | null = null;
    mockRefreshAccess.mockResolvedValue(accessStateSnapshot("premium", "active"));

    const { result } = renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockRefreshAccess).toHaveBeenCalled();
    });

    mockPost.mockClear();
    mockPost.mockReturnValue(
      new Promise((resolve) => {
        resolveSync = resolve;
      }),
    );
    let first: Promise<{ confirmed: boolean }>;
    let second: Promise<{ confirmed: boolean }>;
    act(() => {
      first = result.current.confirmPremiumEntitlement();
      second = result.current.confirmPremiumEntitlement();
    });

    expect(first!).toBe(second!);
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveSync?.(creditsSnapshot("premium"));
      await first!;
    });

    expect(result.current.isPremium).toBe(true);
    expect(result.current.subscription?.state).toBe("premium_active");
  });

  it("keeps active RevenueCat entitlement pending when sync-tier confirmation fails", async () => {
    const { result } = renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    mockPost.mockClear();
    mockPost.mockRejectedValueOnce(new Error("sync failed"));

    let confirmed = true;
    await act(async () => {
      confirmed = (await result.current.confirmPremiumEntitlement()).confirmed;
    });

    expect(confirmed).toBe(false);
    expect(result.current.isPremium).toBeNull();
    expect(result.current.subscription?.state).toBe("premium_pending_confirmation");
    expect(result.current.premiumIssueReason).toBe("sync_tier_failed");
  });

  it("reports uid mismatch without confirming premium", async () => {
    mockGetCustomerInfo.mockResolvedValue({
      originalAppUserId: "other-user",
      entitlements: { active: { premium: { identifier: "premium" } } },
    });
    const { result } = renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalled();
    });

    let confirmation: Awaited<ReturnType<typeof result.current.confirmPremiumEntitlement>>;
    await act(async () => {
      confirmation = await result.current.confirmPremiumEntitlement();
    });

    expect(confirmation!).toEqual({
      confirmed: false,
      reason: "uid_mismatch",
    });
    expect(mockPost).not.toHaveBeenCalledWith("/ai/credits/sync-tier");
    expect(result.current.subscription?.state).toBe("premium_pending_confirmation");
    expect(result.current.premiumIssueReason).toBe("uid_mismatch");
  });

  it("uses canonical access-state when RevenueCat fails", async () => {
    mockGetCustomerInfo.mockRejectedValueOnce(new Error("revenuecat offline"));

    const { result } = renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.subscription?.state).toBe("free_active");
    });

    expect(result.current.isPremium).toBe(false);
    expect(result.current.subscription?.state).not.toBe("premium_active");
  });

  it("skips sync-tier API call when user is logged out", async () => {
    mockUseAuthContext.mockReturnValue({ uid: null, email: null });
    mockProductReadyUid = null;

    renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockRcLogOut).toHaveBeenCalled();
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
    expect(mockRefreshAccess).not.toHaveBeenCalled();
  });

  it("refreshes premium state when app returns to active", async () => {
    renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalledTimes(1);
    });
    expect(appStateHandler).toBeTruthy();
    mockGetCustomerInfo.mockClear();
    mockPost.mockClear();
    mockRefreshAccess.mockClear();

    await act(async () => {
      nowMs += 31_000;
      appStateHandler?.("active");
    });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalledTimes(1);
    });
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockRefreshAccess).toHaveBeenCalledTimes(1);
  });

  it("runs at most one access refresh sequence when app resumes repeatedly", async () => {
    renderHook(() => usePremiumContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalledTimes(1);
    });
    mockGetCustomerInfo.mockClear();
    mockPost.mockClear();
    mockRefreshAccess.mockClear();

    await act(async () => {
      nowMs += 31_000;
      appStateHandler?.("active");
      appStateHandler?.("active");
    });

    await waitFor(() => {
      expect(mockGetCustomerInfo).toHaveBeenCalledTimes(1);
    });
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockRefreshAccess).toHaveBeenCalledTimes(1);
  });
});
