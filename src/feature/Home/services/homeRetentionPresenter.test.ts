import { describe, expect, it } from "@jest/globals";
import {
  buildHomeRetentionSurface,
  shouldRequestHomeCoach,
  shouldRequestHomeWeeklyReport,
} from "@/feature/Home/services/homeRetentionPresenter";
import type { HomeDayState } from "@/feature/Home/services/homeDaySelectors";
import type { CoachInsight, CoachResponse } from "@/services/coach/coachTypes";
import type { WeeklyReport } from "@/services/weeklyReport/weeklyReportTypes";

function createDayState(overrides?: Partial<HomeDayState>): HomeDayState {
  return {
    dayKey: "2026-03-18",
    dayMeals: [],
    mealCount: 1,
    consumed: { kcal: 500, protein: 25, carbs: 45, fat: 15 },
    goalCalories: 2000,
    macroTargets: null,
    kcalProgress: 0.25,
    status: "in_progress",
    isToday: true,
    isCompletedDay: false,
    isEmptyDay: false,
    isPastEmptyDay: false,
    isTodayEmpty: false,
    ...overrides,
  };
}

function createWeeklyReport(overrides?: Partial<WeeklyReport>): WeeklyReport {
  return {
    status: "ready",
    period: { startDay: "2026-03-09", endDay: "2026-03-15" },
    summary: "Weekday rhythm carried most of the week.",
    insights: [],
    priorities: [],
    ...overrides,
  };
}

function createCoachInsight(overrides?: Partial<CoachInsight>): CoachInsight {
  return {
    id: "2026-03-18:stable",
    type: "stable",
    priority: 80,
    title: "Ask coach about today",
    body: "Today has enough signal for a short check-in.",
    actionLabel: "Open chat",
    actionType: "open_chat",
    reasonCodes: ["day_signal_ready"],
    source: "rules",
    validUntil: "2026-03-18T23:59:59Z",
    confidence: 0.8,
    isPositive: false,
    ...overrides,
  };
}

function createCoachResponse(topInsight: CoachInsight | null): CoachResponse {
  return {
    dayKey: "2026-03-18",
    computedAt: "2026-03-18T08:00:00.000Z",
    source: "rules",
    insights: topInsight ? [topInsight] : [],
    topInsight,
    meta: {
      available: !!topInsight,
      emptyReason: topInsight ? null : "no_data",
      isDegraded: false,
    },
  };
}

const unavailableCoach = {
  loading: false,
  enabled: false,
  coach: createCoachResponse(null),
  status: "disabled" as const,
  isStale: true,
};

describe("homeRetentionPresenter", () => {
  it("does not request weekly report for free users", () => {
    expect(
      shouldRequestHomeWeeklyReport({
        hasAccess: false,
        dayState: createDayState(),
      }),
    ).toBe(false);
  });

  it("requests weekly report only when today has logged meal signal", () => {
    expect(
      shouldRequestHomeWeeklyReport({
        hasAccess: true,
        dayState: createDayState(),
      }),
    ).toBe(true);
    expect(
      shouldRequestHomeWeeklyReport({
        hasAccess: true,
        dayState: createDayState({
          mealCount: 0,
          status: "today_empty",
          isEmptyDay: true,
          isTodayEmpty: true,
        }),
      }),
    ).toBe(false);
    expect(
      shouldRequestHomeWeeklyReport({
        hasAccess: true,
        dayState: createDayState({
          dayKey: "2026-03-17",
          isToday: false,
        }),
      }),
    ).toBe(false);
  });

  it("chooses weekly report over coach when weekly is ready", () => {
    const surface = buildHomeRetentionSurface({
      dayState: createDayState(),
      weekly: {
        hasAccess: true,
        loading: false,
        report: createWeeklyReport(),
        status: "live_success",
      },
      coach: {
        loading: false,
        enabled: true,
        coach: createCoachResponse(createCoachInsight()),
        status: "live_success",
        isStale: false,
      },
    });

    expect(surface).toEqual({ type: "weekly_report" });
  });

  it("keeps a not-available weekly report visible as a recoverable retention card", () => {
    const surface = buildHomeRetentionSurface({
      dayState: createDayState(),
      weekly: {
        hasAccess: true,
        loading: false,
        report: createWeeklyReport({ status: "not_available", summary: null }),
        status: "service_unavailable",
      },
      coach: {
        loading: false,
        enabled: true,
        coach: createCoachResponse(createCoachInsight()),
        status: "live_success",
        isStale: false,
      },
    });

    expect(surface).toEqual({ type: "weekly_report" });
  });

  it("chooses coach when weekly has insufficient signal and coach does not compete with the hero CTA", () => {
    const surface = buildHomeRetentionSurface({
      dayState: createDayState(),
      weekly: {
        hasAccess: true,
        loading: false,
        report: createWeeklyReport({ status: "insufficient_data", summary: null }),
        status: "live_success",
      },
      coach: {
        loading: false,
        enabled: true,
        coach: createCoachResponse(createCoachInsight()),
        status: "live_success",
        isStale: false,
      },
    });

    expect(surface.type).toBe("coach_insight");
    expect(surface.type === "coach_insight" ? surface.ctaTargetScreen : null).toBe("Chat");
  });

  it("keeps empty day focused on the primary add meal CTA", () => {
    const surface = buildHomeRetentionSurface({
      dayState: createDayState({
        mealCount: 0,
        status: "today_empty",
        isEmptyDay: true,
        isTodayEmpty: true,
      }),
      weekly: {
        hasAccess: true,
        loading: false,
        report: createWeeklyReport(),
        status: "live_success",
      },
      coach: {
        loading: false,
        enabled: true,
        coach: createCoachResponse(createCoachInsight()),
        status: "live_success",
        isStale: false,
      },
    });

    expect(surface).toEqual({ type: "none", reason: "empty_day" });
  });

  it("does not request or render coach for selected past days", () => {
    const dayState = createDayState({
      dayKey: "2026-03-17",
      isToday: false,
    });

    expect(shouldRequestHomeCoach({ uid: "user-1", dayState })).toBe(false);
    expect(
      buildHomeRetentionSurface({
        dayState,
        weekly: {
          hasAccess: true,
          loading: false,
          report: createWeeklyReport(),
          status: "live_success",
        },
        coach: {
          loading: false,
          enabled: true,
          coach: createCoachResponse(createCoachInsight()),
          status: "live_success",
          isStale: false,
        },
      }),
    ).toEqual({ type: "none", reason: "not_today" });
  });

  it("suppresses coach when its CTA duplicates the active day primary CTA", () => {
    const surface = buildHomeRetentionSurface({
      dayState: createDayState(),
      weekly: {
        hasAccess: true,
        loading: false,
        report: createWeeklyReport({ status: "insufficient_data", summary: null }),
        status: "live_success",
      },
      coach: {
        loading: false,
        enabled: true,
        coach: createCoachResponse(
          createCoachInsight({
            id: "2026-03-18:under_logging",
            type: "under_logging",
            actionLabel: "Log next meal",
            actionType: "log_next_meal",
          }),
        ),
        status: "live_success",
        isStale: false,
      },
    });

    expect(surface).toEqual({
      type: "none",
      reason: "coach_competes_with_primary_cta",
    });
  });

  it("returns none while weekly access has a pending ready candidate", () => {
    expect(
      buildHomeRetentionSurface({
        dayState: createDayState(),
        weekly: {
          hasAccess: true,
          loading: true,
          report: createWeeklyReport({ status: "not_available", summary: null }),
          status: "no_user",
        },
        coach: unavailableCoach,
      }),
    ).toEqual({ type: "none", reason: "weekly_loading" });
  });
});
