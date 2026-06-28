import type { ReactNode } from "react";
import { fireEvent } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import MealAddMethodScreen from "@/feature/Meals/screens/MealAddMethodScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockUseNavigation = jest.fn();
const mockUseRoute = jest.fn();
const mockUseMealAddMethodState = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockUseNavigation(),
  useRoute: () => mockUseRoute(),
}));

jest.mock("@/feature/Meals/hooks/useMealAddMethodState", () => ({
  useMealAddMethodState: (params: unknown) => mockUseMealAddMethodState(params),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? `meals:${key}`,
  }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: ({
    name,
    rotation,
    testID,
  }: {
    name: string;
    rotation?: string;
    testID?: string;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(View, {
      accessibilityLabel: `${name}:${rotation ?? "none"}`,
      testID,
    });
  },
}));

jest.mock("@/feature/Meals/components/ResumeDraftSheet", () => ({
  ResumeDraftSheet: ({
    onResume,
    onDiscard,
    onClose,
  }: {
    onResume: () => void;
    onDiscard: () => void;
    onClose: () => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(
      View,
      null,
      createElement(Text, null, "resume-draft-sheet"),
      createElement(
        Pressable,
        { onPress: onResume },
        createElement(Text, null, "resume-draft"),
      ),
      createElement(
        Pressable,
        { onPress: onDiscard },
        createElement(Text, null, "discard-draft"),
      ),
      createElement(
        Pressable,
        { onPress: onClose },
        createElement(Text, null, "close-resume-draft"),
      ),
    );
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/components", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: ReactNode }) =>
      createElement(View, null, children),
  };
});

describe("MealAddMethodScreen", () => {
  beforeEach(() => {
    mockUseNavigation.mockReturnValue({
      replace: jest.fn(),
      navigate: jest.fn(),
      dispatch: jest.fn(),
      goBack: jest.fn(),
    });
    mockUseRoute.mockReturnValue({ params: undefined });
  });

  it("renders method rows and forwards the selected option", () => {
    const options = [
      {
        key: "photo",
        icon: "camera",
        titleKey: "photoTitle",
        descKey: "photoDesc",
      },
      {
        key: "barcode",
        icon: "scan-barcode",
        titleKey: "barcodeTitle",
        descKey: "barcodeDesc",
      },
    ] as const;
    const handleOptionPress =
      jest.fn<(option: (typeof options)[number]) => Promise<void>>();
    handleOptionPress.mockResolvedValue(undefined);
    mockUseMealAddMethodState.mockReturnValue({
      options,
      handleOptionPress,
      showResumeModal: false,
    });

    const { getByTestId, getByText } = renderWithTheme(<MealAddMethodScreen />);

    expect(getByText("meals:photoTitle")).toBeTruthy();
    expect(getByText("meals:barcodeTitle")).toBeTruthy();
    expect(
      getByTestId("meal-add-option-photo-chevron").props.accessibilityLabel,
    ).toBe("chevron:180deg");

    fireEvent.press(getByTestId("meal-add-option-photo"));
    fireEvent.press(getByTestId("meal-add-option-barcode"));

    expect(handleOptionPress.mock.calls[0][0]).toEqual(options[0]);
    expect(handleOptionPress.mock.calls[1][0]).toEqual(options[1]);
    expect(mockUseMealAddMethodState).toHaveBeenCalledWith({
      navigation: expect.anything(),
      replaceOnStart: true,
      persistSelection: false,
      resetStackOnStart: false,
      loadKnownPatternCandidate: true,
    });
  });

  it("persists the selected method only for Home-driven chooser usage", () => {
    mockUseRoute.mockReturnValue({
      params: { selectionMode: "persistDefault" },
    });
    mockUseMealAddMethodState.mockReturnValue({
      options: [],
      handleOptionPress: jest.fn(),
      showResumeModal: false,
    });

    renderWithTheme(<MealAddMethodScreen />);

    expect(mockUseMealAddMethodState).toHaveBeenCalledWith({
      navigation: expect.anything(),
      replaceOnStart: true,
      persistSelection: true,
      resetStackOnStart: false,
      loadKnownPatternCandidate: true,
    });
  });

  it("enables stack reset when opened from inside the meal add flow", () => {
    mockUseRoute.mockReturnValue({
      params: { selectionMode: "temporary", origin: "mealAddFlow" },
    });
    mockUseMealAddMethodState.mockReturnValue({
      options: [],
      handleOptionPress: jest.fn(),
      showResumeModal: false,
    });

    renderWithTheme(<MealAddMethodScreen />);

    expect(mockUseMealAddMethodState).toHaveBeenCalledWith({
      navigation: expect.anything(),
      replaceOnStart: true,
      persistSelection: false,
      resetStackOnStart: true,
      loadKnownPatternCandidate: true,
    });
  });

  it("wires resume draft sheet actions", () => {
    const handleContinueDraft = jest.fn(async () => undefined);
    const handleDiscardDraft = jest.fn(async () => undefined);
    const closeResumeModal = jest.fn();

    mockUseMealAddMethodState.mockReturnValue({
      options: [],
      handleOptionPress: jest.fn(),
      showResumeModal: true,
      resumeDraftMeal: { mealId: "draft-1" },
      handleContinueDraft,
      handleDiscardDraft,
      closeResumeModal,
    });

    const { getByText } = renderWithTheme(<MealAddMethodScreen />);

    expect(getByText("resume-draft-sheet")).toBeTruthy();

    fireEvent.press(getByText("resume-draft"));
    fireEvent.press(getByText("discard-draft"));
    fireEvent.press(getByText("close-resume-draft"));

    expect(handleContinueDraft).toHaveBeenCalledTimes(1);
    expect(handleDiscardDraft).toHaveBeenCalledTimes(1);
    expect(closeResumeModal).toHaveBeenCalledTimes(1);
  });

  it("renders known-pattern suggestion actions when a candidate is available", () => {
    const handleKnownPatternReview = jest.fn(async () => undefined);
    const handleKnownPatternDismiss = jest.fn(async () => undefined);

    mockUseMealAddMethodState.mockReturnValue({
      options: [],
      handleOptionPress: jest.fn(),
      showResumeModal: false,
      knownPatternCandidate: {
        candidateId: "a1b2c3d4e5f6a1b2",
        subjectKeyHash: "b2c3d4e5f6a1b2c3",
      },
      knownPatternBusy: false,
      handleKnownPatternReview,
      handleKnownPatternDismiss,
    });

    const { getByTestId, getByText } = renderWithTheme(<MealAddMethodScreen />);

    expect(getByTestId("meal-add-known-pattern-card")).toBeTruthy();
    expect(getByText("meals:knownPatternTitle")).toBeTruthy();

    fireEvent.press(getByTestId("meal-add-known-pattern-review-button"));
    fireEvent.press(getByTestId("meal-add-known-pattern-dismiss-button"));

    expect(handleKnownPatternReview).toHaveBeenCalledTimes(1);
    expect(handleKnownPatternDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses the sheet when tapping the overlay", () => {
    const navigation = {
      replace: jest.fn(),
      navigate: jest.fn(),
      dispatch: jest.fn(),
      goBack: jest.fn(),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseMealAddMethodState.mockReturnValue({
      options: [],
      handleOptionPress: jest.fn(),
      showResumeModal: false,
    });

    const { getAllByRole } = renderWithTheme(<MealAddMethodScreen />);

    fireEvent.press(getAllByRole("button")[0]);

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("exposes a visible close affordance inside the sheet", () => {
    const navigation = {
      replace: jest.fn(),
      navigate: jest.fn(),
      dispatch: jest.fn(),
      goBack: jest.fn(),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseMealAddMethodState.mockReturnValue({
      options: [],
      handleOptionPress: jest.fn(),
      showResumeModal: false,
    });

    const { getByTestId } = renderWithTheme(<MealAddMethodScreen />);

    fireEvent.press(getByTestId("meal-add-method-close-button"));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
