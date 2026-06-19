import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { handleE2EDeepLink } from "@/services/e2e/deepLink";

const mockAsyncStorageClear = jest.fn<() => Promise<void>>();
const mockGetApp = jest.fn();
const mockSignOut = jest.fn<() => Promise<void>>();
const mockResetNavigation = jest.fn();
const mockStopSyncLoop = jest.fn();
const mockRunReconnectReconcile = jest.fn<(uid: string) => Promise<unknown>>();
const mockResetOfflineStorage = jest.fn();
const mockSetE2EForcedOffline = jest.fn();
const mockMarkE2EResetStarted = jest.fn();
const mockMarkE2EResetReady = jest.fn();
const mockMarkE2ESeedReady = jest.fn();
const mockMarkE2ESeedError = jest.fn();
const mockApplyE2ESeedCommand = jest.fn<(input: unknown) => Promise<string[]>>();
const mockResetE2EFixtureState = jest.fn<() => Promise<void>>();

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
  runReconnectReconcile: (uid: string) => mockRunReconnectReconcile(uid),
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
  markE2ESeedReady: (...args: unknown[]) => mockMarkE2ESeedReady(...args),
  markE2ESeedError: (...args: unknown[]) => mockMarkE2ESeedError(...args),
  markE2EResetStarted: () => mockMarkE2EResetStarted(),
  markE2EResetReady: (...args: unknown[]) => mockMarkE2EResetReady(...args),
}));

jest.mock("@/services/e2e/fixtures", () => ({
  parseE2ESeedCommand: (params: Record<string, string>) => ({
    fixture: params.fixture,
    credits: params.credits,
    ai: params.ai,
    barcode: params.barcode,
    billing: params.billing,
    chat: params.chat,
    shareExport: params.shareExport,
    notificationPermission: params.notificationPermission,
    reminder: params.reminder,
    weeklyReport: params.weeklyReport,
    aiConsent: params.aiConsent,
    aiConsentGrant: params.aiConsentGrant,
    aiConsentRevoke: params.aiConsentRevoke,
    smartMemory: params.smartMemory,
    knownPattern: params.knownPattern,
    planning: params.planning,
    historyAssert: params.historyAssert,
    telemetryBaseline: params.telemetryBaseline,
    telemetryAssert: params.telemetryAssert,
  }),
  applyE2ESeedCommand: (input: unknown) => mockApplyE2ESeedCommand(input),
  resetE2EFixtureState: () => mockResetE2EFixtureState(),
}));

describe("handleE2EDeepLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorageClear.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockApplyE2ESeedCommand.mockResolvedValue([]);
    mockResetE2EFixtureState.mockResolvedValue(undefined);
    mockRunReconnectReconcile.mockResolvedValue(undefined);
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

  it("applies seed links and marks all seeded targets ready", async () => {
    mockApplyE2ESeedCommand.mockResolvedValue([
      "fixture-user-with-today-meal",
      "credits-none",
      "smartMemory-active",
    ]);

    const handled = await handleE2EDeepLink(
      "fitaly://e2e/seed?fixture=user-with-today-meal&credits=none&smartMemory=active",
    );

    expect(handled).toBe(true);
    expect(mockApplyE2ESeedCommand).toHaveBeenCalledWith({
      uid: "user-1",
      command: {
        fixture: "user-with-today-meal",
        credits: "none",
        ai: undefined,
        barcode: undefined,
        billing: undefined,
        chat: undefined,
        shareExport: undefined,
      notificationPermission: undefined,
      reminder: undefined,
      weeklyReport: undefined,
      aiConsent: undefined,
      aiConsentGrant: undefined,
      aiConsentRevoke: undefined,
      smartMemory: "active",
      knownPattern: undefined,
      planning: undefined,
      historyAssert: undefined,
      telemetryBaseline: undefined,
      telemetryAssert: undefined,
      },
    });
    expect(mockMarkE2ESeedReady).toHaveBeenCalledWith([
      "fixture-user-with-today-meal",
      "credits-none",
      "smartMemory-active",
    ]);
    expect(mockMarkE2EResetStarted).not.toHaveBeenCalled();
  });

  it("ignores seed links with no valid seed command", async () => {
    mockApplyE2ESeedCommand.mockResolvedValue([]);

    const handled = await handleE2EDeepLink("fitaly://e2e/seed?fixture=unknown");

    expect(handled).toBe(false);
    expect(mockMarkE2ESeedReady).not.toHaveBeenCalled();
    expect(mockMarkE2ESeedError).toHaveBeenCalledWith("seed-empty");
  });

  it("marks seed errors explicitly instead of leaving stale readiness markers", async () => {
    mockApplyE2ESeedCommand.mockRejectedValueOnce(
      Object.assign(new Error("seed failed"), {
        code: "e2e/known-pattern-seed-unavailable",
      }),
    );

    const handled = await handleE2EDeepLink(
      "fitaly://e2e/seed?fixture=activated-user-empty&knownPattern=candidate",
    );

    expect(handled).toBe(false);
    expect(mockApplyE2ESeedCommand).toHaveBeenCalledWith({
      uid: "user-1",
      command: expect.objectContaining({
        fixture: "activated-user-empty",
        knownPattern: "candidate",
      }),
    });
    expect(mockMarkE2ESeedReady).not.toHaveBeenCalled();
    expect(mockMarkE2ESeedError).toHaveBeenCalledWith(
      "seed-e2e-known-pattern-seed-unavailable",
    );
  });

  it("toggles connectivity without clearing local state or signing out", async () => {
    const handled = await handleE2EDeepLink(
      "fitaly://e2e/connectivity?offline=1",
    );

    expect(handled).toBe(true);
    expect(mockSetE2EForcedOffline).toHaveBeenCalledWith(true);
    expect(mockRunReconnectReconcile).not.toHaveBeenCalled();
    expect(mockAsyncStorageClear).not.toHaveBeenCalled();
    expect(mockResetOfflineStorage).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockMarkE2EResetReady).toHaveBeenCalledWith("offline");
  });

  it("runs reconnect reconcile when forced connectivity returns online", async () => {
    const handled = await handleE2EDeepLink(
      "fitaly://e2e/connectivity?offline=0",
    );

    expect(handled).toBe(true);
    expect(mockSetE2EForcedOffline).toHaveBeenCalledWith(false);
    expect(mockRunReconnectReconcile).toHaveBeenCalledWith("user-1");
    expect(mockMarkE2EResetReady).toHaveBeenCalledWith("home");
  });
});
