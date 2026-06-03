import { useState } from "react";
import { Text } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import Step4AIAssistantPreferences from "@/feature/Onboarding/components/Step4AIAssistantPreferences";
import { INITIAL_FORM } from "@/feature/Onboarding/constants";
import type { OnboardingFormData } from "@/feature/Onboarding/types";
import type { AiPersona } from "@/types";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function Step4Harness({
  initialPersona = "calm_guide",
}: {
  initialPersona?: AiPersona;
}) {
  const [form, setForm] = useState<OnboardingFormData>({
    ...INITIAL_FORM,
    aiPersona: initialPersona,
  });

  return (
    <>
      <Text testID="selected-persona">{form.aiPersona}</Text>
      <Step4AIAssistantPreferences
        form={form}
        setForm={setForm}
        onContinue={jest.fn()}
        onBack={jest.fn()}
      />
    </>
  );
}

describe("Step4AIAssistantPreferences", () => {
  it("updates the canonical aiPersona value from tone cards", () => {
    const { getByTestId } = renderWithTheme(<Step4Harness />);

    expect(
      getByTestId("onboarding-ai-persona-calm_guide").props.accessibilityState,
    ).toMatchObject({ checked: true, selected: true });

    fireEvent.press(getByTestId("onboarding-ai-persona-focused_coach"));

    expect(getByTestId("selected-persona").props.children).toBe(
      "focused_coach",
    );
    expect(
      getByTestId("onboarding-ai-persona-focused_coach").props
        .accessibilityState,
    ).toMatchObject({ checked: true, selected: true });
  });

  it("keeps the final submit and back actions wired through existing testIDs", () => {
    const onContinue = jest.fn();
    const onBack = jest.fn();

    const { getByTestId } = renderWithTheme(
      <Step4AIAssistantPreferences
        form={INITIAL_FORM}
        setForm={jest.fn()}
        onContinue={onContinue}
        onBack={onBack}
      />,
    );

    fireEvent.press(getByTestId("onboarding-step-4-submit-button"));
    fireEvent.press(getByTestId("onboarding-step-4-back-button"));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
