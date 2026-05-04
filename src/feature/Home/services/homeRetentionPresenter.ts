import type { HomeDayState } from "@/feature/Home/services/homeDaySelectors";
import type {
  CoachInsight,
  CoachResponse,
  CoachResultStatus,
} from "@/services/coach/coachTypes";
import type {
  WeeklyReport,
  WeeklyReportResultStatus,
} from "@/services/weeklyReport/weeklyReportTypes";

export type HomeRetentionSurface =
  | { type: "weekly_report" }
  | {
      type: "coach_insight";
      insight: CoachInsight;
      ctaTargetScreen: "MealAddMethod" | "Chat" | "HistoryList" | null;
    }
  | { type: "none"; reason: HomeRetentionNoneReason };

type CoachCtaTarget = Extract<
  HomeRetentionSurface,
  { type: "coach_insight" }
>["ctaTargetScreen"];

export type HomeRetentionNoneReason =
  | "not_today"
  | "empty_day"
  | "weekly_loading"
  | "weekly_unavailable"
  | "coach_unavailable"
  | "coach_competes_with_primary_cta";

type DayInput = Pick<
  HomeDayState,
  "dayKey" | "isToday" | "mealCount" | "status"
>;

type WeeklyInput = {
  hasAccess: boolean;
  loading: boolean;
  report: Pick<WeeklyReport, "status">;
  status: WeeklyReportResultStatus;
};

type CoachInput = {
  loading: boolean;
  enabled: boolean;
  coach: Pick<CoachResponse, "dayKey" | "meta" | "topInsight">;
  status: CoachResultStatus;
  isStale: boolean;
};

function isAllowedTodayContext(dayState: DayInput): boolean {
  return (
    dayState.isToday &&
    !!dayState.dayKey &&
    dayState.mealCount > 0 &&
    dayState.status !== "today_empty" &&
    dayState.status !== "past_empty"
  );
}

export function shouldRequestHomeWeeklyReport(params: {
  hasAccess: boolean;
  dayState: DayInput;
}): boolean {
  return params.hasAccess && isAllowedTodayContext(params.dayState);
}

export function shouldRequestHomeCoach(params: {
  uid: string | null | undefined;
  dayState: DayInput;
}): boolean {
  return !!params.uid && isAllowedTodayContext(params.dayState);
}

function isReadyWeeklyReport(weekly: WeeklyInput): boolean {
  return (
    weekly.hasAccess &&
    !weekly.loading &&
    weekly.status === "live_success" &&
    weekly.report.status === "ready"
  );
}

function resolveCoachCtaTarget(insight: CoachInsight): CoachCtaTarget {
  if (insight.actionType === "log_next_meal") return "MealAddMethod";
  if (insight.actionType === "open_chat") return "Chat";
  if (insight.actionType === "review_history") return "HistoryList";
  return null;
}

function competesWithPrimaryCta(
  dayState: DayInput,
  insight: CoachInsight,
): boolean {
  if (
    insight.actionType === "log_next_meal" &&
    (dayState.status === "today_empty" || dayState.status === "in_progress")
  ) {
    return true;
  }

  return insight.actionType === "review_history" && dayState.status === "completed";
}

function getRenderableCoachInsight(params: {
  dayState: DayInput;
  coach: CoachInput;
}): CoachInsight | null {
  const { coach, dayState } = params;
  const insight = coach.coach.topInsight;

  if (
    coach.loading ||
    !coach.enabled ||
    coach.status !== "live_success" ||
    coach.isStale ||
    !coach.coach.meta.available ||
    !insight ||
    coach.coach.dayKey !== dayState.dayKey
  ) {
    return null;
  }

  return insight;
}

export function buildHomeRetentionSurface(params: {
  dayState: DayInput;
  weekly: WeeklyInput;
  coach: CoachInput;
}): HomeRetentionSurface {
  if (!params.dayState.isToday) {
    return { type: "none", reason: "not_today" };
  }

  if (!isAllowedTodayContext(params.dayState)) {
    return { type: "none", reason: "empty_day" };
  }

  if (params.weekly.hasAccess && params.weekly.loading) {
    return { type: "none", reason: "weekly_loading" };
  }

  if (isReadyWeeklyReport(params.weekly)) {
    return { type: "weekly_report" };
  }

  const coachInsight = getRenderableCoachInsight({
    dayState: params.dayState,
    coach: params.coach,
  });

  if (!coachInsight) {
    return { type: "none", reason: "coach_unavailable" };
  }

  if (competesWithPrimaryCta(params.dayState, coachInsight)) {
    return { type: "none", reason: "coach_competes_with_primary_cta" };
  }

  return {
    type: "coach_insight",
    insight: coachInsight,
    ctaTargetScreen: resolveCoachCtaTarget(coachInsight),
  };
}
