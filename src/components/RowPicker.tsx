import { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";

export type RowPickerOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  testID?: string;
};

type RowPickerProps<T extends string> = {
  label?: string;
  options: RowPickerOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  style?: StyleProp<ViewStyle>;
  size?: "default" | "compact";
  testID?: string;
};

export function RowPicker<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  style,
  size = "default",
  testID,
}: RowPickerProps<T>) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={style} testID={testID}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View accessibilityRole="radiogroup" style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          const disabled = !!option.disabled;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => {
                if (disabled || selected) return;
                onChange(option.value);
              }}
              style={({ pressed }) => [
                styles.option,
                size === "compact" ? styles.optionCompact : null,
                selected ? styles.optionSelected : null,
                disabled ? styles.optionDisabled : null,
                pressed && !disabled ? styles.optionPressed : null,
              ]}
              testID={option.testID}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.text,
                  size === "compact" ? styles.textCompact : null,
                  selected ? styles.textSelected : null,
                  disabled ? styles.textDisabled : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    label: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelL,
      lineHeight: theme.typography.lineHeight.labelL,
      fontFamily: theme.typography.fontFamily.medium,
      marginBottom: theme.spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    option: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    optionCompact: {
      minHeight: 40,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    optionSelected: {
      backgroundColor: theme.primary,
    },
    optionDisabled: {
      opacity: 0.4,
    },
    optionPressed: {
      opacity: 0.8,
    },
    text: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
    },
    textCompact: {
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    textSelected: {
      color: theme.textInverse,
    },
    textDisabled: {
      color: theme.textTertiary,
    },
    errorText: {
      marginTop: theme.spacing.xs,
      color: theme.error.text,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
