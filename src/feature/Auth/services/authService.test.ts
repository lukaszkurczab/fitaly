import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import {
  authLogin,
  authLogout,
  authRegister,
  authSendPasswordReset,
} from "@/feature/Auth/services/authService";
import {
  __resetSignupProfileBootstrapForTests,
  isSignupProfileBootstrapPending,
} from "@/services/session/signupProfileBootstrap";

const mockGetAuth = jest.fn<(...args: unknown[]) => unknown>();
const mockCreateUserWithEmailAndPassword = jest.fn<
  (...args: unknown[]) => Promise<{ user: { uid: string; email: string; delete: () => Promise<void> } }>
>();
const mockInitializeUserOnboardingProfile = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockLogError = jest.fn<(...args: unknown[]) => void>();
const mockFetchUserProfileRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockEmitUserProfileChanged = jest.fn<(...args: unknown[]) => void>();
const mockNormalizeBootstrapProfile = jest.fn<(...args: unknown[]) => unknown>();
const mockWriteProfileCache = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDelete = jest.fn<() => Promise<void>>();
const mockSignOut = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockSignInWithEmailAndPassword = jest.fn<
  (...args: unknown[]) => Promise<{ user: { uid: string } }>
>();
const mockGetIdToken = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockSendPasswordResetEmail = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockResetUserRuntime = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockClearE2EAuthSession = jest.fn<() => Promise<void>>();

let mockE2EEnabled = false;
let mockE2EAuthSession: { uid: string; email: string } | null = null;

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(),
}));

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
  getIdToken: (...args: unknown[]) => mockGetIdToken(...args),
  sendPasswordResetEmail: (...args: unknown[]) =>
    mockSendPasswordResetEmail(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
}));

jest.mock("@/services/core/apiClient", () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("@/services/core/errorLogger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

jest.mock("@/services/user/userProfileRepository", () => ({
  fetchUserProfileRemote: (...args: unknown[]) =>
    mockFetchUserProfileRemote(...args),
  emitUserProfileChanged: (...args: unknown[]) =>
    mockEmitUserProfileChanged(...args),
}));

jest.mock("@/services/user/profileCache", () => ({
  normalizeBootstrapProfile: (...args: unknown[]) =>
    mockNormalizeBootstrapProfile(...args),
  writeProfileCache: (...args: unknown[]) => mockWriteProfileCache(...args),
}));

jest.mock("@/services/session/resetUserRuntime", () => ({
  resetUserRuntime: (...args: unknown[]) => mockResetUserRuntime(...args),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => mockE2EEnabled,
}));

jest.mock("@/services/e2e/authSession", () => ({
  getE2EAuthSession: () => mockE2EAuthSession,
  clearE2EAuthSession: () => mockClearE2EAuthSession(),
}));

jest.mock("@/services/user/userService", () => ({
  initializeUserOnboardingProfile: (...args: unknown[]) =>
    mockInitializeUserOnboardingProfile(...args),
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { resolvedLanguage: "en", language: "en" },
}));

const mockI18n = (
  jest.requireMock("@/i18n") as {
    default: { resolvedLanguage?: string; language?: string };
  }
).default;

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetSignupProfileBootstrapForTests();
    mockE2EEnabled = false;
    mockE2EAuthSession = null;
    mockI18n.resolvedLanguage = "en";
    mockI18n.language = "en";
    mockGetAuth.mockReturnValue({ app: "auth", currentUser: { uid: "user-1" } });
    mockDelete.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: "user-1" },
    });
    mockGetIdToken.mockResolvedValue("firebase-id-token");
    mockFetchUserProfileRemote.mockResolvedValue({
      uid: "user-1",
      username: "neo",
    });
    mockNormalizeBootstrapProfile.mockReturnValue({
      uid: "user-1",
      username: "neo",
    });
    mockWriteProfileCache.mockResolvedValue(undefined);
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    mockResetUserRuntime.mockResolvedValue(undefined);
    mockClearE2EAuthSession.mockResolvedValue(undefined);
    mockPost.mockResolvedValue({ deleted: true });
    mockCreateUserWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: "user-1",
        email: "user@example.com",
        delete: mockDelete,
      },
    });
    mockInitializeUserOnboardingProfile.mockResolvedValue(undefined);
  });

  it("runs backend-owned onboarding profile initialization after auth user creation", async () => {
    mockI18n.resolvedLanguage = "pl";
    const user = await authRegister("user@example.com", "Strong1!", "Neo");

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalled();
    expect(mockInitializeUserOnboardingProfile).toHaveBeenCalledWith(
      "neo",
      "pl",
    );
    expect(user.uid).toBe("user-1");
  });

  it("keeps signup profile bootstrap pending until backend initialization finishes", async () => {
    let resolveInitialization!: () => void;
    mockInitializeUserOnboardingProfile.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveInitialization = resolve;
      }),
    );

    const pendingSignup = authRegister("user@example.com", "Strong1!", "Neo");

    await Promise.resolve();
    await Promise.resolve();

    expect(mockInitializeUserOnboardingProfile).toHaveBeenCalledTimes(1);
    expect(isSignupProfileBootstrapPending("user-1")).toBe(true);
    expect(isSignupProfileBootstrapPending("other-user")).toBe(false);

    resolveInitialization();

    await expect(pendingSignup).resolves.toMatchObject({ uid: "user-1" });
    expect(isSignupProfileBootstrapPending("user-1")).toBe(false);
  });

  it("normalizes auth input emails and username before calling providers", async () => {
    await authLogin("  USER@Example.COM ", "Strong1!");
    await authSendPasswordReset("  USER@Example.COM ");
    await authRegister("  USER@Example.COM ", "Strong1!", "  Neo  ");

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
      "Strong1!",
    );
    expect(mockGetIdToken).toHaveBeenCalledWith({ uid: "user-1" }, true);
    expect(mockFetchUserProfileRemote).toHaveBeenCalledWith("user-1");
    expect(mockWriteProfileCache).toHaveBeenCalledWith("user-1", {
      uid: "user-1",
      username: "neo",
    });
    expect(mockEmitUserProfileChanged).toHaveBeenCalledWith("user-1", {
      uid: "user-1",
      username: "neo",
    });
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
    );
    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
      "Strong1!",
    );
    expect(mockInitializeUserOnboardingProfile).toHaveBeenCalledWith(
      "neo",
      "en",
    );
  });

  it("does not complete login until Firebase returns a fresh ID token", async () => {
    let resolveToken!: (token: string) => void;
    mockGetIdToken.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    );

    const login = authLogin("user@example.com", "Strong1!");
    await Promise.resolve();

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
    let settled = false;
    void login.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveToken("fresh-token");

    await expect(login).resolves.toMatchObject({ uid: "user-1" });
  });

  it("signs out and returns a login error when profile bootstrap fails", async () => {
    const profileError = new Error("profile failed");
    mockFetchUserProfileRemote.mockRejectedValueOnce(profileError);

    await expect(
      authLogin("user@example.com", "Strong1!"),
    ).rejects.toMatchObject({
      code: "auth/profile-bootstrap-failed",
      source: "AuthService",
      retryable: true,
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockResetUserRuntime).toHaveBeenCalledWith("user-1", {
      reason: "logout",
    });
    expect(mockWriteProfileCache).not.toHaveBeenCalled();
    expect(mockEmitUserProfileChanged).not.toHaveBeenCalled();
  });

  it("clears a local E2E auth session during logout", async () => {
    mockE2EEnabled = true;
    mockE2EAuthSession = {
      uid: "e2e-e2e-example-com",
      email: "e2e@example.com",
    };
    mockGetAuth.mockReturnValue({ app: "auth", currentUser: null });

    await authLogout();

    expect(mockSignOut).toHaveBeenCalledWith({
      app: "auth",
      currentUser: null,
    });
    expect(mockClearE2EAuthSession).toHaveBeenCalledTimes(1);
    expect(mockResetUserRuntime).toHaveBeenCalledWith(
      "e2e-e2e-example-com",
      { reason: "logout" },
    );
  });

  it("refreshes the Firebase ID token before backend signup initialization", async () => {
    await authRegister("user@example.com", "Strong1!", "Neo");

    expect(mockGetIdToken).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "user-1" }),
      true,
    );
    expect(mockGetIdToken.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitializeUserOnboardingProfile.mock.invocationCallOrder[0],
    );
  });

  it("normalizes region language and falls back to en for unsupported values", async () => {
    mockI18n.resolvedLanguage = "pl-PL";
    await authRegister("user@example.com", "Strong1!", "Neo");
    expect(mockInitializeUserOnboardingProfile).toHaveBeenLastCalledWith(
      "neo",
      "pl",
    );

    mockI18n.resolvedLanguage = "";
    mockI18n.language = "de-DE";
    await authRegister("user@example.com", "Strong1!", "Neo");
    expect(mockInitializeUserOnboardingProfile).toHaveBeenLastCalledWith(
      "neo",
      "en",
    );
  });

  it("maps onboarding 409 to username unavailable and rolls back backend then auth user", async () => {
    mockInitializeUserOnboardingProfile.mockRejectedValue({
      status: 409,
      code: "api/http-error",
    });

    await expect(
      authRegister("user@example.com", "Strong1!", "Neo"),
    ).rejects.toMatchObject({
      code: "username/unavailable",
      source: "AuthService",
    });

    expect(mockPost).toHaveBeenCalledWith("/users/me/delete");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockPost.mock.invocationCallOrder[0]).toBeLessThan(
      mockDelete.mock.invocationCallOrder[0],
    );
    expect(mockInitializeUserOnboardingProfile).toHaveBeenCalled();
  });

  it("still deletes Firebase user and logs when backend signup cleanup fails", async () => {
    const onboardingError = new Error("onboarding failed");
    const cleanupError = new Error("cleanup failed");
    mockInitializeUserOnboardingProfile.mockRejectedValue(onboardingError);
    mockPost.mockRejectedValue(cleanupError);

    await expect(
      authRegister("user@example.com", "Strong1!", "Neo"),
    ).rejects.toBe(onboardingError);

    expect(mockPost).toHaveBeenCalledWith("/users/me/delete");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      "authRegister: failed backend account cleanup during signup rollback",
      { uid: "user-1" },
      cleanupError,
    );
  });

  it("logs Firebase delete failure without hiding onboarding error", async () => {
    const onboardingError = new Error("onboarding failed");
    const deleteError = new Error("delete failed");
    mockInitializeUserOnboardingProfile.mockRejectedValue(onboardingError);
    mockDelete.mockRejectedValue(deleteError);

    await expect(
      authRegister("user@example.com", "Strong1!", "Neo"),
    ).rejects.toBe(onboardingError);

    expect(mockPost).toHaveBeenCalledWith("/users/me/delete");
    expect(mockLogError).toHaveBeenCalledWith(
      "authRegister: failed to delete Firebase user during signup rollback — zombie user requires manual cleanup",
      { uid: "user-1" },
      deleteError,
    );
  });

  it("resets user runtime on logout", async () => {
    await authLogout();

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockResetUserRuntime).toHaveBeenCalledWith("user-1", {
      reason: "logout",
    });
  });

  it("still resets runtime when signOut fails and rethrows signOut error", async () => {
    mockSignOut.mockRejectedValueOnce(new Error("signout-failed"));

    await expect(authLogout()).rejects.toThrow("signout-failed");

    expect(mockResetUserRuntime).toHaveBeenCalledWith("user-1", {
      reason: "logout",
    });
  });
});
