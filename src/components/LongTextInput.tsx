import { forwardRef, useMemo } from "react";
import { View, TextInput as RNTextInput, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import type { ViewStyle, TextStyle } from "react-native";
import { TextInput as AppTextInput } from "@/components/TextInput";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  disabled?: boolean;
  editable?: boolean;
  numberOfLines?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  maxLength?: number;
  testID?: string;
};

const DEFAULT_MAX_LENGTH = 250;

export const LongTextInput = forwardRef<RNTextInput, Props>(
  (
    {
      value,
      onChangeText,
      placeholder,
      label,
      error,
      style,
      inputStyle,
      disabled = false,
      editable,
      numberOfLines = 4,
      onBlur,
      onFocus,
      maxLength = DEFAULT_MAX_LENGTH,
      testID,
    },
    ref,
  ) => {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);

    const counterColorStyle = useMemo(
      () => ({
        color:
          value.length >= maxLength ? theme.error.text : theme.textSecondary,
      }),
      [value.length, maxLength, theme.error.text, theme.textSecondary],
    );

    return (
      <View style={style}>
        <AppTextInput
          testID={testID}
          ref={ref}
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          inputStyle={[styles.input, inputStyle]}
          disabled={disabled}
          editable={editable}
          multiline
          numberOfLines={numberOfLines}
          onBlur={onBlur}
          onFocus={onFocus}
          maxLength={maxLength}
          error={error}
          autoCorrect={false}
          spellCheck={false}
        />

        <Text style={[styles.counter, counterColorStyle]}>
          {value.length}/{maxLength}
        </Text>

      </View>
    );
  },
);

LongTextInput.displayName = "LongTextInput";

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    input: {
      minHeight: 96,
    },
    counter: {
      marginTop: theme.spacing.xs,
      alignSelf: "flex-end",
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
