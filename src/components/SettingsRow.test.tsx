import { Text } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { SettingsRow } from "@/components/SettingsRow";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{name}</Text>;
  },
}));

describe("SettingsRow", () => {
  it("renders copy, value, leading slot, and default chevron for pressable rows", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = renderWithTheme(
      <SettingsRow
        title="Change email"
        subtitle="Current email address"
        value="name@example.com"
        leading={<Text testID="leading">avatar</Text>}
        onPress={onPress}
        testID="settings-row"
      />,
    );

    expect(getByText("Change email")).toBeTruthy();
    expect(getByText("Current email address").props.numberOfLines).toBe(2);
    expect(getByText("name@example.com")).toBeTruthy();
    expect(getByTestId("leading")).toBeTruthy();
    expect(getByText("chevron")).toBeTruthy();

    fireEvent.press(getByTestId("settings-row"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("supports non-pressable rows without a chevron", () => {
    const { queryByText } = renderWithTheme(
      <SettingsRow title="Membership" value="Premium" />,
    );

    expect(queryByText("chevron")).toBeNull();
  });

  it("allows informational rows to opt into a taller subtitle", () => {
    const { getByText } = renderWithTheme(
      <SettingsRow
        title="Data clarity"
        subtitle="Full legal and privacy helper copy should stay readable when the screen needs it."
        subtitleNumberOfLines={3}
      />,
    );

    expect(
      getByText(
        "Full legal and privacy helper copy should stay readable when the screen needs it.",
      ).props.numberOfLines,
    ).toBe(3);
  });

  it("allows a long title to wrap without requiring a subtitle", () => {
    const { getByText } = renderWithTheme(
      <SettingsRow title="Update nutrition survey" titleNumberOfLines={2} />,
    );

    expect(getByText("Update nutrition survey").props.numberOfLines).toBe(2);
  });

  it("allows screens to tune row hierarchy without changing shared defaults", () => {
    const { getByText } = renderWithTheme(
      <SettingsRow
        title="Legal and privacy"
        subtitle="Short supporting copy"
        titleStyle={{ fontSize: 15 }}
        subtitleStyle={{ fontSize: 12 }}
        chevronSize={20}
        onPress={jest.fn()}
      />,
    );

    expect(getByText("Legal and privacy").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 15 })]),
    );
    expect(getByText("Short supporting copy").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 12 })]),
    );
  });
});
