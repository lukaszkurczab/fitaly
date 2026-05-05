import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  AccessProvider,
  useAccessContext,
} from "@/context/AccessContext";

const mockUseAuthContext = jest.fn();
const mockGet = jest.fn<(url: string) => Promise<unknown>>();
let mockProductReadyUid: string | null = null;

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/hooks/useProductReadiness", () => ({
  useProductReadiness: () => ({
    uid: mockProductReadyUid,
  }),
}));

jest.mock("@/services/core/apiClient", () => ({
  get: (url: string) => mockGet(url),
}));

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

function accessStateSnapshot(tier: "free" | "premium") {
  const premium = tier === "premium";
  const feature = {
    enabled: premium,
    status: premium ? "enabled" : "disabled",
    reason: premium ? null : "requires_premium",
    requiredCredits: null,
    remainingCredits: null,
  };
  return {
    tier,
    entitlementStatus: premium ? "active" : "inactive",
    credits: creditsSnapshot(tier),
    features: {
      aiChat: {
        enabled: true,
        status: "enabled",
        reason: null,
        requiredCredits: 1,
        remainingCredits: tier === "premium" ? 799 : 49,
      },
      photoAnalysis: feature,
      textMealAnalysis: feature,
      weeklyReport: feature,
      fullHistory: feature,
      cloudBackup: feature,
    },
    refreshedAt: "2026-04-30T10:00:00.000Z",
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AccessProvider>{children}</AccessProvider>;
}

describe("AccessContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ uid: null });
    mockProductReadyUid = null;
    mockGet.mockResolvedValue(accessStateSnapshot("free"));
  });

  it("does not derive access state from a credits-only response", () => {
    const { result } = renderHook(() => useAccessContext(), { wrapper });

    act(() => {
      const applied = result.current.applyAccessFromResponse(
        creditsSnapshot("premium"),
      );
      expect(applied).toBeNull();
    });

    expect(result.current.accessState).toBeNull();
  });

  it("applies canonical access-state responses", () => {
    const { result } = renderHook(() => useAccessContext(), { wrapper });
    const premiumAccess = accessStateSnapshot("premium");

    act(() => {
      const applied = result.current.applyAccessFromResponse(premiumAccess);
      expect(applied).toMatchObject({
        tier: "premium",
        entitlementStatus: "active",
        credits: {
          tier: "premium",
          balance: 800,
        },
      });
    });

    expect(result.current.accessState?.tier).toBe("premium");
    expect(result.current.accessState?.entitlementStatus).toBe("active");
  });

  it("refreshes from /billing/access-state as the canonical contract", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockProductReadyUid = "user-1";
    mockGet.mockResolvedValue(accessStateSnapshot("premium"));

    const { result } = renderHook(() => useAccessContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.accessState?.tier).toBe("premium");
    });

    expect(mockGet).toHaveBeenCalledWith("/billing/access-state");
    expect(result.current.accessState?.entitlementStatus).toBe("active");
  });

  it("does not refresh access before product readiness", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockProductReadyUid = null;

    const { result, rerender } = renderHook(() => useAccessContext(), { wrapper });

    await act(async () => {
      await result.current.refreshAccess();
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.accessState).toBeNull();

    mockProductReadyUid = "user-1";
    rerender(undefined);

    await waitFor(() => {
      expect(result.current.accessState?.tier).toBe("free");
    });
    expect(mockGet).toHaveBeenCalledWith("/billing/access-state");
  });
});
