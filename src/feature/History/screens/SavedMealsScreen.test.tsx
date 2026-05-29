import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ActivityIndicator } from "react-native";
import SavedMealsScreen from "@/feature/History/screens/SavedMealsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal } from "@/types/meal";

const mockUseNetInfo = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUseMeals = jest.fn();
const mockUseFilters = jest.fn();
const mockUseMealDraftContext = jest.fn();
const mockUseSavedMealsData = jest.fn();
const mockUuid = jest.fn();
const mockSyncMyMeals = jest.fn<
  (uid: string | null | undefined) => Promise<void>
>();
let savedMealsFocusEffect: (() => void) | undefined;

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) => {
    savedMealsFocusEffect = callback;
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@hooks/useMeals", () => ({
  useMeals: (uid: string) => mockUseMeals(uid),
}));

jest.mock("@/context/HistoryContext", () => ({
  useFilters: (scope: string) => mockUseFilters(scope),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("@/feature/History/hooks/useSavedMealsData", () => ({
  useSavedMealsData: (params: unknown) => mockUseSavedMealsData(params),
}));

jest.mock("@/services/meals/myMealService", () => ({
  syncMyMeals: (uid: string | null | undefined) => mockSyncMyMeals(uid),
}));

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { defaultValue?: string } | string,
    ) => (typeof options === "string" ? options : options?.defaultValue ?? key),
  }),
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: React.ReactNode }) =>
      createElement(View, null, children),
    FullScreenLoader: () => createElement(Text, null, "full-screen-loader"),
    SearchBox: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (value: string) => void;
    }) =>
      createElement(
        Pressable,
        { onPress: () => onChange("next query") },
        createElement(Text, null, `search:${value}`),
      ),
  };
});

jest.mock("@/components/MealListItem", () => ({
  MealListItem: ({
    meal,
    onPress,
    onDuplicate,
    onEdit,
    onDelete,
  }: {
    meal: Meal;
    onPress: () => void;
    onDuplicate: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      View,
      null,
      createElement(
        Pressable,
        { onPress },
        createElement(Text, null, `open:${meal.name}`),
      ),
      createElement(
        Pressable,
        { onPress: onDuplicate },
        createElement(Text, null, `duplicate:${meal.name}`),
      ),
      createElement(
        Pressable,
        { onPress: onEdit },
        createElement(Text, null, `edit:${meal.name}`),
      ),
      createElement(
        Pressable,
        { onPress: onDelete },
        createElement(Text, null, `delete:${meal.name}`),
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
      createElement(Text, null, `empty-title:${title}`),
      createElement(Text, null, `empty-description:${description}`),
    );
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
  FilterPanel: ({ scope }: { scope: string }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, `filter-panel:${scope}`);
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

const buildMeal = (overrides?: Partial<Meal>): Meal => ({
  mealId: "meal-1",
  cloudId: "cloud-1",
  userUid: "user-1",
  name: "Pasta bake",
  photoUrl: "https://example.com/pasta.jpg",
  ingredients: [
    {
      id: "ingredient-1",
      name: "Pasta",
      amount: 100,
      unit: "g",
      kcal: 150,
      protein: 5,
      carbs: 30,
      fat: 2,
    },
  ],
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
  timestamp: "2026-01-01T12:00:00.000Z",
  syncState: "synced",
  tags: [],
  deleted: false,
  notes: null,
  type: "lunch",
  source: "saved",
  ...overrides,
});

describe("SavedMealsScreen", () => {
  beforeEach(() => {
    savedMealsFocusEffect = undefined;
    mockSyncMyMeals.mockReset();
    mockSyncMyMeals.mockResolvedValue(undefined);
    mockUuid.mockReset();
    mockUuid
      .mockReturnValueOnce("duplicated-meal-id")
      .mockReturnValueOnce("edited-meal-id");
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUseMeals.mockReturnValue({ getMeals: jest.fn() });
    mockUseFilters.mockReturnValue({
      query: "",
      setQuery: jest.fn(),
      filters: null,
      showFilters: false,
      toggleShowFilters: jest.fn(),
      filterCount: 0,
    });
    mockUseMealDraftContext.mockReturnValue({
      meal: null,
      setMeal: jest.fn(),
      saveDraft: jest.fn<(uid: string) => Promise<void>>(
        async (_uid: string) => undefined,
      ),
      setLastScreen: jest.fn<(uid: string, screen: string) => Promise<void>>(
        async (_uid: string, _screen: string) => undefined,
      ),
    });
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      loading: false,
      loadingMore: false,
      validating: false,
      errorKind: null,
      dataState: "ready",
      visibleItems: [],
      refresh: jest.fn(),
      onDelete: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });
  });

  it("passes a sync callback that calls syncMyMeals with current uid", async () => {
    renderWithTheme(<SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />);

    expect(mockUseSavedMealsData).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        syncSavedMeals: expect.any(Function),
      }),
    );

    const params = mockUseSavedMealsData.mock.calls[0]?.[0] as {
      syncSavedMeals: () => Promise<void>;
    };

    await params.syncSavedMeals();
    expect(mockSyncMyMeals).toHaveBeenCalledWith("user-1");
  });

  it("refreshes on later focus but skips the initial mount focus", async () => {
    jest.spyOn(Date, "now").mockReturnValue(32_000);
    const refresh = jest.fn(async () => undefined);
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      loading: false,
      loadingMore: false,
      validating: false,
      refreshing: false,
      errorKind: null,
      dataState: "ready",
      visibleItems: [],
      refresh,
      onDelete: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    renderWithTheme(<SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />);

    savedMealsFocusEffect?.();
    expect(refresh).not.toHaveBeenCalled();

    savedMealsFocusEffect?.();
    expect(refresh).toHaveBeenCalledTimes(1);

    jest.restoreAllMocks();
  });

  it("renders loading and non-ready states", () => {
    const setQuery = jest.fn();

    mockUseFilters.mockReturnValue({
      query: "rice",
      setQuery,
      filters: null,
      showFilters: false,
      toggleShowFilters: jest.fn(),
      filterCount: 0,
    });

    mockUseSavedMealsData
      .mockReturnValueOnce({
        pageSize: 20,
        dataState: "loading",
      })
      .mockReturnValueOnce({
        pageSize: 20,
        dataState: "error",
        errorKind: "refresh",
      })
      .mockReturnValueOnce({
        pageSize: 20,
        dataState: "offline-empty",
        errorKind: null,
      })
      .mockReturnValueOnce({
        pageSize: 20,
        dataState: "empty",
        errorKind: null,
      });

    const loading = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    expect(loading.getByText("full-screen-loader")).toBeTruthy();

    const error = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    expect(error.getByText("search:rice")).toBeTruthy();
    expect(error.getByText("empty-title:savedMeals.errorTitle")).toBeTruthy();
    expect(
      error.getByText("empty-description:savedMeals.refreshError"),
    ).toBeTruthy();
    fireEvent.press(error.getByText("search:rice"));
    expect(setQuery).toHaveBeenCalledWith("next query");

    const offline = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    expect(
      offline.getByText("empty-description:savedMeals.offlineEmpty"),
    ).toBeTruthy();

    const empty = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    expect(
      empty.getByText("empty-description:Try a different search."),
    ).toBeTruthy();
  });

  it("renders filters branch outside the ready state", () => {
    mockUseFilters.mockReturnValue({
      query: "",
      setQuery: jest.fn(),
      filters: null,
      showFilters: true,
      toggleShowFilters: jest.fn(),
      filterCount: 1,
    });
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      dataState: "empty",
      errorKind: null,
    });

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    expect(screen.getByText("filter-panel:myMeals")).toBeTruthy();
  });

  it("renders ready list state and handles saved meal actions", async () => {
    const navigate = jest.fn<(screen: string, params?: unknown) => void>();
    const toggleShowFilters = jest.fn();
    const setMeal = jest.fn();
    const saveDraft = jest.fn<
      (uid: string, draftOverride?: Meal | null) => Promise<void>
    >(
      async (_uid: string) => undefined,
    );
    const setLastScreen = jest.fn<(uid: string, screen: string) => Promise<void>>(
      async (_uid: string, _screen: string) => undefined,
    );
    const onDelete = jest.fn();
    const getMeals = jest.fn(async () => undefined);
    const refresh = jest.fn();
    const meal = buildMeal();

    mockUseMeals.mockReturnValue({ getMeals });
    mockUseFilters.mockReturnValue({
      query: "",
      setQuery: jest.fn(),
      filters: null,
      showFilters: false,
      toggleShowFilters,
      filterCount: 3,
    });
    mockUseMealDraftContext.mockReturnValue({
      meal: null,
      setMeal,
      saveDraft,
      setLastScreen,
    });
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      loading: false,
      loadingMore: true,
      validating: true,
      errorKind: null,
      dataState: "ready",
      visibleItems: [meal],
      refresh,
      onDelete,
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate } as never} />,
    );

    expect(screen.getByText("search:")).toBeTruthy();
    expect(screen.getByText("filter-badge:3")).toBeTruthy();
    expect(screen.getByText("open:Pasta bake")).toBeTruthy();
    expect(screen.getByText("loading-skeleton:56")).toBeTruthy();
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();

    fireEvent.press(screen.getByText("filter-badge:3"));
    fireEvent.press(screen.getByText("open:Pasta bake"));
    fireEvent.press(screen.getByText("duplicate:Pasta bake"));
    fireEvent.press(screen.getByText("edit:Pasta bake"));
    fireEvent.press(screen.getByText("delete:Pasta bake"));

    expect(toggleShowFilters).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenNthCalledWith(1, "MealDetails", {
      cloudId: "cloud-1",
    });
    expect(onDelete).toHaveBeenCalledWith(meal);

    await waitFor(() => {
      expect(setMeal).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          mealId: "duplicated-meal-id",
          cloudId: undefined,
          savedMealRefId: "cloud-1",
          source: "saved",
          name: "Pasta bake",
          photoUrl: "https://example.com/pasta.jpg",
          ingredients: meal.ingredients,
          userUid: "user-1",
        }),
      );
      expect(saveDraft).toHaveBeenNthCalledWith(
        1,
        "user-1",
        expect.objectContaining({
          mealId: "duplicated-meal-id",
          cloudId: undefined,
          savedMealRefId: "cloud-1",
          source: "saved",
        }),
      );
      expect(setLastScreen).toHaveBeenNthCalledWith(1, "user-1", "ReviewMeal");
      expect(navigate).toHaveBeenNthCalledWith(2, "AddMeal", {
        start: "ReviewMeal",
      });
      expect(setMeal).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          mealId: "edited-meal-id",
          cloudId: undefined,
          savedMealRefId: "cloud-1",
          source: "saved",
          name: "Pasta bake",
          photoUrl: "https://example.com/pasta.jpg",
          ingredients: meal.ingredients,
          userUid: "user-1",
        }),
      );
      expect(saveDraft).toHaveBeenNthCalledWith(
        2,
        "user-1",
        expect.objectContaining({
          mealId: "edited-meal-id",
          cloudId: undefined,
          savedMealRefId: "cloud-1",
          source: "saved",
        }),
      );
      expect(setLastScreen).toHaveBeenNthCalledWith(
        2,
        "user-1",
        "EditMealDetails",
      );
      expect(navigate).toHaveBeenNthCalledWith(3, "AddMeal", {
        start: "EditMealDetails",
        submitIntent: "replaceReview",
      });
    });
  });

  it("does not duplicate or edit when the user is missing", async () => {
    const navigate = jest.fn<(screen: string, params?: unknown) => void>();
    const setMeal = jest.fn();
    const saveDraft = jest.fn<
      (uid: string, draftOverride?: Meal | null) => Promise<void>
    >(
      async (_uid: string) => undefined,
    );
    const setLastScreen = jest.fn<(uid: string, screen: string) => Promise<void>>(
      async (_uid: string, _screen: string) => undefined,
    );
    const meal = buildMeal({ cloudId: undefined });

    mockUseAuthContext.mockReturnValue({ uid: null });
    mockUseMealDraftContext.mockReturnValue({
      meal: buildMeal({ mealId: "existing-draft" }),
      setMeal,
      saveDraft,
      setLastScreen,
    });
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      loading: false,
      loadingMore: false,
      validating: false,
      errorKind: null,
      dataState: "ready",
      visibleItems: [meal],
      refresh: jest.fn(),
      onDelete: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate } as never} />,
    );

    fireEvent.press(screen.getByText("duplicate:Pasta bake"));
    fireEvent.press(screen.getByText("edit:Pasta bake"));

    await waitFor(() => {
      expect(setMeal).not.toHaveBeenCalled();
      expect(saveDraft).not.toHaveBeenCalled();
      expect(setLastScreen).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
