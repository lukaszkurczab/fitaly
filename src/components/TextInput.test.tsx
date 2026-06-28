import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import {
  Text,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { ReactTestInstance } from "react-test-renderer";
import { TextInput as AppTextInput } from "@/components/TextInput";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import { themes } from "@/theme/themes";
import { typography } from "@/theme/typography";

const MockAdornment = ({ size, color }: { size?: number; color?: string }) => (
  <Text>{`${size ?? "none"}-${color ?? "none"}`}</Text>
);

const flattenInputStyle = (input: ReactTestInstance) =>
  StyleSheet.flatten(input.props.style as StyleProp<TextStyle>);

const findInputWrapperStyle = (input: ReactTestInstance) => {
  let current = input.parent;

  while (current) {
    const style = StyleSheet.flatten(
      current.props.style as StyleProp<ViewStyle>,
    );

    if (style?.flexDirection === "row" && style?.borderWidth === 1) {
      return style;
    }

    current = current.parent;
  }

  throw new Error("TextInput wrapper not found");
};

const expectSingleLineCenteredMetrics = (
  input: ReactTestInstance,
  lineHeight = typography.lineHeight.bodyL,
) => {
  expect(flattenInputStyle(input)).toEqual(
    expect.objectContaining({
      height: lineHeight,
      textAlignVertical: "center",
      includeFontPadding: false,
      paddingVertical: 0,
      paddingTop: 0,
      paddingBottom: 0,
      marginVertical: 0,
    }),
  );
};

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

    expectSingleLineCenteredMetrics(getByPlaceholderText("Age"));
    expect(findInputWrapperStyle(getByPlaceholderText("Age"))).toEqual(
      expect.objectContaining({
        minHeight: 52,
        paddingVertical: 0,
        alignItems: "center",
        justifyContent: "center",
      }),
    );
  });

  it("keeps single-line alignment metrics after custom input styles", () => {
    const { getByPlaceholderText } = renderWithTheme(
      <AppTextInput
        value="query"
        onChangeText={() => undefined}
        placeholder="Search meals"
        inputStyle={{
          lineHeight: typography.lineHeight.bodyM,
          marginVertical: 6,
          paddingVertical: 8,
        }}
      />,
    );

    expectSingleLineCenteredMetrics(
      getByPlaceholderText("Search meals"),
      typography.lineHeight.bodyM,
    );
  });

  it("keeps centered single-line metrics and error visuals in error state", () => {
    const { getByTestId } = renderWithTheme(
      <AppTextInput
        testID="email-input"
        errorTestID="email-error"
        value="bad-email"
        onChangeText={() => undefined}
        error="Invalid email"
      />,
    );

    const input = getByTestId("email-input");

    expectSingleLineCenteredMetrics(input);
    expect(findInputWrapperStyle(input)).toEqual(
      expect.objectContaining({
        backgroundColor: themes.light.input.backgroundError,
        borderColor: themes.light.input.borderError,
      }),
    );
    expect(StyleSheet.flatten(getByTestId("email-error").props.style)).toEqual(
      expect.objectContaining({ color: themes.light.error.text }),
    );
  });

  it("keeps centered single-line metrics and disabled visuals when disabled", () => {
    const { getByTestId, getByText } = renderWithTheme(
      <AppTextInput
        testID="password-input"
        label="Password"
        value=""
        onChangeText={() => undefined}
        disabled
      />,
    );

    const input = getByTestId("password-input");

    expect(input.props.editable).toBe(false);
    expectSingleLineCenteredMetrics(input);
    expect(findInputWrapperStyle(input)).toEqual(
      expect.objectContaining({
        backgroundColor: themes.light.input.backgroundDisabled,
        borderColor: themes.light.input.borderDisabled,
      }),
    );
    expect(StyleSheet.flatten(getByText("Password").props.style)).toEqual(
      expect.objectContaining({ color: themes.light.textTertiary }),
    );
  });

  it("keeps multiline inputs top-aligned while preserving multiline sizing", () => {
    const { getByTestId } = renderWithTheme(
      <AppTextInput
        testID="notes-input"
        value="Line one\nLine two"
        onChangeText={() => undefined}
        multiline
        numberOfLines={3}
        inputMaxHeight={160}
        inputStyle={{
          minHeight: 88,
          marginVertical: 12,
        }}
      />,
    );

    expect(StyleSheet.flatten(getByTestId("notes-input").props.style)).toEqual(
      expect.objectContaining({
        maxHeight: 160,
        minHeight: 88,
        marginVertical: 12,
        textAlignVertical: "top",
        includeFontPadding: false,
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
