import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/theme/useTheme";

type DockChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
  labelVariant?: "bold" | "italic" | "underline";
  tone?: "default" | "primary";
  testID?: string;
  accessibilityLabel?: string;
};

export default function DockChip({
  label,
  active,
  onPress,
  compact = false,
  labelVariant,
  tone = "default",
  testID,
  accessibilityLabel,
}: DockChipProps) {
  const theme = useTheme();
  const colors = resolveDockChipColors(theme, active, tone);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        compact ? styles.chipCompact : null,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.74}
        style={[
          styles.chipLabel,
          resolveLabelVariantStyle(labelVariant),
          {
            color: colors.textColor,
            fontFamily: labelVariant === "bold"
              ? theme.typography.fontFamily.bold
              : active || tone === "primary"
              ? theme.typography.fontFamily.semiBold
              : theme.typography.fontFamily.medium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function resolveDockChipColors(
  theme: ReturnType<typeof useTheme>,
  active: boolean,
  tone: "default" | "primary",
) {
  if (tone === "primary") {
    return {
      backgroundColor: theme.isDark ? theme.primaryStrong : theme.primary,
      borderColor: theme.isDark ? "rgba(214, 229, 209, 0.78)" : theme.primary,
      textColor: theme.isDark ? theme.textInverse : theme.cta.primaryText,
    };
  }

  if (!theme.isDark) {
    return {
      backgroundColor: active ? theme.primary : theme.surfaceAlt,
      borderColor: active ? theme.primary : theme.borderSoft,
      textColor: active ? theme.cta.primaryText : theme.textSecondary,
    };
  }

  if (active) {
    return {
      backgroundColor: theme.primaryStrong,
      borderColor: "rgba(214, 229, 209, 0.78)",
      textColor: theme.textInverse,
    };
  }

  return {
    backgroundColor: "rgba(30, 34, 30, 0.94)",
    borderColor: "rgba(166, 189, 160, 0.22)",
    textColor: theme.textSecondary,
  };
}

function resolveLabelVariantStyle(
  variant: DockChipProps["labelVariant"],
) {
  if (variant === "italic") {
    return styles.chipLabelItalic;
  }
  if (variant === "underline") {
    return styles.chipLabelUnderline;
  }
  return null;
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 29,
    borderRadius: 15,
    paddingHorizontal: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCompact: {
    minHeight: 23,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  chipLabel: {
    fontSize: 10.5,
    lineHeight: 12,
  },
  chipLabelItalic: {
    fontStyle: "italic",
    transform: [{ skewX: "-10deg" }],
  },
  chipLabelUnderline: {
    textDecorationLine: "underline",
  },
});
