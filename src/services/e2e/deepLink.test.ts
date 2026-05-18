import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { handleE2EDeepLink } from "@/services/e2e/deepLink";

const mockAsyncStorageClear = jest.fn<() => Promise<void>>();
const mockGetApp = jest.fn();
const mockSignOut = jest.fn<() => Promise<void>>();
const mockResetNavigation = jest.fn();
const mockStopSyncLoop = jest.fn();
const mockResetOfflineStorage = jest.fn();
const mockSetE2EForcedOffline = jest.fn();
const mockMarkE2EResetStarted = jest.fn();
const mockMarkE2EResetReady = jest.fn();

let mockE2EEnabled = true;
let mockCurrentUser: { uid: string } | null = null;

jest.mock("@react-native-async-storage/async-storage", () => ({
  clear: () => mockAsyncStorageClear(),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: () => mockGetApp(),
}));

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: () => ({ currentUser: mockCurrentUser }),
  signOut: () => mockSignOut(),
}));

jest.mock("@/navigation/navigate", () => ({
  resetNavigation: (...args: unknown[]) => mockResetNavigation(...args),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  stopSyncLoop: () => mockStopSyncLoop(),
}));

jest.mock("@/services/offline/db", () => ({
  resetOfflineStorage: () => mockResetOfflineStorage(),
}));

jest.mock("@/services/e2e/connectivity", () => ({
  setE2EForcedOffline: (...args: unknown[]) =>
    mockSetE2EForcedOffline(...args),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => mockE2EEnabled,
}));

jest.mock("@/services/e2e/status", () => ({
  markE2EResetStarted: () => mockMarkE2EResetStarted(),
  markE2EResetReady: (...args: unknown[]) => mockMarkE2EResetReady(...args),
}));

describe("handleE2EDeepLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorageClear.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockE2EEnabled = true;
    mockCurrentUser = { uid: "user-1" };
  });

  it("logs out and marks the login reset target as ready", async () => {
    const handled = await handleE2EDeepLink("fitaly://e2e/reset?logout=1");

    expect(handled).toBe(true);
    expect(mockMarkE2EResetStarted).toHaveBeenCalledTimes(1);
    expect(mockStopSyncLoop).toHaveBeenCalledTimes(1);
    expect(mockResetOfflineStorage).toHaveBeenCalledTimes(1);
    expect(mockAsyncStorageClear).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSetE2EForcedOffline).toHaveBeenNthCalledWith(1, false);
    expect(mockSetE2EForcedOffline).toHaveBeenNthCalledWith(2, false);
    expect(mockResetNavigation).not.toHaveBeenCalled();
    expect(mockMarkE2EResetReady).toHaveBeenCalledWith("login");
  });

  it("keeps the signed-in route and marks forced offline as ready", async () => {
    const handled = await handleE2EDeepLink(
      "fitaly://e2e/reset?offline=1&logout=0",
    );

    expect(handled).toBe(true);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockSetE2EForcedOffline).toHaveBeenNthCalledWith(1, false);
    expect(mockSetE2EForcedOffline).toHaveBeenNthCalledWith(2, true);
    expect(mockResetNavigation).toHaveBeenCalledWith("Home");
    expect(mockMarkE2EResetReady).toHaveBeenCalledWith("offline");
  });

  it("marks home ready when reset keeps an active session online", async () => {
    const handled = await handleE2EDeepLink("fitaly://e2e/reset?logout=0");

    expect(handled).toBe(true);
    expect(mockResetNavigation).toHaveBeenCalledWith("Home");
    expect(mockMarkE2EResetReady).toHaveBeenCalledWith("home");
  });

  it("ignores reset links outside e2e mode", async () => {
    mockE2EEnabled = false;

    const handled = await handleE2EDeepLink("fitaly://e2e/reset?logout=1");

    expect(handled).toBe(false);
    expect(mockResetNavigation).not.toHaveBeenCalled();
    expect(mockMarkE2EResetStarted).not.toHaveBeenCalled();
  });
});
