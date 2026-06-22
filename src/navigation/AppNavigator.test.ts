import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  PRODUCT_STACK_NON_AI_SURFACE_ROUTES,
  resolveEffectiveBootstrapState,
  resolveInitialRouteName,
  shouldRenderProfileGateStack,
  shouldRenderProductStack,
} from "@/navigation/appNavigatorState";
import AppNavigator from "@/navigation/AppNavigator";
import type { RootStackParamList } from "@/navigation/navigate";
import type { UserAiConsent } from "@/types";

type RegisteredStackScreen = {
  name: keyof RootStackParamList;
  component: unknown;
  initialParams?: unknown;
};
type MockUserProfileContext = {
  profileBootstrapState: "profileReady" | "profileMissing";
  userData: {
    uid: string;
    profile: {
      readiness: {
        status: string;
      };
    };
  } | null;
};
type MockE2EStatus =
  | { phase: "idle"; target: null }
  | { phase: "resetting"; target: null }
  | { phase: "ready"; target: string; targets: string[] }
  | { phase: "error"; target: string; targets: string[] };

const mockRegisteredStackScreens: RegisteredStackScreen[] = [];
const mockNavigatorInitialRouteNames: Array<keyof RootStackParamList> = [];

let mockAuthContext = {
  authLoading: false,
  isAuthenticated: true,
  uid: "user-1",
};

let mockUserProfileContext: MockUserProfileContext = {
  profileBootstrapState: "profileReady",
  userData: {
    uid: "user-1",
    profile: {
      readiness: {
        status: "ready",
      },
    },
  },
};
let mockE2EAuthSession: { uid: string; email: string } | null = null;
let mockE2EEnabled = false;
let mockE2EStatus: MockE2EStatus = { phase: "idle", target: null };
const mockAuthLogout = jest.fn(async () => undefined);
const mockMarkE2EResetReady = jest.fn<void, [string]>();
const mockSubscribeE2EStatus = jest.fn<() => void, [unknown]>(() => jest.fn());

jest.mock("@react-navigation/stack", () => {
  const ReactActual = jest.requireActual("react") as typeof import("react");

  return {
    createStackNavigator: jest.fn(() => ({
      Navigator: ({
        children,
        initialRouteName,
      }: {
        children: React.ReactNode;
        initialRouteName: keyof RootStackParamList;
      }) => {
        mockNavigatorInitialRouteNames.push(initialRouteName);
        return ReactActual.createElement(
          ReactActual.Fragment,
          null,
          children,
        );
      },
      Screen: (props: RegisteredStackScreen) => {
        mockRegisteredStackScreens.push(props);
        return null;
      },
    })),
  };
});

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockAuthContext,
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUserProfileContext,
}));

jest.mock("@/hooks/useSignupProfileBootstrapPending", () => ({
  useSignupProfileBootstrapPending: () => false,
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => mockE2EEnabled,
}));

jest.mock("@/services/e2e/authSession", () => ({
  getE2EAuthSession: () => mockE2EAuthSession,
}));

jest.mock("@/services/e2e/status", () => ({
  getE2EStatus: () => mockE2EStatus,
  markE2EResetReady: (target: string) => mockMarkE2EResetReady(target),
  subscribeE2EStatus: (listener: unknown) => mockSubscribeE2EStatus(listener),
}));

jest.mock("@/services/gamification/streakService", () => ({
  ensureStreakDoc: jest.fn(async () => undefined),
  resetIfMissed: jest.fn(async () => undefined),
}));

jest.mock("@/services/gamification/badgeService", () => ({
  primeBadges: jest.fn(async () => undefined),
}));

jest.mock("@/services/core/errorLogger", () => ({
  logWarning: jest.fn(),
}));

jest.mock("@/feature/Auth/services/authService", () => ({
  authLogout: () => mockAuthLogout(),
}));

jest.mock("@/components/ErrorBoundary", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/feature/Home/screens/HomeScreen", () => ({
  __esModule: true,
  default: "HomeScreen",
}));
jest.mock("@/feature/Home/screens/WeeklyReportScreen", () => ({
  __esModule: true,
  default: "WeeklyReportScreen",
}));
jest.mock("@/feature/History/screens/HistoryListScreen", () => ({
  __esModule: true,
  default: "HistoryListScreen",
}));
jest.mock("@/feature/Statistics/screens/StatisticsScreen", () => ({
  __esModule: true,
  default: "StatisticsScreen",
}));
jest.mock("@/feature/Auth/screens/LoginScreen", () => ({
  __esModule: true,
  default: "LoginScreen",
}));
jest.mock("@/feature/Auth/screens/RegisterScreen", () => ({
  __esModule: true,
  default: "RegisterScreen",
}));
jest.mock("@/feature/Meals/screens/MealAddMethodScreen", () => ({
  __esModule: true,
  default: "MealAddMethodScreen",
}));
jest.mock("@feature/UserProfile/screens/UserProfileScreen", () => ({
  __esModule: true,
  default: "ProfileScreen",
}));
jest.mock("@/feature/Auth/screens/TermsScreen", () => ({
  __esModule: true,
  default: "TermsScreen",
}));
jest.mock("@/feature/Auth/screens/PrivacyScreen", () => ({
  __esModule: true,
  default: "PrivacyScreen",
}));
jest.mock("@/feature/Auth/screens/ResetPasswordScreen", () => ({
  __esModule: true,
  default: "ResetPasswordScreen",
}));
jest.mock("@/feature/Auth/screens/CheckMailboxScreen", () => ({
  __esModule: true,
  default: "CheckMailboxScreen",
}));
jest.mock("@/feature/Onboarding/screens/OnboardingScreen", () => ({
  __esModule: true,
  default: "OnboardingScreen",
}));
jest.mock("@/screens/LoadingScreen", () => ({
  __esModule: true,
  default: "LoadingScreen",
}));
jest.mock("@/feature/History/screens/MealDetailsScreen", () => ({
  __esModule: true,
  default: "MealDetailsScreen",
}));
jest.mock("@/feature/History/screens/EditHistoryMealDetailsScreen", () => ({
  __esModule: true,
  default: "EditHistoryMealDetailsScreen",
}));
jest.mock("@/feature/UserProfile/screens/EditUserDataScreen", () => ({
  __esModule: true,
  default: "EditUserDataScreen",
}));
jest.mock("@/feature/UserProfile/screens/ProfilePhotoPreviewScreen", () => ({
  __esModule: true,
  default: "ProfilePhotoPreviewScreen",
}));
jest.mock("@/feature/UserProfile/screens/AvatarCameraScreen", () => ({
  __esModule: true,
  default: "AvatarCameraScreen",
}));
jest.mock("@/feature/UserProfile/screens/UsernameChangeScreen", () => ({
  __esModule: true,
  default: "UsernameChangeScreen",
}));
jest.mock("@/feature/UserProfile/screens/ChangeEmailScreen", () => ({
  __esModule: true,
  default: "ChangeEmailScreen",
}));
jest.mock("@/feature/UserProfile/screens/ChangeEmailCheckMailboxScreen", () => ({
  __esModule: true,
  default: "ChangeEmailCheckMailboxScreen",
}));
jest.mock("@/feature/UserProfile/screens/ChangePasswordScreen", () => ({
  __esModule: true,
  default: "ChangePasswordScreen",
}));
jest.mock("@/feature/UserProfile/screens/LanguageScreen", () => ({
  __esModule: true,
  default: "LanguageScreen",
}));
jest.mock("@/feature/UserProfile/screens/SendFeedbackScreen", () => ({
  __esModule: true,
  default: "SendFeedbackScreen",
}));
jest.mock("@/feature/UserProfile/screens/LegalPrivacyHubScreen", () => ({
  __esModule: true,
  default: "LegalPrivacyHubScreen",
}));
jest.mock("@/feature/UserProfile/screens/PrivacyAiSettingsScreen", () => ({
  __esModule: true,
  default: "PrivacyAiSettingsScreen",
}));
jest.mock("@/feature/UserProfile/screens/DataAiClarityScreen", () => ({
  __esModule: true,
  default: "DataAiClarityScreen",
}));
jest.mock("@/feature/UserProfile/screens/MemoryCenterScreen", () => ({
  __esModule: true,
  default: "MemoryCenterScreen",
}));
jest.mock("@/feature/Recipes/screens/RecipeCatalogScreen", () => ({
  __esModule: true,
  default: "RecipeCatalogScreen",
}));
jest.mock("@/feature/Planning/screens/PlanningScreen", () => ({
  __esModule: true,
  default: "PlanningScreen",
}));
jest.mock("@/feature/UserProfile/screens/HelpFeedbackHubScreen", () => ({
  __esModule: true,
  default: "HelpFeedbackHubScreen",
}));
jest.mock("@/feature/UserProfile/screens/ContactSupportScreen", () => ({
  __esModule: true,
  default: "ContactSupportScreen",
}));
jest.mock("@/feature/UserProfile/screens/AppSettingsScreen", () => ({
  __esModule: true,
  default: "AppSettingsScreen",
}));
jest.mock("@/feature/Subscription/screens/ManageSubscriptionScreen", () => ({
  __esModule: true,
  default: "ManageSubscriptionScreen",
}));
jest.mock("@/feature/History/screens/SavedMealsScreen", () => ({
  __esModule: true,
  default: "SavedMealsScreen",
}));
jest.mock("@/feature/UserProfile/screens/NotificationsScreen", () => ({
  __esModule: true,
  default: "NotificationsScreen",
}));
jest.mock("@/feature/UserProfile/screens/DeleteAccountScreen", () => ({
  __esModule: true,
  default: "DeleteAccountScreen",
}));
jest.mock("@/feature/Meals/screens/MealShareScreen", () => ({
  __esModule: true,
  default: "MealShareScreen",
}));
jest.mock("@/feature/AI/screens/ChatScreen", () => ({
  __esModule: true,
  default: "ChatScreen",
}));
jest.mock("@/feature/History/screens/SavedMealsCameraScreen", () => ({
  __esModule: true,
  default: "SavedMealsCameraScreen",
}));
jest.mock("@feature/Meals/screens/AddMealScreen", () => ({
  __esModule: true,
  default: "AddMealScreen",
}));

describe("AppNavigator onboarding gate", () => {
  beforeEach(() => {
    mockRegisteredStackScreens.length = 0;
    mockNavigatorInitialRouteNames.length = 0;
    mockAuthLogout.mockResolvedValue(undefined);
    mockE2EAuthSession = null;
    mockE2EEnabled = false;
    mockE2EStatus = { phase: "idle", target: null };
    mockMarkE2EResetReady.mockClear();
    mockSubscribeE2EStatus.mockClear();
    mockAuthContext = {
      authLoading: false,
      isAuthenticated: true,
      uid: "user-1",
    };
    mockUserProfileContext = {
      profileBootstrapState: "profileReady",
      userData: {
        uid: "user-1",
        profile: {
          readiness: {
            status: "ready",
          },
        },
      },
    };
  });

  it("starts unauthenticated users on a registered auth screen", () => {
    expect(resolveInitialRouteName("unauthenticated", undefined)).toBe("Login");
  });

  it("keeps first-run users out of the product stack until profile readiness", () => {
    expect(shouldRenderProductStack("profileReady", "needs_profile")).toBe(false);
    expect(resolveInitialRouteName("profileReady", "needs_profile")).toBe("Onboarding");
  });

  it("routes missing authenticated profiles back to Login instead of onboarding recovery", () => {
    expect(shouldRenderProfileGateStack("profileMissing")).toBe(false);
    expect(shouldRenderProductStack("profileMissing", undefined)).toBe(false);
    expect(resolveInitialRouteName("profileMissing", undefined)).toBe("Login");
  });

  it("does not auto-logout a transient missing profile for the local E2E auth session", () => {
    mockAuthContext = {
      authLoading: false,
      isAuthenticated: true,
      uid: "e2e-e2e-example-com",
    };
    mockUserProfileContext = {
      profileBootstrapState: "profileMissing",
      userData: null,
    };
    mockE2EAuthSession = {
      uid: "e2e-e2e-example-com",
      email: "e2e@example.com",
    };

    render(React.createElement(AppNavigator));

    expect(mockAuthLogout).not.toHaveBeenCalled();
  });

  it("marks E2E home ready only after the product stack renders for the E2E session", async () => {
    mockE2EEnabled = true;
    mockE2EAuthSession = {
      uid: "user-1",
      email: "e2e@example.com",
    };
    mockE2EStatus = { phase: "resetting", target: null };

    render(React.createElement(AppNavigator));

    await waitFor(() => {
      expect(mockMarkE2EResetReady).toHaveBeenCalledWith("home");
    });
  });

  it("keeps a transient missing profile on Loading during signup profile initialization", () => {
    const bootstrapState = resolveEffectiveBootstrapState({
      bootstrapState: "profileMissing",
      signupProfileBootstrapPending: true,
    });

    expect(bootstrapState).toBe("profileLoading");
    expect(shouldRenderProfileGateStack(bootstrapState)).toBe(false);
    expect(resolveInitialRouteName(bootstrapState, undefined)).toBe("Loading");
  });

  it("keeps profile bootstrap failures on the loading retry screen", () => {
    expect(shouldRenderProfileGateStack("bootstrapFailed")).toBe(false);
    expect(shouldRenderProductStack("bootstrapFailed", undefined)).toBe(false);
    expect(resolveInitialRouteName("bootstrapFailed", undefined)).toBe(
      "Loading",
    );
  });

  it("renders the product stack when profile is complete and AI consent is pending", () => {
    expect(shouldRenderProductStack("profileReady", "needs_ai_consent")).toBe(true);
    expect(resolveInitialRouteName("profileReady", "needs_ai_consent")).toBe("Home");
  });

  it("renders Home after canonical readiness", () => {
    expect(shouldRenderProductStack("profileReady", "ready")).toBe(true);
    expect(resolveInitialRouteName("profileReady", "ready")).toBe("Home");
    expect(shouldRenderProductStack("profileMissing", "ready")).toBe(false);
    expect(resolveInitialRouteName("profileMissing", "ready")).toBe("Login");
  });

  it("keeps required non-AI routes in the product stack contract for revoked AI consent profiles", () => {
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-05-01T10:00:00Z",
      revokedAt: "2026-05-02T10:00:00Z",
    } satisfies UserAiConsent;

    expect(revokedAiConsent.status).toBe("revoked");
    expect(shouldRenderProductStack("profileReady", "ready")).toBe(true);
    expect(resolveInitialRouteName("profileReady", "ready")).toBe("Home");
    expect(PRODUCT_STACK_NON_AI_SURFACE_ROUTES).toEqual([
      "Home",
      "HistoryList",
      "AddMeal",
      "Statistics",
    ]);
  });

  it("registers Privacy & AI settings in the actual product stack", () => {
    render(React.createElement(AppNavigator));

    const registeredRouteNames = mockRegisteredStackScreens.map(
      (screen) => screen.name,
    );
    const privacyAiSettingsRoute = mockRegisteredStackScreens.find(
      (screen) => screen.name === "PrivacyAiSettings",
    );

    expect(mockNavigatorInitialRouteNames).toEqual(["Home"]);
    expect(registeredRouteNames).toContain("LegalPrivacyHub");
    expect(registeredRouteNames).toContain("PrivacyAiSettings");
    expect(registeredRouteNames).toContain("DataAiClarity");
    expect(registeredRouteNames).toContain("RecipeCatalog");
    expect(registeredRouteNames).toContain("Planning");
    expect(privacyAiSettingsRoute?.component).toBe("PrivacyAiSettingsScreen");
    expect(
      mockRegisteredStackScreens.find(
        (screen) => screen.name === "RecipeCatalog",
      )?.component,
    ).toBe("RecipeCatalogScreen");
    expect(
      mockRegisteredStackScreens.find((screen) => screen.name === "Planning")
        ?.component,
    ).toBe("PlanningScreen");
    expect(
      registeredRouteNames.filter((name) => name === "PrivacyAiSettings"),
    ).toHaveLength(1);
  });
});
