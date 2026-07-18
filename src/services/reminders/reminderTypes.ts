export const REMINDER_DECISION_TYPES = ["send", "suppress", "noop"] as const;

export const REMINDER_KINDS = [
  "log_first_meal",
  "log_next_meal",
  "complete_day",
] as const;

export const REMINDER_REASON_CODES = [
  "preferred_window_open",
  "preferred_window_today",
  "habit_window_match",
  "habit_window_today",
  "day_empty",
  "day_partially_logged",
  "logging_usually_happens_now",
  "recent_activity_detected",
  "already_logged_recently",
  "quiet_hours",
  "reminders_disabled",
  "frequency_cap_reached",
  "insufficient_signal",
  "day_already_complete",
] as const;

export const SEND_REMINDER_REASON_CODES = [
  "preferred_window_open",
  "preferred_window_today",
  "habit_window_match",
  "habit_window_today",
  "day_empty",
  "day_partially_logged",
  "logging_usually_happens_now",
] as const;

export const SUPPRESS_REMINDER_REASON_CODES = [
  "recent_activity_detected",
  "already_logged_recently",
  "quiet_hours",
  "reminders_disabled",
  "frequency_cap_reached",
] as const;

export const NOOP_REMINDER_REASON_CODES = [
  "insufficient_signal",
  "day_already_complete",
] as const;

export type ReminderDecisionType = (typeof REMINDER_DECISION_TYPES)[number];
export type ReminderKind = (typeof REMINDER_KINDS)[number];
export type ReminderReasonCode = (typeof REMINDER_REASON_CODES)[number];
export type SendReminderReasonCode =
  (typeof SEND_REMINDER_REASON_CODES)[number];
export type SuppressReminderReasonCode =
  (typeof SUPPRESS_REMINDER_REASON_CODES)[number];
export type NoopReminderReasonCode =
  (typeof NOOP_REMINDER_REASON_CODES)[number];

type ReminderDecisionBase = {
  dayKey: string;
  computedAt: string;
  confidence: number;
  validUntil: string;
};

export type SendReminderDecision = ReminderDecisionBase & {
  decision: "send";
  kind: ReminderKind;
  reasonCodes: SendReminderReasonCode[];
  scheduledAtUtc: string;
};

export type SuppressReminderDecision = ReminderDecisionBase & {
  decision: "suppress";
  kind: null;
  reasonCodes: SuppressReminderReasonCode[];
  scheduledAtUtc: null;
};

export type NoopReminderDecision = ReminderDecisionBase & {
  decision: "noop";
  kind: null;
  reasonCodes: NoopReminderReasonCode[];
  scheduledAtUtc: null;
};

export type ReminderDecision =
  | SendReminderDecision
  | SuppressReminderDecision
  | NoopReminderDecision;

export type ReminderDecisionSource =
  | "disabled"
  | "remote"
  | "precondition"
  | "error";

export type ReminderDecisionResult =
  | {
      decision: ReminderDecision;
      source: "remote";
      status: "live_success";
      enabled: true;
      error: null;
    }
  | {
      decision: null;
      source: "disabled";
      status: "disabled";
      enabled: false;
      error: null;
    }
  | {
      decision: null;
      source: "precondition";
      status: "no_user" | "profile_not_ready";
      enabled: true;
      error: null;
    }
  | {
      decision: null;
      source: "error";
      status: "invalid_payload" | "service_unavailable";
      enabled: true;
      error: import("@/services/contracts/serviceError").ServiceError;
    };

export type ReminderDecisionResultStatus = ReminderDecisionResult["status"];
