import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { WeeklyReport } from "@/services/weeklyReport/weeklyReportTypes";
import { createServiceError } from "@/services/contracts/serviceError";

const mockGet = jest.fn<(path: string, options?: unknown) => Promise<unknown>>();
const mockReadPublicEnv = jest.fn<(name: string) => string | undefined>();
const mockWarn = jest.fn<(...args: unknown[]) => void>();

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

describe("weeklyReportService", () => {
  function createPayload(overrides?: Partial<WeeklyReport>): WeeklyReport {
    return {
      status: "ready",
      period: {
        startDay: "2026-03-09",
        endDay: "2026-03-15",
      },
      summary: "Logging stayed steady across the week.",
      insights: [
        {
          type: "consistency",
          importance: "high",
          tone: "positive",
          title: "You stayed consistent on most days",
          body: "You had valid logging on 6 of 7 days, which made the week readable.",
          reasonCodes: ["valid_logged_days_7_high"],
        },
      ],
      priorities: [
        {
          type: "maintain_consistency",
          text: "Keep the same logging rhythm on most days.",
          reasonCodes: ["maintain_best_pattern"],
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadPublicEnv.mockImplementation((name: string) => {
      if (name === "EXPO_PUBLIC_ENABLE_WEEKLY_REPORTS") {
        return "true";
      }
      return undefined;
    });
  });

  it("fetches and normalizes a ready weekly report", async () => {
    mockGet.mockResolvedValue(createPayload());

    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/reports/weekly?weekEnd=2026-03-15",
      { timeout: 15_000 },
    );
    expect(result.enabled).toBe(true);
    expect(result.status).toBe("live_success");
    expect(result.report.status).toBe("ready");
    expect(result.report.insights[0]?.type).toBe("consistency");
  });

  it("derives the default weekEnd from UTC yesterday", () => {
    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = service.getCurrentWeeklyReportWeekEnd(
      new Date("2026-03-22T00:30:00+01:00"),
    );

    expect(result).toBe("2026-03-20");
  });

  it("does not gate weekly report fetch behind mobile feature flags", async () => {
    mockReadPublicEnv.mockImplementation((name: string) => {
      if (name === "EXPO_PUBLIC_ENABLE_WEEKLY_REPORTS") {
        return "false";
      }
      return undefined;
    });
    mockGet.mockResolvedValue(createPayload());

    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(result.enabled).toBe(true);
    expect(result.source).toBe("remote");
    expect(result.status).toBe("live_success");
    expect(result.report.status).toBe("ready");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("supports insufficient-data payloads", async () => {
    mockGet.mockResolvedValue(
      createPayload({
        status: "insufficient_data",
        summary: "Log a few complete days to unlock a weekly report.",
        insights: [],
        priorities: [],
      }),
    );

    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(result.status).toBe("live_success");
    expect(result.report.status).toBe("insufficient_data");
    expect(result.report.insights).toEqual([]);
  });

  it("falls back to unavailable state on invalid payload", async () => {
    mockGet.mockResolvedValue({
      ...createPayload(),
      insights: [{ ...createPayload().insights[0], type: "mystery_type" }],
    });

    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("invalid_payload");
    expect(result.report.status).toBe("not_available");
    expect(result.error).toEqual(
      expect.objectContaining({ code: "weekly-report/invalid-contract-payload" }),
    );
  });

  it("maps 403 WEEKLY_REPORT_PREMIUM_REQUIRED to premium_required", async () => {
    mockGet.mockRejectedValue(
      Object.assign(
        createServiceError({
          code: "api/http-error",
          source: "ApiClient",
          retryable: false,
          message: "WEEKLY_REPORT_PREMIUM_REQUIRED",
        }),
        {
          status: 403,
          details: { detail: "WEEKLY_REPORT_PREMIUM_REQUIRED" },
        },
      ),
    );

    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("premium_required");
    expect(result.report.status).toBe("not_available");
  });

  it("maps 400 invalid weekEnd response to bad_request", async () => {
    mockGet.mockRejectedValue(
      Object.assign(
        createServiceError({
          code: "api/http-error",
          source: "ApiClient",
          retryable: false,
          message: "Invalid weekEnd. Expected YYYY-MM-DD.",
        }),
        {
          status: 400,
          details: { detail: "Invalid weekEnd. Expected YYYY-MM-DD." },
        },
      ),
    );

    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-13-40",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("bad_request");
    expect(result.report.status).toBe("not_available");
  });

  it("maps 503 disabled response to feature_disabled and not premium_required", async () => {
    mockGet.mockRejectedValue(
      Object.assign(
        createServiceError({
          code: "api/http-error",
          source: "ApiClient",
          retryable: true,
          message: "Weekly reports are disabled",
        }),
        {
          status: 503,
          details: { detail: "Weekly reports are disabled" },
        },
      ),
    );

    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("feature_disabled");
    expect(result.status).not.toBe("premium_required");
    expect(result.report.status).toBe("not_available");
  });

  it("returns no-user fallback without calling the endpoint when uid is missing", async () => {
    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport(null, {
      weekEnd: "2026-03-15",
    });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("no_user");
    expect(result.enabled).toBe(true);
    expect(result.report.status).toBe("not_available");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("treats non-object payload as invalid contract", async () => {
    mockGet.mockResolvedValue("invalid-payload");
    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(result.status).toBe("invalid_payload");
    expect(result.report.status).toBe("not_available");
  });

  it("treats malformed period and oversized priorities as invalid contract", async () => {
    mockGet.mockResolvedValue({
      ...createPayload(),
      period: null,
      priorities: [
        ...createPayload().priorities,
        { type: "maintain_consistency", text: "x", reasonCodes: ["x"] },
        { type: "maintain_consistency", text: "y", reasonCodes: ["y"] },
      ],
    });
    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(result.status).toBe("invalid_payload");
    expect(result.report.status).toBe("not_available");
  });

  it("treats non-string reasonCodes entries as invalid contract", async () => {
    mockGet.mockResolvedValue({
      ...createPayload(),
      insights: [
        {
          ...createPayload().insights[0],
          reasonCodes: ["ok", 123],
        },
      ],
    });
    const service =
      jest.requireActual("@/services/weeklyReport/weeklyReportService") as typeof import("@/services/weeklyReport/weeklyReportService");

    const result = await service.getWeeklyReport("user-1", {
      weekEnd: "2026-03-15",
    });

    expect(result.status).toBe("invalid_payload");
    expect(result.report.status).toBe("not_available");
  });
});
