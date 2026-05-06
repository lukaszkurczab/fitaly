import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RuntimeConfig } from "@/services/core/runtimeConfig";

const mockPost = jest.fn<(path: string, data?: unknown, options?: unknown) => Promise<unknown>>();
const mockGetRuntimeConfig = jest.fn<() => RuntimeConfig>();
const mockNetInfoFetch = jest.fn<
  () => Promise<{ isConnected: boolean | null; isInternetReachable?: boolean | null }>
>();
const mockGetLocales = jest.fn<() => Array<{ languageTag?: string }>>();

function createRuntimeConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    apiBaseUrl: "https://api.example.com",
    apiVersion: "v1",
    backendLoggingEnabled: false,
    telemetryEnabled: true,
    smartRemindersEnabled: true,
    billingDisabled: false,
    buildProfile: "",
    privacyUrl: "",
    termsUrl: "",
    revenuecatAndroidKey: "",
    revenuecatIosKey: "",
    sentryDsn: "",
    sentryEnvironment: "development",
    sentryOrganization: "",
    sentryProject: "",
    ...overrides,
  };
}

jest.mock("@/services/core/apiClient", () => ({
  post: (path: string, data?: unknown, options?: unknown) =>
    mockPost(path, data, options),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockGetRuntimeConfig(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: () => mockNetInfoFetch(),
  },
}));

jest.mock("expo-localization", () => ({
  getLocales: () => mockGetLocales(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { version: "1.0.1", extra: {} },
    nativeBuildVersion: "45",
  },
}));

describe("telemetryClient", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig());
    mockNetInfoFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    mockGetLocales.mockReturnValue([{ languageTag: "pl-PL" }]);
    mockPost.mockResolvedValue({
      acceptedCount: 1,
      duplicateCount: 0,
      rejectedCount: 0,
      rejectedEvents: [],
    });
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");
    telemetryClient.stopTelemetryClient();
    telemetryClient.__resetTelemetryClientForTests();
    await AsyncStorage.clear();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("enqueues tracked events into the buffered queue", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    await telemetryClient.track("meal_logged", { mealInputMethod: "photo" });

    const raw = await AsyncStorage.getItem(
      telemetryClient.TELEMETRY_BUFFER_STORAGE_KEY,
    );
    const payload = JSON.parse(raw || "{}") as {
      sessionId?: string;
      events?: Array<{
        name?: string;
        sessionId?: string;
        actor?: { anonymousId?: string; userId?: string };
        schemaVersion?: number;
        props?: { mealInputMethod?: string };
      }>;
    };

    expect(payload.sessionId).toEqual(expect.any(String));
    expect(payload.events).toHaveLength(1);
    expect(payload.events?.[0]).toMatchObject({
      name: "meal_logged",
      sessionId: payload.sessionId,
      actor: { anonymousId: expect.stringMatching(/^anon_/) },
      schemaVersion: 2,
      props: { mealInputMethod: "photo" },
    });
    expect(payload.events?.[0]?.actor?.userId).toBeUndefined();
  });

  it("deduplicates buffered events by eventId when restoring persisted queue", async () => {
    const duplicateEvent = {
      eventId: "evt-1",
      name: "meal_logged",
      ts: "2026-03-18T12:00:00.000Z",
      props: { mealInputMethod: "photo" },
    };

    await AsyncStorage.setItem(
      "telemetry:buffer:v1",
      JSON.stringify({
        sessionId: "sess-1",
        events: [duplicateEvent, duplicateEvent],
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    await telemetryClient.initTelemetryClient();
    await telemetryClient.flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0]?.[1]).toMatchObject({
      sessionId: "sess-1",
      events: [
        expect.objectContaining({
          ...duplicateEvent,
          sessionId: "sess-1",
          actor: { anonymousId: expect.stringMatching(/^anon_/) },
          schemaVersion: 2,
        }),
      ],
    });
  });

  it("snapshots event-level actor identity so mixed account batches are not reassigned at flush time", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    await telemetryClient.track("session_start", { origin: "app_boot" });
    telemetryClient.setTelemetryUserId("user-a");
    await telemetryClient.track("meal_logged", { mealInputMethod: "manual" });
    telemetryClient.setTelemetryUserId("user-b");
    await telemetryClient.track("paywall_view", {
      source: "meal_text_limit",
      trigger_source: "meal_text_limit_modal",
    });

    await telemetryClient.flush();

    const payload = mockPost.mock.calls[0]?.[1] as
      | { events?: Array<{ actor?: { anonymousId?: string; userId?: string } }> }
      | undefined;

    expect(payload?.events).toHaveLength(3);
    expect(payload?.events?.[0]?.actor).toEqual({
      anonymousId: expect.stringMatching(/^anon_/),
    });
    expect(payload?.events?.[1]?.actor).toEqual({ userId: "user-a" });
    expect(payload?.events?.[2]?.actor).toEqual({ userId: "user-b" });
  });

  it("promotes requestId to the event-level correlation contract when present", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    telemetryClient.setTelemetryUserId("user-1");
    await telemetryClient.track("ai_meal_review_saved", {
      inputMethod: "photo",
      corrected: true,
      ingredientCount: 2,
      requestId: "req-1",
    });
    await telemetryClient.flush();

    expect(mockPost.mock.calls[0]?.[1]).toMatchObject({
      events: [
        expect.objectContaining({
          requestId: "req-1",
          actor: { userId: "user-1" },
        }),
      ],
    });
  });

  it("flushes a batch immediately when the queue reaches the batch limit", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    for (let index = 0; index < 50; index += 1) {
      await telemetryClient.track("meal_logged", { batchIndex: index });
    }

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0]?.[0]).toBe("/api/v2/telemetry/events/batch");
    expect(
      (mockPost.mock.calls[0]?.[1] as { events?: unknown[] } | undefined)?.events,
    ).toHaveLength(50);
  });

  it("retries flushing after backoff when a send attempt fails", async () => {
    mockPost
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        acceptedCount: 1,
        duplicateCount: 0,
        rejectedCount: 0,
        rejectedEvents: [],
      });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    await telemetryClient.track("meal_logged");
    await telemetryClient.flush();
    await telemetryClient.flush();

    expect(mockPost).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_000);
    await telemetryClient.flush();

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(
      await AsyncStorage.getItem(telemetryClient.TELEMETRY_BUFFER_STORAGE_KEY),
    ).toBeNull();
  });

  it("drops a batch permanently when the backend rejects it with a non-retryable 4xx", async () => {
    const error = Object.assign(new Error("invalid telemetry payload"), {
      status: 422,
      retryable: false,
    });
    mockPost.mockRejectedValueOnce(error);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    await telemetryClient.track("weekly_report_opened", {
      reportStatus: "ready",
      insightCount: 2,
      priorityCount: 2,
    });
    await telemetryClient.flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(
      await AsyncStorage.getItem(telemetryClient.TELEMETRY_BUFFER_STORAGE_KEY),
    ).toBeNull();
  });

  it("is a graceful no-op for notification telemetry when telemetry is disabled", async () => {
    mockGetRuntimeConfig.mockReturnValue(
      createRuntimeConfig({ telemetryEnabled: false }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    await telemetryClient.initTelemetryClient();
    await telemetryClient.track("notification_opened", {
      notificationType: "day_fill",
      origin: "user_notifications",
    });
    await telemetryClient.flush();

    expect(mockPost).not.toHaveBeenCalled();
    expect(
      await AsyncStorage.getItem(telemetryClient.TELEMETRY_BUFFER_STORAGE_KEY),
    ).toBeNull();
  });

  it("restores buffered queue from AsyncStorage and flushes it on demand", async () => {
    await AsyncStorage.setItem(
      "telemetry:buffer:v1",
      JSON.stringify({
        sessionId: "sess-restored",
        events: [
          {
            eventId: "evt-restored",
            name: "weekly_report_opened",
            ts: "2026-03-18T12:00:00.000Z",
            props: {
              reportStatus: "ready",
              insightCount: 2,
              priorityCount: 2,
            },
          },
        ],
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const telemetryClient = require("@/services/telemetry/telemetryClient") as typeof import("@/services/telemetry/telemetryClient");

    await telemetryClient.initTelemetryClient();
    await telemetryClient.flush();

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/telemetry/events/batch",
      expect.objectContaining({
        sessionId: "sess-restored",
        app: {
          platform: expect.any(String),
          appVersion: "1.0.1",
          build: "45",
        },
        device: {
          locale: "pl-PL",
          tzOffsetMin: expect.any(Number),
        },
        events: [
          expect.objectContaining({
            eventId: "evt-restored",
            name: "weekly_report_opened",
            sessionId: "sess-restored",
            actor: { anonymousId: expect.stringMatching(/^anon_/) },
            schemaVersion: 2,
          }),
        ],
      }),
      { timeout: 15_000, retryMode: "idempotent" },
    );
  });
});
