import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockLoadAllPrefs = jest.fn<
  (uid: string) => Promise<{
    motivation: { enabled: boolean };
    smartReminders: { enabled: boolean };
    stats: { enabled: boolean };
  }>
>();
const mockSetMotivationPrefs = jest.fn<
  (uid: string, enabled: boolean) => Promise<void>
>();
const mockSetSmartRemindersPrefs = jest.fn<
  (uid: string, enabled: boolean) => Promise<void>
>();
const mockSetStatsPrefs = jest.fn<
  (uid: string, enabled: boolean) => Promise<void>
>();
const mockReconcileAll = jest.fn<(uid: string) => Promise<void>>();
const mockEnsureAndroidChannel = jest.fn<() => Promise<void>>();
const mockCancelSystemNotifications = jest.fn<
  (uid: string, key: string) => Promise<void>
>();
const mockCancelAllReminderScheduling = jest.fn<
  (uid: string) => Promise<void>
>();
const mockGetPermissionsAsync = jest.fn<
  () => Promise<{ granted?: boolean; status?: string }>
>();
const mockRequestPermissionsAsync = jest.fn<
  () => Promise<{ granted?: boolean; status?: string }>
>();

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Linking: {
    openSettings: async () => undefined,
  },
  AppState: {
    addEventListener: (
      _event: "change",
      _listener: (state: "active" | "background" | "inactive") => void,
    ) => ({ remove: jest.fn() }),
  },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
}));

jest.mock("@/services/e2e/fixtures", () => ({
  resolveE2ENotificationPermission: () => null,
}));

jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    loading: false,
    loadAllPrefs: (uid: string) => mockLoadAllPrefs(uid),
    setMotivationPrefs: (uid: string, enabled: boolean) =>
      mockSetMotivationPrefs(uid, enabled),
    setSmartRemindersPrefs: (uid: string, enabled: boolean) =>
      mockSetSmartRemindersPrefs(uid, enabled),
    setStatsPrefs: (uid: string, enabled: boolean) =>
      mockSetStatsPrefs(uid, enabled),
  }),
}));

jest.mock("@/services/notifications/engine", () => ({
  reconcileAll: (uid: string) => mockReconcileAll(uid),
}));

jest.mock("@/services/notifications/localScheduler", () => ({
  ensureAndroidChannel: () => mockEnsureAndroidChannel(),
}));

jest.mock("@/services/notifications/system", () => ({
  cancelSystemNotifications: (uid: string, key: string) =>
    mockCancelSystemNotifications(uid, key),
}));

jest.mock("@/services/reminders/reminderScheduling", () => ({
  cancelAllReminderScheduling: (uid: string) =>
    mockCancelAllReminderScheduling(uid),
}));

describe("useNotificationsScreenState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAllPrefs.mockResolvedValue({
      motivation: { enabled: false },
      smartReminders: { enabled: false },
      stats: { enabled: false },
    });
    mockSetMotivationPrefs.mockResolvedValue(undefined);
    mockSetSmartRemindersPrefs.mockResolvedValue(undefined);
    mockSetStatsPrefs.mockResolvedValue(undefined);
    mockReconcileAll.mockResolvedValue(undefined);
    mockEnsureAndroidChannel.mockResolvedValue(undefined);
    mockCancelSystemNotifications.mockResolvedValue(undefined);
    mockCancelAllReminderScheduling.mockResolvedValue(undefined);
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it("requests permission when enabling smart reminders and permission state is unresolved", async () => {
    mockGetPermissionsAsync.mockImplementation(
      () => new Promise(() => {
        // Intentionally unresolved so hook keeps systemAllowed=null while user toggles.
      }),
    );

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      (require("@/feature/UserProfile/hooks/useNotificationsScreenState") as typeof import("@/feature/UserProfile/hooks/useNotificationsScreenState")).useNotificationsScreenState("user-1"),
    );

    await act(async () => {
      await result.current.onToggleSmartReminders(true);
    });

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("does not keep optimistic smart reminders state when prefs sync fails", async () => {
    mockSetSmartRemindersPrefs.mockRejectedValueOnce(new Error("sync failed"));

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      (require("@/feature/UserProfile/hooks/useNotificationsScreenState") as typeof import("@/feature/UserProfile/hooks/useNotificationsScreenState")).useNotificationsScreenState("user-1"),
    );

    await waitFor(() => {
      expect(result.current.smartRemindersEnabled).toBe(false);
    });

    await act(async () => {
      await result.current.onToggleSmartReminders(true);
    });

    expect(mockSetSmartRemindersPrefs).toHaveBeenCalledWith("user-1", true);
    expect(result.current.smartRemindersEnabled).toBe(false);
    expect(result.current.lastSyncError).toBe("sync failed");
  });
});
