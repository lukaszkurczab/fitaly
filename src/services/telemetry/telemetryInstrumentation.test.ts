import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";
import {
  toSmartReminderConfidenceBucket,
  toSmartReminderScheduledWindow,
  trackAiMealReviewSaved,
  trackCoachInsightTapped,
  trackCoachInsightViewed,
  trackEntitlementConfirmationFailed,
  trackEntitlementConfirmed,
  trackMealLogged,
  trackNotificationOpened,
  trackOnboardingCompleted,
  trackPaywallViewed,
  trackPurchaseStarted,
  trackPurchaseSucceeded,
  trackRestoreFailed,
  trackRestoreStarted,
  trackRestoreSucceeded,
  trackSessionStart,
  trackWeeklyReportAccessBlocked,
  trackWeeklyReportLockedViewed,
  trackSmartReminderDecisionFailed,
  trackSmartReminderNoop,
  trackSmartReminderScheduled,
  trackSmartReminderScheduleFailed,
  trackSmartReminderSuppressed,
  trackWeeklyReportOpened,
} from "@/services/telemetry/telemetryInstrumentation";

const mockTrack = jest.fn<(name: string, props?: Record<string, unknown>) => Promise<void>>();

jest.mock("@/services/telemetry/telemetryClient", () => ({
  track: (name: string, props?: Record<string, unknown>) => mockTrack(name, props),
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-03-18T12:00:00.000Z",
  type: "lunch",
  name: "Meal",
  ingredients: [],
  createdAt: "2026-03-18T12:00:00.000Z",
  updatedAt: "2026-03-18T12:00:00.000Z",
  syncState: "pending",
  source: "manual",
  ...overrides,
});

describe("telemetryInstrumentation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrack.mockResolvedValue();
  });

  it("maps launch KPI telemetry events to the backend allowlist", async () => {
    await trackSessionStart();
    await trackOnboardingCompleted({ mode: "first" });
    await trackMealLogged(
      baseMeal({
        source: "ai",
        inputMethod: "photo",
        ingredients: [
          {
            id: "i1",
            name: "Egg",
            amount: 1,
            kcal: 80,
            protein: 6,
            fat: 5,
            carbs: 0,
          },
        ],
      }),
    );
    await trackAiMealReviewSaved({
      inputMethod: "photo",
      corrected: true,
      ingredientCount: 1,
      requestId: "run-1",
    });
    await trackNotificationOpened({
      notificationType: "meal_reminder",
      origin: "system_notifications",
    });
    await trackPaywallViewed({
      source: "meal_text_limit",
      triggerSource: "meal_text_limit_modal",
    });
    await trackPurchaseStarted();
    await trackPurchaseSucceeded();
    await trackEntitlementConfirmed({ source: "purchase" });
    await trackEntitlementConfirmationFailed({
      source: "purchase",
      reason: "credits_not_premium",
    });
    await trackRestoreStarted();
    await trackRestoreSucceeded({ confirmed: true });
    await trackRestoreFailed({ reason: "network" });
    await trackWeeklyReportOpened({
      reportStatus: "ready",
      insightCount: 2,
      priorityCount: 2,
      source: "remote",
      accessState: "premium",
      accessReason: null,
    });
    await trackWeeklyReportLockedViewed({
      source: "disabled",
      accessState: "locked",
      accessReason: "requires_premium",
    });
    await trackWeeklyReportAccessBlocked({
      source: "disabled",
      accessState: "degraded",
      accessReason: "degraded",
    });
    await trackCoachInsightViewed({
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "fresh",
    });
    await trackCoachInsightTapped({
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "degraded",
    });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "session_start", {
      origin: "app_boot",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "onboarding_completed", {
      mode: "first",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "meal_logged", {
      ingredientCount: 1,
      source: "ai",
      mealInputMethod: "photo",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(4, "ai_meal_review_saved", {
      inputMethod: "photo",
      corrected: true,
      ingredientCount: 1,
      requestId: "run-1",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(5, "notification_opened", {
      notificationType: "meal_reminder",
      origin: "system_notifications",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(6, "paywall_view", {
      source: "meal_text_limit",
      trigger_source: "meal_text_limit_modal",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(7, "purchase_started", {
      source: "manage_subscription",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(8, "purchase_succeeded", {
      source: "manage_subscription",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(9, "entitlement_confirmed", {
      source: "purchase",
      tier: "premium",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(
      10,
      "entitlement_confirmation_failed",
      {
        source: "purchase",
        reason: "credits_not_premium",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(11, "restore_started", {
      source: "manage_subscription",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(12, "restore_succeeded", {
      source: "manage_subscription",
      confirmed: true,
    });
    expect(mockTrack).toHaveBeenNthCalledWith(13, "restore_failed", {
      source: "manage_subscription",
      reason: "network",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(14, "weekly_report_opened", {
      reportStatus: "ready",
      insightCount: 2,
      priorityCount: 2,
      source: "remote",
      accessState: "premium",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(
      15,
      "weekly_report_locked_viewed",
      {
        source: "disabled",
        accessState: "locked",
        accessReason: "requires_premium",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      16,
      "weekly_report_access_blocked",
      {
        source: "disabled",
        accessState: "degraded",
        accessReason: "degraded",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(17, "coach_insight_viewed", {
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "fresh",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(18, "coach_insight_tapped", {
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "degraded",
    });
  });

  it("keeps smart reminder telemetry mappings contract-safe", async () => {
    expect(toSmartReminderConfidenceBucket(0.2)).toBe("low");
    expect(toSmartReminderConfidenceBucket(0.7)).toBe("medium");
    expect(toSmartReminderConfidenceBucket(0.9)).toBe("high");
    expect(toSmartReminderScheduledWindow(360)).toBe("morning");
    expect(toSmartReminderScheduledWindow(780)).toBe("afternoon");
    expect(toSmartReminderScheduledWindow(1140)).toBe("evening");

    await trackSmartReminderScheduled({
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      scheduledWindow: "evening",
    });
    await trackSmartReminderSuppressed({
      decision: "suppress",
      suppressionReason: "quiet_hours",
      confidenceBucket: "high",
    });
    await trackSmartReminderNoop({
      decision: "noop",
      noopReason: "insufficient_signal",
      confidenceBucket: "medium",
    });
    await trackSmartReminderDecisionFailed({
      failureReason: "invalid_payload",
    });
    await trackSmartReminderScheduleFailed({
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      failureReason: "channel_unavailable",
    });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "smart_reminder_scheduled", {
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      scheduledWindow: "evening",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "smart_reminder_suppressed", {
      decision: "suppress",
      suppressionReason: "quiet_hours",
      confidenceBucket: "high",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "smart_reminder_noop", {
      decision: "noop",
      noopReason: "insufficient_signal",
      confidenceBucket: "medium",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(4, "smart_reminder_decision_failed", {
      failureReason: "invalid_payload",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(5, "smart_reminder_schedule_failed", {
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      failureReason: "channel_unavailable",
    });
  });

  it("normalizes optional telemetry dimensions before sending", async () => {
    expect(toSmartReminderScheduledWindow(0)).toBe("overnight");
    expect(toSmartReminderScheduledWindow(1300)).toBe("late_evening");

    await trackMealLogged(baseMeal({ source: "saved", ingredients: [] }));
    await trackMealLogged(
      baseMeal({
        source: "ai",
        photoUrl: null,
        photoLocalPath: null,
        localPhotoUrl: null,
        imageId: null,
        ingredients: [],
      }),
    );
    await trackNotificationOpened({
      notificationType: " Meal Reminder! ",
      origin: "third-party",
      actionIdentifier: "Open Chat",
      openedFromBackground: true,
    });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "meal_logged", {
      ingredientCount: 0,
      source: "saved",
      mealInputMethod: "manual",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "meal_logged", {
      ingredientCount: 0,
      source: "ai",
      mealInputMethod: "text",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "notification_opened", {
      notificationType: "meal_reminder",
      origin: "unknown",
      actionIdentifier: "open_chat",
      openedFromBackground: true,
    });
  });
});
