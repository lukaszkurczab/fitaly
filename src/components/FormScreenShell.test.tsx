import { Text } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { FormScreenShell } from "@/components/FormScreenShell";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{name}</Text>;
  },
}));

jest.mock("@/components/Layout", () => ({
  __esModule: true,
  Layout: ({ children }: { children: unknown }) => children,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("FormScreenShell", () => {
  it("renders header, intro copy, children, and sticky actions", () => {
    const onBack = jest.fn();
    const onSave = jest.fn();
    const { getByTestId, getByText } = renderWithTheme(
      <FormScreenShell
        title="Change email"
        onBack={onBack}
        intro="Update the address linked to your account."
        actionLabel="Save"
        onActionPress={onSave}
        actionTestID="form-save-button"
      >
        <Text>Email field</Text>
      </FormScreenShell>,
    );

    expect(getByText("Change email")).toBeTruthy();
    expect(getByText("Update the address linked to your account.")).toBeTruthy();
    expect(getByText("Email field")).toBeTruthy();

    fireEvent.press(getByText("arrow"));
    fireEvent.press(getByTestId("form-save-button"));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("honors row order for primary and secondary actions", () => {
    const { getAllByRole } = renderWithTheme(
      <FormScreenShell
        title="Edit profile"
        onBack={jest.fn()}
        actionLabel="Save"
        actionTestID="primary-action"
        secondaryActionLabel="Cancel"
        secondaryActionTestID="secondary-action"
        actionsLayout="row"
        actionsRowOrder="secondary-primary"
      >
        <Text>Profile form</Text>
      </FormScreenShell>,
    );

    const actionButtonOrder = getAllByRole("button")
      .map((button) => button.props.testID)
      .filter((testID) =>
        testID === "primary-action" || testID === "secondary-action",
      );

    expect(actionButtonOrder).toEqual(["secondary-action", "primary-action"]);
  });
});
