import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { Text } from "react-native";
import { Modal } from "@/components/Modal";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Modal", () => {
  it("renders title/message and handles action presses", () => {
    const onPrimaryPress = jest.fn();
    const onSecondaryPress = jest.fn();
    const { getByText } = renderWithTheme(
      <Modal
        visible
        title="Sync error"
        message="Try again"
        primaryAction={{ label: "Retry", onPress: onPrimaryPress }}
        secondaryAction={{ label: "Cancel", onPress: onSecondaryPress }}
      />,
    );

    expect(getByText("Sync error")).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();

    fireEvent.press(getByText("Retry"));
    fireEvent.press(getByText("Cancel"));

    expect(onPrimaryPress).toHaveBeenCalledTimes(1);
    expect(onSecondaryPress).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from close button", () => {
    const onClose = jest.fn();
    const { getByLabelText, getByTestId } = renderWithTheme(
      <Modal
        visible
        title="Closable"
        onClose={onClose}
        closeButtonTestID="modal-close-button"
        closeButtonSize={44}
        closeButtonContainerStyle={{ top: 20, right: 20 }}
        closeButtonBackgroundColor="#FFFDF8"
        closeButtonIconColor="#575B52"
      />,
    );

    expect(getByTestId("modal-close-button")).toBeTruthy();
    fireEvent.press(getByLabelText("close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies optional presentation styles without changing modal defaults", () => {
    const { getByTestId, getByText } = renderWithTheme(
      <Modal
        visible
        testID="styled-modal"
        title="Styled modal"
        message="Presentation override"
        containerStyle={{ borderRadius: 28, backgroundColor: "#FFFDF8" }}
        footerStyle={{ marginTop: 12 }}
        footer={<MockFooter />}
      />,
    );

    expect(getByText("Styled modal")).toBeTruthy();
    expect(getByText("Presentation override")).toBeTruthy();
    expect(getByText("Footer")).toBeTruthy();
    expect(getByTestId("styled-modal").props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          borderRadius: 28,
          backgroundColor: "#FFFDF8",
        }),
      ]),
    );
  });

  it("supports object-based actions", () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const { getByText } = renderWithTheme(
      <Modal
        visible
        title="Delete meal"
        primaryAction={{
          label: "Delete",
          onPress: onPrimary,
          tone: "destructive",
        }}
        secondaryAction={{ label: "Keep", onPress: onSecondary, tone: "ghost" }}
      />,
    );

    fireEvent.press(getByText("Delete"));
    fireEvent.press(getByText("Keep"));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});

function MockFooter() {
  return <Text>Footer</Text>;
}
