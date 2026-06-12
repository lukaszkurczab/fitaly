import { renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  useIsProductReady,
  useProductReadiness,
} from "@/hooks/useProductReadiness";
import { PRODUCT_STACK_NON_AI_SURFACE_ROUTES } from "@/navigation/appNavigatorState";
import type { UserAiConsent, UserData, UserReadiness } from "@/types";
import type { AppBootstrapState } from "@/navigation/appNavigatorState";

const mockUseAuthContext = jest.fn();
const mockUseUserProfileContext = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserProfileContext(),
}));

const readyReadiness: UserReadiness = {
  status: "ready",
  onboardingCompletedAt: "2026-05-01T09:00:00Z",
  readyAt: "2026-05-01T10:00:00Z",
};

const needsAiConsentReadiness: UserReadiness = {
  status: "needs_ai_consent",
  onboardingCompletedAt: "2026-05-01T09:00:00Z",
  readyAt: null,
};

const needsProfileReadiness: UserReadiness = {
  status: "needs_profile",
  onboardingCompletedAt: null,
  readyAt: null,
};

const notGrantedAiConsent: UserAiConsent = {
  status: "not_granted",
  grantedAt: null,
  revokedAt: null,
};

const revokedAiConsent: UserAiConsent = {
  status: "revoked",
  grantedAt: "2026-05-01T10:00:00Z",
  revokedAt: "2026-05-02T10:00:00Z",
};

const grantedAiConsent: UserAiConsent = {
  status: "granted",
  grantedAt: "2026-05-01T10:00:00Z",
  revokedAt: null,
};

function buildUserData(
  readiness: UserReadiness,
  aiConsent: UserAiConsent,
): UserData {
  return {
    uid: "user-1",
    email: "user@example.com",
    username: "neo",
    plan: "free",
    createdAt: 1,
    lastLogin: "2026-05-01T10:00:00Z",
    syncState: "synced",
    profile: {
      language: "en",
      nutritionProfile: {
        unitsSystem: "metric",
        age: "30",
        sex: "female",
        height: "170",
        heightInch: "",
        weight: "70",
        preferences: [],
        activityLevel: "moderate",
        goal: "maintain",
        chronicDiseases: [],
        chronicDiseasesOther: "",
        allergies: [],
        allergiesOther: "",
        lifestyle: "",
        calorieTarget: 2200,
      },
      aiPreferences: {
        stylePersona: "calm_guide",
      },
      aiConsent,
      readiness,
    },
  };
}

function mockProductBootstrap(params: {
  userData: UserData | null;
  profileBootstrapState?: AppBootstrapState;
  authLoading?: boolean;
  isAuthenticated?: boolean;
}) {
  mockUseAuthContext.mockReturnValue({
    authLoading: params.authLoading ?? false,
    isAuthenticated: params.isAuthenticated ?? true,
  });
  mockUseUserProfileContext.mockReturnValue({
    userData: params.userData,
    profileBootstrapState: params.profileBootstrapState ?? "profileReady",
  });
}

describe("useProductReadiness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProductBootstrap({
      userData: buildUserData(readyReadiness, grantedAiConsent),
    });
  });

  it("keeps non-AI runtime uid available for ready profiles without granted AI consent", () => {
    mockProductBootstrap({
      userData: buildUserData(readyReadiness, notGrantedAiConsent),
    });

    const { result } = renderHook(() => useProductReadiness());

    expect(result.current).toMatchObject({
      isProductReady: true,
      canRenderProductStack: true,
      status: "ready",
      uid: "user-1",
      bootstrapState: "profileReady",
    });
  });

  it("keeps non-AI runtime uid available for ready profiles with revoked AI consent", () => {
    mockProductBootstrap({
      userData: buildUserData(readyReadiness, revokedAiConsent),
    });

    const { result } = renderHook(() => useProductReadiness());

    expect(result.current.isProductReady).toBe(true);
    expect(result.current.canRenderProductStack).toBe(true);
    expect(result.current.uid).toBe("user-1");
    expect(PRODUCT_STACK_NON_AI_SURFACE_ROUTES).toEqual([
      "Home",
      "HistoryList",
      "AddMeal",
      "Statistics",
    ]);
  });

  it("treats legacy needs_ai_consent readiness as product-stack eligible", () => {
    mockProductBootstrap({
      userData: buildUserData(needsAiConsentReadiness, notGrantedAiConsent),
    });

    const readiness = renderHook(() => useProductReadiness());
    const isProductReady = renderHook(() => useIsProductReady());

    expect(readiness.result.current).toMatchObject({
      isProductReady: true,
      canRenderProductStack: true,
      status: "needs_ai_consent",
      uid: "user-1",
      bootstrapState: "profileReady",
    });
    expect(isProductReady.result.current).toBe(true);
  });

  it("does not expose uid before the product stack can render", () => {
    mockProductBootstrap({
      userData: buildUserData(needsProfileReadiness, notGrantedAiConsent),
    });

    const { result } = renderHook(() => useProductReadiness());

    expect(result.current).toMatchObject({
      isProductReady: false,
      canRenderProductStack: false,
      status: "profileReady",
      uid: null,
      bootstrapState: "profileReady",
    });
  });
});
