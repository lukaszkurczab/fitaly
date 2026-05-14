import {
  buildDegradedAccessState,
  hasConfirmedPremiumAccess,
  parseAccessState,
} from "@/services/access/accessState";
import type { AiCreditsStatus } from "@/services/ai/contracts";

function buildCredits(overrides: Partial<AiCreditsStatus> = {}): AiCreditsStatus {
  return {
    userId: "user-1",
    tier: "free",
    balance: 4,
    allocation: 100,
    periodStartAt: "2026-04-01T00:00:00Z",
    periodEndAt: "2026-05-01T00:00:00Z",
    costs: { chat: 1, textMeal: 1, photo: 5 },
    renewalAnchorSource: "free_cycle_start",
    revenueCatEntitlementId: null,
    revenueCatExpirationAt: null,
    lastRevenueCatEventId: null,
    ...overrides,
  };
}

describe("access state contract parser", () => {
  it("parses the canonical backend response", () => {
    const parsed = parseAccessState({
      tier: "free",
      entitlementStatus: "inactive",
      credits: buildCredits(),
      features: {
        aiChat: {
          enabled: true,
          status: "enabled",
          reason: null,
          requiredCredits: 1,
          remainingCredits: 3,
        },
        photoAnalysis: {
          enabled: false,
          status: "disabled",
          reason: "insufficient_credits",
          requiredCredits: 5,
          remainingCredits: 0,
        },
        textMealAnalysis: {
          enabled: true,
          status: "enabled",
          reason: null,
          requiredCredits: 1,
          remainingCredits: 3,
        },
        weeklyReport: {
          enabled: false,
          status: "disabled",
          reason: "requires_premium",
          requiredCredits: null,
          remainingCredits: null,
        },
        fullHistory: {
          enabled: false,
          status: "disabled",
          reason: "requires_premium",
          requiredCredits: null,
          remainingCredits: null,
        },
        cloudBackup: {
          enabled: false,
          status: "disabled",
          reason: "requires_premium",
          requiredCredits: null,
          remainingCredits: null,
        },
      },
      refreshedAt: "2026-04-30T10:00:00Z",
    });

    expect(parsed?.features.aiChat.enabled).toBe(true);
    expect(parsed?.features.photoAnalysis.reason).toBe("insufficient_credits");
    expect(parsed?.credits?.balance).toBe(4);
  });

  it("parses explicit degraded state without credits", () => {
    const feature = {
      enabled: false,
      status: "unknown",
      reason: "degraded",
      requiredCredits: null,
      remainingCredits: null,
    };

    const parsed = parseAccessState({
      tier: "unknown",
      entitlementStatus: "degraded",
      credits: null,
      features: {
        aiChat: feature,
        photoAnalysis: feature,
        textMealAnalysis: feature,
        weeklyReport: feature,
        fullHistory: feature,
        cloudBackup: feature,
      },
      refreshedAt: "2026-04-30T10:00:00Z",
    });

    expect(parsed?.entitlementStatus).toBe("degraded");
    expect(parsed?.features.aiChat.enabled).toBe(false);
    expect(parsed?.credits).toBeNull();
  });

  it("rejects incomplete feature maps", () => {
    expect(parseAccessState({
      tier: "free",
      entitlementStatus: "inactive",
      credits: buildCredits(),
      features: {},
      refreshedAt: "2026-04-30T10:00:00Z",
    })).toBeNull();
  });

  it("confirms premium only for premium tier with active entitlement", () => {
    const activePremium = parseAccessState({
      tier: "premium",
      entitlementStatus: "active",
      credits: buildCredits({ tier: "premium", balance: 2, allocation: 800 }),
      features: {
        aiChat: {
          enabled: true,
          status: "enabled",
          reason: null,
          requiredCredits: 1,
          remainingCredits: 1,
        },
        photoAnalysis: {
          enabled: false,
          status: "disabled",
          reason: "insufficient_credits",
          requiredCredits: 5,
          remainingCredits: 0,
        },
        textMealAnalysis: {
          enabled: true,
          status: "enabled",
          reason: null,
          requiredCredits: 1,
          remainingCredits: 1,
        },
        weeklyReport: {
          enabled: true,
          status: "enabled",
          reason: null,
          requiredCredits: null,
          remainingCredits: null,
        },
        fullHistory: {
          enabled: true,
          status: "enabled",
          reason: null,
          requiredCredits: null,
          remainingCredits: null,
        },
        cloudBackup: {
          enabled: true,
          status: "enabled",
          reason: null,
          requiredCredits: null,
          remainingCredits: null,
        },
      },
      refreshedAt: "2026-04-30T10:00:00Z",
    });
    const degradedPremium = {
      ...activePremium!,
      entitlementStatus: "degraded" as const,
    };

    expect(hasConfirmedPremiumAccess(activePremium)).toBe(true);
    expect(hasConfirmedPremiumAccess(degradedPremium)).toBe(false);
    expect(hasConfirmedPremiumAccess({
      ...activePremium!,
      tier: "free",
    })).toBe(false);
    expect(hasConfirmedPremiumAccess({
      ...activePremium!,
      credits: null,
    })).toBe(false);
  });

  it("builds explicit degraded client state when refresh fails before payload parsing", () => {
    const state = buildDegradedAccessState("2026-04-30T10:00:00Z");

    expect(state.tier).toBe("unknown");
    expect(state.entitlementStatus).toBe("degraded");
    expect(state.features.cloudBackup.status).toBe("unknown");
  });
});
