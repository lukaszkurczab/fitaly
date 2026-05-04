import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockTrackNotificationOpened = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockWarn = jest.fn<(...args: unknown[]) => void>();

let mockNotificationReceivedListener: ((notification: {
  request: { content: { data?: unknown } };
}) => void) | null = null;
let mockNotificationResponseListener: ((response: {
  actionIdentifier?: string;
  notification: { request: { content: { data?: unknown } } };
}) => void) | null = null;
let mockAppStateChangeListener: ((state: "active" | "background" | "inactive") => void) | null =
  null;

const mockReceivedSubscription = { remove: jest.fn() };
const mockResponseSubscription = { remove: jest.fn() };
const mockAppStateSubscription = { remove: jest.fn() };

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackNotificationOpened: (input: Record<string, unknown>) =>
    mockTrackNotificationOpened(input),
}));

jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: (
    listener: (notification: { request: { content: { data?: unknown } } }) => void,
  ) => {
    mockNotificationReceivedListener = listener;
    return mockReceivedSubscription;
  },
  addNotificationResponseReceivedListener: (
    listener: (response: {
      actionIdentifier?: string;
      notification: { request: { content: { data?: unknown } } };
    }) => void,
  ) => {
    mockNotificationResponseListener = listener;
    return mockResponseSubscription;
  },
}));

jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (
      _event: "change",
      listener: (state: "active" | "background" | "inactive") => void,
    ) => {
      mockAppStateChangeListener = listener;
      return mockAppStateSubscription;
    },
  },
}));

jest.mock("@/utils/debug", () => ({
  debugScope: () => ({
    log: jest.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: jest.fn(),
    time: jest.fn(),
    timeEnd: jest.fn(),
    child: () => ({
      log: jest.fn(),
      warn: (...args: unknown[]) => mockWarn(...args),
      error: jest.fn(),
      time: jest.fn(),
      timeEnd: jest.fn(),
      child: jest.fn(),
    }),
  }),
}));

describe("notificationTelemetry", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");
    service.__resetNotificationTelemetryForTests();
    jest.clearAllMocks();
    mockNotificationReceivedListener = null;
    mockNotificationResponseListener = null;
    mockAppStateChangeListener = null;
    mockTrackNotificationOpened.mockResolvedValue(undefined);
  });

  it("resolveNotificationTelemetryContext returns null context for non-record data", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveNotificationTelemetryContext } = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    expect(resolveNotificationTelemetryContext(null)).toEqual({ notificationType: null, origin: null });
    expect(resolveNotificationTelemetryContext("string")).toEqual({ notificationType: null, origin: null });
    expect(resolveNotificationTelemetryContext(42)).toEqual({ notificationType: null, origin: null });
  });

  it("resolveNotificationTelemetryContext uses system_notifications when only sys field present", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveNotificationTelemetryContext } = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    expect(resolveNotificationTelemetryContext({ sys: "weekly_summary" })).toEqual({
      notificationType: "weekly_summary",
      origin: "system_notifications",
    });
  });

  it("resolveNotificationTelemetryContext uses user_notifications when only notifId present", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveNotificationTelemetryContext } = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    expect(resolveNotificationTelemetryContext({ notifId: "notif-123" })).toEqual({
      notificationType: null,
      origin: "user_notifications",
    });
  });

  it("resolveNotificationTelemetryContext returns null context when record has no recognized fields", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveNotificationTelemetryContext } = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    expect(resolveNotificationTelemetryContext({ foo: "bar" })).toEqual({
      notificationType: null,
      origin: null,
    });
  });

  it("second initNotificationTelemetry call is a no-op — listeners registered only once", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    service.initNotificationTelemetry();
    service.initNotificationTelemetry();

    // If init ran twice, addNotificationReceivedListener would be called twice
    // We verify by checking the subscription.remove counts after stop
    service.stopNotificationTelemetry();
    expect(mockReceivedSubscription.remove).toHaveBeenCalledTimes(1);
  });

  it("stopNotificationTelemetry is safe to call when not initialized", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    // Never called init — subscriptions are null; should not throw
    expect(() => service.stopNotificationTelemetry()).not.toThrow();
    expect(mockReceivedSubscription.remove).not.toHaveBeenCalled();
  });

  it("safeTrack swallows telemetry errors and logs a warning", async () => {
    mockTrackNotificationOpened.mockRejectedValueOnce(new Error("network"));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    service.initNotificationTelemetry();
    mockNotificationResponseListener?.({
      actionIdentifier: "DEFAULT",
      notification: {
        request: {
          content: {
            data: { type: "meal_reminder", origin: "user_notifications" },
          },
        },
      },
    });
    await Promise.resolve();
    expect(mockWarn).toHaveBeenCalled();
  });

  it("tracks notification opened events from Expo listeners", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    service.initNotificationTelemetry();
    mockNotificationReceivedListener?.({
      request: {
        content: {
          data: { type: "meal_reminder", origin: "user_notifications" },
        },
      },
    });

    mockAppStateChangeListener?.("background");
    mockNotificationResponseListener?.({
      actionIdentifier: "DEFAULT",
      notification: {
        request: {
          content: {
            data: { sys: "stats_weekly_summary", origin: "system_notifications" },
          },
        },
      },
    });

    await Promise.resolve();

    expect(mockTrackNotificationOpened).toHaveBeenCalledWith({
      notificationType: "stats_weekly_summary",
      origin: "system_notifications",
      openedFromBackground: true,
      actionIdentifier: "DEFAULT",
    });
  });

  it("tracks smart reminder opens only through generic notification_opened", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    service.initNotificationTelemetry();
    mockNotificationResponseListener?.({
      actionIdentifier: "DEFAULT",
      notification: {
        request: {
          content: {
            data: {
              type: "meal_reminder",
              origin: "system_notifications",
              smartReminder: true,
              reminderKind: "log_next_meal",
              scheduledWindow: "evening",
            },
          },
        },
      },
    });

    await Promise.resolve();

    expect(mockTrackNotificationOpened).toHaveBeenCalledWith({
      notificationType: "meal_reminder",
      origin: "system_notifications",
      openedFromBackground: false,
      actionIdentifier: "DEFAULT",
    });
  });

  it("cleans up listeners on stop", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/notifications/notificationTelemetry") as typeof import("@/services/notifications/notificationTelemetry");

    service.initNotificationTelemetry();
    service.stopNotificationTelemetry();

    expect(mockReceivedSubscription.remove).toHaveBeenCalled();
    expect(mockResponseSubscription.remove).toHaveBeenCalled();
    expect(mockAppStateSubscription.remove).toHaveBeenCalled();
  });
});
