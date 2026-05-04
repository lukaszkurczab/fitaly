import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getNotificationText } from "@/services/notifications/texts";
import {
  cancelAllForNotif,
  ensureAndroidChannel,
  listStoredNotificationIdsByPrefix,
  notificationScheduleKey,
  scheduleOneShotAt,
} from "@/services/notifications/localScheduler";
import {
  getCurrentReminderDecisionDayKey,
  getReminderDecision,
} from "@/services/reminders/reminderService";
import {
  trackSmartReminderNoop,
  trackSmartReminderScheduleFailed,
  toSmartReminderConfidenceBucket,
  toSmartReminderScheduledWindow,
  trackSmartReminderScheduled,
  trackSmartReminderSuppressed,
} from "@/services/telemetry/telemetryInstrumentation";
import type {
  ReminderDecision,
  ReminderDecisionResult,
  ReminderDecisionResultStatus,
} from "@/services/reminders/reminderTypes";
import { debugScope } from "@/utils/debug";

const log = debugScope("ReminderScheduling");
const SMART_REMINDER_KEY_PREFIX = "smart-reminder";
const MIN_SCHEDULE_LEAD_MS = 30_000;

type ReminderPermissionState = "granted" | "denied" | "unknown";
type ReminderChannelState =
  | "not_applicable"
  | "ready"
  | "missing"
  | "error"
  | "unknown";

export type ReminderSchedulingOutcome = "scheduled" | "cancelled" | "skipped";

export type ReminderSchedulingReason =
  | "scheduled"
  | "decision_disabled"
  | "decision_no_user"
  | "decision_service_unavailable"
  | "decision_invalid_payload"
  | "decision_suppress"
  | "decision_noop"
  | "permission_unavailable"
  | "channel_unavailable"
  | "invalid_time"
  | "schedule_error";

export type ReminderReconcileSnapshot = {
  uid: string;
  dayKey: string;
  startedAt: string;
  finishedAt: string | null;
  permission: ReminderPermissionState;
  channel: ReminderChannelState;
  channelError: string | null;
  decisionStatus: ReminderDecisionResultStatus | null;
  decisionSource: ReminderDecisionResult["source"] | null;
  decisionType: ReminderDecision["decision"] | null;
  reasonCodes: string[];
  payloadValidation: "passed" | "invalid" | "unknown";
  outcome: ReminderSchedulingOutcome | null;
  schedulingReason: ReminderSchedulingReason | null;
  localKey: string | null;
  scheduledAtUtc: string | null;
  lastErrorStage:
    | "decision"
    | "permission"
    | "channel"
    | "time"
    | "schedule"
    | null;
  lastErrorMessage: string | null;
};

export type ReminderSchedulingResult = {
  outcome: ReminderSchedulingOutcome;
  reason: ReminderSchedulingReason;
  localKey: string | null;
  result: ReminderDecisionResult;
};

export type ReminderStoredScheduleDiagnostics = {
  uid: string;
  localKeyPrefix: string;
  entries: Array<{
    localKey: string;
    ids: string[];
  }>;
  totalIds: number;
  errorMessage: string | null;
};

let lastReminderReconcileSnapshot: ReminderReconcileSnapshot | null = null;

function emitSmartReminderTelemetry(
  promise: Promise<void>,
  eventName: string,
  context: Record<string, unknown>,
): void {
  void promise.catch((error) => {
    log.warn(`${eventName} telemetry failed`, {
      ...context,
      error,
    });
  });
}

function createReminderLocalId(dayKey: string): string {
  return `${SMART_REMINDER_KEY_PREFIX}:${dayKey}`;
}

function createReminderScheduleLocalKeyPrefix(uid: string): string {
  return notificationScheduleKey(uid, SMART_REMINDER_KEY_PREFIX);
}

function createReminderScheduleKey(uid: string, dayKey: string): string {
  return notificationScheduleKey(uid, createReminderLocalId(dayKey));
}

function resolveScheduledDate(
  decision: ReminderDecision,
  now: Date,
): Date | null {
  if (decision.scheduledAtUtc === null) {
    return null;
  }

  const scheduled = new Date(decision.scheduledAtUtc);
  if (Number.isNaN(scheduled.getTime())) {
    return null;
  }

  const validUntil = new Date(decision.validUntil);
  if (Number.isNaN(validUntil.getTime())) {
    return null;
  }

  const nextAllowed = new Date(now.getTime() + MIN_SCHEDULE_LEAD_MS);
  const when = scheduled > nextAllowed ? scheduled : nextAllowed;
  if (when > validUntil) {
    return null;
  }

  return when;
}

function isNotificationPermissionGranted(
  permission: Notifications.NotificationPermissionsStatus,
): boolean {
  const maybeGranted = permission as { granted?: boolean; status?: string };
  return maybeGranted.granted === true || maybeGranted.status === "granted";
}

function getLocalMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function buildReminderContent(
  decision: ReminderDecision,
  scheduledWindow: ReturnType<typeof toSmartReminderScheduledWindow>,
) {
  const notificationType =
    decision.kind === "complete_day" ? "day_fill" : "meal_reminder";
  const text = getNotificationText(notificationType, "friendly");

  return {
    title: text.title,
    body: text.body,
    data: {
      type: notificationType,
      origin: "system_notifications",
      smartReminder: true,
      reminderKind: decision.kind,
      dayKey: decision.dayKey,
      scheduledWindow,
    },
  };
}

function createInitialSnapshot(uid: string, dayKey: string): ReminderReconcileSnapshot {
  return {
    uid,
    dayKey,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    permission: "unknown",
    channel: "unknown",
    channelError: null,
    decisionStatus: null,
    decisionSource: null,
    decisionType: null,
    reasonCodes: [],
    payloadValidation: "unknown",
    outcome: null,
    schedulingReason: null,
    localKey: null,
    scheduledAtUtc: null,
    lastErrorStage: null,
    lastErrorMessage: null,
  };
}

function updateSnapshot(patch: Partial<ReminderReconcileSnapshot>): void {
  if (!lastReminderReconcileSnapshot) {
    return;
  }
  lastReminderReconcileSnapshot = {
    ...lastReminderReconcileSnapshot,
    ...patch,
  };
}

function finalizeSnapshot(params: {
  outcome: ReminderSchedulingOutcome;
  reason: ReminderSchedulingReason;
  localKey: string | null;
  scheduledAtUtc?: string | null;
  errorStage?: ReminderReconcileSnapshot["lastErrorStage"];
  errorMessage?: string | null;
}): void {
  updateSnapshot({
    finishedAt: new Date().toISOString(),
    outcome: params.outcome,
    schedulingReason: params.reason,
    localKey: params.localKey,
    scheduledAtUtc: params.scheduledAtUtc ?? null,
    lastErrorStage: params.errorStage ?? null,
    lastErrorMessage: params.errorMessage ?? null,
  });
}

function resolveUnavailableReason(
  status: ReminderDecisionResultStatus,
): ReminderSchedulingReason {
  if (status === "disabled") {
    return "decision_disabled";
  }
  if (status === "no_user") {
    return "decision_no_user";
  }
  if (status === "invalid_payload") {
    return "decision_invalid_payload";
  }
  return "decision_service_unavailable";
}

function resolveChannelState(params: {
  ensured: boolean;
  exists: boolean | null;
}): ReminderChannelState {
  if (!params.ensured) {
    return "error";
  }
  if (params.exists === false) {
    return "missing";
  }
  return "ready";
}

async function clearAndCancel(localKey: string): Promise<void> {
  await cancelAllForNotif(localKey);
}

export function getLastReminderReconcileSnapshot(): ReminderReconcileSnapshot | null {
  return lastReminderReconcileSnapshot
    ? { ...lastReminderReconcileSnapshot, reasonCodes: [...lastReminderReconcileSnapshot.reasonCodes] }
    : null;
}

export function __resetReminderSchedulingForTests(): void {
  lastReminderReconcileSnapshot = null;
}

export async function cancelAllReminderScheduling(uid: string): Promise<void> {
  try {
    const diagnostics = await getReminderStoredScheduleDiagnostics(uid);
    for (const localKey of diagnostics.entries.map((entry) => entry.localKey)) {
      await cancelAllForNotif(localKey);
    }
  } catch (error) {
    log.warn("failed to cancel all smart reminder schedules", { uid, error });
  }
}

export async function getReminderStoredScheduleDiagnostics(
  uid: string,
): Promise<ReminderStoredScheduleDiagnostics> {
  const localKeyPrefix = createReminderScheduleLocalKeyPrefix(uid);

  try {
    const entries = await listStoredNotificationIdsByPrefix(`${localKeyPrefix}:`);
    const totalIds = entries.reduce((sum, entry) => sum + entry.ids.length, 0);
    return {
      uid,
      localKeyPrefix,
      entries,
      totalIds,
      errorMessage: null,
    };
  } catch (error) {
    return {
      uid,
      localKeyPrefix,
      entries: [],
      totalIds: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function hasStoredReminderScheduleForDay(
  uid: string,
  dayKey: string,
): Promise<boolean> {
  const diagnostics = await getReminderStoredScheduleDiagnostics(uid);
  if (diagnostics.errorMessage) {
    return false;
  }

  const localKey = createReminderScheduleKey(uid, dayKey);
  return diagnostics.entries.some(
    (entry) => entry.localKey === localKey && entry.ids.length > 0,
  );
}

export async function reconcileReminderScheduling(
  uid: string,
  options?: { dayKey?: string | null; now?: Date },
): Promise<ReminderSchedulingResult> {
  const dayKey =
    options?.dayKey?.trim() || getCurrentReminderDecisionDayKey(options?.now);
  const localKey = createReminderScheduleKey(uid, dayKey);
  const now = options?.now ?? new Date();

  lastReminderReconcileSnapshot = createInitialSnapshot(uid, dayKey);

  const result = await getReminderDecision(uid, { dayKey });
  updateSnapshot({
    decisionStatus: result.status,
    decisionSource: result.source,
    decisionType: result.decision?.decision ?? null,
    reasonCodes: [...(result.decision?.reasonCodes ?? [])],
    payloadValidation:
      result.status === "invalid_payload"
        ? "invalid"
        : result.status === "live_success"
          ? "passed"
          : "unknown",
  });

  if (result.status !== "live_success" || !result.decision) {
    await clearAndCancel(localKey);
    const reason = resolveUnavailableReason(result.status);
    log.log("skip scheduling because reminder decision is unavailable", {
      uid,
      dayKey,
      status: result.status,
      source: result.source,
      reason,
    });
    finalizeSnapshot({
      outcome: "cancelled",
      reason,
      localKey,
      errorStage: "decision",
      errorMessage:
        result.status === "live_success"
          ? "missing_decision_payload"
          : result.status,
    });
    return {
      outcome: "cancelled",
      reason,
      localKey,
      result,
    };
  }

  if (result.decision.decision !== "send") {
    await clearAndCancel(localKey);
    if (result.decision.decision === "suppress") {
      const suppressionReason = result.decision.reasonCodes[0];
      if (suppressionReason) {
        emitSmartReminderTelemetry(
          trackSmartReminderSuppressed({
            decision: "suppress",
            suppressionReason,
            confidenceBucket: toSmartReminderConfidenceBucket(
              result.decision.confidence,
            ),
          }),
          "smart_reminder_suppressed",
          {
            uid,
            dayKey,
            suppressionReason,
          },
        );
      }
      finalizeSnapshot({
        outcome: "cancelled",
        reason: "decision_suppress",
        localKey,
      });
      return {
        outcome: "cancelled",
        reason: "decision_suppress",
        localKey,
        result,
      };
    }

    const noopReason = result.decision.reasonCodes[0];
    if (noopReason) {
      emitSmartReminderTelemetry(
        trackSmartReminderNoop({
          decision: "noop",
          noopReason,
          confidenceBucket: toSmartReminderConfidenceBucket(
            result.decision.confidence,
          ),
        }),
        "smart_reminder_noop",
        {
          uid,
          dayKey,
          noopReason,
        },
      );
    }

    log.log("skip scheduling because reminder decision is noop", {
      uid,
      dayKey,
      reasonCodes: result.decision.reasonCodes,
    });
    finalizeSnapshot({
      outcome: "cancelled",
      reason: "decision_noop",
      localKey,
    });
    return {
      outcome: "cancelled",
      reason: "decision_noop",
      localKey,
      result,
    };
  }

  let permissionGranted = false;
  try {
    const permission = await Notifications.getPermissionsAsync();
    permissionGranted = isNotificationPermissionGranted(permission);
    updateSnapshot({ permission: permissionGranted ? "granted" : "denied" });
  } catch (error) {
    updateSnapshot({
      permission: "unknown",
      lastErrorStage: "permission",
      lastErrorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (!permissionGranted) {
    await clearAndCancel(localKey);
    emitSmartReminderTelemetry(
      trackSmartReminderScheduleFailed({
        reminderKind: result.decision.kind,
        decision: "send",
        confidenceBucket: toSmartReminderConfidenceBucket(
          result.decision.confidence,
        ),
        failureReason: "permission_unavailable",
      }),
      "smart_reminder_schedule_failed",
      {
        uid,
        dayKey,
        failureReason: "permission_unavailable",
      },
    );
    log.log("skip scheduling because notification permission is unavailable", {
      uid,
      dayKey,
    });
    finalizeSnapshot({
      outcome: "cancelled",
      reason: "permission_unavailable",
      localKey,
      errorStage: "permission",
      errorMessage: "permission_unavailable",
    });
    return {
      outcome: "cancelled",
      reason: "permission_unavailable",
      localKey,
      result,
    };
  }

  if (Platform.OS === "android") {
    const channelResult = await ensureAndroidChannel();
    updateSnapshot({
      channel: resolveChannelState(channelResult),
      channelError: channelResult.errorMessage,
    });

    if (!channelResult.ensured || channelResult.exists === false) {
      await clearAndCancel(localKey);
      emitSmartReminderTelemetry(
        trackSmartReminderScheduleFailed({
          reminderKind: result.decision.kind,
          decision: "send",
          confidenceBucket: toSmartReminderConfidenceBucket(
            result.decision.confidence,
          ),
          failureReason: "schedule_error",
        }),
        "smart_reminder_schedule_failed",
        {
          uid,
          dayKey,
          failureReason: "channel_unavailable",
          channelError: channelResult.errorMessage,
        },
      );
      log.warn("skip scheduling because Android channel is unavailable", {
        uid,
        dayKey,
        channelResult,
      });
      finalizeSnapshot({
        outcome: "cancelled",
        reason: "channel_unavailable",
        localKey,
        errorStage: "channel",
        errorMessage: channelResult.errorMessage ?? "channel_unavailable",
      });
      return {
        outcome: "cancelled",
        reason: "channel_unavailable",
        localKey,
        result,
      };
    }
  } else {
    updateSnapshot({ channel: "not_applicable", channelError: null });
  }

  const when = resolveScheduledDate(result.decision, now);
  if (!when) {
    await clearAndCancel(localKey);
    emitSmartReminderTelemetry(
      trackSmartReminderScheduleFailed({
        reminderKind: result.decision.kind,
        decision: "send",
        confidenceBucket: toSmartReminderConfidenceBucket(
          result.decision.confidence,
        ),
        failureReason: "invalid_time",
      }),
      "smart_reminder_schedule_failed",
      {
        uid,
        dayKey,
        failureReason: "invalid_time",
      },
    );
    log.warn("skip scheduling because reminder delivery time is invalid", {
      uid,
      dayKey,
      scheduledAtUtc: result.decision.scheduledAtUtc,
      validUntil: result.decision.validUntil,
    });
    finalizeSnapshot({
      outcome: "cancelled",
      reason: "invalid_time",
      localKey,
      errorStage: "time",
      errorMessage: "invalid_time",
    });
    return {
      outcome: "cancelled",
      reason: "invalid_time",
      localKey,
      result,
    };
  }

  await cancelAllForNotif(localKey);
  const scheduledWindow = toSmartReminderScheduledWindow(getLocalMinuteOfDay(when));
  try {
    await scheduleOneShotAt(
      when,
      buildReminderContent(result.decision, scheduledWindow),
      localKey,
    );
  } catch (error) {
    await clearAndCancel(localKey);
    emitSmartReminderTelemetry(
      trackSmartReminderScheduleFailed({
        reminderKind: result.decision.kind,
        decision: "send",
        confidenceBucket: toSmartReminderConfidenceBucket(
          result.decision.confidence,
        ),
        failureReason: "schedule_error",
      }),
      "smart_reminder_schedule_failed",
      {
        uid,
        dayKey,
        failureReason: "schedule_error",
      },
    );
    log.warn("smart reminder scheduling failed", {
      uid,
      dayKey,
      error,
    });
    finalizeSnapshot({
      outcome: "cancelled",
      reason: "schedule_error",
      localKey,
      errorStage: "schedule",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      outcome: "cancelled",
      reason: "schedule_error",
      localKey,
      result,
    };
  }

  emitSmartReminderTelemetry(
    trackSmartReminderScheduled({
      reminderKind: result.decision.kind,
      decision: "send",
      confidenceBucket: toSmartReminderConfidenceBucket(
        result.decision.confidence,
      ),
      scheduledWindow,
    }),
    "smart_reminder_scheduled",
    {
      uid,
      dayKey,
      reminderKind: result.decision.kind,
    },
  );
  log.log("scheduled smart reminder", {
    uid,
    dayKey,
    kind: result.decision.kind,
    when,
    localKey,
  });

  finalizeSnapshot({
    outcome: "scheduled",
    reason: "scheduled",
    localKey,
    scheduledAtUtc: when.toISOString(),
  });

  return {
    outcome: "scheduled",
    reason: "scheduled",
    localKey,
    result,
  };
}
