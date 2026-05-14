import React, { forwardRef, useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  KeyboardTypeOptions,
  TextInputProps,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { useKeyboardAwareInputFocus } from "@/components/KeyboardAwareScrollView";

type Props = {
  label?: string;
  helperText?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  icon?: React.ReactElement<{ size?: number; color?: string }>;
  onBlur?: () => void;
  onFocus?: () => void;
  iconPosition?: "left" | "right";
  error?: boolean | string;
  multiline?: boolean;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  onEndEditing?: () => void;
  disabled?: boolean;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  accessibilityLabel?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  autoCorrect?: boolean;
  spellCheck?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  onContentSizeChange?: TextInputProps["onContentSizeChange"];
  scrollEnabled?: boolean;
  inputMaxHeight?: number;
  rightLabel?: string;
  maxLength?: number;
  testID?: string;
};

const DEFAULT_ICON_SIZE = 22;

const resolveAdornment = (
  node: React.ReactNode,
  fallbackColor: string,
): React.ReactNode => {
  if (!React.isValidElement<{ size?: number; color?: string }>(node)) {
    return node;
  }

  return React.cloneElement(node, {
    size: node.props.size ?? DEFAULT_ICON_SIZE,
    color: node.props.color ?? fallbackColor,
  });
};

export const TextInput = forwardRef<RNTextInput, Props>(
  (
    {
      label,
      helperText,
      placeholder,
      value,
      onChangeText,
      keyboardType = "default",
      secureTextEntry = false,
      icon,
      iconPosition = "left",
      error,
      onBlur,
      onFocus,
      multiline = false,
      numberOfLines = 1,
      style,
      fieldStyle,
      inputStyle,
      disabled = false,
      editable,
      autoCapitalize = "none",
      autoComplete,
      textContentType,
      accessibilityLabel,
      left,
      right,
      autoCorrect = false,
      spellCheck,
      returnKeyType,
      onSubmitEditing,
      onContentSizeChange,
      scrollEnabled,
      inputMaxHeight,
      onEndEditing,
      rightLabel,
      maxLength = 128,
      testID,
    },
    ref,
  ) => {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const focusInputIntoView = useKeyboardAwareInputFocus();
    const [isFocused, setIsFocused] = useState(false);
    const innerRef = useRef<RNTextInput | null>(null);

    const setInputRef = useCallback(
      (instance: RNTextInput | null) => {
        innerRef.current = instance;
        if (typeof ref === "function") {
          ref(instance);
          return;
        }
        if (ref) {
          (ref as React.MutableRefObject<RNTextInput | null>).current =
            instance;
        }
      },
      [ref],
    );

    const hasError = !!error;
    const errorMsg = typeof error === "string" ? error : undefined;
    const isEditable = editable !== undefined ? editable : !disabled;
    const resolvedSpellCheck = spellCheck ?? autoCorrect;
    const inputMinHeight = multiline
      ? numberOfLines * theme.typography.lineHeight.bodyM
      : theme.typography.lineHeight.bodyM;
    const multilineInputMinHeight = inputMinHeight - theme.spacing.sm * 2;

    const borderColor = hasError
      ? theme.input.borderError
      : isFocused
        ? theme.input.borderFocused
        : isEditable
          ? theme.input.border
          : theme.input.borderDisabled;

    const backgroundColor = hasError
      ? theme.input.backgroundError
      : isEditable
        ? theme.input.background
        : theme.input.backgroundDisabled;

    const adornmentColor = hasError ? theme.error.text : theme.textSecondary;
    const resolvedLeft =
      left ??
      (icon && iconPosition === "left"
        ? resolveAdornment(icon, adornmentColor)
        : null);
    const resolvedRightIcon =
      right ??
      (icon && iconPosition === "right"
        ? resolveAdornment(icon, adornmentColor)
        : null);
    const resolvedRight = rightLabel ? (
      <Text style={styles.rightLabel}>{rightLabel}</Text>
    ) : (
      resolvedRightIcon
    );

    const helperMessage = errorMsg ?? helperText;
    const labelColor = hasError
      ? theme.error.text
      : isFocused
        ? theme.primary
        : isEditable
          ? theme.textSecondary
          : theme.textTertiary;

    return (
      <View style={[styles.container, style]}>
        {label ? (
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        ) : null}

        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor,
              borderColor,
              minHeight: multiline ? inputMinHeight : 0,
              alignItems: multiline ? "flex-start" : "center",
              justifyContent: multiline ? "flex-start" : "center",
            },
            fieldStyle,
          ]}
        >
          {resolvedLeft ? (
            <View
              style={[
                styles.leftAdornment,
                multiline ? styles.adornmentTopAligned : null,
              ]}
            >
              {resolvedLeft}
            </View>
          ) : null}

          <RNTextInput
            testID={testID}
            autoCorrect={autoCorrect}
            spellCheck={resolvedSpellCheck}
            ref={setInputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => {
              setIsFocused(true);
              focusInputIntoView?.(innerRef.current);
              onFocus?.();
            }}
            onBlur={() => {
              setIsFocused(false);
              onBlur?.();
            }}
            placeholder={placeholder}
            placeholderTextColor={theme.input.placeholder}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            editable={isEditable}
            onEndEditing={onEndEditing}
            multiline={multiline}
            numberOfLines={numberOfLines}
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            textContentType={textContentType}
            accessibilityLabel={accessibilityLabel}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onContentSizeChange={onContentSizeChange}
            scrollEnabled={scrollEnabled}
            maxLength={maxLength}
            style={[
              styles.input,
              {
                minHeight: multiline
                  ? multilineInputMinHeight
                  : undefined,
                maxHeight: multiline ? inputMaxHeight : undefined,
                height: multiline ? undefined : "100%",
                textAlignVertical: multiline ? "top" : "center",
                includeFontPadding: false,
                paddingVertical: 0,
              },
              inputStyle,
            ]}
            selectionColor={theme.primary}
            underlineColorAndroid="transparent"
          />

          {resolvedRight ? (
            <View
              style={[
                styles.rightAdornment,
                multiline ? styles.adornmentTopAligned : null,
              ]}
            >
              {resolvedRight}
            </View>
          ) : null}
        </View>

        {helperMessage ? (
          <Text style={hasError ? styles.errorText : styles.helperText}>
            {helperMessage}
          </Text>
        ) : null}
      </View>
    );
  },
);

TextInput.displayName = "TextInput";

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      width: "100%",
      flexShrink: 1,
    },
    label: {
      fontSize: theme.typography.size.labelS,
      marginBottom: theme.spacing.xxs + theme.spacing.xxs / 2,
      fontFamily: theme.typography.fontFamily.medium,
    },
    inputWrapper: {
      width: "100%",
      borderRadius: theme.rounded.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      justifyContent: "center",
      paddingVertical: theme.spacing.xxs,
    },
    input: {
      flex: 1,
      color: theme.input.text,
      fontSize: theme.typography.size.bodyL,
      fontFamily: theme.typography.fontFamily.regular,
      marginVertical: theme.spacing.xs,
    },
    rightLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      marginLeft: theme.spacing.xs,
      fontFamily: theme.typography.fontFamily.medium,
    },
    helperText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      marginTop: theme.spacing.xs - theme.spacing.xxs / 2,
      fontFamily: theme.typography.fontFamily.regular,
    },
    errorText: {
      color: theme.error.text,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      marginTop: theme.spacing.xs - theme.spacing.xxs / 2,
      fontFamily: theme.typography.fontFamily.medium,
    },
    leftAdornment: {
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
    },
    rightAdornment: {
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
    },
    adornmentTopAligned: {
      alignSelf: "flex-start",
    },
  });
