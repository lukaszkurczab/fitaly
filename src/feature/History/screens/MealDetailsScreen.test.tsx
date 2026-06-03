import { fireEvent } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ActivityIndicator } from "react-native";
import MealDetailsScreen from "@/feature/History/screens/MealDetailsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal, Nutrients } from "@/types/meal";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

type ModalProps = {
  visible: boolean;
  message?: string;
  primaryAction?: { label: string; onPress?: () => void };
  secondaryAction?: { label: string; onPress?: () => void };
};

const mockUseMealDetailsScreenState = jest.fn();
const mockUseNetInfo = jest.fn<() => { isConnected: boolean | null }>();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { ns?: string; defaultValue?: string },
    ) => (options?.ns ? `${options.ns}:${key}` : options?.defaultValue ?? key),
    i18n: { language: "en" },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 8,
    right: 4,
    bottom: 0,
    left: 6,
  }),
}));

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/feature/History/hooks/useMealDetailsScreenState", () => ({
  useMealDetailsScreenState: () => mockUseMealDetailsScreenState(),
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
    BackTitleHeader: ({
      onBack,
      title,
    }: {
      onBack: () => void;
      title: string;
    }) =>
      createElement(
        View,
        null,
        createElement(
          Pressable,
          { onPress: onBack, accessibilityRole: "button", accessibilityLabel: "common:back" },
          createElement(Text, null, "back-button"),
        ),
        createElement(Text, null, title),
      ),
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
        createElement(Text, null, "back-button"),
      ),
    Card: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      onPress
        ? createElement(Pressable, { onPress }, children)
        : createElement(View, null, children),
    Button: ({
      label,
      onPress,
      disabled,
    }: ButtonProps) =>
      createElement(
        Pressable,
        { onPress, disabled, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
    Modal: ({
      visible,
      message,
      primaryAction,
      secondaryAction,
    }: ModalProps) =>
      visible
        ? createElement(
            View,
            null,
            message ? createElement(Text, null, message) : null,
            primaryAction
              ? createElement(
                  Pressable,
                  { onPress: primaryAction.onPress },
                  createElement(Text, null, primaryAction.label),
                )
              : null,
            secondaryAction
              ? createElement(
                  Pressable,
                  { onPress: secondaryAction.onPress },
                  createElement(Text, null, secondaryAction.label),
                )
              : null,
          )
        : null,
  };
});

jest.mock("../components/FallbackImage", () => ({
  FallbackImage: ({
    uri,
    onError,
  }: {
    uri: string;
    onError: () => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(
      View,
      null,
      createElement(Text, null, `fallback-image:${uri}`),
      createElement(
        Pressable,
        { onPress: onError },
        createElement(Text, null, "image-error"),
      ),
    );
  },
}));

const buildMeal = (overrides?: Partial<Meal>): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-02-01T12:00:00.000Z",
  type: "lunch",
  name: "Chicken bowl",
  ingredients: [
    {
      id: "ingredient-1",
      name: "Chicken",
      amount: 120,
      unit: "g",
      kcal: 220,
      protein: 30,
      carbs: 0,
      fat: 8,
    },
  ],
  createdAt: "2026-02-01T12:00:00.000Z",
  updatedAt: "2026-02-01T12:00:00.000Z",
  syncState: "synced",
  source: "saved",
  photoUrl: "file:///meal.jpg",
  ...overrides,
});

const buildNutrition = (overrides?: Partial<Nutrients>): Nutrients => ({
  kcal: 220,
  protein: 30,
  carbs: 0,
  fat: 8,
  ...overrides,
});

const buildState = (overrides?: Record<string, unknown>) => ({
  draft: buildMeal(),
  nutrition: buildNutrition(),
  showImageBlock: true,
  checkingImage: false,
  effectivePhotoUri: "file:///meal.jpg",
  onImageError: jest.fn(),
  goShare: jest.fn(),
  startEdit: jest.fn(),
  showDeleteModal: false,
  deleting: false,
  openDeleteModal: jest.fn(),
  closeDeleteModal: jest.fn(),
  confirmDelete: jest.fn(),
  reloadFromLocal: jest.fn(),
  handleBack: jest.fn(),
  ...overrides,
});

describe("MealDetailsScreen", () => {
  beforeEach(() => {
    mockUseMealDetailsScreenState.mockReset();
    mockUseNetInfo.mockReturnValue({ isConnected: true });
  });

  it("renders fallback state when the draft or nutrition is missing", () => {
    const state = {
      draft: null,
      nutrition: null,
      reloadFromLocal: jest.fn(),
      handleBack: jest.fn(),
    };
    mockUseMealDetailsScreenState.mockReturnValue({
      ...state,
    });

    const screen = renderWithTheme(<MealDetailsScreen />);

    expect(screen.getByText("meals:detailsUnavailable.title")).toBeTruthy();
    expect(screen.getByText("meals:detailsUnavailable.desc")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("common:back"));
    expect(state.handleBack).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText("common:retry"));
    expect(state.reloadFromLocal).toHaveBeenCalledTimes(1);
  });

  it("renders offline fallback copy when meal details are missing", () => {
    mockUseNetInfo.mockReturnValue({ isConnected: false });
    mockUseMealDetailsScreenState.mockReturnValue({
      draft: null,
      nutrition: null,
      reloadFromLocal: jest.fn(),
      handleBack: jest.fn(),
    });

    const screen = renderWithTheme(<MealDetailsScreen />);

    expect(screen.getByText("meals:detailsUnavailable.offlineDesc")).toBeTruthy();
  });

  it("renders without the image block when it is hidden", () => {
    const state = buildState({ showImageBlock: false });
    mockUseMealDetailsScreenState.mockReturnValue(state);

    const screen = renderWithTheme(<MealDetailsScreen />);

    expect(screen.getByText("Chicken bowl")).toBeTruthy();
    expect(screen.getByTestId("history-meal-details-sticky-header")).toBeTruthy();
    expect(screen.getByTestId("history-meal-details-sticky-actions")).toBeTruthy();
    expect(screen.queryByTestId("history-meal-details-sync-synced")).toBeNull();
    expect(screen.queryByText("fallback-image:file:///meal.jpg")).toBeNull();
    fireEvent.press(screen.getByText("meals:edit_meal"));
    fireEvent.press(screen.getByText("history:delete_meal"));
    expect(state.startEdit).toHaveBeenCalledTimes(1);
    expect(state.openDeleteModal).toHaveBeenCalledTimes(1);
  });

  it("renders pending sync as a compact icon beside the meal name", () => {
    mockUseMealDetailsScreenState.mockReturnValue(
      buildState({
        draft: buildMeal({ syncState: "pending" }),
        showImageBlock: false,
      }),
    );

    const screen = renderWithTheme(<MealDetailsScreen />);

    expect(screen.getByTestId("history-meal-details-sync-pending")).toBeTruthy();
    expect(
      screen.queryByText("history.syncStatus.pending.label"),
    ).toBeNull();
    expect(
      screen.queryByText("history.syncStatus.pending.description"),
    ).toBeNull();
  });

  it("renders the existing photo branch and forwards image actions", () => {
    const state = buildState();
    mockUseMealDetailsScreenState.mockReturnValue(state);

    const screen = renderWithTheme(<MealDetailsScreen />);

    expect(screen.getByText("fallback-image:file:///meal.jpg")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("common:share"));
    fireEvent.press(screen.getByText("image-error"));
    fireEvent.press(screen.getByLabelText("common:back"));

    expect(state.goShare).toHaveBeenCalledTimes(1);
    expect(state.onImageError).toHaveBeenCalledTimes(1);
    expect(state.handleBack).toHaveBeenCalledTimes(1);
  });

  it("hides the share action when the meal has a photo but no identity", () => {
    mockUseMealDetailsScreenState.mockReturnValue(
      buildState({
        draft: buildMeal({ cloudId: undefined, mealId: "" }),
        effectivePhotoUri: "file:///meal.jpg",
      }),
    );

    const screen = renderWithTheme(<MealDetailsScreen />);

    expect(screen.getByText("fallback-image:file:///meal.jpg")).toBeTruthy();
    expect(screen.queryByLabelText("common:share")).toBeNull();
  });

  it("renders the image loading branch", () => {
    mockUseMealDetailsScreenState.mockReturnValue(
      buildState({
        checkingImage: true,
        effectivePhotoUri: null,
      }),
    );

    const screen = renderWithTheme(<MealDetailsScreen />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it("does not show the add photo action on the details view", () => {
    const state = buildState({
      effectivePhotoUri: null,
      showImageBlock: false,
    });
    mockUseMealDetailsScreenState.mockReturnValue(state);

    const screen = renderWithTheme(<MealDetailsScreen />);

    expect(screen.getByText("Chicken")).toBeTruthy();
    expect(screen.queryByLabelText("meals:add_photo")).toBeNull();
  });

  it("renders delete modal actions and forwards confirm/cancel", () => {
    const state = buildState({ showDeleteModal: true });
    mockUseMealDetailsScreenState.mockReturnValue(state);

    const screen = renderWithTheme(<MealDetailsScreen />);

    fireEvent.press(screen.getByText("common:delete"));
    fireEvent.press(screen.getByText("common:cancel"));

    expect(state.confirmDelete).toHaveBeenCalledTimes(1);
    expect(state.closeDeleteModal).toHaveBeenCalledTimes(1);
  });
});
