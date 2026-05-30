import { fireEvent } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import HistoryListScreen from "@/feature/History/screens/HistoryListScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockUseHistoryListState = jest.fn();

jest.mock("@/feature/History/hooks/useHistoryListState", () => ({
  useHistoryListState: (params: unknown) => mockUseHistoryListState(params),
}));

jest.mock("@/services/meals/mealService", () => ({
  FREE_WINDOW_DAYS: 30,
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { ns?: string; defaultValue?: string; count?: number },
    ) => {
      if (key === "gram") return "g";
      return (
        options?.defaultValue ??
        (typeof options?.count === "number" ? `${options.count} results` : key)
      );
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("@/components", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({
      children,
      backgroundGradient,
    }: {
      children?: React.ReactNode;
      backgroundGradient?: unknown;
    }) =>
      createElement(
        View,
        null,
        createElement(
          Text,
          null,
          `layout-background:${backgroundGradient ? "yes" : "no"}`,
        ),
        children,
      ),
    SearchBox: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (value: string) => void;
    }) =>
      createElement(
        Pressable,
        { onPress: () => onChange("updated query") },
        createElement(Text, null, `search:${value}`),
      ),
  };
});

jest.mock("../components/EmptyState", () => ({
  EmptyState: ({
    title,
    eyebrow,
    description,
    actionLabel,
    onAction,
    variant,
  }: {
    title: string;
    eyebrow?: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    variant?: "archive" | "compact";
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      View,
      null,
      createElement(Text, null, `empty-variant:${variant ?? "archive"}`),
      eyebrow ? createElement(Text, null, `empty-eyebrow:${eyebrow}`) : null,
      createElement(Text, null, `empty-title:${title}`),
      createElement(Text, null, `empty-description:${description}`),
      actionLabel && onAction
        ? createElement(
            Pressable,
            { onPress: onAction },
            createElement(Text, null, `empty-action:${actionLabel}`),
          )
        : null,
    );
  },
}));

jest.mock("../components/LoadingSkeleton", () => ({
  LoadingSkeleton: ({ height }: { height: number }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, `loading-skeleton:${height}`);
  },
}));

jest.mock("../components/FilterBadgeButton", () => ({
  FilterBadgeButton: ({
    activeCount,
    onPress,
  }: {
    activeCount: number;
    onPress: () => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      Pressable,
      { onPress },
      createElement(Text, null, `filter-badge:${activeCount}`),
    );
  },
}));

jest.mock("../components/FilterPanel", () => ({
  FilterPanel: ({
    scope,
    isPremium,
    windowDays,
    onUpgrade,
  }: {
    scope: string;
    isPremium?: boolean;
    windowDays?: number;
    onUpgrade?: () => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      View,
      null,
      createElement(
        Text,
        null,
        `filter-panel:${scope}:${String(isPremium)}:${String(windowDays)}`,
      ),
      onUpgrade
        ? createElement(
            Pressable,
            { onPress: onUpgrade },
            createElement(Text, null, "upgrade-history"),
          )
        : null,
    );
  },
}));

jest.mock("@/components/MealListItem", () => ({
  MealListItem: ({
    meal,
    onPress,
  }: {
    meal: { name?: string };
    onPress: () => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      Pressable,
      { onPress },
      createElement(Text, null, `meal:${meal.name ?? ""}`),
    );
  },
}));

describe("HistoryListScreen", () => {
  beforeEach(() => {
    mockUseHistoryListState.mockReset();
  });

  it("renders loading and non-ready states", () => {
    const setQuery = jest.fn();
    const onUpgrade = jest.fn();

    mockUseHistoryListState
      .mockReturnValueOnce({
        dataState: "loading",
        sections: [],
      })
      .mockReturnValueOnce({
        dataState: "error",
        sections: [],
        showFilters: false,
        query: "salad",
        setQuery,
        emptyState: {
          title: "Nothing found",
          description: "Try again later",
        },
      })
      .mockReturnValueOnce({
        dataState: "offline-empty",
        sections: [],
        showFilters: true,
        isPremium: false,
        onUpgrade,
      });

    const loading = renderWithTheme(
      <HistoryListScreen navigation={{} as never} />,
    );
    expect(loading.getByTestId("history-list-loading")).toBeTruthy();

    const empty = renderWithTheme(
      <HistoryListScreen navigation={{} as never} />,
    );
    expect(empty.getByText("search:salad")).toBeTruthy();
    expect(empty.getByText("empty-title:Nothing found")).toBeTruthy();
    fireEvent.press(empty.getByText("search:salad"));
    expect(setQuery).toHaveBeenCalledWith("updated query");

    const filters = renderWithTheme(
      <HistoryListScreen navigation={{} as never} />,
    );
    expect(filters.getByText("filter-panel:history:false:30")).toBeTruthy();
    fireEvent.press(filters.getByText("upgrade-history"));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("renders ready list state and forwards actions", () => {
    const toggleShowFilters = jest.fn();
    const onMealPress = jest.fn();
    const refresh = jest.fn();
    const onEndReached = jest.fn();
    const retryFailedSyncOps = jest.fn();

    mockUseHistoryListState.mockReturnValue({
      dataState: "ready",
      showFilters: false,
      query: "",
      setQuery: jest.fn(),
      filterCount: 2,
      toggleShowFilters,
      sections: [
        {
          title: "Today",
          dateKey: "2026-02-10",
          totalKcal: 720,
          data: [
            { mealId: "meal-1", name: "Chicken bowl", syncState: "pending" },
            { mealId: "meal-2", name: "Apple pie", syncState: "synced" },
          ],
        },
      ],
      keyExtractor: (item: { mealId: string }) => item.mealId,
      loading: false,
      loadingMore: true,
      refresh,
      onEndReached,
      onMealPress,
      kcalLabel: "kcal",
      isPremium: true,
      deadLetterBanner: {
        title: "2 failed changes",
        description: "Retry to requeue failed operations.",
        actionLabel: "Retry now",
      },
      retryingFailedSync: false,
      retryFailedSyncOps,
    });

    const screen = renderWithTheme(
      <HistoryListScreen navigation={{} as never} />,
    );

    expect(screen.getByText("search:")).toBeTruthy();
    expect(screen.getByText("2 failed changes")).toBeTruthy();
    expect(screen.getByText("Retry now")).toBeTruthy();
    expect(screen.getByText("filter-badge:2")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("720 kcal")).toBeTruthy();
    expect(screen.getByText("Chicken bowl")).toBeTruthy();
    expect(screen.getByText("Apple pie")).toBeTruthy();
    expect(screen.getByTestId("history-meal-sync-pending-0")).toBeTruthy();
    expect(screen.queryByText("history.syncStatus.pending.label")).toBeNull();
    expect(screen.getByText("loading-skeleton:88")).toBeTruthy();

    fireEvent.press(screen.getByText("filter-badge:2"));
    fireEvent.press(screen.getByText("Chicken bowl"));
    fireEvent.press(screen.getByText("Retry now"));

    expect(toggleShowFilters).toHaveBeenCalledTimes(1);
    expect(onMealPress).toHaveBeenCalledWith({
      mealId: "meal-1",
      name: "Chicken bowl",
      syncState: "pending",
    });
    expect(retryFailedSyncOps).toHaveBeenCalledTimes(1);
    expect(onEndReached).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders compact macro labels with full accessibility names", () => {
    mockUseHistoryListState.mockReturnValue({
      dataState: "ready",
      showFilters: false,
      query: "",
      setQuery: jest.fn(),
      filterCount: 0,
      toggleShowFilters: jest.fn(),
      sections: [
        {
          title: "Today",
          dateKey: "2026-02-10",
          totalKcal: 375,
          data: [
            {
              mealId: "meal-1",
              name: "Yogurt bowl",
              type: "lunch",
              timestamp: "2026-02-10T12:30:00.000Z",
              syncState: "synced",
              totals: {
                kcal: 375,
                protein: 20,
                carbs: 49,
                fat: 12,
              },
            },
          ],
        },
      ],
      loading: false,
      loadingMore: false,
      refresh: jest.fn(),
      onEndReached: jest.fn(),
      onMealPress: jest.fn(),
      kcalLabel: "kcal",
      isPremium: true,
    });

    const screen = renderWithTheme(
      <HistoryListScreen navigation={{} as never} />,
    );

    expect(screen.getByText("macroShort.protein 20g")).toBeTruthy();
    expect(screen.getByText("macroShort.carbs 49g")).toBeTruthy();
    expect(screen.getByText("macroShort.fat 12g")).toBeTruthy();
    expect(screen.getByLabelText("protein: 20g")).toBeTruthy();
    expect(screen.getByLabelText("carbs: 49g")).toBeTruthy();
    expect(screen.getByLabelText("fat: 12g")).toBeTruthy();
  });

  it("renders ready filters view", () => {
    mockUseHistoryListState.mockReturnValue({
      dataState: "ready",
      sections: [],
      showFilters: true,
      query: "",
      filterCount: 0,
      isPremium: true,
      onUpgrade: jest.fn(),
    });

    const screen = renderWithTheme(
      <HistoryListScreen navigation={{} as never} />,
    );

    expect(screen.getByText("filter-panel:history:true:30")).toBeTruthy();
  });

  it("uses the designed archive empty state only for unfiltered first-run History", () => {
    const onLogFirstMeal = jest.fn();
    mockUseHistoryListState.mockReturnValue({
      dataState: "empty",
      sections: [],
      showFilters: false,
      query: "",
      setQuery: jest.fn(),
      filterCount: 0,
      toggleShowFilters: jest.fn(),
      emptyState: {
        title: "History is still empty",
        description: "Log your first meal.",
      },
      onLogFirstMeal,
    });

    const screen = renderWithTheme(
      <HistoryListScreen navigation={{} as never} />,
    );

    expect(screen.getByText("screenTitle")).toBeTruthy();
    expect(screen.getByText("layout-background:no")).toBeTruthy();
    expect(screen.getByText("empty-variant:archive")).toBeTruthy();
    expect(screen.getByText("empty-eyebrow:emptyEyebrow")).toBeTruthy();
    expect(screen.getByText("empty-action:emptyAction")).toBeTruthy();

    fireEvent.press(screen.getByText("empty-action:emptyAction"));
    expect(onLogFirstMeal).toHaveBeenCalledTimes(1);
  });

  it("uses compact no-results treatment for active filters", () => {
    mockUseHistoryListState.mockReturnValue({
      dataState: "empty",
      sections: [],
      showFilters: false,
      query: "",
      setQuery: jest.fn(),
      filterCount: 1,
      toggleShowFilters: jest.fn(),
      emptyState: {
        title: "Nothing matches the filters",
        description: "Change or clear filters.",
      },
      onLogFirstMeal: jest.fn(),
    });

    const screen = renderWithTheme(
      <HistoryListScreen navigation={{} as never} />,
    );

    expect(screen.getByText("empty-variant:compact")).toBeTruthy();
    expect(screen.getByText("layout-background:no")).toBeTruthy();
    expect(
      screen.getByText("empty-title:Nothing matches the filters"),
    ).toBeTruthy();
    expect(screen.queryByText("empty-action:emptyAction")).toBeNull();
    expect(screen.queryByText("empty-eyebrow:emptyEyebrow")).toBeNull();
  });
});
