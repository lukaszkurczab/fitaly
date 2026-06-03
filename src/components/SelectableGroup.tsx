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

export type SelectableOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  testID?: string;
};

type SelectableGroupProps<T extends string> = {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectableOption<T>[];
  value?: T | null;
  values?: T[];
  onChange: (value: T) => void;
  selectionMode?: "single" | "multiple";
  variant?: "chip" | "card";
  size?: "default" | "compact";
  columns?: 1 | 2 | 3;
  style?: StyleProp<ViewStyle>;
};

const COLUMN_WIDTHS: Record<1 | 2 | 3, `${number}%`> = {
  1: "100%",
  2: "48%",
  3: "31.5%",
};

export function SelectableGroup<T extends string>({
  label,
  helperText,
  error,
  options,
  value,
  values,
  onChange,
  selectionMode = "single",
  variant = "chip",
  size = "default",
  columns = 1,
  style,
}: SelectableGroupProps<T>) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const selectedValues = values ?? (value ? [value] : []);
  const isMultiple = selectionMode === "multiple";
  const widthStyle =
    variant === "card" || columns > 1
      ? {
          width: COLUMN_WIDTHS[columns],
        }
      : null;

  return (
    <View style={style}>
      {label ? <Text style={styles.groupLabel}>{label}</Text> : null}

      <View style={variant === "card" ? styles.cardWrap : styles.chipWrap}>
        {options.map((option) => {
          const selected = selectedValues.includes(option.value);
          const disabled = !!option.disabled;

          return (
            <Pressable
              key={option.value}
              accessibilityRole={isMultiple ? "checkbox" : "radio"}
              accessibilityLabel={option.label}
              accessibilityState={{
                checked: selected,
                selected,
                disabled,
              }}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
                if (!isMultiple && selected) return;
                onChange(option.value);
              }}
              style={({ pressed }) => [
                variant === "card" ? styles.cardOption : styles.chipOption,
                size === "compact" && variant === "card"
                  ? styles.cardOptionCompact
                  : null,
                size === "compact" && variant === "chip"
                  ? styles.chipOptionCompact
                  : null,
                widthStyle,
                selected
                  ? variant === "card"
                    ? styles.cardOptionSelected
                    : styles.chipOptionSelected
                  : null,
                disabled ? styles.optionDisabled : null,
                pressed && !disabled ? styles.optionPressed : null,
              ]}
              testID={option.testID}
            >
              <Text
                style={[
                  variant === "card" ? styles.cardLabel : styles.chipLabel,
                  size === "compact" ? styles.labelCompact : null,
                  selected ? styles.selectedText : null,
                ]}
              >
                {option.label}
              </Text>

              {variant === "card" && option.description ? (
                <Text
                  style={[
                    styles.cardDescription,
                    size === "compact" ? styles.cardDescriptionCompact : null,
                    selected ? styles.selectedDescription : null,
                  ]}
                >
                  {option.description}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    groupLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelL,
      lineHeight: theme.typography.lineHeight.labelL,
      fontFamily: theme.typography.fontFamily.medium,
      marginBottom: theme.spacing.sm,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    cardWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    chipOption: {
      minHeight: 48,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.rounded.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.12)"
        : "rgba(207, 197, 184, 0.70)",
      backgroundColor: theme.isDark
        ? "rgba(32, 37, 32, 0.84)"
        : "rgba(255, 253, 248, 0.72)",
      alignItems: "center",
      justifyContent: "center",
    },
    chipOptionCompact: {
      minHeight: 40,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    chipOptionSelected: {
      borderColor: theme.primaryStrong,
      backgroundColor: theme.primaryStrong,
      shadowColor: theme.isDark ? "#000000" : "#2F312B",
      shadowOpacity: theme.isDark ? 0.22 : 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    cardOption: {
      minHeight: 72,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.12)"
        : "rgba(207, 197, 184, 0.68)",
      backgroundColor: theme.isDark
        ? "rgba(32, 37, 32, 0.86)"
        : "rgba(255, 253, 248, 0.76)",
      gap: theme.spacing.xxs,
    },
    cardOptionCompact: {
      minHeight: 58,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.rounded.md,
    },
    cardOptionSelected: {
      borderColor: theme.primaryStrong,
      backgroundColor: theme.primarySoft,
      shadowColor: theme.isDark ? "#000000" : "#2F312B",
      shadowOpacity: theme.isDark ? 0.24 : 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    chipLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "center",
    },
    cardLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    cardDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    labelCompact: {
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    cardDescriptionCompact: {
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    selectedText: {
      color: theme.textInverse,
    },
    selectedDescription: {
      color: theme.textInverse,
    },
    optionDisabled: {
      opacity: 0.45,
    },
    optionPressed: {
      opacity: 0.88,
    },
    helperText: {
      marginTop: theme.spacing.xs,
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    errorText: {
      marginTop: theme.spacing.xs,
      color: theme.error.text,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
