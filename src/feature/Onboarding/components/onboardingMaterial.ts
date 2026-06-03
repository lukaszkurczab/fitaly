import { StyleSheet } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Theme = ReturnType<typeof useTheme>;

export function createOnboardingMaterialStyles(theme: Theme) {
  const panelBorder = theme.isDark
    ? "rgba(255, 253, 248, 0.08)"
    : "rgba(207, 197, 184, 0.58)";

  const panel: ViewStyle = {
    padding: theme.spacing.lg,
    borderRadius: theme.rounded.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: panelBorder,
    backgroundColor: theme.isDark
      ? "rgba(36, 41, 36, 0.96)"
      : "rgba(255, 253, 248, 0.96)",
    gap: theme.spacing.sm,
    shadowOpacity: 0,
    elevation: 0,
  };

  const inputField: ViewStyle = {
    borderRadius: theme.rounded.md,
  };

  const optionalBadge: ViewStyle = {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.rounded.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.isDark
      ? "rgba(255, 253, 248, 0.12)"
      : "rgba(207, 197, 184, 0.72)",
    backgroundColor: theme.isDark
      ? "rgba(38, 43, 38, 0.86)"
      : "rgba(255, 253, 248, 0.72)",
  };

  const optionalBadgeText: TextStyle = {
    color: theme.textSecondary,
    fontSize: theme.typography.size.caption,
    lineHeight: theme.typography.lineHeight.caption,
    fontFamily: theme.typography.fontFamily.medium,
  };

  return {
    panel,
    inputField,
    optionalBadge,
    optionalBadgeText,
  };
}
