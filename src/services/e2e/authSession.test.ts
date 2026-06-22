import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const storage = new Map<string, string>();

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockRemoveItem = jest.fn<(key: string) => Promise<void>>();
const mockEmit = jest.fn<(...args: unknown[]) => void>();
const mockOn = jest.fn<(...args: unknown[]) => () => void>();
const mockWriteProfileCache = jest.fn<
  (uid: string, profile: unknown) => Promise<void>
>();
const mockGetFirebaseAuth = jest.fn<() => Promise<unknown>>();
const mockSignInWithEmailAndPassword = jest.fn<
  (...args: unknown[]) => Promise<{ user: { uid: string } }>
>();
const mockCreateUserWithEmailAndPassword = jest.fn<
  (...args: unknown[]) => Promise<{ user: { uid: string } }>
>();
const mockGetIdToken = jest.fn<(...args: unknown[]) => Promise<string>>();

let mockE2EEnabled = true;
let mockFirebaseAuthEmulatorHost = "";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
  removeItem: (key: string) => mockRemoveItem(key),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => mockE2EEnabled,
  buildE2EProfileSeed: (uid: string, email: string) => ({
    uid,
    email,
    profile: {
      readiness: {
        status: "ready",
      },
    },
  }),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
  on: (...args: unknown[]) => mockOn(...args),
}));

jest.mock("@/services/user/profileCache", () => ({
  writeProfileCache: (uid: string, profile: unknown) =>
    mockWriteProfileCache(uid, profile),
}));

jest.mock("@/FirebaseConfig", () => ({
  getFirebaseAuth: () => mockGetFirebaseAuth(),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => ({
    firebaseAuthEmulatorHost: mockFirebaseAuthEmulatorHost,
  }),
}));

jest.mock("@react-native-firebase/auth", () => ({
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
  getIdToken: (...args: unknown[]) => mockGetIdToken(...args),
}));

function loadAuthSession(): typeof import("@/services/e2e/authSession") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@/services/e2e/authSession");
}

describe("services/e2e/authSession", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    storage.clear();
    mockE2EEnabled = true;
    mockFirebaseAuthEmulatorHost = "";
    mockGetItem.mockImplementation(async (key) => storage.get(key) ?? null);
    mockSetItem.mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
    mockRemoveItem.mockImplementation(async (key) => {
      storage.delete(key);
    });
    mockWriteProfileCache.mockResolvedValue(undefined);
    mockOn.mockReturnValue(jest.fn());
    mockGetFirebaseAuth.mockResolvedValue({ auth: true });
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: "firebase-user-1" },
    });
    mockCreateUserWithEmailAndPassword.mockResolvedValue({
      user: { uid: "firebase-user-created" },
    });
    mockGetIdToken.mockResolvedValue("token");
  });

  it("establishes a normalized local session, persists it, and publishes it", async () => {
    const authSession = loadAuthSession();

    await expect(
      authSession.establishE2EAuthSession(" E2E@Example.COM "),
    ).resolves.toEqual({
      uid: "e2e-e2e-example-com",
      email: "e2e@example.com",
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      "e2e:auth:session",
      JSON.stringify({
        uid: "e2e-e2e-example-com",
        email: "e2e@example.com",
      }),
    );
    expect(mockWriteProfileCache).toHaveBeenCalledWith(
      "e2e-e2e-example-com",
      expect.objectContaining({
        uid: "e2e-e2e-example-com",
        email: "e2e@example.com",
      }),
    );
    expect(authSession.getE2EAuthSession()).toEqual({
      uid: "e2e-e2e-example-com",
      email: "e2e@example.com",
    });
    expect(mockEmit).toHaveBeenCalledWith("e2e:auth:session", {
      uid: "e2e-e2e-example-com",
      email: "e2e@example.com",
    });
    expect(mockEmit).toHaveBeenCalledWith(
      "user:profile:changed",
      expect.objectContaining({
        uid: "e2e-e2e-example-com",
        data: expect.objectContaining({
          uid: "e2e-e2e-example-com",
          email: "e2e@example.com",
        }),
      }),
    );
    expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("uses Firebase Auth emulator when configured and persists the Firebase uid", async () => {
    mockFirebaseAuthEmulatorHost = "http://127.0.0.1:9099";
    const authSession = loadAuthSession();

    await expect(
      authSession.establishE2EAuthSession(" E2E@Example.COM ", "Secret123!"),
    ).resolves.toEqual({
      uid: "firebase-user-1",
      email: "e2e@example.com",
      idToken: "token",
    });

    expect(mockGetFirebaseAuth).toHaveBeenCalledTimes(1);
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      { auth: true },
      "e2e@example.com",
      "Secret123!",
    );
    expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(mockGetIdToken).toHaveBeenCalledWith({ uid: "firebase-user-1" }, true);
    expect(authSession.getE2EAuthToken()).toBe("token");
    expect(mockWriteProfileCache).toHaveBeenCalledWith(
      "firebase-user-1",
      expect.objectContaining({
        uid: "firebase-user-1",
        email: "e2e@example.com",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith(
      "user:profile:changed",
      expect.objectContaining({
        uid: "firebase-user-1",
        data: expect.objectContaining({
          uid: "firebase-user-1",
          email: "e2e@example.com",
        }),
      }),
    );
  });

  it("creates the Firebase Auth emulator user when sign-in reports a missing user", async () => {
    mockFirebaseAuthEmulatorHost = "http://127.0.0.1:9099";
    mockSignInWithEmailAndPassword.mockRejectedValueOnce(
      Object.assign(new Error("missing"), { code: "auth/user-not-found" }),
    );
    const authSession = loadAuthSession();

    await expect(
      authSession.establishE2EAuthSession("e2e@example.com", "Secret123!"),
    ).resolves.toEqual({
      uid: "firebase-user-created",
      email: "e2e@example.com",
      idToken: "token",
    });

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      { auth: true },
      "e2e@example.com",
      "Secret123!",
    );
    expect(mockGetIdToken).toHaveBeenCalledWith(
      { uid: "firebase-user-created" },
      true,
    );
  });

  it("does not expose a session when persistence fails", async () => {
    const authSession = loadAuthSession();
    mockSetItem.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      authSession.establishE2EAuthSession("e2e@example.com"),
    ).rejects.toThrow("storage unavailable");

    expect(authSession.getE2EAuthSession()).toBeNull();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("hydrates a valid stored session and ignores invalid stored data", async () => {
    storage.set(
      "e2e:auth:session",
      JSON.stringify({
        uid: "e2e-existing-user",
        email: "Existing@Example.COM",
      }),
    );
    const authSession = loadAuthSession();

    await expect(authSession.hydrateE2EAuthSession()).resolves.toEqual({
      uid: "e2e-existing-user",
      email: "existing@example.com",
    });
    expect(authSession.getE2EAuthSession()).toEqual({
      uid: "e2e-existing-user",
      email: "existing@example.com",
    });

    jest.resetModules();
    storage.set("e2e:auth:session", "{bad-json");
    const freshAuthSession = loadAuthSession();

    await expect(freshAuthSession.hydrateE2EAuthSession()).resolves.toBeNull();
    expect(freshAuthSession.getE2EAuthSession()).toBeNull();
  });

  it("restores and clears a local session", async () => {
    const authSession = loadAuthSession();

    await authSession.restoreE2EAuthSession({
      uid: "e2e-user",
      email: "e2e@example.com",
    });
    expect(authSession.getE2EAuthSession()).toEqual({
      uid: "e2e-user",
      email: "e2e@example.com",
    });

    await authSession.clearE2EAuthSession();

    expect(mockRemoveItem).toHaveBeenCalledWith("e2e:auth:session");
    expect(authSession.getE2EAuthSession()).toBeNull();
    expect(authSession.getE2EAuthToken()).toBeNull();
    expect(mockEmit).toHaveBeenLastCalledWith("e2e:auth:session", null);
  });

  it("stays inert outside E2E mode", async () => {
    mockE2EEnabled = false;
    const authSession = loadAuthSession();

    await expect(
      authSession.establishE2EAuthSession("e2e@example.com"),
    ).rejects.toMatchObject({
      code: "e2e/auth-session-disabled",
    });
    await expect(authSession.hydrateE2EAuthSession()).resolves.toBeNull();
    await expect(
      authSession.restoreE2EAuthSession({
        uid: "e2e-user",
        email: "e2e@example.com",
      }),
    ).resolves.toBeUndefined();
    await expect(authSession.clearE2EAuthSession()).resolves.toBeUndefined();

    expect(authSession.getE2EAuthSession()).toBeNull();
    expect(authSession.getE2EAuthToken()).toBeNull();
    expect(authSession.subscribeE2EAuthSession(jest.fn())).toEqual(
      expect.any(Function),
    );
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockRemoveItem).not.toHaveBeenCalled();
    expect(mockOn).not.toHaveBeenCalled();
  });
});
