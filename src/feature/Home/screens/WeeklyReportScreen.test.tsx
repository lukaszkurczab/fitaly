import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import WeeklyReportScreen from "@/feature/Home/screens/WeeklyReportScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockUseAuthContext = jest.fn();
const mockUsePremiumContext = jest.fn();
const mockUseAccessContext = jest.fn();
const mockUseWeeklyReport = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/PremiumContext", () => ({
  usePremiumContext: () => mockUsePremiumContext(),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => mockUseAccessContext(),
}));

jest.mock("@/hooks/useWeeklyReport", () => ({
  useWeeklyReport: (params: unknown) => mockUseWeeklyReport(params),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => {
    const translations: Record<string, string> = {
      "weeklyReport.screenTitle": "Weekly report",
      "weeklyReport.closedWeekPill": "Closed week",
      "weeklyReport.temporarilyUnavailablePill": "Temporarily unavailable",
      "weeklyReport.reflectionReadyFallback": "Your weekly reflection is ready.",
      "weeklyReport.signalsBehindIt": "Signals behind it",
      "weeklyReport.carryForwardTitle": "Carry into next week",
      "weeklyReport.carryForwardBody":
        "Keep it light. Guard the first weekend meal and let the weekday rhythm hold.",
      "weeklyReport.loadingTitle": "Composing your weekly reflection",
      "weeklyReport.loadingBody":
        "Reading the closed week first, then shaping one carry-forward for next week.",
      "weeklyReport.loadingHelperNote":
        "This stays concise: one reflection, a short signal read, and one carry-forward.",
      "weeklyReport.signalMeterLabel": "Closed week signal",
      "weeklyReport.signalMeterCaption":
        "A fuller week usually unlocks the reflection.",
      "weeklyReport.insufficientTitle":
        "This closed week does not have enough signal yet",
      "weeklyReport.insufficientBody":
        "That can happen when only part of the week is captured. Once the closed week has a fuller shape, this summary usually unlocks on its own.",
      "weeklyReport.insufficientFootnote": "This is normal. Nothing is failing here.",
      "weeklyReport.backToHome": "Back to Home",
      "weeklyReport.unavailableTitle": "Your weekly reflection isn't ready right now",
      "weeklyReport.unavailableBody":
        "The closed week is there, but this summary is taking a little longer to finish.",
      "weeklyReport.unavailableFootnote":
        "The rest of Home stays available while this catches up.",
      "weeklyReport.tryAgain": "Try again",
      "weeklyReport.back": "Back",
      "weeklyReport.accessibilityRefresh": "Refresh weekly report",
      "weeklyReport.lockedTitle": "Weekly Report is a Premium feature",
      "weeklyReport.lockedBody":
        "Upgrade to Premium to unlock your weekly reflection before we generate it.",
      "weeklyReport.unlockCta": "Manage subscription",
      "weeklyReport.accessIssueTitle":
        "Weekly Report access needs attention",
      "weeklyReport.accessIssueBody":
        "Restore or review your Premium subscription before requesting this report again.",
      "weeklyReport.retryAccessCta": "Retry access check",
      "weeklyReport.restoreAccessCta": "Manage subscription",
      "weeklyReport.accessLoadingTitle": "Checking weekly report access",
      "weeklyReport.accessLoadingBody":
        "Confirming your Premium access before we generate this report.",
      "weeklyReport.accessLoadingHelper":
        "We wait for subscription state first so we don't trigger the report unnecessarily.",
    };

    return {
      i18n: { language: "en" },
      t: (key: string) => translations[key] ?? key,
    };
  },
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: ReactNode }) =>
      createElement(View, null, children),
    Button: ({
      label,
      onPress,
      children,
    }: {
      label?: string;
      onPress?: () => void;
      children?: ReactNode;
    }) =>
      createElement(
        Pressable,
        { onPress },
        createElement(Text, null, label ?? children),
      ),
    AppIcon: ({ name }: { name: string }) =>
      createElement(Text, null, `icon:${name}`),
  };
});

describe("WeeklyReportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUsePremiumContext.mockReturnValue({
      subscription: { state: "premium_active" },
      refreshPremium: jest.fn(),
    });
    mockUseAccessContext.mockReturnValue({
      getFeature: jest.fn(() => ({
        enabled: true,
        status: "enabled",
        reason: null,
      })),
      refreshAccess: jest.fn(),
    });
  });

  it("renders loading state", () => {
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "not_available",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: true,
      enabled: true,
      source: "fallback",
      status: "service_unavailable",
      error: null,
      refresh: jest.fn(),
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(getByText("Weekly report")).toBeTruthy();
    expect(getByText("Composing your weekly reflection")).toBeTruthy();
    expect(
      getByText(
        "Reading the closed week first, then shaping one carry-forward for next week.",
      ),
    ).toBeTruthy();
  });

  it("keeps weekly report request inactive while premium state is unknown", () => {
    mockUsePremiumContext.mockReturnValue({
      subscription: null,
      refreshPremium: jest.fn(),
    });
    mockUseAccessContext.mockReturnValue({
      getFeature: jest.fn(() => null),
      refreshAccess: jest.fn(),
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "not_available",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: false,
      source: "disabled",
      status: "disabled",
      error: null,
      refresh: jest.fn(),
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(getByText("Checking weekly report access")).toBeTruthy();
  });

  it("renders premium locked state for free users without activating request", () => {
    mockUsePremiumContext.mockReturnValue({
      subscription: { state: "free_active" },
      refreshPremium: jest.fn(),
    });
    mockUseAccessContext.mockReturnValue({
      getFeature: jest.fn(() => ({
        enabled: false,
        status: "disabled",
        reason: "requires_premium",
      })),
      refreshAccess: jest.fn(),
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "not_available",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: false,
      source: "disabled",
      status: "disabled",
      error: null,
      refresh: jest.fn(),
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(getByText("Weekly Report is a Premium feature")).toBeTruthy();
    expect(getByText("Manage subscription")).toBeTruthy();
  });

  it("renders premium locked state when backend returns premium_required", () => {
    mockUseAccessContext.mockReturnValue({
      getFeature: jest.fn(() => ({
        enabled: true,
        status: "enabled",
        reason: null,
      })),
      refreshAccess: jest.fn(),
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "not_available",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: true,
      source: "fallback",
      status: "premium_required",
      error: new Error("premium required"),
      refresh: jest.fn(),
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByText, queryByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(getByText("Weekly Report is a Premium feature")).toBeTruthy();
    expect(getByText("Manage subscription")).toBeTruthy();
    expect(queryByText("Your weekly reflection isn't ready right now")).toBeNull();
  });

  it("renders degraded access state without activating weekly report request", () => {
    const refreshPremium = jest.fn();
    mockUsePremiumContext.mockReturnValue({
      subscription: { state: "premium_expired" },
      refreshPremium,
    });
    mockUseAccessContext.mockReturnValue({
      getFeature: jest.fn(() => ({
        enabled: false,
        status: "unknown",
        reason: "degraded",
      })),
      refreshAccess: refreshPremium,
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "not_available",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: false,
      source: "disabled",
      status: "disabled",
      error: null,
      refresh: jest.fn(),
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(getByText("Weekly Report access needs attention")).toBeTruthy();
    expect(getByText("Retry access check")).toBeTruthy();
  });

  it("renders ready state with synthesis hierarchy", () => {
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "ready",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: "Weekday rhythm carried most of the week.",
        insights: [
          {
            type: "consistency",
            importance: "high",
            tone: "positive",
            title: "Weekday meals stayed steadier",
            body: "Lunch and dinner held steadier Monday to Friday.",
            reasonCodes: ["weekday_rhythm_held"],
          },
        ],
        priorities: [
          {
            type: "reduce_weekend_drift",
            text: "Move the first weekend meal earlier.",
            reasonCodes: ["protect_first_weekend_meal"],
          },
        ],
      },
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      error: null,
      refresh: jest.fn(),
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(getByText("Closed week")).toBeTruthy();
    expect(getByText("Weekday rhythm carried most of the week.")).toBeTruthy();
    expect(getByText("Signals behind it")).toBeTruthy();
    expect(getByText("Carry into next week")).toBeTruthy();
  });

  it("renders insufficient-data state", () => {
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "insufficient_data",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      error: null,
      refresh: jest.fn(),
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(
      getByText("This closed week does not have enough signal yet"),
    ).toBeTruthy();
    expect(getByText("Back to Home")).toBeTruthy();
    expect(getByText("This is normal. Nothing is failing here.")).toBeTruthy();
  });

  it("renders unavailable state", () => {
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "not_available",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: true,
      source: "fallback",
      status: "service_unavailable",
      error: new Error("backend down"),
      refresh: jest.fn(),
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(
      getByText("Your weekly reflection isn't ready right now"),
    ).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();
    expect(getByText("Back")).toBeTruthy();
  });
});
