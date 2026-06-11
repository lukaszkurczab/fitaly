import { render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Text } from "react-native";
import { UserProfileProvider } from "@/context/UserProfileContext";
import type {
  UserAiConsent,
  UserData,
  UserReadiness,
} from "@/types";
import type { UserProfileBootstrapState } from "@/hooks/useUserProfile";

type AuthContextMock = {
  firebaseUser: { uid: string } | null;
};

const mockUseAuthContext = jest.fn<() => AuthContextMock>();
const mockUseUser = jest.fn();
const mockRunMigrations = jest.fn();
const mockStartSyncLoop = jest.fn<(uid: string) => void>();
const mockStopSyncLoop = jest.fn<() => void>();
const mockCleanupTransientOfflineAssets = jest.fn<() => Promise<void>>();
const mockEmit = jest.fn<(...args: unknown[]) => void>();
const mockOn = jest.fn<
  (
    eventName: string,
    handler: (event: { uid?: string; cloudId?: string | null }) => void,
  ) => () => void
>();
const mockEventsUnsubscribe = jest.fn<() => void>();

jest.mock("./AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@hooks/useUser", () => ({
  useUser: (uid: string) => mockUseUser(uid),
}));

jest.mock("@/services/offline/db", () => ({
  runMigrations: () => mockRunMigrations(),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  startSyncLoop: (uid: string) => mockStartSyncLoop(uid),
  stopSyncLoop: () => mockStopSyncLoop(),
}));

jest.mock("@/services/offline/fileCleanup", () => ({
  cleanupTransientOfflineAssets: () => mockCleanupTransientOfflineAssets(),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
  on: (
    eventName: string,
    handler: (event: { uid?: string; cloudId?: string | null }) => void,
  ) => mockOn(eventName, handler),
}));

const readyReadiness: UserReadiness = {
  status: "ready",
  onboardingCompletedAt: "2026-05-01T09:00:00Z",
  readyAt: "2026-05-01T10:00:00Z",
};

const needsProfileReadiness: UserReadiness = {
  status: "needs_profile",
  onboardingCompletedAt: null,
  readyAt: null,
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

function buildUserData(params: {
  readiness: UserReadiness;
  aiConsent: UserAiConsent;
}): UserData {
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
      aiConsent: params.aiConsent,
      readiness: params.readiness,
    },
  };
}

function mockUserProfileBootstrap(params: {
  userData: UserData | null;
  profileBootstrapState: UserProfileBootstrapState;
}) {
  mockUseUser.mockReturnValue({
    userData: params.userData,
    loading: false,
    profileBootstrapState: params.profileBootstrapState,
    profileBootstrapError: null,
    syncState: "synced",
    retryingProfileSync: false,
    getUserProfile: jest.fn(async () => params.userData),
    fetchUserFromCloud: jest.fn(async () => params.userData),
    updateUserProfile: jest.fn(async () => undefined),
    applyServerProfile: jest.fn(async (profile: UserData) => profile),
    retryProfileSync: jest.fn(async () => undefined),
    syncUserProfile: jest.fn(async () => undefined),
    setAvatar: jest.fn(async () => undefined),
  });
}

function renderProvider() {
  return render(
    <UserProfileProvider>
      <Text>child</Text>
    </UserProfileProvider>,
  );
}

describe("UserProfileProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({
      firebaseUser: { uid: "user-1" },
    });
    mockCleanupTransientOfflineAssets.mockResolvedValue(undefined);
    mockOn.mockReturnValue(mockEventsUnsubscribe);
    mockUserProfileBootstrap({
      userData: buildUserData({
        readiness: readyReadiness,
        aiConsent: grantedAiConsent,
      }),
      profileBootstrapState: "profileReady",
    });
  });

  it("starts user-scoped runtime sync for a profileReady ready profile with revoked AI consent", async () => {
    mockUserProfileBootstrap({
      userData: buildUserData({
        readiness: readyReadiness,
        aiConsent: revokedAiConsent,
      }),
      profileBootstrapState: "profileReady",
    });

    renderProvider();

    await waitFor(() => {
      expect(mockStartSyncLoop).toHaveBeenCalledWith("user-1");
    });
    expect(mockUseUser).toHaveBeenCalledWith("user-1");
    expect(mockStopSyncLoop).not.toHaveBeenCalled();
  });

  it("keeps the onboarding/profile guard intact for needs_profile profiles", async () => {
    mockUserProfileBootstrap({
      userData: buildUserData({
        readiness: needsProfileReadiness,
        aiConsent: grantedAiConsent,
      }),
      profileBootstrapState: "profileReady",
    });

    renderProvider();

    await waitFor(() => {
      expect(mockStopSyncLoop).toHaveBeenCalledTimes(1);
    });
    expect(mockStartSyncLoop).not.toHaveBeenCalled();
  });

  it("does not start sync before the profile bootstrap state is product-ready", async () => {
    mockUserProfileBootstrap({
      userData: buildUserData({
        readiness: readyReadiness,
        aiConsent: revokedAiConsent,
      }),
      profileBootstrapState: "profileLoading",
    });

    renderProvider();

    await waitFor(() => {
      expect(mockStopSyncLoop).toHaveBeenCalledTimes(1);
    });
    expect(mockStartSyncLoop).not.toHaveBeenCalled();
  });
});
