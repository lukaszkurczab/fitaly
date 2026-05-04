export type WeeklyReportStatus =
  | "ready"
  | "insufficient_data"
  | "not_available";

export type WeeklyReportInsightType =
  | "consistency"
  | "logging_coverage"
  | "start_of_day_pattern"
  | "day_completion_pattern"
  | "weekend_drift"
  | "improving_trend";

export type WeeklyReportInsightImportance = "high" | "medium" | "low";

export type WeeklyReportInsightTone = "positive" | "neutral" | "negative";

export type WeeklyReportPriorityType =
  | "maintain_consistency"
  | "increase_logging_coverage"
  | "stabilize_start_of_day"
  | "improve_day_completion"
  | "reduce_weekend_drift";

export type WeeklyReportPeriod = {
  startDay: string;
  endDay: string;
};

export type WeeklyReportInsight = {
  type: WeeklyReportInsightType;
  importance: WeeklyReportInsightImportance;
  tone: WeeklyReportInsightTone;
  title: string;
  body: string;
  reasonCodes: string[];
};

export type WeeklyReportPriority = {
  type: WeeklyReportPriorityType;
  text: string;
  reasonCodes: string[];
};

export type WeeklyReport = {
  status: WeeklyReportStatus;
  period: WeeklyReportPeriod;
  summary: string | null;
  insights: WeeklyReportInsight[];
  priorities: WeeklyReportPriority[];
};

export type WeeklyReportSource = "disabled" | "remote" | "fallback";

export type WeeklyReportResultStatus =
  | "live_success"
  | "disabled"
  | "feature_disabled"
  | "no_user"
  | "invalid_payload"
  | "premium_required"
  | "service_unavailable";

export type WeeklyReportResult = {
  report: WeeklyReport;
  source: WeeklyReportSource;
  status: WeeklyReportResultStatus;
  enabled: boolean;
  error: unknown | null;
};
