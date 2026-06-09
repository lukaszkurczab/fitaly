import type {
  NoopReminderReasonCode,
  ReminderDecisionType,
  ReminderKind,
  SuppressReminderReasonCode,
} from "@/services/reminders/reminderTypes";
import type {
  CoachActionType as CoachInsightActionType,
  CoachInsightType as CoachTelemetryInsightType,
} from "@/services/coach/coachTypes";
import type { TelemetryProps } from "@/services/telemetry/telemetryTypes";
import { track } from "@/services/telemetry/telemetryClient";
import type { Meal } from "@/types/meal";

type MealInputMethod = "manual" | "photo" | "barcode" | "text" | "saved";
type NotificationTelemetryOrigin =
  | "user_notifications"
  | "system_notifications"
  | "unknown";

type NotificationTelemetryInput = {
  notificationType?: string | null;
  origin?: string | null;
  actionIdentifier?: string | null;
  openedFromBackground?: boolean | null;
};

type SmartReminderConfidenceBucket = "low" | "medium" | "high";
type SmartReminderScheduledWindow =
  | "overnight"
  | "morning"
  | "afternoon"
  | "evening"
  | "late_evening";
type SmartReminderDecisionFailureReason =
  | "invalid_payload"
  | "service_unavailable";
type SmartReminderScheduleFailureReason =
  | "permission_unavailable"
  | "channel_unavailable"
  | "invalid_time"
  | "schedule_error";

type SmartReminderTelemetryInput = {
  reminderKind?: ReminderKind | null;
  decision?: ReminderDecisionType | null;
  suppressionReason?: SuppressReminderReasonCode | null;
  noopReason?: NoopReminderReasonCode | null;
  confidenceBucket?: SmartReminderConfidenceBucket | null;
  scheduledWindow?: SmartReminderScheduledWindow | null;
  failureReason?:
    | SmartReminderDecisionFailureReason
    | SmartReminderScheduleFailureReason
    | null;
};

type OnboardingModeTelemetry = "first" | "refill";

type PaywallSource = "manage_subscription" | "meal_text_limit";
type PaywallTriggerSource =
  | "manage_subscription_screen"
  | "meal_text_limit_modal";
type EntitlementSource = "purchase" | "restore" | "manage_subscription";
type DomainFailureReason =
  | "billing_unavailable"
  | "billing_not_initialized"
  | "rc_not_configured"
  | "no_active_entitlement"
  | "entitlement_inactive"
  | "login_failed"
  | "network"
  | "no_offerings"
  | "purchase_not_allowed"
  | "sign_in_required"
  | "store_problem"
  | "sync_tier_failed"
  | "access_unknown_degraded"
  | "credits_missing"
  | "uid_mismatch"
  | "credits_not_premium"
  | "unknown";

type WeeklyReportStatus = "ready" | "insufficient_data" | "unavailable";
type WeeklyReportSource = "remote" | "fallback" | "disabled";
type WeeklyReportAccessState = "premium" | "locked" | "degraded" | "unknown";
type CoachInsightFreshness = "fresh" | "degraded" | "stale";

type AiMealReviewInputMethod = "photo" | "text";

function normalizeNotificationValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return normalized || null;
}

function normalizeNotificationOrigin(
  origin: string | null | undefined,
): NotificationTelemetryOrigin {
  switch (normalizeNotificationValue(origin)) {
    case "user_notifications":
      return "user_notifications";
    case "system_notifications":
      return "system_notifications";
    default:
      return "unknown";
  }
}

function buildNotificationProps(
  input: NotificationTelemetryInput,
): TelemetryProps {
  const actionIdentifier = normalizeNotificationValue(input.actionIdentifier);
  return {
    notificationType:
      normalizeNotificationValue(input.notificationType) || "unknown",
    origin: normalizeNotificationOrigin(input.origin),
    ...(actionIdentifier ? { actionIdentifier } : {}),
    ...(typeof input.openedFromBackground === "boolean"
      ? { openedFromBackground: input.openedFromBackground }
      : {}),
  };
}

function buildSmartReminderProps(
  input: SmartReminderTelemetryInput,
): TelemetryProps {
  const props: TelemetryProps = {};
  for (const [key, value] of Object.entries(input)) {
    if (value != null) {
      props[key] = value;
    }
  }
  return props;
}

function inferMealInputMethod(meal: Pick<
  Meal,
  "inputMethod" | "source" | "photoUrl" | "photoLocalPath" | "localPhotoUrl" | "imageId"
>): MealInputMethod | null {
  if (meal.inputMethod) {
    return meal.inputMethod;
  }

  if (meal.source === "saved") {
    return "saved";
  }

  if (meal.source === "manual" || meal.source === null) {
    return "manual";
  }

  if (meal.source === "ai") {
    if (meal.photoUrl || meal.photoLocalPath || meal.localPhotoUrl || meal.imageId) {
      return "photo";
    }
    return "text";
  }

  return null;
}

function resolveWeeklyReportStatus(input: WeeklyReportStatus): WeeklyReportStatus {
  return input;
}

export function toSmartReminderConfidenceBucket(
  confidence: number,
): SmartReminderConfidenceBucket {
  if (confidence >= 0.8) {
    return "high";
  }

  if (confidence >= 0.5) {
    return "medium";
  }

  return "low";
}

export function toSmartReminderScheduledWindow(
  localMinuteOfDay: number,
): SmartReminderScheduledWindow {
  if (localMinuteOfDay < 360) {
    return "overnight";
  }

  if (localMinuteOfDay < 720) {
    return "morning";
  }

  if (localMinuteOfDay < 1020) {
    return "afternoon";
  }

  if (localMinuteOfDay < 1260) {
    return "evening";
  }

  return "late_evening";
}

export function trackSessionStart(): Promise<void> {
  return track("session_start", { origin: "app_boot" });
}

export function trackMealLogged(meal: Meal): Promise<void> {
  const mealInputMethod = inferMealInputMethod(meal);
  return track("meal_logged", {
    ingredientCount: meal.ingredients.length,
    source: meal.source ?? "manual",
    ...(mealInputMethod ? { mealInputMethod } : {}),
  });
}

export function trackAiMealReviewSaved(input: {
  inputMethod: AiMealReviewInputMethod;
  corrected: boolean;
  ingredientCount: number;
  requestId?: string | null;
}): Promise<void> {
  return track("ai_meal_review_saved", {
    inputMethod: input.inputMethod,
    corrected: input.corrected,
    ingredientCount: input.ingredientCount,
    ...(input.requestId ? { requestId: input.requestId } : {}),
  });
}

export function trackNotificationOpened(
  input: NotificationTelemetryInput,
): Promise<void> {
  return track("notification_opened", buildNotificationProps(input));
}

export function trackPaywallViewed(input: {
  source: PaywallSource;
  triggerSource: PaywallTriggerSource;
}): Promise<void> {
  return track("paywall_view", {
    source: input.source,
    trigger_source: input.triggerSource,
  });
}

export function trackPurchaseStarted(): Promise<void> {
  return track("purchase_started", {
    source: "manage_subscription",
  });
}

export function trackPurchaseSucceeded(): Promise<void> {
  return track("purchase_succeeded", {
    source: "manage_subscription",
  });
}

export function trackEntitlementConfirmed(input: {
  source: EntitlementSource;
}): Promise<void> {
  return track("entitlement_confirmed", {
    source: input.source,
    tier: "premium",
  });
}

export function trackEntitlementConfirmationFailed(input: {
  source: EntitlementSource;
  reason: DomainFailureReason;
}): Promise<void> {
  return track("entitlement_confirmation_failed", {
    source: input.source,
    reason: input.reason,
  });
}

export function trackRestoreStarted(): Promise<void> {
  return track("restore_started", {
    source: "manage_subscription",
  });
}

export function trackRestoreSucceeded(input: {
  confirmed: boolean;
}): Promise<void> {
  return track("restore_succeeded", {
    source: "manage_subscription",
    confirmed: input.confirmed,
  });
}

export function trackRestoreFailed(input: {
  reason: DomainFailureReason;
}): Promise<void> {
  return track("restore_failed", {
    source: "manage_subscription",
    reason: input.reason,
  });
}

export function trackWeeklyReportOpened(input: {
  reportStatus: WeeklyReportStatus;
  insightCount: number;
  priorityCount: number;
  source: WeeklyReportSource;
  accessState: WeeklyReportAccessState;
  accessReason?: string | null;
}): Promise<void> {
  return track("weekly_report_opened", {
    reportStatus: resolveWeeklyReportStatus(input.reportStatus),
    insightCount: input.insightCount,
    priorityCount: input.priorityCount,
    source: input.source,
    accessState: input.accessState,
    ...(input.accessReason ? { accessReason: input.accessReason } : {}),
  });
}

export function trackWeeklyReportLockedViewed(input: {
  source: WeeklyReportSource;
  accessState: Extract<WeeklyReportAccessState, "locked">;
  accessReason?: string | null;
}): Promise<void> {
  return track("weekly_report_locked_viewed", {
    source: input.source,
    accessState: input.accessState,
    ...(input.accessReason ? { accessReason: input.accessReason } : {}),
  });
}

export function trackWeeklyReportAccessBlocked(input: {
  source: WeeklyReportSource;
  accessState: Extract<WeeklyReportAccessState, "degraded" | "unknown">;
  accessReason?: string | null;
}): Promise<void> {
  return track("weekly_report_access_blocked", {
    source: input.source,
    accessState: input.accessState,
    ...(input.accessReason ? { accessReason: input.accessReason } : {}),
  });
}

export function trackCoachInsightViewed(input: {
  insightType: CoachTelemetryInsightType;
  actionType: CoachInsightActionType;
  freshness: CoachInsightFreshness;
}): Promise<void> {
  return track("coach_insight_viewed", {
    insightType: input.insightType,
    actionType: input.actionType,
    freshness: input.freshness,
  });
}

export function trackCoachInsightTapped(input: {
  insightType: CoachTelemetryInsightType;
  actionType: Exclude<CoachInsightActionType, "none">;
  freshness: CoachInsightFreshness;
}): Promise<void> {
  return track("coach_insight_tapped", {
    insightType: input.insightType,
    actionType: input.actionType,
    freshness: input.freshness,
  });
}

export function trackOnboardingCompleted(input: {
  mode: OnboardingModeTelemetry;
}): Promise<void> {
  return track("onboarding_completed", {
    mode: input.mode,
  });
}

export function trackSmartReminderScheduled(
  input: Required<Pick<SmartReminderTelemetryInput, "reminderKind" | "decision" | "confidenceBucket" | "scheduledWindow">>,
): Promise<void> {
  return track("smart_reminder_scheduled", buildSmartReminderProps(input));
}

export function trackSmartReminderSuppressed(
  input: Required<Pick<SmartReminderTelemetryInput, "decision" | "suppressionReason" | "confidenceBucket">>,
): Promise<void> {
  return track("smart_reminder_suppressed", buildSmartReminderProps(input));
}

export function trackSmartReminderNoop(
  input: Required<Pick<SmartReminderTelemetryInput, "decision" | "noopReason" | "confidenceBucket">>,
): Promise<void> {
  return track("smart_reminder_noop", buildSmartReminderProps(input));
}

export function trackSmartReminderDecisionFailed(
  input: Required<Pick<SmartReminderTelemetryInput, "failureReason">>,
): Promise<void> {
  return track("smart_reminder_decision_failed", buildSmartReminderProps(input));
}

export function trackSmartReminderScheduleFailed(
  input: Required<Pick<SmartReminderTelemetryInput, "reminderKind" | "decision" | "confidenceBucket" | "failureReason">>,
): Promise<void> {
  return track("smart_reminder_schedule_failed", buildSmartReminderProps(input));
}
