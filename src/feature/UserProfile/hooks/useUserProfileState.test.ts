import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { useUserProfileState } from "@/feature/UserProfile/hooks/useUserProfileState";
import type { Badge } from "@/types/badge";

const mockRetryProfileSync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDiscardAvatarUploadDeadLetter =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockRefreshUser = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockEnsurePremiumBadges = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockAuthLogout = jest.fn<() => Promise<void>>();
const mockUseAuthContext = jest.fn(() => ({ uid: "u1" }));
const mockUseNetInfo = jest.fn(() => ({ isConnected: true }));
let mockIsPremium: boolean | null = false;
let mockBadges: Badge[] = [];
let mockSyncState: "synced" | "pending" | "dead-letter" = "synced";
let mockHasAvatarUploadDeadLetter = false;

let mockUserData: Record<string, unknown> | null = {
  uid: "u1",
  username: "neo",
  email: "u1@example.com",
  avatarUrl: "",
  avatarLocalPath: "",
  language: "en",
};
let mockLoadingUser = false;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => ({
    userData: mockUserData,
    loadingUser: mockLoadingUser,
    refreshUser: (...args: unknown[]) => mockRefreshUser(...args),
    syncState: mockSyncState,
    hasAvatarUploadDeadLetter: mockHasAvatarUploadDeadLetter,
    retryingProfileSync: false,
    retryProfileSync: (...args: unknown[]) => mockRetryProfileSync(...args),
    discardAvatarUploadDeadLetter: (...args: unknown[]) =>
      mockDiscardAvatarUploadDeadLetter(...args),
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@/context/PremiumContext", () => ({
  usePremiumContext: () => ({ isPremium: mockIsPremium }),
}));

jest.mock("@/hooks/useBadges", () => ({
  useBadges: () => ({
    badges: mockBadges,
    ensurePremiumBadges: (...args: unknown[]) => mockEnsurePremiumBadges(...args),
  }),
}));

jest.mock("@/feature/Auth/services/authService", () => ({
  authLogout: () => mockAuthLogout(),
}));

describe("feature/UserProfile/useUserProfileState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ uid: "u1" });
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockUserData = {
      uid: "u1",
      username: "neo",
      email: "u1@example.com",
      avatarUrl: "",
      avatarLocalPath: "",
      language: "en",
    };
    mockLoadingUser = false;
    mockSyncState = "synced";
    mockHasAvatarUploadDeadLetter = false;
    mockAuthLogout.mockResolvedValue(undefined);
    mockRetryProfileSync.mockResolvedValue(undefined);
    mockDiscardAvatarUploadDeadLetter.mockResolvedValue(undefined);
    mockRefreshUser.mockResolvedValue(undefined);
    mockEnsurePremiumBadges.mockResolvedValue(undefined);
    mockIsPremium = false;
    mockBadges = [];
  });

  it("logs out through the auth service", async () => {
    const navigation = { reset: jest.fn() } as never;
    const { result } = renderHook(() => useUserProfileState({ navigation }));

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(mockAuthLogout).toHaveBeenCalledTimes(1);
  });

  it("does not redirect to login when uid exists but profile is temporarily missing", async () => {
    mockUserData = null;
    const navigation = { reset: jest.fn() };
    renderHook(() => useUserProfileState({ navigation: navigation as never }));

    await waitFor(() => {
      expect(navigation.reset).not.toHaveBeenCalled();
    });
  });

  it("redirects to login when auth uid is missing", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "" });
    mockUserData = null;
    const navigation = { reset: jest.fn() };
    renderHook(() => useUserProfileState({ navigation: navigation as never }));

    await waitFor(() => {
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "Login" }],
      });
    });
  });

  it("exposes profile reload action", async () => {
    const navigation = { reset: jest.fn() };
    const { result } = renderHook(() =>
      useUserProfileState({ navigation: navigation as never }),
    );

    await act(async () => {
      await result.current.handleRetryProfileLoad();
    });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  });

  it("exposes avatar upload dead-letter marker and discard action from profile context", async () => {
    mockSyncState = "dead-letter";
    mockHasAvatarUploadDeadLetter = true;
    const navigation = { reset: jest.fn() };
    const { result } = renderHook(() =>
      useUserProfileState({ navigation: navigation as never }),
    );

    expect(result.current.syncState).toBe("dead-letter");
    expect(result.current.hasAvatarUploadDeadLetter).toBe(true);

    await act(async () => {
      await result.current.discardAvatarUploadDeadLetter();
    });

    expect(mockDiscardAvatarUploadDeadLetter).toHaveBeenCalledTimes(1);
  });

  it("hides premium badges when account is not premium", () => {
    mockIsPremium = false;
    mockBadges = [
      {
        id: "premium_start",
        type: "premium",
        label: "Premium started",
        milestone: "start",
        icon: "⭐",
        color: "#F7A541",
        unlockedAt: 1,
      },
      {
        id: "streak_7",
        type: "streak",
        label: "Streak 7",
        milestone: 7,
        icon: "🔥",
        color: "#00AA88",
        unlockedAt: 2,
      },
    ];
    const navigation = { reset: jest.fn() };
    const { result } = renderHook(() =>
      useUserProfileState({ navigation: navigation as never }),
    );

    expect(result.current.safeBadges).toEqual([
      expect.objectContaining({ id: "streak_7", type: "streak" }),
    ]);
  });

  it("keeps premium badges when account is premium", () => {
    mockIsPremium = true;
    mockBadges = [
      {
        id: "premium_start",
        type: "premium",
        label: "Premium started",
        milestone: "start",
        icon: "⭐",
        color: "#F7A541",
        unlockedAt: 1,
      },
      {
        id: "streak_7",
        type: "streak",
        label: "Streak 7",
        milestone: 7,
        icon: "🔥",
        color: "#00AA88",
        unlockedAt: 2,
      },
    ];
    const navigation = { reset: jest.fn() };
    const { result } = renderHook(() =>
      useUserProfileState({ navigation: navigation as never }),
    );

    expect(result.current.safeBadges).toEqual(mockBadges);
  });
});
