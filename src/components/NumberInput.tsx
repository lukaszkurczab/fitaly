import React, { useCallback, useMemo } from "react";
import {
  TextInput as RNTextInput,
  StyleSheet,
  type KeyboardTypeOptions,
  type TextInputProps as RNTextInputProps,
} from "react-native";
import { TextInput as AppTextInput } from "./TextInput";
import {
  normalizeNumericInputOnBlur,
  sanitizeNumericInput,
} from "@/utils/numericInput";

type BaseProps = React.ComponentProps<typeof AppTextInput>;

type CommonProps = {
  value: string;
  onChangeText: (text: string) => void;
  maxDecimals?: number;
  allowEmptyOnBlur?: boolean;
  blurFallback?: string;
  keyboardType?: KeyboardTypeOptions;
  onBlur?: (normalizedValue: string) => void;
};

type StyledProps = Omit<
  BaseProps,
  "value" | "onChangeText" | "keyboardType" | "onBlur"
> & {
  variant?: "styled";
};

type NativeProps = Omit<
  RNTextInputProps,
  "value" | "onChangeText" | "keyboardType" | "onBlur"
> & {
  variant: "native";
};

type Props = (StyledProps | NativeProps) & CommonProps;

const omitCommonNumberInputProps = (input: Props) => {
  const next = { ...input } as Partial<Props>;
  delete next.variant;
  delete next.value;
  delete next.onChangeText;
  delete next.maxDecimals;
  delete next.allowEmptyOnBlur;
  delete next.blurFallback;
  delete next.keyboardType;
  delete next.onBlur;
  return next;
};

export const NumberInput: React.FC<Props> = (props) => {
  const {
    value,
    onChangeText,
    maxDecimals,
    allowEmptyOnBlur = false,
    blurFallback,
    keyboardType,
    onBlur,
  } = props;

  const resolvedKeyboardType = useMemo<KeyboardTypeOptions>(() => {
    if (keyboardType) return keyboardType;
    if (typeof maxDecimals === "number" && maxDecimals > 0) return "decimal-pad";
    return "numeric";
  }, [keyboardType, maxDecimals]);

  const handleChangeText = useCallback(
    (rawValue: string) => {
      const next = sanitizeNumericInput(rawValue, { maxDecimals });
      onChangeText(next);
    },
    [maxDecimals, onChangeText]
  );

  const handleBlur = useCallback(() => {
    const fallback = blurFallback ?? (allowEmptyOnBlur ? "" : "0");
    const normalized = normalizeNumericInputOnBlur(value, {
      maxDecimals,
      fallback,
    });

    if (normalized !== value) {
      onChangeText(normalized);
    }
    onBlur?.(normalized);
  }, [allowEmptyOnBlur, blurFallback, maxDecimals, onBlur, onChangeText, value]);

  if (props.variant === "native") {
    const nativeProps = omitCommonNumberInputProps(props) as RNTextInputProps;

    return (
      <RNTextInput
        {...nativeProps}
        style={[
          styles.nativeInput,
          nativeProps.style,
        ]}
        value={value}
        onChangeText={handleChangeText}
        keyboardType={resolvedKeyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        onBlur={handleBlur}
      />
    );
  }

  const styledProps = omitCommonNumberInputProps(props) as BaseProps;

  return (
    <AppTextInput
      {...styledProps}
      value={value}
      onChangeText={handleChangeText}
      keyboardType={resolvedKeyboardType}
      autoCapitalize="none"
      autoCorrect={false}
      onBlur={handleBlur}
    />
  );
};

const styles = StyleSheet.create({
  nativeInput: {
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
});
