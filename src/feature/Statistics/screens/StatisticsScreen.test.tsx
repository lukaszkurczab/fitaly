import type { ReactNode } from "react";
import { fireEvent } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import StatisticsScreen from "@/feature/Statistics/screens/StatisticsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { DateRange } from "@/feature/Statistics/types";

const mockUseUserContext = jest.fn();
const mockUsePremiumContext = jest.fn();
const mockUseAccessContext = jest.fn();
const mockUseStatisticsState = jest.fn();
const mockUseNetInfo = jest.fn();

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserContext(),
}));

jest.mock("@/context/PremiumContext", () => ({
  usePremiumContext: () => mockUsePremiumContext(),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => mockUseAccessContext(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@/feature/Statistics/hooks/useStatisticsState", () => ({
  useStatisticsState: (params: unknown) => mockUseStatisticsState(params),
}));

jest.mock("@/services/meals/mealService", () => ({
  FREE_WINDOW_DAYS: 30,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (
      key: string,
      options?: { defaultValue?: string; days?: number } | string,
    ) =>
      typeof options === "string"
        ? options
        : options?.defaultValue ??
          (typeof options?.days === "number" ? `${key}:${options.days}` : key),
  }),
}));

jest.mock("@/components", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { Text, View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );

  return {
    __esModule: true,
    Layout: ({ children }: { children?: ReactNode }) => createElement(View, null, children),
    FullScreenLoader: ({ label }: { label?: string }) =>
      createElement(Text, null, `loader:${label ?? ""}`),
    Calendar: () => null,
    Modal: ({ children }: { children?: ReactNode }) => createElement(View, null, children),
    PieChart: () => null,
  };
});

jest.mock("@/feature/Statistics/components/StatisticsRangeSwitcher", () => ({
  StatisticsRangeSwitcher: ({
    options,
    onChange,
  }: {
    options: Array<{ key: string; label: string }>;
    onChange: (key: string) => void;
  }) => {
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } = jest.requireActual<typeof import("react-native")>(
      "react-native",
    );

    return createElement(
      View,
      null,
      ...options.map((option) =>
        createElement(
          Pressable,
          {
            key: option.key,
            onPress: () => onChange(option.key),
          },
          createElement(Text, null, option.label),
        ),
      ),
    );
  },
}));

jest.mock("@/feature/Statistics/components/StatisticsCustomRangeControl", () => ({
  StatisticsCustomRangeControl: ({
    onApply,
  }: {
    onApply: (range: DateRange) => void;
  }) => {
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } = jest.requireActual<typeof import("react-native")>(
      "react-native",
    );

    return createElement(
      Pressable,
      {
        onPress: () =>
          onApply({
            start: new Date("2026-03-01T00:00:00.000Z"),
            end: new Date("2026-03-10T00:00:00.000Z"),
          }),
      },
      createElement(Text, null, "apply-custom-range"),
    );
  },
}));

jest.mock("@/feature/Statistics/components/StatisticsTrendCard", () => ({
  StatisticsTrendCard: () => {
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, "trend-card");
  },
}));

jest.mock("@/feature/Statistics/components/StatisticsSummaryCard", () => ({
  StatisticsSummaryCard: () => {
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, "summary-card");
  },
}));

jest.mock("@/feature/Statistics/components/StatisticsMacroBreakdownCard", () => ({
  StatisticsMacroBreakdownCard: ({
    protein,
    carbs,
    fat,
  }: {
    protein: number;
    carbs: number;
    fat: number;
  }) => {
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, `macro-breakdown:${protein}:${carbs}:${fat}`);
  },
}));

jest.mock("@/feature/Statistics/components/StatisticsPremiumBanner", () => ({
  StatisticsPremiumBanner: ({ onPress }: { onPress: () => void }) => {
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } = jest.requireActual<typeof import("react-native")>(
      "react-native",
    );

    return createElement(
      Pressable,
      { onPress },
      createElement(Text, null, "premium-banner"),
    );
  },
}));

jest.mock("@/feature/Statistics/components/StatisticsEmptyState", () => ({
  StatisticsEmptyState: ({
    kind,
    isOffline,
    accessWindowDays,
    onManageSubscription,
  }: {
    kind: string;
    isOffline: boolean;
    accessWindowDays?: number;
    onManageSubscription?: () => void;
  }) => {
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } = jest.requireActual<typeof import("react-native")>(
      "react-native",
    );
    return createElement(
      View,
      null,
      createElement(
        Text,
        null,
        `empty:${kind}:${String(isOffline)}:${String(accessWindowDays ?? "")}`,
      ),
      kind === "limited_by_free_window" && onManageSubscription
        ? createElement(
            Pressable,
            { onPress: onManageSubscription },
            createElement(Text, null, "empty-cta"),
          )
        : null,
    );
  },
}));

function makeAnalyticsState(overrides: Record<string, unknown> = {}) {
  return {
    active: "7d",
    setActive: jest.fn(),
    customRange: {
      start: new Date("2026-03-01T00:00:00.000Z"),
      end: new Date("2026-03-07T00:00:00.000Z"),
    },
    setCustomRange: jest.fn(),
    metric: "kcal",
    setMetric: jest.fn(),
    loadingMeals: false,
    emptyKind: "none",
    labels: ["Mon", "Tue"],
    selectedSeries: [1200, 1500],
    totals: { protein: 80, carbs: 150, fat: 50 },
    hasTotals: true,
    avgKcal: 1400,
    avgProtein: 80,
    avgCarbs: 150,
    avgFat: 50,
    avgLoggedProtein: 280,
    avgLoggedCarbs: 525,
    avgLoggedFat: 175,
    loggedDaysCount: 2,
    rangeDaysCount: 7,
    calorieTarget: 2200,
    calorieGoalProgress: 64,
    calorieComparison: {
      previousRange: null,
      previousAverages: null,
      kcalAverageDelta: null,
      kcalAverageDeltaPercent: null,
      hasPreviousEntries: false,
    },
    isWindowLimited: false,
    ...overrides,
  };
}

describe("StatisticsScreen", () => {
  beforeEach(() => {
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockUseUserContext.mockReturnValue({
      userData: {
        uid: "user-1",
        profile: {
          nutritionProfile: {
            calorieTarget: 2200,
            preferences: ["balanced"],
            goal: "maintain",
          },
        },
      },
    });
    mockUsePremiumContext.mockReturnValue({ isPremium: false });
    mockUseAccessContext.mockReturnValue({
      accessState: null,
      loading: false,
      refreshAccess: jest.fn(),
      applyAccessFromResponse: jest.fn(),
      canUseFeature: jest.fn(() => false),
      getFeature: jest.fn(),
    });
  });

  it("renders loading state", () => {
    const navigation = { navigate: jest.fn() };
    mockUseStatisticsState.mockReturnValue(
      makeAnalyticsState({
        loadingMeals: true,
      }),
    );

    const { getByText } = renderWithTheme(
      <StatisticsScreen navigation={navigation as never} />,
    );

    expect(getByText("loader:common:loading")).toBeTruthy();
  });

  it("renders analytics content and premium banner when limited", () => {
    const navigation = { navigate: jest.fn() };
    const setActive = jest.fn();
    const setCustomRange = jest.fn();

    mockUseStatisticsState.mockReturnValue(
      makeAnalyticsState({
        active: "custom",
        setActive,
        setCustomRange,
        isWindowLimited: true,
      }),
    );

    const { getByText } = renderWithTheme(
      <StatisticsScreen navigation={navigation as never} />,
    );

    expect(getByText("summary-card")).toBeTruthy();
    expect(getByText("trend-card")).toBeTruthy();
    expect(getByText("macro-breakdown:280:525:175")).toBeTruthy();

    fireEvent.press(getByText("statistics:ranges.30d"));
    fireEvent.press(getByText("apply-custom-range"));
    fireEvent.press(getByText("premium-banner"));

    expect(setActive).toHaveBeenCalledWith("30d");
    expect(setCustomRange).toHaveBeenCalledWith({
      start: new Date("2026-03-01T00:00:00.000Z"),
      end: new Date("2026-03-10T00:00:00.000Z"),
    });
    expect(navigation.navigate).toHaveBeenCalledWith("ManageSubscription");
  });

  it("renders offline no-history empty state", () => {
    const navigation = { navigate: jest.fn() };
    mockUseNetInfo.mockReturnValue({ isConnected: false });
    mockUseStatisticsState.mockReturnValue(
      makeAnalyticsState({
        emptyKind: "no_history",
      }),
    );

    const { getByText } = renderWithTheme(
      <StatisticsScreen navigation={navigation as never} />,
    );

    expect(getByText("empty:no_history:true:30")).toBeTruthy();
  });

  it("navigates to ManageSubscription from the free-window empty state", () => {
    const navigation = { navigate: jest.fn() };
    mockUseStatisticsState.mockReturnValue(
      makeAnalyticsState({
        emptyKind: "limited_by_free_window",
      }),
    );

    const { getByText } = renderWithTheme(
      <StatisticsScreen navigation={navigation as never} />,
    );

    expect(getByText("empty:limited_by_free_window:false:30")).toBeTruthy();
    fireEvent.press(getByText("empty-cta"));
    expect(navigation.navigate).toHaveBeenCalledWith("ManageSubscription");
  });

  it("does not render the premium banner for premium users", () => {
    const navigation = { navigate: jest.fn() };
    mockUsePremiumContext.mockReturnValue({ isPremium: true });
    mockUseAccessContext.mockReturnValue({
      accessState: null,
      loading: false,
      refreshAccess: jest.fn(),
      applyAccessFromResponse: jest.fn(),
      canUseFeature: jest.fn((feature: string) => feature === "fullHistory"),
      getFeature: jest.fn(),
    });
    mockUseStatisticsState.mockReturnValue(
      makeAnalyticsState({
        isWindowLimited: true,
      }),
    );

    const { queryByText } = renderWithTheme(
      <StatisticsScreen navigation={navigation as never} />,
    );

    expect(queryByText("premium-banner")).toBeNull();
  });
});
