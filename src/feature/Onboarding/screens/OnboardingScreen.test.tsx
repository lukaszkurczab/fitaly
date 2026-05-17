import React from "react";
import { Text, View } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import OnboardingScreen from "@/feature/Onboarding/screens/OnboardingScreen";

const mockReact = React;
const mockText = Text;
const mockView = View;
const mockUseOnboardingFlow = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/theme/useTheme", () => ({
  useTheme: () => ({
    primary: "#111111",
    textSecondary: "#666666",
    spacing: { sm: 8, xl: 24 },
    typography: {
      size: { bodyS: 14 },
      lineHeight: { bodyS: 20 },
      fontFamily: { regular: "System" },
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
  Modal: () => null,
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

function buildOnboardingState() {
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
});
