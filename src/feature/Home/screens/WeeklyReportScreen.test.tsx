import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import WeeklyReportScreen from "@/feature/Home/screens/WeeklyReportScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockTrackWeeklyReportOpened = jest.fn<(input: Record<string, unknown>) => Promise<void>>();
const mockTrackWeeklyReportLockedViewed = jest.fn<(input: Record<string, unknown>) => Promise<void>>();
const mockTrackWeeklyReportAccessBlocked = jest.fn<(input: Record<string, unknown>) => Promise<void>>();

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

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackWeeklyReportOpened: (input: Record<string, unknown>) =>
    mockTrackWeeklyReportOpened(input),
  trackWeeklyReportLockedViewed: (input: Record<string, unknown>) =>
    mockTrackWeeklyReportLockedViewed(input),
  trackWeeklyReportAccessBlocked: (input: Record<string, unknown>) =>
    mockTrackWeeklyReportAccessBlocked(input),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => {
    const translations: Record<string, string> = {
      "weeklyReport.screenTitle": "Weekly report",
      "weeklyReport.closedWeekPill": "Closed week",
      "weeklyReport.readyDetailPill": "Your week",
      "weeklyReport.temporarilyUnavailablePill": "Temporarily unavailable",
      "weeklyReport.reflectionReadyFallback": "Your weekly reflection is ready.",
      "weeklyReport.detailInsightTitle.consistency":
        "Your weekly rhythm was the most helpful signal.",
      "weeklyReport.detailInsightTitle.loggingCoverage":
        "A fuller log will make the week easier to read.",
      "weeklyReport.detailInsightTitle.startOfDayPattern":
        "The start of the day is the rhythm to steady.",
      "weeklyReport.detailInsightTitle.dayCompletionPattern":
        "Closing days can make the week feel lighter.",
      "weeklyReport.detailInsightTitle.weekendDrift":
        "The weekend needs one gentle anchor point.",
      "weeklyReport.detailInsightTitle.improvingTrend":
        "This week shows quiet movement in the right direction.",
      "weeklyReport.signalsBehindIt": "What stood out",
      "weeklyReport.carryForwardTitle": "Small step for next week",
      "weeklyReport.carryForwardBody":
        "Start with one calm adjustment. The rest can stay in the background.",
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
      "weeklyReport.unavailableTitle": "The report is still preparing",
      "weeklyReport.unavailableBody": "Try again in a moment.",
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
      testID,
    }: {
      label?: string;
      onPress?: () => void;
      children?: ReactNode;
      testID?: string;
    }) =>
      createElement(
        Pressable,
        { onPress, testID },
        createElement(Text, null, label ?? children),
      ),
    AppIcon: ({ name }: { name: string }) =>
      createElement(Text, null, `icon:${name}`),
  };
});

describe("WeeklyReportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackWeeklyReportOpened.mockResolvedValue(undefined);
    mockTrackWeeklyReportLockedViewed.mockResolvedValue(undefined);
    mockTrackWeeklyReportAccessBlocked.mockResolvedValue(undefined);
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
    const { getByTestId, getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );
    const loadingHeroStyle = StyleSheet.flatten(
      getByTestId("weekly-report-loading-hero").props.style,
    );
    const loadingSupportStyle = StyleSheet.flatten(
      getByTestId("weekly-report-loading-support-card").props.style,
    );

    expect(getByText("Weekly report")).toBeTruthy();
    expect(getByText("Composing your weekly reflection")).toBeTruthy();
    expect(
      getByText(
        "Reading the closed week first, then shaping one carry-forward for next week.",
      ),
    ).toBeTruthy();
    expect(loadingHeroStyle.elevation).toBeUndefined();
    expect(loadingHeroStyle.shadowOpacity).toBeUndefined();
    expect(loadingSupportStyle.elevation).toBeUndefined();
    expect(loadingSupportStyle.shadowOpacity).toBeUndefined();
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
    const { getByTestId, getByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );
    const lockedCardStyle = StyleSheet.flatten(
      getByTestId("weekly-report-state-card").props.style,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(getByText("Weekly Report is a Premium feature")).toBeTruthy();
    expect(getByText("Manage subscription")).toBeTruthy();
    expect(lockedCardStyle.elevation).toBeUndefined();
    expect(lockedCardStyle.shadowOpacity).toBeUndefined();
    expect(lockedCardStyle.shadowRadius).toBeUndefined();
    expect(mockTrackWeeklyReportLockedViewed).toHaveBeenCalledWith({
      source: "disabled",
      accessState: "locked",
      accessReason: "requires_premium",
    });
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
    expect(queryByText("The report is still preparing")).toBeNull();
    expect(mockTrackWeeklyReportLockedViewed).toHaveBeenCalledWith({
      source: "fallback",
      accessState: "locked",
      accessReason: "premium_required",
    });
    expect(mockTrackWeeklyReportOpened).not.toHaveBeenCalled();
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
    const { getByText, queryByText } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(getByText("Weekly Report access needs attention")).toBeTruthy();
    expect(
      getByText(
        "Restore or review your Premium subscription before requesting this report again.",
      ),
    ).toBeTruthy();
    expect(getByText("Retry access check")).toBeTruthy();
    expect(queryByText("The report is still preparing")).toBeNull();
    expect(queryByText("Try again in a moment.")).toBeNull();
    expect(queryByText("Temporarily unavailable")).toBeNull();
    expect(mockTrackWeeklyReportAccessBlocked).toHaveBeenCalledWith({
      source: "disabled",
      accessState: "degraded",
      accessReason: "degraded",
    });
  });

  it("renders ready state with synthesis hierarchy", () => {
    const refresh = jest.fn();
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
      refresh,
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByTestId, getByText, queryByTestId } = renderWithTheme(
      <WeeklyReportScreen navigation={navigation as never} />,
    );

    expect(queryByTestId("weekly-report-refresh-button")).toBeNull();
    fireEvent.press(getByTestId("weekly-report-back-button"));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(getByText("Your week")).toBeTruthy();
    expect(
      getByText("Your weekly rhythm was the most helpful signal."),
    ).toBeTruthy();
    expect(getByText("What stood out")).toBeTruthy();
    expect(getByText("Small step for next week")).toBeTruthy();
    expect(mockTrackWeeklyReportOpened).toHaveBeenCalledWith({
      reportStatus: "ready",
      insightCount: 1,
      priorityCount: 1,
      source: "remote",
      accessState: "premium",
      accessReason: null,
    });
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
    expect(mockTrackWeeklyReportOpened).toHaveBeenCalledWith({
      reportStatus: "insufficient_data",
      insightCount: 0,
      priorityCount: 0,
      source: "remote",
      accessState: "premium",
      accessReason: null,
    });
  });

  it("renders unavailable state with body retry recovery and back navigation", async () => {
    const refresh = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
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
      refresh,
    });

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const { getByTestId, getByText, queryByTestId, queryByText } =
      renderWithTheme(<WeeklyReportScreen navigation={navigation as never} />);

    expect(queryByTestId("weekly-report-refresh-button")).toBeNull();
    const unavailableCardStyle = StyleSheet.flatten(
      getByTestId("weekly-report-unavailable-card").props.style,
    );
    expect(
      unavailableCardStyle,
    ).toEqual(expect.objectContaining({
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 15,
      gap: 9,
    }));
    expect(unavailableCardStyle.elevation).toBeUndefined();
    expect(unavailableCardStyle.shadowOpacity).toBeUndefined();
    expect(unavailableCardStyle.shadowRadius).toBeUndefined();
    expect(getByText("icon:refresh")).toBeTruthy();
    expect(getByText("Temporarily unavailable")).toBeTruthy();
    expect(
      getByText("The report is still preparing"),
    ).toBeTruthy();
    expect(getByText("Try again in a moment.")).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();
    expect(getByText("Back")).toBeTruthy();
    expect(queryByText("weeklyReport.unavailableFootnote")).toBeNull();
    expect(
      queryByText("Your weekly reflection isn't ready right now"),
    ).toBeNull();
    expect(
      queryByText(
        "The closed week is there, but this summary is taking a little longer to finish.",
      ),
    ).toBeNull();
    expect(
      queryByText("The rest of Home stays available while this catches up."),
    ).toBeNull();

    fireEvent.press(getByTestId("weekly-report-retry-button"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    fireEvent.press(getByTestId("weekly-report-back-button"));
    fireEvent.press(getByTestId("weekly-report-unavailable-back-button"));
    expect(navigation.goBack).toHaveBeenCalledTimes(2);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
