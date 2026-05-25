import React from "react";
import {
  Pressable as mockPressable,
  Text as mockText,
  View as mockView,
} from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import HomeScreen from "@/feature/Home/screens/HomeScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockReact = React;

const mockUseMeals = jest.fn();
const mockUseUserProfileContext = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUsePremiumContext = jest.fn();
const mockUseAccessContext = jest.fn();
const mockUseMealAddMethodState = jest.fn();
const mockUseWeeklyReport = jest.fn();
const mockUseCoach = jest.fn();

jest.mock("@/hooks/useMeals", () => ({
  useMeals: (uid: string | null | undefined) => mockUseMeals(uid),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserProfileContext(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/PremiumContext", () => ({
  usePremiumContext: () => mockUsePremiumContext(),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => mockUseAccessContext(),
}));

jest.mock("@/feature/Meals/hooks/useMealAddMethodState", () => ({
  useMealAddMethodState: (params: unknown) => mockUseMealAddMethodState(params),
}));

jest.mock("@/hooks/useWeeklyReport", () => ({
  useWeeklyReport: (params: unknown) => mockUseWeeklyReport(params),
}));

jest.mock("@/hooks/useCoach", () => ({
  useCoach: (params: unknown) => mockUseCoach(params),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (
      key: string,
      options?:
        | string
        | { count?: number; method?: string; defaultValue?: string; name?: string },
    ) => {
      if (typeof options === "string") {
        return options;
      }
      if (key === "meals:photoTitle") return "Photo";
      if (key === "meals:textTitle") return "Assistant";
      if (key === "meals:barcodeTitle") return "Barcode";
      if (key === "meals:savedTitle") return "Saved meals";
      if (key === "home:methodSelector") return `Method: ${options?.method}`;
      if (key === "home:askAssistantAdvice") return "Ask the assistant for advice";
      if (key === "home:mealCount") {
        return options?.count === 1 ? "1 meal" : `${options?.count ?? 0} meals`;
      }
      if (key === "home:hero.greeting.morning") return `Good morning, ${options?.name}`;
      if (key === "home:hero.greeting.afternoon") return `Good afternoon, ${options?.name}`;
      if (key === "home:hero.greeting.evening") return `Good evening, ${options?.name}`;
      if (key === "home:hero.greetingGeneric.morning") return "Good morning";
      if (key === "home:hero.greetingGeneric.afternoon") return "Good afternoon";
      if (key === "home:hero.greetingGeneric.evening") return "Good evening";
      if (key === "home:hero.todayEmpty.cta") return "Log breakfast";
      if (key === "home:hero.todayEmpty.supportCopy") {
        return "Small steps each day lead to bigger changes.";
      }
      if (key === "home:hero.todayInProgress.cta") return "Log next meal";
      if (key === "home:hero.pastIncomplete.meta") return "You missed a meal log";
      if (key === "home:hero.pastIncomplete.cta") return "Add a missed meal";
      if (key === "home:hero.pastIncomplete.supportCopy") {
        return "You can still fill in what was missing.";
      }
      if (key === "home:hero.completed.title") return `Goal reached, ${options?.name}`;
      if (key === "home:hero.completed.titleGeneric") return "Goal reached";
      if (key === "home:hero.completed.cta") return "Review your day";
      if (key === "home:hero.completed.support") return "See your full breakdown for today";
      if (key === "home:viewHistory") return "See full history";
      return options?.defaultValue ?? key;
    },
  }),
}));

jest.mock("@/components", () => {
  const { createElement, Fragment } =
    jest.requireActual<typeof import("react")>("react");
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Layout: ({ children }: { children: React.ReactNode }) =>
      createElement(Fragment, null, children),
    Modal: ({
      visible,
      title,
      primaryAction,
      secondaryAction,
    }: {
      visible: boolean;
      title?: string;
      primaryAction?: { label: string; onPress?: () => void };
      secondaryAction?: { label: string; onPress?: () => void };
    }) =>
      visible
        ? createElement(
            MockView,
            null,
            title ? createElement(MockText, null, title) : null,
            primaryAction
              ? createElement(
                  MockPressable,
                  { onPress: primaryAction.onPress },
                  createElement(MockText, null, primaryAction.label),
                )
              : null,
            secondaryAction
              ? createElement(
                  MockPressable,
                  { onPress: secondaryAction.onPress },
                  createElement(MockText, null, secondaryAction.label),
                )
              : null,
          )
        : null,
  };
});

jest.mock("@/components/WeekStrip", () => ({
  __esModule: true,
  default: ({
    onSelect,
  }: {
    onSelect: (date: Date) => void;
  }) =>
    mockReact.createElement(
      mockPressable,
      { onPress: () => onSelect(new Date("2026-03-17T12:00:00.000Z")) },
      mockReact.createElement(mockText, null, "pick-2026-03-17"),
    ),
}));

jest.mock("../components/HomeHeroCard", () => ({
  __esModule: true,
  default: ({
    title,
    meta,
    ctaLabel,
    methodLabel,
    progress,
    supportText,
    onPressCta,
    onPressMethodSelector,
  }: {
    title: string;
    meta: string;
    ctaLabel: string;
    methodLabel?: string;
    progress?: number | null;
    supportText?: string | null;
    onPressCta: () => void;
    onPressMethodSelector?: () => void;
  }) =>
    mockReact.createElement(
      mockView,
      null,
      mockReact.createElement(mockText, null, title),
      mockReact.createElement(mockText, null, meta),
      mockReact.createElement(
        mockPressable,
        { onPress: onPressCta },
        mockReact.createElement(mockText, null, ctaLabel),
      ),
      methodLabel
        ? mockReact.createElement(
            mockPressable,
            { onPress: onPressMethodSelector },
            mockReact.createElement(mockText, null, methodLabel),
          )
        : null,
      typeof progress === "number"
        ? mockReact.createElement(
            mockText,
            null,
            `hero-progress:${progress.toFixed(2)}`,
          )
        : null,
      supportText
        ? mockReact.createElement(mockText, null, supportText)
        : null,
    ),
}));

jest.mock("../components/MacroTargetsRow", () => ({
  MacroTargetsRow: ({
    macroTargets,
    consumed,
  }: {
    macroTargets: { proteinGrams: number; fatGrams: number; carbsGrams: number };
    consumed: { protein: number; fat: number; carbs: number };
  }) =>
    mockReact.createElement(
      mockText,
      null,
      `macro-targets:${macroTargets.proteinGrams}/${macroTargets.fatGrams}/${macroTargets.carbsGrams};consumed:${consumed.protein}/${consumed.fat}/${consumed.carbs}`,
    ),
}));

jest.mock("../components/TodaysMealsList", () => ({
  TodaysMealsList: ({
    meals,
  }: {
    meals: Array<{ name?: string | null; syncState?: string }>;
  }) =>
    mockReact.createElement(
      mockText,
      null,
      `meals:${meals.length}:${meals
        .map((meal) => `${meal.name ?? ""}/${meal.syncState ?? ""}`)
        .join("|")}`,
    ),
}));

jest.mock("../components/WeeklyReportCard", () => ({
  __esModule: true,
  default: ({
    loading,
    onPress,
  }: {
    loading: boolean;
    onPress: () => void;
  }) =>
    mockReact.createElement(
      mockPressable,
      { onPress },
      mockReact.createElement(
        mockText,
        null,
        loading ? "weekly-report-card:loading" : "weekly-report-card:ready",
      ),
    ),
}));

jest.mock("../components/CoachInsightCard", () => ({
  __esModule: true,
  default: ({
    insight,
    onPressCta,
  }: {
    insight: { title: string; actionType: string };
    onPressCta?: () => void;
  }) =>
    mockReact.createElement(
      mockPressable,
      { onPress: onPressCta },
      mockReact.createElement(
        mockText,
        null,
        `coach-insight-card:${insight.title}:${insight.actionType}`,
      ),
    ),
}));

type NavigationMock = {
  navigate: jest.Mock;
};

function createNavigation(): NavigationMock {
  return {
    navigate: jest.fn(),
  };
}

function createMeal(overrides: Record<string, unknown> = {}) {
  return {
    userUid: "user-1",
    mealId: "meal-1",
    timestamp: new Date("2026-03-18T10:00:00.000Z").getTime(),
    dayKey: "2026-03-18",
    type: "breakfast",
    name: "Breakfast",
    ingredients: [],
    createdAt: "2026-03-18T10:00:00.000Z",
    updatedAt: "2026-03-18T10:00:00.000Z",
    syncState: "synced",
    source: "manual",
    totals: { kcal: 500, protein: 25, fat: 15, carbs: 45 },
    ...overrides,
  };
}

function createCoachInsight(overrides: Record<string, unknown> = {}) {
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

function createCoachResponse(topInsight: ReturnType<typeof createCoachInsight> | null = null) {
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

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T08:00:00.000Z"));
    jest.clearAllMocks();

    mockUseUserProfileContext.mockReturnValue({
      userData: {
        username: "Anna",
        profile: {
          language: "en",
          readiness: {
            status: "ready",
            onboardingCompletedAt: "2026-03-18T08:00:00.000Z",
            readyAt: "2026-03-18T08:00:00.000Z",
          },
          nutritionProfile: {
            calorieTarget: 2000,
            preferences: [],
            goal: "maintain",
          },
          aiPreferences: {
            stylePersona: "calm_guide",
          },
          consents: {
            aiHealthDataConsentAt: null,
          },
        },
      },
    });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUsePremiumContext.mockReturnValue({ isPremium: true });
    mockUseAccessContext.mockReturnValue({
      accessState: null,
      loading: false,
      refreshAccess: jest.fn(),
      applyAccessFromResponse: jest.fn(),
      canUseFeature: jest.fn((feature: string) => feature === "weeklyReport"),
      getFeature: jest.fn(),
    });
    mockUseMeals.mockReturnValue({
      meals: [],
      getMeals: jest.fn(),
    });
    mockUseMealAddMethodState.mockReturnValue({
      preferredOption: {
        key: "photo",
        icon: "camera",
        titleKey: "photoTitle",
      },
      showResumeModal: false,
      handleDirectStart: jest.fn(async () => undefined),
      handleContinueDraft: jest.fn(async () => undefined),
      handleDiscardDraft: jest.fn(async () => undefined),
      closeResumeModal: jest.fn(),
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "ready",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: "Weekday rhythm carried most of the week.",
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
    mockUseCoach.mockReturnValue({
      coach: createCoachResponse(),
      loading: false,
      enabled: false,
      source: "disabled",
      status: "disabled",
      isStale: true,
      error: null,
      refresh: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the empty today state and starts the preferred method from the hero CTA", async () => {
    const navigation = createNavigation();
    const handleDirectStart = jest.fn(async () => undefined);
    mockUseMealAddMethodState.mockReturnValue({
      preferredOption: {
        key: "photo",
        icon: "camera",
        titleKey: "photoTitle",
      },
      showResumeModal: false,
      handleDirectStart,
      handleContinueDraft: jest.fn(async () => undefined),
      handleDiscardDraft: jest.fn(async () => undefined),
      closeResumeModal: jest.fn(),
    });

    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("Good morning, Anna")).toBeTruthy();
    expect(getByText("Log breakfast")).toBeTruthy();
    expect(getByText("Ask the assistant for advice")).toBeTruthy();
    expect(getByText("Small steps each day lead to bigger changes.")).toBeTruthy();
    expect(queryByText("weekly-report-card:ready")).toBeNull();
    expect(queryByText(/^meals:1:/)).toBeNull();

    fireEvent.press(getByText("Log breakfast"));

    await waitFor(() => {
      expect(handleDirectStart).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText("Ask the assistant for advice"));

    expect(navigation.navigate).toHaveBeenCalledWith("Chat");

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(mockUseCoach).toHaveBeenCalledWith({
      uid: "user-1",
      dayKey: "2026-03-18",
      active: false,
    });
  });

  it("renders the in-progress today state with subtle progress and meals list", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("Log next meal")).toBeTruthy();
    expect(getByText("hero-progress:0.25")).toBeTruthy();
    expect(getByText("macro-targets:125/65/225;consumed:25/15/45")).toBeTruthy();
    expect(getByText(/^meals:1:/)).toBeTruthy();
  });

  it("shows pending, failed and conflict meals from the canonical day state in list and progress", () => {
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          mealId: "pending-meal",
          cloudId: "pending-cloud",
          name: "Pending meal",
          syncState: "pending",
          totals: { kcal: 500, protein: 25, fat: 15, carbs: 45 },
        }),
        createMeal({
          mealId: "failed-meal",
          cloudId: "failed-cloud",
          name: "Failed meal",
          syncState: "failed",
          totals: { kcal: 400, protein: 20, fat: 10, carbs: 50 },
        }),
        createMeal({
          mealId: "conflict-meal",
          cloudId: "conflict-cloud",
          name: "Conflict meal",
          syncState: "conflict",
          totals: { kcal: 300, protein: 15, fat: 9, carbs: 35 },
        }),
      ],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(
      getByText(
        "meals:3:Pending meal/pending|Failed meal/failed|Conflict meal/conflict",
      ),
    ).toBeTruthy();
    expect(getByText("hero-progress:0.60")).toBeTruthy();
    expect(getByText("macro-targets:125/65/225;consumed:60/34/130")).toBeTruthy();
  });

  it("uses canonical dayKey for the selected day when list and progress update from pending meals", () => {
    const getMeals = jest.fn();
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          mealId: "late-pending",
          cloudId: "late-pending",
          name: "Late pending",
          dayKey: "2026-03-17",
          timestamp: "2026-03-18T01:30:00.000Z",
          syncState: "pending",
          totals: { kcal: 400, protein: 30, fat: 10, carbs: 45 },
        }),
        createMeal({
          mealId: "timestamp-neighbor",
          cloudId: "timestamp-neighbor",
          name: "Timestamp neighbor",
          dayKey: "2026-03-18",
          timestamp: "2026-03-17T12:00:00.000Z",
          totals: { kcal: 900, protein: 70, fat: 30, carbs: 95 },
        }),
      ],
      getMeals,
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("pick-2026-03-17"));

    expect(getByText("meals:1:Late pending/pending")).toBeTruthy();
    expect(getByText("hero-progress:0.20")).toBeTruthy();
    expect(getByText("macro-targets:125/65/225;consumed:30/10/45")).toBeTruthy();
    expect(queryByText(/Timestamp neighbor/)).toBeNull();
    expect(getMeals).not.toHaveBeenCalled();
  });

  it("does not trigger an extra meals reload from the screen layer", async () => {
    const getMeals = jest.fn();
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals,
    });

    const navigation = createNavigation();
    renderWithTheme(<HomeScreen navigation={navigation as never} />);

    await waitFor(() => {
      expect(mockUseMeals).toHaveBeenCalledWith("user-1");
    });

    expect(getMeals).not.toHaveBeenCalled();
  });

  it("hides weekly report card for free users", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });
    mockUseAccessContext.mockReturnValue({
      accessState: null,
      loading: false,
      refreshAccess: jest.fn(),
      applyAccessFromResponse: jest.fn(),
      canUseFeature: jest.fn(() => false),
      getFeature: jest.fn(),
    });

    const navigation = createNavigation();
    const { queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(queryByText("weekly-report-card:ready")).toBeNull();
    expect(queryByText("weekly-report-card:loading")).toBeNull();
  });

  it("renders ready weekly report as the only retention card when the day has signal", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });
    mockUseCoach.mockReturnValue({
      coach: createCoachResponse(createCoachInsight()),
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      isStale: false,
      error: null,
      refresh: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: true,
    });
    expect(getByText("weekly-report-card:ready")).toBeTruthy();
    expect(queryByText(/^coach-insight-card:/)).toBeNull();

    fireEvent.press(getByText("weekly-report-card:ready"));
    expect(navigation.navigate).toHaveBeenCalledWith("WeeklyReport");
  });

  it("renders coach insight when weekly report is not ready and coach has a non-competing action", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });
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
    mockUseCoach.mockReturnValue({
      coach: createCoachResponse(createCoachInsight()),
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      isStale: false,
      error: null,
      refresh: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(queryByText("weekly-report-card:ready")).toBeNull();
    fireEvent.press(getByText("coach-insight-card:Ask coach about today:open_chat"));
    expect(navigation.navigate).toHaveBeenCalledWith("Chat");
  });

  it("shows the past empty state for a previous day without entries", () => {
    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("pick-2026-03-17"));

    expect(getByText("Add a missed meal")).toBeTruthy();
    expect(getByText("You missed a meal log")).toBeTruthy();
    expect(getByText("You can still fill in what was missing.")).toBeTruthy();
    expect(queryByText(/^coach-insight-card:/)).toBeNull();
    expect(queryByText("weekly-report-card:ready")).toBeNull();
  });

  it("does not show today retention surfaces for a selected past day", () => {
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          mealId: "meal-past",
          dayKey: "2026-03-17",
          timestamp: new Date("2026-03-17T10:00:00.000Z").getTime(),
        }),
      ],
      getMeals: jest.fn(),
    });
    mockUseCoach.mockReturnValue({
      coach: createCoachResponse(createCoachInsight()),
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      isStale: false,
      error: null,
      refresh: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("pick-2026-03-17"));

    expect(queryByText(/^coach-insight-card:/)).toBeNull();
    expect(queryByText("weekly-report-card:ready")).toBeNull();
    expect(mockUseCoach).toHaveBeenLastCalledWith({
      uid: "user-1",
      dayKey: "2026-03-17",
      active: false,
    });
  });

  it("keeps past days with entries in in-progress state and never shows missing-entry copy", () => {
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          mealId: "meal-past",
          dayKey: "2026-03-17",
          timestamp: new Date("2026-03-17T10:00:00.000Z").getTime(),
          createdAt: "2026-03-17T10:00:00.000Z",
          updatedAt: "2026-03-17T10:00:00.000Z",
          totals: { kcal: 700, protein: 40, fat: 20, carbs: 75 },
        }),
      ],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("pick-2026-03-17"));

    expect(getByText("Add a missed meal")).toBeTruthy();
    expect(getByText("hero-progress:0.35")).toBeTruthy();
    expect(getByText(/^meals:1:/)).toBeTruthy();
    expect(queryByText("You missed a meal log")).toBeNull();
    expect(queryByText("You can still fill in what was missing.")).toBeNull();
  });

  it("updates meals list and progress consistently after a meal is added", () => {
    const mealsState: { meals: ReturnType<typeof createMeal>[] } = { meals: [] };
    mockUseMeals.mockImplementation(() => ({
      meals: mealsState.meals,
      getMeals: jest.fn(),
    }));

    const navigation = createNavigation();
    const { getByText, queryByText, rerender } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(queryByText(/^meals:1:/)).toBeNull();
    expect(queryByText("hero-progress:0.25")).toBeNull();

    mealsState.meals = [createMeal()];
    rerender(<HomeScreen navigation={navigation as never} />);

    expect(getByText(/^meals:1:/)).toBeTruthy();
    expect(getByText("hero-progress:0.25")).toBeTruthy();
    expect(queryByText("hero-progress:0.00")).toBeNull();
  });

  it("renders the completed state and routes the CTA to review flow instead of add flow", () => {
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          totals: { kcal: 2100, protein: 152, fat: 68, carbs: 243 },
        }),
      ],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("Goal reached, Anna")).toBeTruthy();
    expect(getByText("Review your day")).toBeTruthy();
    expect(getByText("Ask the assistant for advice")).toBeTruthy();

    fireEvent.press(getByText("Review your day"));
    expect(navigation.navigate).toHaveBeenCalledWith("HistoryList");
  });
});
