import React from "react";
import { Text, View } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import OnboardingScreen from "@/feature/Onboarding/screens/OnboardingScreen";

const mockReact = React;
const mockText = Text;
const mockView = View;
const mockUseOnboardingFlow = jest.fn();
const mockModal = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const spacing = {
  xxs: 4,
  xs: 8,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  screenPadding: 20,
};

jest.mock("@/theme/useTheme", () => ({
  useTheme: () => ({
    isDark: false,
    background: "#F7F2EA",
    backgroundSecondary: "#EFE7DA",
    primary: "#111111",
    surfaceElevated: "#FFFFFF",
    borderSoft: "#E2D7C7",
    shadow: "#000000",
    text: "#222222",
    textSecondary: "#666666",
    spacing,
    rounded: { full: 9999, md: 16, lg: 20, xl: 24 },
    typography: {
      size: { bodyS: 14, caption: 12 },
      lineHeight: { bodyS: 20, caption: 16 },
      fontFamily: { regular: "System", medium: "System" },
    },
  }),
}));

jest.mock("@/components", () => ({
  Layout: ({ children }: { children: unknown }) => {
    return mockReact.createElement(
      mockView,
      null,
      children as React.ReactNode,
    );
  },
  Modal: (props: Record<string, unknown>) => {
    mockModal(props);
    return null;
  },
  AppIcon: ({ name }: { name: string }) => {
    return mockReact.createElement(mockText, null, name);
  },
}));

jest.mock("@/feature/Onboarding/components/ProgressDots", () => ({
  __esModule: true,
  default: () => {
    return mockReact.createElement(mockText, null, "progress");
  },
}));

jest.mock("@/feature/Onboarding/components/Step1BasicData", () => ({
  __esModule: true,
  default: () => {
    return mockReact.createElement(mockText, null, "step 1");
  },
}));

jest.mock("@/feature/Onboarding/components/Step2Preferences", () => ({
  __esModule: true,
  default: () => {
    return mockReact.createElement(mockText, null, "step 2");
  },
}));

jest.mock("@/feature/Onboarding/components/Step3Health", () => ({
  __esModule: true,
  default: () => {
    return mockReact.createElement(mockText, null, "step 3");
  },
}));

jest.mock("@/feature/Onboarding/components/Step4AIAssistantPreferences", () => ({
  __esModule: true,
  default: () => {
    return mockReact.createElement(mockText, null, "step 4");
  },
}));

jest.mock("@/feature/Onboarding/hooks/useOnboardingFlow", () => ({
  useOnboardingFlow: (...args: unknown[]) => mockUseOnboardingFlow(...args),
}));

function buildOnboardingState(overrides: Record<string, unknown> = {}) {
  return {
    errors: {},
    form: {},
    handleBack: jest.fn(),
    handleCloseRefill: jest.fn(),
    handleDiscardAndExit: jest.fn(),
    handleModalClose: jest.fn(),
    handlePrimaryAction: jest.fn(),
    handleSaveAndExit: jest.fn(),
    handleSkipConfirm: jest.fn(),
    handleSkipStep: jest.fn(),
    handleStep1SecondaryAction: jest.fn(),
    initialForm: {},
    isDirty: false,
    isLoaded: true,
    modalState: null,
    progressLabel: "Step 1 of 4",
    setErrors: jest.fn(),
    setForm: jest.fn(),
    step: 1,
    submitting: false,
    totalSteps: 4,
    ...overrides,
  };
}

function buildNavigation() {
  return {
    setOptions: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    reset: jest.fn(),
  };
}

describe("OnboardingScreen navigation ownership", () => {
  beforeEach(() => {
    mockModal.mockReset();
    mockUseOnboardingFlow.mockReset().mockReturnValue(buildOnboardingState());
  });

  it("does not imperatively replace to Home from the onboarding gate", async () => {
    const navigation = buildNavigation();

    render(
      <OnboardingScreen
        navigation={navigation as never}
        route={{ params: { mode: "first" } } as never}
      />,
    );

    await waitFor(() => {
      expect(navigation.setOptions).toHaveBeenCalledWith({
        gestureEnabled: false,
      });
    });

    expect(mockUseOnboardingFlow).toHaveBeenCalledWith({
      mode: "first",
      navigation,
    });
    expect(navigation.replace).not.toHaveBeenCalledWith("Home");
  });

  it("keeps skip confirmation return semantics on the Wróć action instead of a duplicate close button", () => {
    const handleModalClose = jest.fn();
    const handleSkipConfirm = jest.fn();
    const navigation = buildNavigation();

    mockUseOnboardingFlow.mockReturnValue(
      buildOnboardingState({
        handleModalClose,
        handleSkipConfirm,
        modalState: { type: "skip_step", step: 3 },
      }),
    );

    render(
      <OnboardingScreen
        navigation={navigation as never}
        route={{ params: { mode: "first" } } as never}
      />,
    );

    const modalProps = mockModal.mock.calls[
      mockModal.mock.calls.length - 1
    ]?.[0] as {
      closeOnBackdropPress?: boolean;
      onClose?: () => void;
      primaryAction?: { label: string; onPress?: () => void };
      secondaryAction?: { label: string; onPress?: () => void };
    };

    expect(modalProps.onClose).toBeUndefined();
    expect(modalProps.closeOnBackdropPress).toBe(false);
    expect(modalProps.primaryAction).toMatchObject({
      label: "skipStepModal.primaryCta",
      onPress: handleSkipConfirm,
    });
    expect(modalProps.secondaryAction).toMatchObject({
      label: "skipStepModal.secondaryCta",
      onPress: handleModalClose,
    });
  });

  it("exposes a refill-only close action without adding an exit path to first onboarding", () => {
    const handleCloseRefill = jest.fn();
    const navigation = buildNavigation();

    mockUseOnboardingFlow.mockReturnValue(
      buildOnboardingState({ handleCloseRefill }),
    );

    const { queryByTestId, rerender, getByTestId } = render(
      <OnboardingScreen
        navigation={navigation as never}
        route={{ params: { mode: "first" } } as never}
      />,
    );

    expect(queryByTestId("onboarding-refill-close-button")).toBeNull();

    rerender(
      <OnboardingScreen
        navigation={navigation as never}
        route={{ params: { mode: "refill" } } as never}
      />,
    );

    fireEvent.press(getByTestId("onboarding-refill-close-button"));

    expect(handleCloseRefill).toHaveBeenCalledTimes(1);
  });
});
