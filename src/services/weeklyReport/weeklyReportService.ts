import { get } from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { createServiceError } from "@/services/contracts/serviceError";
import {
  asString,
  isRecord,
} from "@/services/contracts/guards";
import { getErrorStatus } from "@/services/contracts/serviceError";
import { debugScope } from "@/utils/debug";
import {
  isWeeklyReportDayKey,
  isWeeklyReportInsightImportance,
  isWeeklyReportInsightTone,
  isWeeklyReportInsightType,
  isWeeklyReportPriorityType,
  isWeeklyReportStatus,
} from "@/services/weeklyReport/weeklyReportContract";
import type {
  WeeklyReport,
  WeeklyReportInsight,
  WeeklyReportPriority,
  WeeklyReportResult,
  WeeklyReportResultStatus,
} from "@/services/weeklyReport/weeklyReportTypes";

const log = debugScope("WeeklyReportService");
const WEEKLY_REPORT_ENDPOINT = withV2("/users/me/reports/weekly");
const WEEKLY_REPORT_SERVICE_SOURCE = "WeeklyReportService";
const WEEKLY_REPORT_PREMIUM_REQUIRED_DETAIL = "WEEKLY_REPORT_PREMIUM_REQUIRED";
const WEEKLY_REPORTS_DISABLED_DETAIL = "Weekly reports are disabled";

function toDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentWeeklyReportWeekEnd(now: Date = new Date()): string {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() - 1);
  return toDayKey(value);
}

function normalizeWeekEnd(weekEnd?: string | null): string {
  const normalized = weekEnd?.trim();
  return normalized || getCurrentWeeklyReportWeekEnd();
}

function buildEndpoint(weekEnd: string): string {
  return `${WEEKLY_REPORT_ENDPOINT}?weekEnd=${encodeURIComponent(weekEnd)}`;
}

function toStrictString(value: unknown): string | null {
  const normalized = asString(value)?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function toStrictStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map((item) => toStrictString(item));
  if (items.some((item) => item === null)) {
    return null;
  }

  return items as string[];
}

function createInvalidWeeklyReportPayloadError(reason: string, payload?: unknown): Error {
  return createServiceError({
    code: "weekly-report/invalid-contract-payload",
    source: WEEKLY_REPORT_SERVICE_SOURCE,
    retryable: false,
    message: reason,
    cause: payload,
  });
}

function normalizeInsight(value: unknown): WeeklyReportInsight | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = toStrictString(value.title);
  const body = toStrictString(value.body);
  const reasonCodes = toStrictStringArray(value.reasonCodes);

  if (
    !isWeeklyReportInsightType(value.type) ||
    !isWeeklyReportInsightImportance(value.importance) ||
    !isWeeklyReportInsightTone(value.tone) ||
    !title ||
    !body ||
    reasonCodes === null
  ) {
    return null;
  }

  return {
    type: value.type,
    importance: value.importance,
    tone: value.tone,
    title,
    body,
    reasonCodes,
  };
}

function normalizePriority(value: unknown): WeeklyReportPriority | null {
  if (!isRecord(value)) {
    return null;
  }

  const text = toStrictString(value.text);
  const reasonCodes = toStrictStringArray(value.reasonCodes);

  if (
    !isWeeklyReportPriorityType(value.type) ||
    !text ||
    reasonCodes === null
  ) {
    return null;
  }

  return {
    type: value.type,
    text,
    reasonCodes,
  };
}

export function createFallbackWeeklyReport(weekEnd?: string | null): WeeklyReport {
  const normalizedWeekEnd = normalizeWeekEnd(weekEnd);
  const endDate = new Date(`${normalizedWeekEnd}T12:00:00`);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6);

  return {
    status: "not_available",
    period: {
      startDay: toDayKey(startDate),
      endDay: normalizedWeekEnd,
    },
    summary: null,
    insights: [],
    priorities: [],
  };
}

export function normalizeWeeklyReport(
  value: unknown,
): WeeklyReport | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = value.status;
  const summary =
    value.summary === null || value.summary === undefined
      ? null
      : toStrictString(value.summary);

  if (!isWeeklyReportStatus(status)) {
    return null;
  }
  if (!(summary === null || typeof summary === "string")) {
    return null;
  }

  if (!isRecord(value.period)) {
    return null;
  }

  const startDay = value.period.startDay;
  const endDay = value.period.endDay;
  if (!isWeeklyReportDayKey(startDay) || !isWeeklyReportDayKey(endDay)) {
    return null;
  }

  if (!Array.isArray(value.insights) || value.insights.length > 4) {
    return null;
  }
  if (!Array.isArray(value.priorities) || value.priorities.length > 2) {
    return null;
  }

  const insights = value.insights.map((item) => normalizeInsight(item));
  const priorities = value.priorities.map((item) => normalizePriority(item));
  if (insights.some((item) => item === null) || priorities.some((item) => item === null)) {
    return null;
  }

  return {
    status,
    period: {
      startDay,
      endDay,
    },
    summary,
    insights: insights as WeeklyReportInsight[],
    priorities: priorities as WeeklyReportPriority[],
  };
}

function buildWeeklyReportResult(input: {
  report: WeeklyReport;
  source: WeeklyReportResult["source"];
  status: WeeklyReportResultStatus;
  enabled: boolean;
  error: unknown | null;
}): WeeklyReportResult {
  return input;
}

function readWeeklyReportErrorDetail(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }

  const details = isRecord(error.details) ? error.details : null;
  if (details) {
    return asString(details.detail) ?? asString(details.code) ?? null;
  }

  return asString(error.detail) ?? null;
}

function mapWeeklyReportErrorStatus(error: unknown): WeeklyReportResultStatus {
  const status = getErrorStatus(error);
  const detail = readWeeklyReportErrorDetail(error);

  if (
    status === 403 &&
    detail === WEEKLY_REPORT_PREMIUM_REQUIRED_DETAIL
  ) {
    return "premium_required";
  }

  if (status === 400) {
    return "bad_request";
  }

  if (
    status === 503 &&
    detail === WEEKLY_REPORTS_DISABLED_DETAIL
  ) {
    return "feature_disabled";
  }

  return "service_unavailable";
}

export async function getWeeklyReport(
  uid: string | null | undefined,
  options?: { weekEnd?: string | null },
): Promise<WeeklyReportResult> {
  const weekEnd = normalizeWeekEnd(options?.weekEnd);

  if (!uid) {
    return buildWeeklyReportResult({
      report: createFallbackWeeklyReport(weekEnd),
      source: "fallback",
      status: "no_user",
      enabled: true,
      error: null,
    });
  }

  try {
    const payload = await get<unknown>(buildEndpoint(weekEnd), { timeout: 15_000 });
    const normalized = normalizeWeeklyReport(payload);
    if (!normalized) {
      throw createInvalidWeeklyReportPayloadError(
        "Invalid weekly report contract payload",
        payload,
      );
    }

    return buildWeeklyReportResult({
      report: normalized,
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });
  } catch (error) {
    log.warn("getWeeklyReport backend error", { uid, weekEnd, error });
    const isInvalidPayload =
      error instanceof Error &&
      "code" in error &&
      (error as { code?: unknown }).code === "weekly-report/invalid-contract-payload";

    return buildWeeklyReportResult({
      report: createFallbackWeeklyReport(weekEnd),
      source: "fallback",
      status: isInvalidPayload ? "invalid_payload" : mapWeeklyReportErrorStatus(error),
      enabled: true,
      error,
    });
  }
}
