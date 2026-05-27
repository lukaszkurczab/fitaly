import type { ReactNode } from "react";
import { Linking } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import MealCameraScreen from "@/feature/Meals/screens/MealAdd/MealCameraScreen";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

type PhotoPreviewProps = {
  photoUri: string;
  onRetake: () => void;
  onAccept: () => void;
  primaryText: string;
  secondaryText: string;
};

type ScreenCornerNavButtonProps = {
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
};

type ModalProps = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  primaryAction: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
};

type CameraViewProps = {
  onCameraReady?: () => void;
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

const mockUseMealCameraState = jest.fn();
const mockDevice = { isDevice: true };

jest.mock("@/feature/Meals/hooks/useMealCameraState", () => ({
  useMealCameraState: (params: unknown) => mockUseMealCameraState(params),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 4, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-device", () => mockDevice);

jest.mock("expo-camera", () => ({
  CameraView: ({ onCameraReady }: CameraViewProps) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(
      View,
      null,
      createElement(Text, null, "camera-view"),
      createElement(
        Pressable,
        { onPress: onCameraReady, accessibilityRole: "button" },
        createElement(Text, null, "camera-ready"),
      ),
    );
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: (ns: string) => ({
    t: (
      key: string,
      options?: { defaultValue?: string; count?: number } | string,
    ) => {
      if (typeof options === "string") {
        return options;
      }

      if (options?.defaultValue) {
        return options.count !== undefined
          ? options.defaultValue.replace("{{count}}", String(options.count))
          : options.defaultValue;
      }

      return `${ns}:${key}`;
    },
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
    Button: ({ label, onPress, disabled }: ButtonProps) =>
      createElement(
        Pressable,
        { onPress, disabled, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
    TextButton: ({ label, onPress, disabled, testID }: ButtonProps) =>
      createElement(
        Pressable,
        { onPress, disabled, testID, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
    PhotoPreview: ({
      photoUri,
      onRetake,
      onAccept,
      primaryText,
      secondaryText,
    }: PhotoPreviewProps) =>
      createElement(
        View,
        null,
        createElement(Text, null, photoUri),
        createElement(
          Pressable,
          { onPress: onRetake, accessibilityRole: "button" },
          createElement(Text, null, secondaryText),
        ),
        createElement(
          Pressable,
          { onPress: onAccept, accessibilityRole: "button" },
          createElement(Text, null, primaryText),
        ),
      ),
    ScreenCornerNavButton: ({
      icon,
      onPress,
      accessibilityLabel,
    }: ScreenCornerNavButtonProps) =>
      createElement(
        Pressable,
        { onPress, accessibilityRole: "button" },
        createElement(Text, null, `${icon}:${accessibilityLabel}`),
      ),
  };
});

jest.mock("@/components/Modal", () => ({
  Modal: ({
    visible,
    title,
    message,
    onClose,
    primaryAction,
    secondaryAction,
  }: ModalProps) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return visible
      ? createElement(
          View,
          null,
          createElement(Text, null, title),
          createElement(Text, null, message),
          createElement(
            Pressable,
            { onPress: primaryAction.onPress, accessibilityRole: "button" },
            createElement(Text, null, primaryAction.label),
          ),
          secondaryAction
            ? createElement(
                Pressable,
                { onPress: secondaryAction.onPress, accessibilityRole: "button" },
                createElement(Text, null, secondaryAction.label),
              )
            : null,
          createElement(
            Pressable,
            { onPress: onClose, accessibilityRole: "button" },
            createElement(Text, null, "close-modal"),
          ),
        )
      : null;
  },
}));

const buildHookState = (
  overrides?: Partial<ReturnType<typeof baseHookState>>,
) => ({
  ...baseHookState(),
  ...overrides,
});

function baseHookState() {
  return {
    permission: { granted: true, canAskAgain: true },
    requestPermission: jest.fn(),
    cameraRef: { current: null },
    isCameraReady: true,
    isTakingPhoto: false,
    photoUri: null as string | null,
    premiumModal: false,
    canUsePhotoAi: true,
    credits: {
      userId: "user-1",
      tier: "free" as const,
      balance: 9,
      allocation: 100,
      periodStartAt: "2026-03-01T00:00:00.000Z",
      periodEndAt: "2026-04-01T00:00:00.000Z",
      costs: { chat: 1, textMeal: 1, photo: 5 },
    },
    skipDetection: false,
    setIsCameraReady: jest.fn(),
    handleTakePicture: jest.fn(async () => undefined),
    handleAccept: jest.fn(async () => undefined),
    handleRetake: jest.fn(),
    closePremiumModal: jest.fn(),
    goManagePremium: jest.fn(),
  };
}

const buildProps = (
  params: Partial<MealAddScreenProps<"CameraDefault">["params"]> = {},
) =>
  ({
    navigation: {
      navigate: jest.fn(),
      goBack: jest.fn(),
      replace: jest.fn(),
    } as unknown as MealAddScreenProps<"CameraDefault">["navigation"],
    flow: {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => true),
    } as unknown as MealAddScreenProps<"CameraDefault">["flow"],
    params,
  }) as MealAddScreenProps<"CameraDefault">;

describe("MealCameraScreen", () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    mockUseMealCameraState.mockReset();
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockDevice.isDevice = true;
    jest
      .spyOn(Linking, "openSettings")
      .mockImplementation(async () => Promise.resolve());
  });

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it("renders an empty layout while camera permission is loading", () => {
    mockUseMealCameraState.mockReturnValue(
      buildHookState({ permission: null as never }),
    );

    const { queryByText } = renderWithTheme(<MealCameraScreen {...buildProps()} />);

    expect(queryByText("camera-view")).toBeNull();
    expect(queryByText("common:continue")).toBeNull();
  });

  it("requests permission when access can still be asked for", () => {
    const hookState = buildHookState({
      permission: { granted: false, canAskAgain: true },
    });
    mockUseMealCameraState.mockReturnValue(hookState);

    const { getByText } = renderWithTheme(<MealCameraScreen {...buildProps()} />);

    fireEvent.press(getByText("common:continue"));
    expect(hookState.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("opens system settings when camera permission is blocked", () => {
    mockUseMealCameraState.mockReturnValue(
      buildHookState({
        permission: { granted: false, canAskAgain: false },
      }),
    );

    const { getByText } = renderWithTheme(<MealCameraScreen {...buildProps()} />);

    fireEvent.press(getByText("common:continue"));
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it("renders photo preview actions when a photo was captured", () => {
    const hookState = buildHookState({
      photoUri: "file:///meal.jpg",
    });
    mockUseMealCameraState.mockReturnValue(hookState);

    const { getByText } = renderWithTheme(<MealCameraScreen {...buildProps()} />);

    fireEvent.press(getByText("common:camera_retake"));
    fireEvent.press(getByText("common:camera_use_photo"));

    expect(hookState.handleRetake).toHaveBeenCalledTimes(1);
    expect(hookState.handleAccept).toHaveBeenCalledTimes(1);
  });

  it("renders the active photo camera UI and forwards actions", () => {
    mockDevice.isDevice = true;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const props = buildProps();
    const hookState = buildHookState({
      premiumModal: true,
    });
    mockUseMealCameraState.mockReturnValue(hookState);

    const { getByText } = renderWithTheme(<MealCameraScreen {...props} />);

    fireEvent.press(getByText("back:Back"));
    fireEvent.press(getByText("Take photo"));
    fireEvent.press(getByText("Change add method"));
    fireEvent.press(getByText("chat:limit.upgradeCta"));

    expect(getByText("✦ chat:credits.costMultiple")).toBeTruthy();
    expect(getByText("Photo")).toBeTruthy();
    expect(getByText("Take a clear photo")).toBeTruthy();
    expect(
      getByText("Center the full meal in the frame. One photo is enough to start."),
    ).toBeTruthy();
    expect(getByText("✦ 4 credits remaining")).toBeTruthy();
    expect(props.flow.goBack).toHaveBeenCalledTimes(1);
    expect(hookState.handleTakePicture).toHaveBeenCalledTimes(1);
    expect(hookState.goManagePremium).toHaveBeenCalledTimes(1);
    expect(props.navigation.navigate).toHaveBeenCalledWith("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  });

  it("starts in fullscreen camera mode when the photo method requests it", () => {
    mockDevice.isDevice = true;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const props = buildProps({ fullscreenPreferred: true });
    const hookState = buildHookState();
    mockUseMealCameraState.mockReturnValue(hookState);

    const { getByTestId, getByText, queryByText } = renderWithTheme(
      <MealCameraScreen {...props} />,
    );

    expect(queryByText("Take a clear photo")).toBeNull();

    fireEvent.press(getByTestId("add-meal-photo-fullscreen-capture-button"));
    expect(hookState.handleTakePicture).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("add-meal-photo-fullscreen-change-method-button"));
    expect(props.navigation.navigate).toHaveBeenCalledWith("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });

    fireEvent.press(getByTestId("add-meal-photo-show-controls-button"));
    expect(getByText("Take a clear photo")).toBeTruthy();
  });

  it("keeps the no-credits photo state in the options sheet even when fullscreen is requested", () => {
    mockDevice.isDevice = true;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockUseMealCameraState.mockReturnValue(
      buildHookState({
        canUsePhotoAi: false,
        credits: {
          userId: "user-1",
          tier: "free",
          balance: 0,
          allocation: 100,
          periodStartAt: "2026-03-01T00:00:00.000Z",
          periodEndAt: "2026-04-01T00:00:00.000Z",
          costs: { chat: 1, textMeal: 1, photo: 5 },
        },
      }),
    );

    const { getByText, queryByTestId } = renderWithTheme(
      <MealCameraScreen {...buildProps({ fullscreenPreferred: true })} />,
    );

    expect(getByText("No credits left for photo")).toBeTruthy();
    expect(queryByTestId("add-meal-photo-fullscreen-capture-button")).toBeNull();
  });

  it("does not render simulator preview controls on simulator", () => {
    mockDevice.isDevice = false;
    mockUseMealCameraState.mockReturnValue(buildHookState());

    const { queryByText, queryByTestId } = renderWithTheme(
      <MealCameraScreen {...buildProps()} />,
    );

    expect(queryByText("Preview credits: Credits OK")).toBeNull();
    expect(queryByText("Preview review: S03 · Preparing")).toBeNull();
    expect(queryByTestId("simulator-preview-review")).toBeNull();
  });

  it("uses real credits on simulator when the credits snapshot is available", () => {
    mockDevice.isDevice = false;
    mockUseMealCameraState.mockReturnValue(
      buildHookState({
        credits: {
          userId: "user-1",
          tier: "free",
          balance: 9,
          allocation: 100,
          periodStartAt: "2026-03-01T00:00:00.000Z",
          periodEndAt: "2026-04-01T00:00:00.000Z",
          costs: { chat: 1, textMeal: 1, photo: 5 },
        },
      }),
    );

    const { getByText, queryByText } = renderWithTheme(
      <MealCameraScreen {...buildProps()} />,
    );

    expect(getByText("✦ 4 credits remaining")).toBeTruthy();
    expect(queryByText("✦ 74 credits remaining")).toBeNull();
  });

  it("renders the low credits note when the remaining balance is low", () => {
    mockDevice.isDevice = true;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockUseMealCameraState.mockReturnValue(
      buildHookState({
        credits: {
          userId: "user-1",
          tier: "free",
          balance: 7,
          allocation: 100,
          periodStartAt: "2026-03-01T00:00:00.000Z",
          periodEndAt: "2026-04-01T00:00:00.000Z",
          costs: { chat: 1, textMeal: 1, photo: 5 },
        },
      }),
    );

    const { getByText } = renderWithTheme(<MealCameraScreen {...buildProps()} />);
    expect(getByText("Only 2 credits left after this photo")).toBeTruthy();
  });

  it("renders the no-credits state without the take photo CTA", () => {
    mockDevice.isDevice = true;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockUseMealCameraState.mockReturnValue(
      buildHookState({
        canUsePhotoAi: false,
        credits: {
          userId: "user-1",
          tier: "free",
          balance: 0,
          allocation: 100,
          periodStartAt: "2026-03-01T00:00:00.000Z",
          periodEndAt: "2026-04-01T00:00:00.000Z",
          costs: { chat: 1, textMeal: 1, photo: 5 },
        },
      }),
    );

    const { getByText, queryByText } = renderWithTheme(
      <MealCameraScreen {...buildProps()} />,
    );

    expect(getByText("No credits left for photo")).toBeTruthy();
    expect(queryByText("Take photo")).toBeNull();
  });

  it("renders the top-left close button on the entry camera screen", () => {
    const props = buildProps();
    props.flow.canGoBack = jest.fn(() => false) as never;
    mockUseMealCameraState.mockReturnValue(buildHookState());

    const { getByText, queryByText } = renderWithTheme(
      <MealCameraScreen {...props} />,
    );

    fireEvent.press(getByText("close:Close"));

    expect(queryByText("close:Close")).toBeTruthy();
    expect(queryByText("back:Back")).toBeNull();
    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("forwards the camera ready callback to the hook state", () => {
    const hookState = buildHookState();
    mockUseMealCameraState.mockReturnValue(hookState);

    const { getByText } = renderWithTheme(<MealCameraScreen {...buildProps()} />);

    fireEvent.press(getByText("camera-ready"));

    expect(hookState.setIsCameraReady).toHaveBeenCalledWith(true);
  });
});
