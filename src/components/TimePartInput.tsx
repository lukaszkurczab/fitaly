import React, { useCallback } from "react";
import { TextInput, type TextInputProps } from "react-native";

type Props = Omit<
  TextInputProps,
  "value" | "onChangeText" | "onBlur" | "keyboardType" | "maxLength"
> & {
  value: string;
  onChangeText: (value: string) => void;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  fallbackValue: number;
  mapZeroToMax?: boolean;
};

const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);
const pad2 = (n: number) => String(n).padStart(2, "0");

export const TimePartInput: React.FC<Props> = ({
  value,
  onChangeText,
  onCommit,
  min,
  max,
  fallbackValue,
  mapZeroToMax = false,
  ...rest
}) => {
  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text.replace(/[^\d]/g, "").slice(0, 2));
    },
    [onChangeText]
  );

  const handleBlur = useCallback(() => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      onChangeText(pad2(fallbackValue));
      return;
    }

    const raw = mapZeroToMax && parsed === 0 ? max : parsed;
    const next = clamp(raw, min, max);
    onCommit(next);
    onChangeText(pad2(next));
  }, [fallbackValue, mapZeroToMax, max, min, onChangeText, onCommit, value]);

  return (
    <TextInput
      {...rest}
      value={value}
      onChangeText={handleChangeText}
      onBlur={handleBlur}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={2}
    />
  );
};
