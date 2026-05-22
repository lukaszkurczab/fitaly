import type { ReactNode } from "react";
import { fireEvent } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import SelectSavedMealScreen from "@/feature/Meals/screens/SelectSavedMealsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal } from "@/types/meal";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

const mockUseAuthContext = jest.fn();
const mockUseMealDraftContext = jest.fn();
const mockUseSelectSavedMealsState = jest.fn();
const mockSyncMyMeals = jest.fn();
const mockUseNetInfo = jest.fn();
let selectSavedMealsFocusEffect: (() => void) | undefined;

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("@/feature/Meals/hooks/useSelectSavedMealsState", () => ({
  useSelectSavedMealsState: (params: unknown) =>
    mockUseSelectSavedMealsState(params),
}));

jest.mock("@/services/meals/myMealService", () => ({
  syncMyMeals: (uid: string | null) => mockSyncMyMeals(uid),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) => {
    selectSavedMealsFocusEffect = callback;
  },
}));

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) =>
      typeof fallbackOrOptions === "string" ? fallbackOrOptions : key,
  }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
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
    ScreenCornerNavButton: ({
      onPress,
      accessibilityLabel,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
    }) =>
      createElement(
        Pressable,
        { onPress, accessibilityRole: "button", accessibilityLabel },
        createElement(Text, null, "close-button"),
      ),
    FullScreenLoader: () => createElement(Text, null, "full-screen-loader"),
    Button: ({ label, onPress, disabled }: ButtonProps) =>
      createElement(
        Pressable,
        { onPress, disabled, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
    TextInput: ({
      value,
      onChangeText,
      placeholder,
    }: {
      value: string;
      onChangeText: (value: string) => void;
      placeholder?: string;
    }) =>
      createElement(
        View,
        null,
        createElement(Text, null, `input:${value}`),
        createElement(Text, null, placeholder ?? "placeholder"),
        createElement(
          Pressable,
          { onPress: () => onChangeText("pasta") },
          createElement(Text, null, "change-search"),
        ),
      ),
  };
});

jest.mock("@/feature/Meals/components/SavedMealActionCard", () => ({
  SavedMealActionCard: ({
    meal,
    onAdd,
  }: {
    meal: Meal;
    onAdd: (meal: Meal) => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      View,
      null,
      createElement(Text, null, meal.name ?? "unnamed-meal"),
      createElement(
        Pressable,
        { onPress: () => onAdd(meal) },
        createElement(Text, null, `add:${meal.name ?? "unnamed-meal"}`),
      ),
    );
  },
}));

jest.mock("../components/EmptyState", () => ({
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      View,
      null,
      createElement(Text, null, title),
      createElement(Text, null, description),
    );
  },
}));

const buildMeal = (overrides?: Partial<Meal>): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-01-10T12:00:00.000Z",
  type: "dinner",
  name: "Chicken pasta",
  ingredients: [],
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-01-10T12:00:00.000Z",
  syncState: "synced",
  source: "saved",
  ...overrides,
});

describe("SelectSavedMealScreen", () => {
  beforeEach(() => {
    selectSavedMealsFocusEffect = undefined;
    mockSyncMyMeals.mockReset();
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUseMealDraftContext.mockReturnValue({
      setMeal: jest.fn(),
      saveDraft: jest.fn(async () => undefined),
      setLastScreen: jest.fn(async () => undefined),
    });
  });

  it("shows the loader while data is loading", () => {
    mockUseSelectSavedMealsState.mockReturnValue({
      step: 20,
      queryText: "",
      setQueryText: jest.fn(),
      loading: true,
      pageItems: [],
      refresh: jest.fn(),
      handleAddMeal: jest.fn(),
      handleStartOver: jest.fn(),
      keyExtractor: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const { getByText, queryByText } = renderWithTheme(
      <SelectSavedMealScreen navigation={{} as never} />,
    );

    expect(getByText("full-screen-loader")).toBeTruthy();
    expect(queryByText("close-button")).toBeNull();
  });

  it("shows the empty state and supports starting over", () => {
    const handleStartOver = jest.fn();
    const setQueryText = jest.fn();
    mockUseSelectSavedMealsState.mockReturnValue({
      step: 20,
      queryText: "",
      setQueryText,
      loading: false,
      pageItems: [],
      refresh: jest.fn(),
      handleAddMeal: jest.fn(),
      handleStartOver,
      keyExtractor: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const { getByText } = renderWithTheme(
      <SelectSavedMealScreen navigation={{} as never} />,
    );

    fireEvent.press(getByText("change-search"));
    fireEvent.press(getByText("Choose another method"));

    expect(getByText("Saved meals")).toBeTruthy();
    expect(getByText("No saved meals yet")).toBeTruthy();
    expect(setQueryText).toHaveBeenCalledWith("pasta");
    expect(handleStartOver).toHaveBeenCalledTimes(1);
  });

  it("shows close button on empty state and uses back navigation when available", () => {
    const goBack = jest.fn();
    const navigate = jest.fn();
    mockUseSelectSavedMealsState.mockReturnValue({
      step: 20,
      queryText: "",
      setQueryText: jest.fn(),
      loading: false,
      pageItems: [],
      refresh: jest.fn(),
      handleAddMeal: jest.fn(),
      handleStartOver: jest.fn(),
      keyExtractor: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const { getByLabelText } = renderWithTheme(
      <SelectSavedMealScreen
        navigation={{ canGoBack: () => true, goBack, navigate } as never}
      />,
    );

    fireEvent.press(getByLabelText("common:close"));

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows offline-empty state copy when there are no local saved meals", () => {
    mockUseNetInfo.mockReturnValue({ isConnected: false });
    mockUseSelectSavedMealsState.mockReturnValue({
      step: 20,
      queryText: "",
      setQueryText: jest.fn(),
      loading: false,
      pageItems: [],
      refresh: jest.fn(),
      handleAddMeal: jest.fn(),
      handleStartOver: jest.fn(),
      keyExtractor: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const { getByText } = renderWithTheme(
      <SelectSavedMealScreen navigation={{} as never} />,
    );

    expect(getByText("savedMeals.offlineEmpty")).toBeTruthy();
  });

  it("renders meals list and wires inline add actions", () => {
    const handleAddMeal = jest.fn();
    mockUseSelectSavedMealsState.mockReturnValue({
      step: 20,
      queryText: "chi",
      setQueryText: jest.fn(),
      loading: false,
      pageItems: [buildMeal()],
      refresh: jest.fn(),
      handleAddMeal,
      handleStartOver: jest.fn(),
      keyExtractor: (meal: Meal) => meal.mealId,
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const navigate = jest.fn();
    const { getByText, getByLabelText } = renderWithTheme(
      <SelectSavedMealScreen
        navigation={{ canGoBack: () => false, goBack: jest.fn(), navigate } as never}
      />,
    );

    fireEvent.press(getByText("add:Chicken pasta"));
    fireEvent.press(getByLabelText("common:close"));

    expect(getByText("input:chi")).toBeTruthy();
    expect(handleAddMeal).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Chicken pasta" }),
    );
    expect(navigate).toHaveBeenCalledWith("Home");
  });

  it("passes working sync and navigation callbacks to state hook", async () => {
    const navigate = jest.fn();
    mockUseSelectSavedMealsState.mockReturnValue({
      step: 20,
      queryText: "",
      setQueryText: jest.fn(),
      loading: false,
      pageItems: [],
      refresh: jest.fn(),
      handleAddMeal: jest.fn(),
      handleStartOver: jest.fn(),
      keyExtractor: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    renderWithTheme(
      <SelectSavedMealScreen navigation={{ navigate } as unknown as never} />,
    );

    const hookArgs = mockUseSelectSavedMealsState.mock.calls.at(-1)?.[0] as {
      syncSavedMeals: () => Promise<unknown> | unknown;
      onNavigateReview: () => void;
      onStartOver: () => void;
    };

    await hookArgs.syncSavedMeals();
    hookArgs.onNavigateReview();
    hookArgs.onStartOver();

    expect(mockSyncMyMeals).toHaveBeenCalledWith("user-1");
    expect(navigate).toHaveBeenCalledWith("AddMeal", { start: "ReviewMeal" });
    expect(navigate).toHaveBeenCalledWith("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  });

  it("refreshes on later focus but skips the initial mount focus", () => {
    jest.spyOn(Date, "now").mockReturnValue(32_000);
    const refresh = jest.fn(async () => undefined);
    mockUseSelectSavedMealsState.mockReturnValue({
      step: 20,
      queryText: "",
      setQueryText: jest.fn(),
      loading: false,
      refreshing: false,
      pageItems: [],
      refresh,
      handleAddMeal: jest.fn(),
      handleStartOver: jest.fn(),
      keyExtractor: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    renderWithTheme(
      <SelectSavedMealScreen navigation={{} as never} />,
    );

    selectSavedMealsFocusEffect?.();
    expect(refresh).not.toHaveBeenCalled();

    selectSavedMealsFocusEffect?.();
    expect(refresh).toHaveBeenCalledTimes(1);

    jest.restoreAllMocks();
  });
});
