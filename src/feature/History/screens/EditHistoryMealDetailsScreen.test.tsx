import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import EditHistoryMealDetailsScreen from "@/feature/History/screens/EditHistoryMealDetailsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal } from "@/types/meal";

const mockUseRoute = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUseMeals = jest.fn();
const mockUseMealDraftContext = jest.fn();
const mockMealDetailsFormProps = jest.fn();
const mockSelectLocalMealByCloudId = jest.fn(
  (_uid: string, _cloudId: string): Meal | null => null,
);
const mockSubscribeLocalMeals = jest.fn(
  (_uid: string, _listener: () => void) => jest.fn(),
);

jest.mock("@react-navigation/native", () => ({
  useRoute: () => mockUseRoute(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/hooks/useMeals", () => ({
  useMeals: (uid: string) => mockUseMeals(uid),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("@/services/meals/localMealsStore", () => ({
  selectLocalMealByCloudId: (uid: string, cloudId: string) =>
    mockSelectLocalMealByCloudId(uid, cloudId),
  subscribeLocalMeals: (uid: string, listener: () => void) =>
    mockSubscribeLocalMeals(uid, listener),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

jest.mock("@/feature/Meals/screens/MealAdd/MealDetailsFormScreen", () => ({
  MealDetailsFormScreen: (props: {
    onReviewSubmit?: (meal: Meal) => Promise<void> | void;
    onReviewPhotoPress?: () => void;
    showAddMealFlowHeader?: boolean;
    submitIntent?: string;
    flowHeaderExitGuardEnabled?: boolean;
    onFlowHeaderBack?: () => void;
    onFlowHeaderClose?: () => void;
    reviewSubmitLabel?: string;
    reviewFallbackLabel?: string;
    draftAdapter?: {
      meal: Meal | null;
      persistMeal: (meal: Meal) => Promise<void> | void;
    };
  }) => {
    const {
      onReviewSubmit,
      onReviewPhotoPress,
      draftAdapter,
    } = props;
    mockMealDetailsFormProps(props);
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(
      View,
      null,
      createElement(
        Pressable,
        {
          accessibilityRole: "button",
          onPress: () => {
            if (!draftAdapter) {
              throw new Error("History edit requires a local draft adapter");
            }
            const nextMeal = {
              ...(draftAdapter.meal as Meal),
              name: "Edited meal",
            };
            void draftAdapter.persistMeal(nextMeal);
            void onReviewSubmit?.({
              ...nextMeal,
              name: "Edited meal",
            });
          },
        },
        createElement(Text, null, "submit-review-edit"),
      ),
      createElement(
        Pressable,
        {
          accessibilityRole: "button",
          onPress: onReviewPhotoPress,
        },
        createElement(Text, null, "open-photo-edit"),
      ),
    );
  },
}));

const buildMeal = (overrides?: Partial<Meal>): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  cloudId: "cloud-1",
  timestamp: "2026-01-10T12:00:00.000Z",
  type: "lunch",
  name: "Chicken bowl",
  ingredients: [],
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-01-10T12:00:00.000Z",
  syncState: "synced",
  source: "manual",
  photoUrl: "file:///meal.jpg",
  ...overrides,
});

describe("EditHistoryMealDetailsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { cloudId: "cloud-1" } });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockSelectLocalMealByCloudId.mockReturnValue(buildMeal());
    mockSubscribeLocalMeals.mockReturnValue(jest.fn());
    mockUseMealDraftContext.mockReturnValue({
      setMeal: jest.fn(),
      saveDraft: jest.fn(async () => undefined),
      setLastScreen: jest.fn(async () => undefined),
      loadDraft: jest.fn(async () => undefined),
    });
  });

  it("uses the shared correction header and cancel footer intent for history edits", async () => {
    const navigation = {
      goBack: jest.fn<() => void>(),
      canGoBack: jest.fn<() => boolean>(() => true),
      navigate: jest.fn<(screen: string, params?: unknown) => void>(),
      replace: jest.fn<(screen: string, params?: unknown) => void>(),
    };
    const updateMeal = jest.fn<(meal: Meal) => Promise<void>>(
      async (_meal: Meal) => undefined,
    );

    mockUseMeals.mockReturnValue({ updateMeal });

    renderWithTheme(
      <EditHistoryMealDetailsScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(mockMealDetailsFormProps).toHaveBeenCalledWith(
        expect.objectContaining({
          showAddMealFlowHeader: true,
          submitIntent: "goBack",
          flowHeaderExitGuardEnabled: false,
          reviewSubmitLabel: "Save changes",
          reviewFallbackLabel: "Cancel",
        }),
      );
    });

    const props = mockMealDetailsFormProps.mock.calls.at(-1)?.[0] as
      | {
          onFlowHeaderBack?: () => void;
          onFlowHeaderClose?: () => void;
        }
      | undefined;
    props?.onFlowHeaderBack?.();
    props?.onFlowHeaderClose?.();

    expect(navigation.goBack).toHaveBeenCalledTimes(2);
    expect(updateMeal).not.toHaveBeenCalled();
  });

  it("loads the local history snapshot and updates the existing meal on submit", async () => {
    const navigation = {
      goBack: jest.fn<() => void>(),
      canGoBack: jest.fn<() => boolean>(() => true),
      navigate: jest.fn<(screen: string, params?: unknown) => void>(),
      replace: jest.fn<(screen: string, params?: unknown) => void>(),
    };
    const updateMeal = jest.fn<(meal: Meal) => Promise<void>>(
      async (_meal: Meal) => undefined,
    );

    mockUseMeals.mockReturnValue({ updateMeal });

    const screen = renderWithTheme(
      <EditHistoryMealDetailsScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(mockSelectLocalMealByCloudId).toHaveBeenCalledWith(
        "user-1",
        "cloud-1",
      );
    });

    fireEvent.press(screen.getByText("submit-review-edit"));

    await waitFor(() => {
      expect(updateMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          mealId: "meal-1",
          cloudId: "cloud-1",
          userUid: "user-1",
          name: "Edited meal",
          localPhotoUrl: undefined,
        }),
      );
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  it("opens the camera from the edit screen instead of details view", async () => {
    const navigation = {
      goBack: jest.fn<() => void>(),
      canGoBack: jest.fn<() => boolean>(() => true),
      navigate: jest.fn<(screen: string, params?: unknown) => void>(),
      replace: jest.fn<(screen: string, params?: unknown) => void>(),
    };

    mockUseMeals.mockReturnValue({ updateMeal: jest.fn(async () => undefined) });

    const screen = renderWithTheme(
      <EditHistoryMealDetailsScreen navigation={navigation as never} />,
    );

    fireEvent.press(screen.getByText("open-photo-edit"));

    expect(navigation.replace).toHaveBeenCalledWith("SavedMealsCamera", {
      id: "cloud-1",
      meal: expect.objectContaining({
        mealId: "meal-1",
        cloudId: "cloud-1",
      }),
      returnTo: "EditHistoryMealDetails",
    });
  });

  it("does not save the global draft and submits history edits through updateMeal", async () => {
    const navigation = {
      goBack: jest.fn<() => void>(),
      canGoBack: jest.fn<() => boolean>(() => true),
      navigate: jest.fn<(screen: string, params?: unknown) => void>(),
      replace: jest.fn<(screen: string, params?: unknown) => void>(),
    };
    const updateMeal = jest.fn<(meal: Meal) => Promise<void>>(
      async (_meal: Meal) => undefined,
    );
    const setMeal = jest.fn();
    const saveDraft = jest.fn(async () => undefined);
    const setLastScreen = jest.fn(async () => undefined);
    const loadDraft = jest.fn(async () => undefined);

    mockUseMeals.mockReturnValue({ updateMeal });
    mockUseMealDraftContext.mockReturnValue({
      setMeal,
      saveDraft,
      setLastScreen,
      loadDraft,
    });

    const screen = renderWithTheme(
      <EditHistoryMealDetailsScreen navigation={navigation as never} />,
    );

    fireEvent.press(screen.getByText("submit-review-edit"));

    await waitFor(() => {
      expect(updateMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          cloudId: "cloud-1",
          name: "Edited meal",
        }),
      );
    });
    expect(setMeal).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
    expect(setLastScreen).not.toHaveBeenCalled();
    expect(loadDraft).not.toHaveBeenCalled();
  });
});
