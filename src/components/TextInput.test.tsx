import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { Text, StyleSheet } from "react-native";
import { TextInput as AppTextInput } from "@/components/TextInput";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import { themes } from "@/theme/themes";

const MockAdornment = ({ size, color }: { size?: number; color?: string }) => (
  <Text>{`${size ?? "none"}-${color ?? "none"}`}</Text>
);

describe("TextInput", () => {
  it("renders label, right label and error text", () => {
    const { getByText } = renderWithTheme(
      <AppTextInput
        label="Email"
        value=""
        onChangeText={() => undefined}
        rightLabel="@example.com"
        error="Invalid email"
      />,
    );

    expect(getByText("Email")).toBeTruthy();
    expect(getByText("@example.com")).toBeTruthy();
    expect(getByText("Invalid email")).toBeTruthy();
  });

  it("calls onChangeText and focus handlers", () => {
    const onChangeText = jest.fn();
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const { getByPlaceholderText } = renderWithTheme(
      <AppTextInput
        value=""
        onChangeText={onChangeText}
        placeholder="Type here"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const input = getByPlaceholderText("Type here");
    fireEvent.changeText(input, "hello");
    fireEvent(input, "focus");
    fireEvent(input, "blur");

    expect(onChangeText).toHaveBeenCalledWith("hello");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("does not auto-capitalize text by default", () => {
    const { getByPlaceholderText } = renderWithTheme(
      <AppTextInput
        value=""
        onChangeText={() => undefined}
        placeholder="Meal name"
      />,
    );

    expect(getByPlaceholderText("Meal name").props.autoCapitalize).toBe("none");
  });

  it("uses centered single-line input metrics without extra vertical padding", () => {
    const { getByPlaceholderText } = renderWithTheme(
      <AppTextInput
        value="24"
        onChangeText={() => undefined}
        placeholder="Age"
      />,
    );

    expect(StyleSheet.flatten(getByPlaceholderText("Age").props.style)).toEqual(
      expect.objectContaining({
        height: "100%",
        textAlignVertical: "center",
        includeFontPadding: false,
        paddingVertical: 0,
      }),
    );
  });

  it("renders helper text and cloned icon adornments with fallback props", () => {
    const { getByText, getByPlaceholderText } = renderWithTheme(
      <AppTextInput
        value=""
        onChangeText={() => undefined}
        placeholder="Search"
        helperText="Helpful hint"
        icon={<MockAdornment />}
        iconPosition="right"
        disabled
      />,
    );

    expect(getByText("Helpful hint")).toBeTruthy();
    expect(getByText(`22-${themes.light.textSecondary}`)).toBeTruthy();
    expect(getByPlaceholderText("Search").props.editable).toBe(false);
  });

  it("keeps explicit adornment props and supports custom left/right nodes", () => {
    const { getByText, getByDisplayValue } = renderWithTheme(
      <AppTextInput
        value="content"
        onChangeText={() => undefined}
        left={<Text>Left node</Text>}
        right={<Text>Right node</Text>}
        icon={<MockAdornment size={30} color="tomato" />}
        iconPosition="left"
        multiline
        numberOfLines={3}
      />,
    );

    expect(getByText("Left node")).toBeTruthy();
    expect(getByText("Right node")).toBeTruthy();
    expect(getByDisplayValue("content").props.multiline).toBe(true);
    expect(getByDisplayValue("content").props.numberOfLines).toBe(3);
  });

  it("uses helper text style when error is boolean and preserves explicit icon props", () => {
    const { getByText } = renderWithTheme(
      <AppTextInput
        value=""
        onChangeText={() => undefined}
        helperText="Still visible"
        error
        icon={<MockAdornment size={30} color="tomato" />}
        iconPosition="left"
      />,
    );

    expect(getByText("Still visible")).toBeTruthy();
    expect(getByText("30-tomato")).toBeTruthy();
    expect(StyleSheet.flatten(getByText("Still visible").props.style)).toEqual(
      expect.objectContaining({ color: themes.light.error.text }),
    );
  });
});
