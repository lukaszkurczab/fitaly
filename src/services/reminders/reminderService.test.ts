import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  NoopReminderDecision,
  SendReminderDecision,
  SuppressReminderDecision,
} from "@/services/reminders/reminderTypes";

const mockGet =
  jest.fn<(path: string, options?: unknown) => Promise<unknown>>();
const mockReadPublicEnv = jest.fn<(name: string) => string | undefined>();
const mockWarn = jest.fn<(...args: unknown[]) => void>();
const mockTrackSmartReminderDecisionFailed = jest.fn<() => Promise<void>>();

jest.mock("@/services/core/apiClient", () => ({
  get: (path: string, options?: unknown) => mockGet(path, options),
}));

jest.mock("@/services/core/publicEnv", () => ({
  readPublicEnv: (name: string) => mockReadPublicEnv(name),
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

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackSmartReminderDecisionFailed: () =>
    mockTrackSmartReminderDecisionFailed(),
}));

describe("reminderService", () => {
  function createHealthySendPayload(
    overrides?: Partial<SendReminderDecision>,
  ): SendReminderDecision {
    return {
      dayKey: "2026-03-18",
      computedAt: "2026-03-18T12:00:00Z",
      decision: "send",
      kind: "log_next_meal",
      reasonCodes: ["preferred_window_today", "day_partially_logged"],
      scheduledAtUtc: "2026-03-18T18:30:00Z",
      confidence: 0.84,
      validUntil: "2026-03-18T19:30:00Z",
      ...overrides,
    };
  }

  function createHealthySuppressPayload(
    overrides?: Partial<SuppressReminderDecision>,
  ): SuppressReminderDecision {
    return {
      dayKey: "2026-03-18",
      computedAt: "2026-03-18T12:00:00Z",
      decision: "suppress",
      kind: null,
      reasonCodes: ["quiet_hours"],
      scheduledAtUtc: null,
      confidence: 0.84,
      validUntil: "2026-03-18T19:30:00Z",
      ...overrides,
    };
  }

  function createHealthyNoopPayload(
    overrides?: Partial<NoopReminderDecision>,
  ): NoopReminderDecision {
    return {
      dayKey: "2026-03-18",
      computedAt: "2026-03-18T12:00:00Z",
      decision: "noop",
      kind: null,
      reasonCodes: ["insufficient_signal"],
      scheduledAtUtc: null,
      confidence: 0.84,
      validUntil: "2026-03-18T19:30:00Z",
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackSmartReminderDecisionFailed.mockResolvedValue(undefined);
    mockReadPublicEnv.mockImplementation((name: string) => {
      if (name === "EXPO_PUBLIC_ENABLE_SMART_REMINDERS") {
        return "true";
      }
      return undefined;
    });
  });

  it("fetches reminder decision and keeps the backend payload strict", async () => {
    mockGet.mockResolvedValue(createHealthySendPayload());

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    const tzOffsetMin = service.getDeviceTzOffsetMin();
    expect(mockGet).toHaveBeenCalledWith(
      `/api/v2/users/me/reminders/decision?day=2026-03-18&tzOffsetMin=${tzOffsetMin}`,
      { timeout: 15_000 },
    );
    expect(result.enabled).toBe(true);
    expect(result.source).toBe("remote");
    expect(result.status).toBe("live_success");
    expect(result.decision?.kind).toBe("log_next_meal");
  });

  it("includes tzOffsetMin in the endpoint URL derived from device timezone", async () => {
    mockGet.mockResolvedValue(createHealthySendPayload());

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    await service.getReminderDecision("user-1", { dayKey: "2026-03-18" });

    const calledUrl = mockGet.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("&tzOffsetMin=");
    const match = calledUrl.match(/tzOffsetMin=(-?\d+)/);
    expect(match).not.toBeNull();
    const offset = Number(match![1]);
    expect(offset).toBeGreaterThanOrEqual(-840);
    expect(offset).toBeLessThanOrEqual(840);
  });

  it("getDeviceTzOffsetMin returns negated Date.getTimezoneOffset", () => {
    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = service.getDeviceTzOffsetMin();
    const expected = -new Date().getTimezoneOffset();
    expect(result).toBe(expected);
  });

  it("defaults smart reminders on and derives canonical local day keys", () => {
    mockReadPublicEnv.mockReturnValue(undefined);
    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    expect(service.isSmartRemindersEnabled()).toBe(true);
    expect(
      service.getCurrentReminderDecisionDayKey(
        new Date("2026-03-18T12:00:00.000Z"),
      ),
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("treats blank smart reminder flags as enabled", () => {
    mockReadPublicEnv.mockReturnValue("   ");
    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    expect(service.isSmartRemindersEnabled()).toBe(true);
  });

  it("returns disabled state and skips the endpoint when smart reminders are globally disabled", async () => {
    mockReadPublicEnv.mockImplementation((name: string) => {
      if (name === "EXPO_PUBLIC_ENABLE_SMART_REMINDERS") {
        return "false";
      }
      return undefined;
    });

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.enabled).toBe(false);
    expect(result.source).toBe("disabled");
    expect(result.status).toBe("disabled");
    expect(result.decision).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns a no-user fallback and skips the endpoint when uid is missing", async () => {
    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision(null, {
      dayKey: "2026-03-18",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("no_user");
    expect(result.decision).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns profile-not-ready fallback and skips the endpoint before product readiness", async () => {
    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
      productReady: false,
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("profile_not_ready");
    expect(result.decision).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("rejects contract drift as invalid payload instead of normalizing it away", async () => {
    mockGet.mockResolvedValue({
      ...createHealthySendPayload(),
      decision: "maybe_later",
    });

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("invalid_payload");
    expect(result.decision).toBeNull();
    expect(result.error).toEqual(
      expect.objectContaining({ code: "reminder/invalid-contract-payload" }),
    );
    expect(mockTrackSmartReminderDecisionFailed).toHaveBeenCalled();
  });

  it("rejects non-send payloads that illegally carry kind or schedule", async () => {
    mockGet.mockResolvedValue({
      ...createHealthySuppressPayload(),
      kind: "log_next_meal",
      scheduledAtUtc: "2026-03-18T18:30:00Z",
    });

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("invalid_payload");
    expect(result.decision).toBeNull();
  });

  it("rejects reason codes that do not match the decision semantics", async () => {
    mockGet.mockResolvedValue({
      ...createHealthySendPayload(),
      reasonCodes: ["quiet_hours"],
    });

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("invalid_payload");
    expect(result.decision).toBeNull();
  });

  it("rejects non-canonical UTC timestamps instead of relying on Date.parse", async () => {
    mockGet.mockResolvedValue({
      ...createHealthySendPayload(),
      scheduledAtUtc: "2026-03-18T18:30:00+00:00",
    });

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("invalid_payload");
    expect(result.decision).toBeNull();
  });

  it("surfaces backend failures distinctly when the endpoint is unavailable", async () => {
    mockGet.mockRejectedValue(new Error("backend down"));

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("service_unavailable");
    expect(result.decision).toBeNull();
    expect(result.error).toEqual(expect.any(Error));
    expect(mockWarn).toHaveBeenCalled();
    expect(mockTrackSmartReminderDecisionFailed).toHaveBeenCalled();
  });

  it("accepts a valid suppress payload", async () => {
    mockGet.mockResolvedValue(createHealthySuppressPayload());

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.status).toBe("live_success");
    expect(result.decision?.decision).toBe("suppress");
  });

  it("accepts a valid noop payload", async () => {
    mockGet.mockResolvedValue(createHealthyNoopPayload());

    const service = jest.requireActual(
      "@/services/reminders/reminderService",
    ) as typeof import("@/services/reminders/reminderService");

    const result = await service.getReminderDecision("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.status).toBe("live_success");
    expect(result.decision?.decision).toBe("noop");
  });
});
