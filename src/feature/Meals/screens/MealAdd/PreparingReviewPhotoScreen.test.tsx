import type { ReactNode } from "react";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import PreparingReviewPhotoScreen from "@/feature/Meals/screens/MealAdd/PreparingReviewPhotoScreen";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal } from "@/types";
import type { VisionAnalyzeResult } from "@/services/ai/visionService";

type DetectIngredientsWithVision = (
  userUid: string,
  imageUri: string,
  opts?: { lang?: string },
) => Promise<VisionAnalyzeResult | null>;

const mockDetectIngredientsWithVision = jest.fn<DetectIngredientsWithVision>();
const mockGetAiUxErrorType = jest.fn();
const mockGetErrorStatus = jest.fn();
const mockGetMealAiMetaFromAiResponse = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUseUserContext = jest.fn();
const mockUseAiCreditsContext = jest.fn();
const mockUseMealDraftContext = jest.fn();
const mockDevice = { isDevice: true };

jest.mock("expo-device", () => mockDevice);

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@/services/ai/visionService", () => ({
  detectIngredientsWithVision: (...args: Parameters<DetectIngredientsWithVision>) =>
    mockDetectIngredientsWithVision(...args),
}));

jest.mock("@/services/ai/uxError", () => ({
  getAiUxErrorType: (error: unknown) => mockGetAiUxErrorType(error),
}));

jest.mock("@/services/contracts/serviceError", () => ({
  getErrorStatus: (error: unknown) => mockGetErrorStatus(error),
}));

jest.mock("@/services/meals/mealMetadata", () => ({
  getMealAiMetaFromAiResponse: (value: unknown) =>
    mockGetMealAiMetaFromAiResponse(value),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserContext(),
}));

jest.mock("@/context/AiCreditsContext", () => ({
  useAiCreditsContext: () => mockUseAiCreditsContext(),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; ns?: string }) =>
      options?.defaultValue ?? `${options?.ns ?? "meals"}:${key}`,
  }),
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
      testID,
      disabled,
    }: {
      label: string;
      onPress?: () => void;
      testID?: string;
      disabled?: boolean;
    }) =>
      createElement(
        Pressable,
        { onPress, disabled, testID, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
    TextButton: ({
      label,
      onPress,
      testID,
      disabled,
    }: {
      label: string;
      onPress?: () => void;
      testID?: string;
      disabled?: boolean;
    }) =>
      createElement(
        Pressable,
        { onPress, disabled, testID, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
  };
});

const buildDraftContext = (meal?: Partial<Meal>) => ({
  meal: meal
    ? ({
        mealId: "meal-1",
        userUid: "user-1",
        name: null,
        photoUrl: "file:///meal.jpg",
        ingredients: [],
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
        syncState: "pending",
        tags: [],
        deleted: false,
        notes: null,
        type: "other",
        timestamp: "",
        source: null,
        inputMethod: "photo",
        aiMeta: null,
        ...meal,
      } satisfies Meal)
    : null,
  saveDraft: jest.fn(async () => undefined),
  setMeal: jest.fn(),
  updateMeal: jest.fn(),
});

const buildProps = () =>
  ({
    navigation: {
      navigate: jest.fn(),
    } as unknown as MealAddScreenProps<"PreparingReviewPhoto">["navigation"],
    flow: {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => true),
    } as unknown as MealAddScreenProps<"PreparingReviewPhoto">["flow"],
    params: {
      image: "file:///meal.jpg",
      id: "meal-1",
      attempt: 2,
    },
  }) as MealAddScreenProps<"PreparingReviewPhoto">;

const successCredits = {
  userId: "user-1",
  tier: "free" as const,
  balance: 5,
  allocation: 100,
  periodStartAt: "2026-03-01T00:00:00.000Z",
  periodEndAt: "2026-04-01T00:00:00.000Z",
  costs: { chat: 1, textMeal: 1, photo: 5 },
  version: "v1",
  persistence: "backend_owned" as const,
};

describe("PreparingReviewPhotoScreen", () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockDevice.isDevice = true;

    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUseUserContext.mockReturnValue({ language: "en" });
    mockUseAiCreditsContext.mockReturnValue({
      applyCreditsFromResponse: jest.fn(),
      refreshCredits: jest.fn(async () => null),
    });
    mockGetAiUxErrorType.mockReturnValue("not_recognized");
    mockGetErrorStatus.mockReturnValue(500);
    mockGetMealAiMetaFromAiResponse.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it("replaces the flow with review when analysis succeeds", async () => {
    const props = buildProps();
    const draftContext = buildDraftContext();

    mockUseMealDraftContext.mockReturnValue(draftContext);
    mockDetectIngredientsWithVision.mockResolvedValue({
      ingredients: [
        {
          id: "ingredient-1",
          name: "Chicken",
          amount: 180,
          unit: "g",
          protein: 35,
          fat: 8,
          carbs: 0,
          kcal: 250,
        },
      ],
      credits: {
        ...successCredits,
        ingredients: [],
      },
    });

    renderWithTheme(<PreparingReviewPhotoScreen {...props} />);

    await waitFor(() => {
      expect(props.flow.replace).toHaveBeenCalledWith("ReviewMeal", {});
    });
  });

  it("shows the slower state while the analysis is still in flight", async () => {
    const props = buildProps();
    const draftContext = buildDraftContext();

    mockUseMealDraftContext.mockReturnValue(draftContext);
    mockDetectIngredientsWithVision.mockImplementation(
      () =>
        new Promise(() => {
          // Keep the promise pending.
        }),
    );

    const { getByText } = renderWithTheme(
      <PreparingReviewPhotoScreen {...props} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    await waitFor(() => {
      expect(getByText("This is taking a bit longer")).toBeTruthy();
    });

    fireEvent.press(getByText("Use manual entry"));
    expect(props.flow.replace).toHaveBeenCalledWith("EditMealDetails", {
      submitIntent: "replaceReview",
    });
  });

  it("shows the offline recovery state and lets the user save the draft", async () => {
    const props = buildProps();
    const draftContext = buildDraftContext();
    const error = new Error("offline");

    mockUseMealDraftContext.mockReturnValue(draftContext);
    mockDetectIngredientsWithVision.mockRejectedValue(error);
    mockGetAiUxErrorType.mockReturnValue("offline");

    const { getByText } = renderWithTheme(
      <PreparingReviewPhotoScreen {...props} />,
    );

    await waitFor(() => {
      expect(getByText("Your meal is safe")).toBeTruthy();
    });

    fireEvent.press(getByText("Save draft"));
    expect(props.navigation.navigate).toHaveBeenCalledWith("Home");
  });

  it("shows the failure recovery state and lets the user retake the photo", async () => {
    const props = buildProps();
    const draftContext = buildDraftContext();
    const error = new Error("bad-photo");

    mockUseMealDraftContext.mockReturnValue(draftContext);
    mockDetectIngredientsWithVision.mockRejectedValue(error);
    mockGetAiUxErrorType.mockReturnValue("not_recognized");

    const { getByText } = renderWithTheme(
      <PreparingReviewPhotoScreen {...props} />,
    );

    await waitFor(() => {
      expect(getByText("We couldn't prepare review")).toBeTruthy();
    });

    fireEvent.press(getByText("Try again"));
    expect(props.flow.replace).toHaveBeenCalledWith("CameraDefault", {
      id: "meal-1",
      attempt: 3,
    });
  });

  it("renders simulator preview states without calling vision analysis", async () => {
    mockDevice.isDevice = false;
    const props = buildProps();
    props.params.simulatorReviewState = "failed";
    props.params.simulatorCreditsState = "low";
    const draftContext = buildDraftContext();

    mockUseMealDraftContext.mockReturnValue(draftContext);

    const { getByText } = renderWithTheme(
      <PreparingReviewPhotoScreen {...props} />,
    );

    act(() => {
      jest.advanceTimersByTime(900);
    });

    await waitFor(() => {
      expect(getByText("We couldn't prepare review")).toBeTruthy();
    });

    expect(mockDetectIngredientsWithVision).not.toHaveBeenCalled();
  });
});
