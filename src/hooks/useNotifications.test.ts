import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { useNotifications } from "@/hooks/useNotifications";

const mockFetchNotificationPrefs = jest.fn<(uid: string) => Promise<unknown>>();
const mockUpdateNotificationPrefs =
  jest.fn<(uid: string, notifications: unknown) => Promise<void>>();
const mockStorageGetItem =
  jest.fn<(...args: unknown[]) => Promise<string | null>>();
const mockStorageSetItem = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.mock("@/services/notifications/notificationsRepository", () => ({
  fetchNotificationPrefs: (uid: string) => mockFetchNotificationPrefs(uid),
  updateNotificationPrefs: (uid: string, notifications: unknown) =>
    mockUpdateNotificationPrefs(uid, notifications),
}));

jest.mock("@/services/e2e/fixtures", () => ({
  getE2EFixtureState: () => null,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockStorageGetItem(...args),
    setItem: (...args: unknown[]) => mockStorageSetItem(...args),
  },
}));

describe("useNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockFetchNotificationPrefs.mockResolvedValue({});
    mockUpdateNotificationPrefs.mockResolvedValue(undefined);
    mockStorageGetItem.mockResolvedValue(null);
    mockStorageSetItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("exposes stable non-loading state", async () => {
    const { result } = renderHook(() => useNotifications(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("loads all prefs from cloud and caches them", async () => {
    mockFetchNotificationPrefs.mockResolvedValueOnce({
      notifications: {
        motivationEnabled: true,
        smartRemindersEnabled: false,
        statsEnabled: true,
      },
    });

    const { result } = renderHook(() => useNotifications("u1"));

    await expect(result.current.loadAllPrefs("u1")).resolves.toEqual({
      motivation: { enabled: true },
      smartReminders: { enabled: false },
      stats: { enabled: true },
    });

    expect(mockStorageSetItem).toHaveBeenCalledWith(
      "notif:prefs:u1:motivation",
      JSON.stringify({ enabled: true }),
    );
    expect(mockStorageSetItem).toHaveBeenCalledWith(
      "notif:prefs:u1:smart-reminders",
      JSON.stringify({ enabled: false }),
    );
    expect(mockStorageSetItem).toHaveBeenCalledWith(
      "notif:prefs:u1:stats",
      JSON.stringify({ enabled: true }),
    );
  });

  it("falls back to cached prefs and defaults when cache is malformed or missing", async () => {
    mockFetchNotificationPrefs.mockRejectedValue(new Error("network"));

    mockStorageGetItem.mockImplementation(async (...args: unknown[]) => {
      const key = args[0] as string;

      if (key === "notif:prefs:u1:motivation") {
        return JSON.stringify({ enabled: true });
      }
      if (key === "notif:prefs:u1:smart-reminders") {
        return "{bad-json";
      }
      if (key === "notif:prefs:u1:stats") {
        return null;
      }

      return null;
    });

    const { result } = renderHook(() => useNotifications("u1"));

    await expect(result.current.loadAllPrefs("u1")).resolves.toEqual({
      motivation: { enabled: true },
      smartReminders: { enabled: true },
      stats: { enabled: false },
    });
  });

  it("uses defaults for missing cloud fields and still caches them", async () => {
    mockFetchNotificationPrefs.mockResolvedValueOnce({
      notifications: {},
    });

    const { result } = renderHook(() => useNotifications("u1"));

    await expect(result.current.loadAllPrefs("u1")).resolves.toEqual({
      motivation: { enabled: false },
      smartReminders: { enabled: true },
      stats: { enabled: false },
    });

    expect(mockStorageSetItem).toHaveBeenCalledWith(
      "notif:prefs:u1:motivation",
      JSON.stringify({ enabled: false }),
    );
    expect(mockStorageSetItem).toHaveBeenCalledWith(
      "notif:prefs:u1:smart-reminders",
      JSON.stringify({ enabled: true }),
    );
    expect(mockStorageSetItem).toHaveBeenCalledWith(
      "notif:prefs:u1:stats",
      JSON.stringify({ enabled: false }),
    );
  });

  it("persists prefs to cache only after successful backend sync", async () => {
    mockUpdateNotificationPrefs
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useNotifications("u1"));

    await act(async () => {
      await result.current.setMotivationPrefs("u1", true);
    });
    expect(mockUpdateNotificationPrefs).toHaveBeenNthCalledWith(1, "u1", {
      motivationEnabled: true,
    });

    await act(async () => {
      await result.current.setSmartRemindersPrefs("u1", false);
    });
    expect(mockUpdateNotificationPrefs).toHaveBeenNthCalledWith(2, "u1", {
      smartRemindersEnabled: false,
    });

    await expect(result.current.setStatsPrefs("u1", false)).rejects.toBeInstanceOf(
      Error,
    );
    expect(mockUpdateNotificationPrefs).toHaveBeenNthCalledWith(3, "u1", {
      statsEnabled: false,
    });

    expect(mockStorageSetItem).toHaveBeenCalledWith(
      "notif:prefs:u1:motivation",
      JSON.stringify({ enabled: true }),
    );
    expect(mockStorageSetItem).toHaveBeenCalledWith(
      "notif:prefs:u1:smart-reminders",
      JSON.stringify({ enabled: false }),
    );
    expect(mockStorageSetItem).not.toHaveBeenCalledWith(
      "notif:prefs:u1:stats",
      JSON.stringify({ enabled: false }),
    );
  });
});
