export type TelemetryPrimitive = string | number | boolean | null;

export type TelemetryPropertyValue =
  | TelemetryPrimitive
  | TelemetryPrimitive[];

export type TelemetryProps = Record<string, TelemetryPropertyValue>;

export const TELEMETRY_EVENT_NAMES = [
  "session_start",
  "onboarding_completed",
  "meal_logged",
  "ai_meal_review_saved",
  "notification_opened",
  "paywall_view",
  "purchase_started",
  "purchase_succeeded",
  "entitlement_confirmed",
  "entitlement_confirmation_failed",
  "first_premium_feature_used",
  "restore_started",
  "restore_succeeded",
  "restore_failed",
  "weekly_report_opened",
  "weekly_report_locked_viewed",
  "weekly_report_access_blocked",
  "coach_insight_viewed",
  "coach_insight_tapped",
  "smart_reminder_suppressed",
  "smart_reminder_scheduled",
  "smart_reminder_noop",
  "smart_reminder_decision_failed",
  "smart_reminder_schedule_failed",
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];

export type TelemetryEvent = {
  eventId: string;
  name: TelemetryEventName;
  ts: string;
  props?: TelemetryProps;
};

export type TelemetryBatchPayload = {
  sessionId: string;
  app: {
    platform: string;
    appVersion: string;
    build?: string | null;
  };
  device: {
    locale?: string | null;
    tzOffsetMin?: number | null;
  };
  events: TelemetryEvent[];
};
