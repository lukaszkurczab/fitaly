import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { UserData, UserProfile } from "@/types";
import { useUser } from "@/hooks/useUser";
import { Platform } from "react-native";

const mockSubscribeToUserProfile = jest.fn<(...args: unknown[]) => unknown>();
const mockFetchUserProfileRemote =
  jest.fn<(...args: unknown[]) => Promise<UserData | null>>();
const mockEmitUserProfileChanged = jest.fn<(...args: unknown[]) => void>();
const mockSavePhotoLocally = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockChangeUsernameService =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockChangeEmailService = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockChangePasswordService =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDeleteAccountService =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockExportUserDataService =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockEnqueueUserAvatarUpload =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockEnqueueUserProfileUpdate =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockGetSyncCounts =
  jest.fn<(...args: unknown[]) => Promise<{ dead: number; pending: number }>>();
const mockRetryDeadLetterOps =
  jest.fn<(...args: unknown[]) => Promise<number>>();
const mockPushQueue = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockAssertNoUndefined = jest.fn<(...args: unknown[]) => void>();
const mockAsyncStorageGetItem =
  jest.fn<(...args: unknown[]) => Promise<string | null>>();
const mockAsyncStorageSetItem =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFsGetInfoAsync =
  jest.fn<(...args: unknown[]) => Promise<{ exists: boolean }>>();
const mockFsMakeDirectoryAsync =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFsDeleteAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFsMoveAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFsCopyAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFsReadAsStringAsync =
  jest.fn<(...args: unknown[]) => Promise<string>>();
const mockFsWriteAsStringAsync =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFsCreateDownloadResumable =
  jest.fn<
    (...args: unknown[]) => { downloadAsync: () => Promise<{ status: number }> }
  >();
const mockFsStorageRequestPermissions =
  jest.fn<
    (
      ...args: unknown[]
    ) => Promise<{ granted: boolean; directoryUri: string | null }>
  >();
const mockFsStorageCreateFile =
  jest.fn<(...args: unknown[]) => Promise<string>>();
const mockPrintToFileAsync =
  jest.fn<(...args: unknown[]) => Promise<{ uri: string }>>();
const mockShareAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockNetInfoFetch =
  jest.fn<(...args: unknown[]) => Promise<{ isConnected: boolean }>>();
const mockUnsub = jest.fn<() => void>();
const mockI18nChangeLanguage =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockLogError = jest.fn<(...args: unknown[]) => void>();
const mockLogWarning = jest.fn<(...args: unknown[]) => void>();
const mockCaptureException = jest.fn<(...args: unknown[]) => void>();

const createExportPayload = () => ({
  profile: createUser(),
  meals: [{ id: "meal-1" }],
  chatMessages: [{ id: "chat-1" }],
});

let mockSnapshotCb: ((snap: { data: () => unknown }) => void) | null = null;

jest.mock("@/services/user/userProfileRepository", () => ({
  subscribeToUserProfile: (...args: unknown[]) =>
    mockSubscribeToUserProfile(...args),
  fetchUserProfileRemote: (...args: unknown[]) =>
    mockFetchUserProfileRemote(...args),
  emitUserProfileChanged: (...args: unknown[]) =>
    mockEmitUserProfileChanged(...args),
}));

jest.mock("@utils/savePhotoLocally", () => ({
  savePhotoLocally: (...args: unknown[]) => mockSavePhotoLocally(...args),
}));

jest.mock("@/services/user/userService", () => ({
  changeUsernameService: (...args: unknown[]) =>
    mockChangeUsernameService(...args),
  changeEmailService: (...args: unknown[]) => mockChangeEmailService(...args),
  changePasswordService: (...args: unknown[]) =>
    mockChangePasswordService(...args),
  deleteAccountService: (...args: unknown[]) =>
    mockDeleteAccountService(...args),
  exportUserData: (...args: unknown[]) => mockExportUserDataService(...args),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  enqueueUserProfileUpdate: (...args: unknown[]) =>
    mockEnqueueUserProfileUpdate(...args),
  enqueueUserAvatarUpload: (...args: unknown[]) =>
    mockEnqueueUserAvatarUpload(...args),
  getSyncCounts: (...args: unknown[]) => mockGetSyncCounts(...args),
  retryDeadLetterOps: (...args: unknown[]) => mockRetryDeadLetterOps(...args),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (params: { uid: string }) => mockPushQueue(params.uid),
  pushQueue: (...args: unknown[]) => mockPushQueue(...args),
}));

jest.mock("@/utils/findUndefined", () => ({
  assertNoUndefined: (...args: unknown[]) => mockAssertNoUndefined(...args),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
    setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
  },
}));

jest.mock("@/services/core/fileSystem", () => ({
  documentDirectory: "file:///docs/",
  getInfoAsync: (...args: unknown[]) => mockFsGetInfoAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockFsMakeDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => mockFsDeleteAsync(...args),
  moveAsync: (...args: unknown[]) => mockFsMoveAsync(...args),
  copyAsync: (...args: unknown[]) => mockFsCopyAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockFsReadAsStringAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockFsWriteAsStringAsync(...args),
  createDownloadResumable: (...args: unknown[]) =>
    mockFsCreateDownloadResumable(...args),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: (...args: unknown[]) =>
      mockFsStorageRequestPermissions(...args),
    createFileAsync: (...args: unknown[]) => mockFsStorageCreateFile(...args),
  },
  EncodingType: {
    Base64: "base64",
  },
}));

jest.mock("expo-print", () => ({
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
}));

jest.mock("expo-sharing", () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: (...args: unknown[]) => mockNetInfoFetch(...args),
  },
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: {
    resolvedLanguage: "en",
    language: "en",
    changeLanguage: (...args: unknown[]) => mockI18nChangeLanguage(...args),
    t: (key: string) => key,
  },
}));

jest.mock("@/services/core/events", () => ({
  emit: jest.fn(),
  on: jest.fn(() => jest.fn()),
}));

jest.mock("@/services/core/errorLogger", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: "https://api.example.com",
    apiVersion: "v1",
    backendLoggingEnabled: false,
    telemetryEnabled: false,
    smartRemindersEnabled: true,
    billingDisabled: false,
    buildProfile: "production",
    privacyUrl: "",
    termsUrl: "",
    revenuecatAndroidKey: "",
    revenuecatIosKey: "",
    sentryDsn: "https://sentry.example/1",
    sentryEnvironment: "production",
    sentryOrganization: "",
    sentryProject: "",
  }),
}));

jest.mock("@/services/user/profilePatch", () => ({
  sanitizeUserProfilePatch: (patch: Partial<UserData>) => {
    const next = { ...patch };
    delete next.uid;
    delete next.username;
    delete next.email;
    delete next.plan;
    delete next.createdAt;
    delete next.lastLogin;
    delete next.syncState;
    delete next.lastSyncedAt;
    delete next.avatarUrl;
    delete next.avatarlastSyncedAt;
    delete next.avatarLocalPath;
    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    );
  },
  sanitizeUserProfileLocalPatch: (patch: Partial<UserData>) => {
    const next = { ...patch };
    delete next.uid;
    delete next.email;
    delete next.plan;
    delete next.createdAt;
    delete next.lastLogin;
    delete next.syncState;
    delete next.lastSyncedAt;
    delete next.avatarUrl;
    delete next.avatarLocalPath;
    delete next.avatarlastSyncedAt;
    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    );
  },
}));

const mockI18n = (
  jest.requireMock("@/i18n") as {
    default: { resolvedLanguage: string; language: string };
  }
).default;

const setPlatformOs = (os: "ios" | "android") => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    get: () => os,
  });
};

const createProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  language: "en",
  nutritionProfile: {
    unitsSystem: "metric",
    age: "30",
    sex: "male",
    height: "180",
    heightInch: "",
    weight: "80",
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
  consents: {
    aiHealthDataConsentAt: null,
  },
  readiness: {
    status: "ready",
    onboardingCompletedAt: "2026-03-10T10:00:00.000Z",
    readyAt: "2026-03-10T10:00:00.000Z",
  },
  ...overrides,
});

const createUser = (overrides: Partial<UserData> = {}): UserData => ({
  uid: "u1",
  email: "u1@example.com",
  username: "neo",
  plan: "free",
  createdAt: 1,
  lastLogin: "2026-03-10T10:00:00.000Z",
  profile: createProfile(),
  syncState: "synced",
  ...overrides,
});

const emitSnapshot = (data: UserData | null) => {
  if (!mockSnapshotCb) throw new Error("snapshot callback missing");
  mockSnapshotCb({
    data: () => data,
  });
};

describe("useUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    setPlatformOs("ios");
    mockSnapshotCb = null;

    mockSubscribeToUserProfile.mockImplementation((...args: unknown[]) => {
      const params = args[0] as { onData: (data: UserData | null) => void };
      mockSnapshotCb = (snap) => {
        params.onData((snap.data() as UserData | null | undefined) ?? null);
      };
      return mockUnsub;
    });

    mockFetchUserProfileRemote.mockResolvedValue(createUser());
    mockSavePhotoLocally.mockResolvedValue("file:///photos/avatar.jpg");
    mockChangeUsernameService.mockResolvedValue(undefined);
    mockChangeEmailService.mockResolvedValue(undefined);
    mockChangePasswordService.mockResolvedValue(undefined);
    mockDeleteAccountService.mockResolvedValue(undefined);
    mockExportUserDataService.mockResolvedValue(createExportPayload());
    mockEnqueueUserAvatarUpload.mockResolvedValue(undefined);
    mockEnqueueUserProfileUpdate.mockResolvedValue(undefined);
    mockGetSyncCounts.mockResolvedValue({ dead: 0, pending: 0 });
    mockRetryDeadLetterOps.mockResolvedValue(0);
    mockPushQueue.mockResolvedValue(undefined);
    mockAssertNoUndefined.mockReturnValue(undefined);
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
    mockFsGetInfoAsync.mockResolvedValue({ exists: true });
    mockFsMakeDirectoryAsync.mockResolvedValue(undefined);
    mockFsDeleteAsync.mockResolvedValue(undefined);
    mockFsMoveAsync.mockResolvedValue(undefined);
    mockFsCopyAsync.mockResolvedValue(undefined);
    mockFsReadAsStringAsync.mockResolvedValue("BASE64PDF");
    mockFsWriteAsStringAsync.mockResolvedValue(undefined);
    mockFsCreateDownloadResumable.mockReturnValue({
      downloadAsync: async () => ({ status: 200 }),
    });
    mockFsStorageRequestPermissions.mockResolvedValue({
      granted: true,
      directoryUri: "content://tree",
    });
    mockFsStorageCreateFile.mockResolvedValue("content://tree/export.pdf");
    mockPrintToFileAsync.mockResolvedValue({ uri: "file:///tmp/export.pdf" });
    mockShareAsync.mockResolvedValue(undefined);
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockI18n.resolvedLanguage = "en";
    mockI18n.language = "en";
    mockI18nChangeLanguage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("handles empty uid language changes without writing profile state", async () => {
    const { result } = renderHook(() => useUser(""));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.userData).toBeNull();
    expect(result.current.language).toBe("en");
    expect(result.current.profileBootstrapState).toBe("profileMissing");
    expect(mockSubscribeToUserProfile).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.changeLanguage("pl");
    });

    expect(result.current.language).toBe("en");
    expect(mockI18nChangeLanguage).toHaveBeenCalledWith("pl");
    expect(mockFetchUserProfileRemote).not.toHaveBeenCalled();
  });

  it("loads cached profile, reacts to snapshot updates and unsubscribes", async () => {
    const cached = createUser({
      profile: createProfile({ language: "de" as never }),
      avatarLocalPath: "file:///avatar-local.jpg",
    });
    mockFetchUserProfileRemote.mockResolvedValue(cached);
    mockAsyncStorageGetItem.mockResolvedValueOnce(JSON.stringify(cached));

    const { result, unmount } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.userData?.username).toBe("neo");
    expect(result.current.language).toBe("en");
    expect(result.current.profileBootstrapState).toBe("profileReady");

    await act(async () => {
      emitSnapshot(
        createUser({
          username: "trinity",
          profile: createProfile({ language: "fr" as never }),
          avatarLocalPath: "file:///avatar-local.jpg",
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.userData?.username).toBe("trinity");
    });

    expect(result.current.language).toBe("en");
    expect(mockAsyncStorageSetItem).toHaveBeenCalled();

    unmount();
    expect(mockUnsub).toHaveBeenCalled();
  });

  it("marks authenticated bootstrap as profile missing when remote profile is absent", async () => {
    mockFetchUserProfileRemote.mockResolvedValue(null);

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.userData).toBeNull();
    expect(result.current.profileBootstrapState).toBe("profileMissing");
  });

  it("hydrates local cache without marking bootstrap as remote-confirmed profileReady", async () => {
    const cached = createUser({ username: "cached-name" });
    let resolveRemote: ((value: UserData) => void) | null = null;
    mockAsyncStorageGetItem.mockResolvedValueOnce(JSON.stringify(cached));
    mockFetchUserProfileRemote.mockReturnValueOnce(
      new Promise<UserData>((resolve) => {
        resolveRemote = resolve;
      }),
    );

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(result.current.userData?.username).toBe("cached-name");
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.profileBootstrapState).toBe("profileLoading");

    await act(async () => {
      resolveRemote?.(createUser({ username: "remote-name" }));
    });

    await waitFor(() => {
      expect(result.current.profileBootstrapState).toBe("profileReady");
      expect(result.current.userData?.username).toBe("remote-name");
    });
  });

  it("normalizes cached bootstrap profiles that are missing the nested profile object", async () => {
    let resolveRemote: ((value: UserData) => void) | null = null;
    mockAsyncStorageGetItem.mockResolvedValueOnce(
      JSON.stringify({
        uid: "u1",
        email: "u1@example.com",
        username: "cached-name",
        plan: "free",
        createdAt: 1,
        lastLogin: "2026-03-10T10:00:00.000Z",
        syncState: "synced",
      }),
    );
    mockFetchUserProfileRemote.mockReturnValueOnce(
      new Promise<UserData>((resolve) => {
        resolveRemote = resolve;
      }),
    );

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(result.current.userData?.username).toBe("cached-name");
    });

    expect(result.current.language).toBe("en");
    expect(result.current.userData?.profile.language).toBe("en");
    expect(mockLogWarning).not.toHaveBeenCalledWith(
      "profile cache hydration failed",
      expect.anything(),
      expect.anything(),
    );

    await act(async () => {
      resolveRemote?.(createUser({ username: "remote-name" }));
    });
  });

  it("ignores delayed remote profile response after account switch", async () => {
    let resolveUserA: ((value: UserData) => void) | null = null;
    mockFetchUserProfileRemote.mockImplementation((sessionKey: unknown) => {
      if (sessionKey === "user-a") {
        return new Promise<UserData>((resolve) => {
          resolveUserA = resolve;
        });
      }
      if (sessionKey === "user-b") {
        return Promise.resolve(
          createUser({
            uid: "user-b",
            email: "user-b@example.com",
            username: "fresh-b",
          }),
        );
      }
      return Promise.resolve(null);
    });

    let currentUid = "user-a";
    const { result, rerender } = renderHook(() => useUser(currentUid));

    await waitFor(() => {
      expect(mockFetchUserProfileRemote).toHaveBeenCalledWith("user-a");
    });

    currentUid = "user-b";
    rerender(undefined);

    await waitFor(() => {
      expect(result.current.profileBootstrapState).toBe("profileReady");
      expect(result.current.userData?.uid).toBe("user-b");
      expect(result.current.userData?.username).toBe("fresh-b");
    });

    mockAsyncStorageSetItem.mockClear();
    mockEmitUserProfileChanged.mockClear();

    await act(async () => {
      resolveUserA?.(
        createUser({
          uid: "user-a",
          email: "user-a@example.com",
          username: "stale-a",
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.userData?.uid).toBe("user-b");
    expect(result.current.userData?.username).toBe("fresh-b");
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalledWith(
      "user:profile:user-a",
      expect.any(String),
    );
    expect(mockEmitUserProfileChanged).not.toHaveBeenCalledWith(
      "user-a",
      expect.anything(),
    );
  });

  it("ignores delayed remote profile response after logout", async () => {
    let resolveUserA: ((value: UserData) => void) | null = null;
    mockFetchUserProfileRemote.mockReturnValueOnce(
      new Promise<UserData>((resolve) => {
        resolveUserA = resolve;
      }),
    );

    let currentUid = "user-a";
    const { result, rerender } = renderHook(() => useUser(currentUid));

    await waitFor(() => {
      expect(mockFetchUserProfileRemote).toHaveBeenCalledWith("user-a");
    });

    currentUid = "";
    rerender(undefined);

    await waitFor(() => {
      expect(result.current.userData).toBeNull();
      expect(result.current.profileBootstrapState).toBe("profileMissing");
    });

    mockAsyncStorageSetItem.mockClear();
    mockEmitUserProfileChanged.mockClear();

    await act(async () => {
      resolveUserA?.(
        createUser({
          uid: "user-a",
          email: "user-a@example.com",
          username: "stale-a",
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.userData).toBeNull();
    expect(result.current.profileBootstrapState).toBe("profileMissing");
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalledWith(
      "user:profile:user-a",
      expect.any(String),
    );
    expect(mockEmitUserProfileChanged).not.toHaveBeenCalledWith(
      "user-a",
      expect.anything(),
    );
  });

  it("preserves existing local avatar path when snapshot omits it", async () => {
    const cached = createUser({
      username: "neo",
      avatarUrl: "https://cdn/avatar.jpg",
      avatarLocalPath: "file:///avatar-local.jpg",
    });
    mockFetchUserProfileRemote.mockResolvedValue(cached);
    mockAsyncStorageGetItem.mockResolvedValueOnce(JSON.stringify(cached));
    mockFsGetInfoAsync.mockImplementation(async (...args: unknown[]) => {
      const path = args[0] as string;
      if (path === "file:///avatar-local.jpg") return { exists: true };
      if (path === "file:///docs/users/u1/images/avatar.jpg") return { exists: false };
      return { exists: false };
    });
    mockFsCreateDownloadResumable.mockReturnValueOnce({
      downloadAsync: async () => ({ status: 500 }),
    });

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      emitSnapshot(
        createUser({
          username: "trinity",
          avatarUrl: "https://cdn/avatar.jpg",
          avatarLocalPath: "",
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.userData?.username).toBe("trinity");
    });

    expect(result.current.userData?.avatarLocalPath).toBe(
      "file:///avatar-local.jpg",
    );
    expect(mockFsCreateDownloadResumable).not.toHaveBeenCalled();
  });

  it("hydrates avatar from remote when url exists and local path is missing", async () => {
    const avatarPath = "file:///docs/users/u1/images/avatar.jpg";
    const cached = createUser({
      avatarUrl: "https://cdn/avatar-remote.jpg",
      avatarLocalPath: "",
    });
    mockFetchUserProfileRemote.mockResolvedValue(cached);

    mockAsyncStorageGetItem
      .mockResolvedValueOnce(JSON.stringify(cached))
      .mockResolvedValueOnce(JSON.stringify(cached));

    let moved = false;
    mockFsMoveAsync.mockImplementation(async () => {
      moved = true;
    });
    mockFsGetInfoAsync.mockImplementation(async (...args: unknown[]) => {
      const path = args[0] as string;
      if (path === "file:///docs/users/u1/images/") return { exists: false };
      if (path === "file:///docs/users/u1/images/avatar.jpg.tmp")
        return { exists: true };
      if (path === avatarPath) {
        return { exists: moved };
      }
      return { exists: true };
    });

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(mockFsCreateDownloadResumable).toHaveBeenCalledWith(
        "https://cdn/avatar-remote.jpg",
        "file:///docs/users/u1/images/avatar.jpg.tmp",
      );
    });

    expect(result.current.userData?.avatarLocalPath).toBe("");
  });

  it("keeps existing avatar when remote hydration download fails", async () => {
    const cached = createUser({
      avatarUrl: "https://cdn/avatar-broken.jpg",
      avatarLocalPath: "",
    });

    mockFetchUserProfileRemote.mockResolvedValue(cached);
    mockAsyncStorageGetItem.mockResolvedValueOnce(JSON.stringify(cached));
    mockFsGetInfoAsync.mockImplementation(async (...args: unknown[]) => {
      const path = args[0] as string;
      if (path === "file:///docs/users/u1/images/") return { exists: true };
      if (path === "file:///docs/users/u1/images/avatar.jpg.tmp")
        return { exists: true };
      return { exists: false };
    });
    mockFsCreateDownloadResumable.mockReturnValueOnce({
      downloadAsync: async () => ({ status: 500 }),
    });

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(mockFsCreateDownloadResumable).toHaveBeenCalled();
    });

    expect(result.current.userData?.avatarLocalPath).toBe("");
    expect(mockFsDeleteAsync).toHaveBeenCalledWith(
      "file:///docs/users/u1/images/avatar.jpg.tmp",
      { idempotent: true },
    );
  });

  it("normalizes invalid local avatar path and updates cache mirror", async () => {
    const cached = createUser({
      avatarLocalPath: "file:///missing-avatar.jpg",
    });
    mockFetchUserProfileRemote.mockResolvedValue(cached);
    mockAsyncStorageGetItem.mockResolvedValueOnce(JSON.stringify(cached));
    mockFsGetInfoAsync.mockImplementation(async (...args: unknown[]) => {
      const path = args[0] as string;
      if (path === "file:///missing-avatar.jpg") {
        throw new Error("missing file");
      }
      if (path === "file:///docs/users/u1/images/avatar.jpg") {
        return { exists: false };
      }
      return { exists: false };
    });

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.userData?.avatarLocalPath).toBe("");
  });

  it("reads cached data when offline in fetchUserFromCloud", async () => {
    const cached = createUser({
      username: "cached-name",
      avatarLocalPath: "file:///avatar-local.jpg",
    });
    mockAsyncStorageGetItem.mockResolvedValue(JSON.stringify(cached));
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });

    const { result } = renderHook(() => useUser("u1"));
    let profile: unknown = null;

    await act(async () => {
      profile = await result.current.fetchUserFromCloud();
    });

    expect(profile).toEqual(
      expect.objectContaining({ username: "cached-name" }),
    );
    expect(result.current.profileBootstrapState).toBe("offlineCached");
    expect(mockFetchUserProfileRemote).not.toHaveBeenCalled();
  });

  it("fetches from cloud when online and mirrors cache", async () => {
    const remote = createUser({
      username: "remote-name",
      avatarLocalPath: "file:///avatar-local.jpg",
    });
    mockFetchUserProfileRemote.mockResolvedValue(remote);

    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(null);
    });

    let profile: unknown = null;
    await act(async () => {
      profile = await result.current.fetchUserFromCloud();
    });

    expect(profile).toEqual(
      expect.objectContaining({ username: "remote-name" }),
    );
    expect(result.current.profileBootstrapState).toBe("profileReady");
    expect(mockFetchUserProfileRemote).toHaveBeenCalledWith("u1");
    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      "user:profile:u1",
      expect.stringContaining("remote-name"),
    );
  });

  it("recovers avatar path from default cache location when cloud payload omits local path", async () => {
    mockFsGetInfoAsync.mockImplementation(async (...args: unknown[]) => {
      const path = args[0] as string;
      if (path === "file:///docs/users/u1/images/avatar.jpg") {
        return { exists: true };
      }
      return { exists: false };
    });
    mockFetchUserProfileRemote.mockResolvedValue(
      createUser({
        avatarUrl: "https://cdn/avatar-remote.jpg",
        avatarLocalPath: "",
      }),
    );

    const { result } = renderHook(() => useUser("u1"));
    let profile: UserData | null = null;

    await act(async () => {
      profile = await result.current.fetchUserFromCloud();
    });

    expect((profile as UserData | null)?.avatarLocalPath).toBe(
      "file:///docs/users/u1/images/avatar.jpg",
    );
    expect(result.current.userData?.avatarLocalPath).toBe(
      "file:///docs/users/u1/images/avatar.jpg",
    );
  });

  it("falls back when cloud fetch throws and handles malformed cached data", async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: true });
    mockFetchUserProfileRemote.mockRejectedValueOnce(new Error("network"));
    mockAsyncStorageGetItem
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("{bad-json")
      .mockResolvedValueOnce(
        JSON.stringify(createUser({ username: "from-cache" })),
      );

    const { result } = renderHook(() => useUser("u1"));

    let malformedProfile: UserData | null = null;
    await act(async () => {
      malformedProfile = await result.current.fetchUserFromCloud();
    });
    expect(malformedProfile).toBeNull();

    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: true });
    mockFetchUserProfileRemote.mockRejectedValueOnce(new Error("network"));

    let fallbackProfile: unknown = null;
    await act(async () => {
      fallbackProfile = await result.current.fetchUserFromCloud();
    });

    expect(fallbackProfile).toEqual(
      expect.objectContaining({ username: "from-cache" }),
    );
  });

  it("captures a bootstrap failure when remote profile fetch fails without cache", async () => {
    const error = Object.assign(new Error("railway 502"), {
      code: "api/http-error",
      source: "ApiClient",
      status: 502,
      retryable: true,
      requestId: "railway-request-1",
    });
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockFetchUserProfileRemote.mockRejectedValue(error);
    mockAsyncStorageGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(result.current.profileBootstrapState).toBe("bootstrapFailed");
    });

    expect(mockCaptureException).toHaveBeenCalledWith(
      "user_profile_bootstrap_failed",
      expect.objectContaining({
        uid: "u1",
        endpoint: "/users/me/profile",
        source: "ApiClient",
        code: "api/http-error",
        status: 502,
        retryable: true,
        requestId: "railway-request-1",
        buildProfile: "production",
        environment: "production",
      }),
      error,
    );
  });

  it("persists language changes through the profile contract", async () => {
    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });
    mockNetInfoFetch.mockClear();

    await act(async () => {
      await result.current.updateUserProfile({
        profile: createProfile({ language: "pl" }),
        avatarLocalPath: undefined,
      });
    });

    const expectedPatch = {
      profile: createProfile({ language: "pl" }),
    };
    expect(mockAssertNoUndefined).toHaveBeenCalledWith(
      expectedPatch,
      "updateUserProfile payload",
    );
    expect(mockEnqueueUserProfileUpdate).toHaveBeenCalledWith(
      "u1",
      expectedPatch,
      expect.objectContaining({
        updatedAt: expect.any(String),
      }),
    );
    expect(result.current.language).toBe("pl");
    expect(mockI18nChangeLanguage).toHaveBeenCalledWith("pl");
  });

  it("keeps mixed profile patch sync on the canonical profile path", async () => {
    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    await act(async () => {
      await result.current.updateUserProfile({
        profile: createProfile({
          language: "pl",
          nutritionProfile: {
            ...createProfile().nutritionProfile,
            age: "31",
          },
        }),
      });
    });

    const expectedPatch = {
      profile: createProfile({
        language: "pl",
        nutritionProfile: {
          ...createProfile().nutritionProfile,
          age: "31",
        },
      }),
    };
    expect(mockAssertNoUndefined).toHaveBeenCalledWith(
      expectedPatch,
      "updateUserProfile payload",
    );
    expect(mockEnqueueUserProfileUpdate).toHaveBeenCalledWith(
      "u1",
      expectedPatch,
      expect.objectContaining({
        updatedAt: expect.any(String),
      }),
    );
    expect(mockPushQueue).toHaveBeenCalledWith("u1");
    expect(result.current.userData?.profile.nutritionProfile.age).toBe("31");
  });

  it("sanitizes local profile patch and blocks protected fields from overriding cache/state", async () => {
    const cachedProfile = createUser({
      avatarUrl: "https://cdn.safe/avatar.jpg",
      avatarlastSyncedAt: "2026-03-10T10:00:00.000Z",
      createdAt: 1,
    });
    mockFetchUserProfileRemote.mockResolvedValue(cachedProfile);
    mockAsyncStorageGetItem.mockImplementation((key: unknown) =>
      Promise.resolve(
        key === "user:profile:u1" ? JSON.stringify(cachedProfile) : null,
      ),
    );

    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(cachedProfile);
    });

    mockAsyncStorageSetItem.mockClear();

    await act(async () => {
      await result.current.updateUserProfile({
        uid: "attacker",
        username: "neo-2",
        profile: createProfile({
          nutritionProfile: {
            ...createProfile().nutritionProfile,
            age: "33",
          },
        }),
        avatarUrl: "https://evil.example/avatar.jpg",
        avatarlastSyncedAt: "9999-01-01T00:00:00.000Z",
        createdAt: 999999,
      });
    });

    expect(result.current.userData).toEqual(
        expect.objectContaining({
          uid: "u1",
          username: "neo-2",
          createdAt: 1,
          avatarUrl: "https://cdn.safe/avatar.jpg",
          avatarlastSyncedAt: "2026-03-10T10:00:00.000Z",
          profile: expect.objectContaining({
            nutritionProfile: expect.objectContaining({ age: "33" }),
          }),
        }),
      );
    const expectedPatch = {
      profile: createProfile({
        nutritionProfile: {
          ...createProfile().nutritionProfile,
          age: "33",
        },
      }),
    };
    expect(mockEnqueueUserProfileUpdate).toHaveBeenCalledWith(
      "u1",
      expectedPatch,
      expect.objectContaining({
        updatedAt: expect.any(String),
      }),
    );

    const lastCacheWrite = mockAsyncStorageSetItem.mock.calls.at(-1) as
      | [string, string]
      | undefined;
    expect(lastCacheWrite).toBeDefined();
    expect(lastCacheWrite?.[0]).toBe("user:profile:u1");
    const parsed = JSON.parse(lastCacheWrite?.[1] ?? "{}") as Partial<UserData>;
    expect(parsed.uid).toBe("u1");
    expect(parsed.createdAt).toBe(1);
    expect(parsed.avatarUrl).toBe("https://cdn.safe/avatar.jpg");
    expect(parsed.avatarlastSyncedAt).toBe("2026-03-10T10:00:00.000Z");
    expect(parsed.profile?.nutritionProfile.age).toBe("33");
    expect(parsed.username).toBe("neo-2");
  });

  it("queues profile update while offline without immediate push", async () => {
    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });

    await act(async () => {
      await result.current.updateUserProfile({
        profile: createProfile({
          nutritionProfile: {
            ...createProfile().nutritionProfile,
            age: "32",
          },
        }),
      });
    });

    const expectedPatch = {
      profile: createProfile({
        nutritionProfile: {
          ...createProfile().nutritionProfile,
          age: "32",
        },
      }),
    };
    expect(mockEnqueueUserProfileUpdate).toHaveBeenCalledWith(
      "u1",
      expectedPatch,
      expect.objectContaining({
        updatedAt: expect.any(String),
      }),
    );
    expect(mockPushQueue).not.toHaveBeenCalledWith("u1");
    expect(result.current.syncState).toBe("pending");
  });

  it("marks profile sync as conflict when dead-letter ops exist", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 0 });

    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    await waitFor(() => {
      expect(result.current.syncState).toBe("conflict");
    });
  });

  it("retries dead-letter profile operations and pushes when online", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 0 });
    mockRetryDeadLetterOps.mockResolvedValue(1);
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    const { result } = renderHook(() => useUser("u1"));

    await waitFor(() => {
      expect(result.current.syncState).toBe("conflict");
    });

    await act(async () => {
      await result.current.retryProfileSync();
    });

    expect(mockRetryDeadLetterOps).toHaveBeenCalledWith({
      uid: "u1",
      kinds: ["update_user_profile", "upload_user_avatar"],
    });
    expect(mockPushQueue).toHaveBeenCalledWith("u1");
  });

  it("sets avatar in offline and online modes", async () => {
    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });

    await act(async () => {
      await result.current.setAvatar("file:///picked.jpg");
    });

    expect(mockSavePhotoLocally).toHaveBeenCalledWith({
      userUid: "u1",
      fileId: "avatar",
      photoUri: "file:///picked.jpg",
    });
    expect(mockEnqueueUserAvatarUpload).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        localPath: "file:///photos/avatar.jpg",
      }),
    );
    expect(mockPushQueue).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      "user:profile:u1",
      expect.stringContaining('"avatarLocalPath":"file:///photos/avatar.jpg"'),
    );

    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: true });

    await act(async () => {
      await result.current.setAvatar("file:///picked-2.jpg");
    });

    expect(mockEnqueueUserAvatarUpload).toHaveBeenCalledTimes(2);
    expect(mockPushQueue).toHaveBeenCalledWith("u1");
  });

  it("delegates account operations and deletes user doc", async () => {
    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    await act(async () => {
      await result.current.changeUsername("morpheus", "pw");
    });

    expect(result.current.userData?.username).toBe("morpheus");
    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      "user:profile:u1",
      expect.stringContaining('"username":"morpheus"'),
    );

    await act(async () => {
      await result.current.changeEmail("new@example.com", "pw");
      await result.current.changePassword("old", "new");
      await result.current.deleteUser("pw");
    });

    expect(mockChangeUsernameService).toHaveBeenCalledWith({
      uid: "u1",
      newUsername: "morpheus",
      password: "pw",
    });
    expect(mockChangeEmailService).toHaveBeenCalledWith({
      newEmail: "new@example.com",
      password: "pw",
    });
    expect(mockChangePasswordService).toHaveBeenCalledWith({
      currentPassword: "old",
      newPassword: "new",
    });
    expect(mockDeleteAccountService).toHaveBeenCalledWith({
      uid: "u1",
      password: "pw",
    });
    expect(result.current.userData).toBeNull();
  });

  it("runs sync convenience helpers and language update for signed-in user", async () => {
    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    await act(async () => {
      await result.current.syncUserProfile();
      await result.current.changeLanguage("it");
    });

    // bootstrap/fetchUserFromCloud + syncUserProfile + changeLanguage pushPendingChanges
    expect(mockNetInfoFetch).toHaveBeenCalledTimes(3);
    expect(result.current.language).toBe("en");
    expect(mockI18nChangeLanguage).toHaveBeenCalledWith("en");
    expect(mockEnqueueUserProfileUpdate).toHaveBeenCalledWith(
      "u1",
      { profile: createProfile({ language: "en" }) },
      expect.objectContaining({
        updatedAt: expect.any(String),
      }),
    );
  });

  it("exports user data for iOS and android SAF branches", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    const iosResult = await result.current.exportUserData();
    expect(iosResult).toBe("file:///docs/fitaly_user_data_2026-03-11.pdf");
    expect(mockExportUserDataService).toHaveBeenCalledWith();
    expect(mockFsCopyAsync).toHaveBeenCalledWith({
      from: "file:///tmp/export.pdf",
      to: "file:///docs/fitaly_user_data_2026-03-11.pdf",
    });
    expect(mockShareAsync).toHaveBeenCalledWith(
      "file:///docs/fitaly_user_data_2026-03-11.pdf",
      expect.objectContaining({
        mimeType: "application/pdf",
      }),
    );

    setPlatformOs("android");

    const androidResult = await result.current.exportUserData();
    expect(androidResult).toBe("content://tree/export.pdf");
    expect(mockFsStorageRequestPermissions).toHaveBeenCalled();
    expect(mockFsStorageCreateFile).toHaveBeenCalled();
    expect(mockFsWriteAsStringAsync).toHaveBeenCalledWith(
      "content://tree/export.pdf",
      "BASE64PDF",
      { encoding: "base64" },
    );
  });

  it("exports user data to app documents when android directory permission is denied", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-12T12:00:00.000Z"));
    mockFsStorageRequestPermissions.mockResolvedValueOnce({
      granted: false,
      directoryUri: null,
    });
    setPlatformOs("android");

    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    const exported = await result.current.exportUserData();
    expect(exported).toBe("file:///docs/fitaly_user_data_2026-03-12.pdf");
    expect(mockFsCopyAsync).toHaveBeenCalledWith({
      from: "file:///tmp/export.pdf",
      to: "file:///docs/fitaly_user_data_2026-03-12.pdf",
    });
  });

  it("exports user data to app documents when SAF flow throws", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-13T12:00:00.000Z"));
    mockFsStorageRequestPermissions.mockRejectedValueOnce(new Error("denied"));
    setPlatformOs("android");

    const { result } = renderHook(() => useUser("u1"));

    await act(async () => {
      emitSnapshot(createUser());
    });

    const exported = await result.current.exportUserData();
    expect(exported).toBe("file:///docs/fitaly_user_data_2026-03-13.pdf");
    expect(mockFsCopyAsync).toHaveBeenCalledWith({
      from: "file:///tmp/export.pdf",
      to: "file:///docs/fitaly_user_data_2026-03-13.pdf",
    });
  });
});
