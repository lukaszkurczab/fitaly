import { StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";

export const PICKER_MENU_MAX_HEIGHT = 256;
export const PICKER_MENU_BOTTOM_OFFSET = 24;
export const PICKER_FIELD_MIN_HEIGHT = 56;

export type PickerControlSurfaceTone = "default" | "soft";

export function getPickerControlStyleParts(
  theme: ReturnType<typeof useTheme>,
  options: { surfaceTone?: PickerControlSurfaceTone } = {},
) {
  const isSoft = options.surfaceTone === "soft";

  return {
    label: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      marginBottom: theme.spacing.xs,
      fontFamily: theme.typography.fontFamily.medium,
    },
    field: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: isSoft ? theme.spacing.sm : 14,
      minHeight: isSoft ? 52 : PICKER_FIELD_MIN_HEIGHT,
      borderRadius: theme.rounded.md,
      borderWidth: isSoft ? StyleSheet.hairlineWidth : 1,
      borderColor: isSoft
        ? theme.isDark
          ? "rgba(255, 253, 248, 0.10)"
          : "rgba(207, 197, 184, 0.52)"
        : theme.input.border,
      backgroundColor: isSoft
        ? theme.isDark
          ? "rgba(30, 35, 30, 0.72)"
          : "rgba(239, 231, 218, 0.34)"
        : theme.input.background,
    },
    fieldOpen: {
      borderColor: theme.input.borderFocused,
      shadowColor: theme.primary,
      shadowOpacity: theme.isDark ? 0.22 : 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: 2,
    },
    fieldError: {
      borderColor: theme.input.borderError,
    },
    fieldDisabled: {
      backgroundColor: theme.input.backgroundDisabled,
      borderColor: theme.input.borderDisabled,
      opacity: 0.68,
    },
    valueText: {
      color: theme.input.text,
      fontSize: isSoft
        ? theme.typography.size.bodyM
        : theme.typography.size.bodyL,
      lineHeight: isSoft
        ? theme.typography.lineHeight.bodyM
        : theme.typography.lineHeight.bodyL,
      fontFamily: isSoft
        ? theme.typography.fontFamily.medium
        : theme.typography.fontFamily.regular,
    },
    placeholderText: {
      color: theme.input.placeholder,
      fontSize: isSoft
        ? theme.typography.size.bodyM
        : theme.typography.size.bodyL,
      lineHeight: isSoft
        ? theme.typography.lineHeight.bodyM
        : theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.regular,
    },
    fieldIcon: {
      marginLeft: theme.spacing.sm,
    },
    errorText: {
      color: theme.error.text,
      marginTop: theme.spacing.xs,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    menu: {
      position: "absolute" as const,
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.rounded.lg,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.22 : 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
      zIndex: 100,
      overflow: "hidden" as const,
    },
    menuContent: {
      paddingVertical: theme.spacing.xs,
    },
    option: {
      minHeight: 52,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      justifyContent: "center" as const,
    },
    optionSelected: {
      backgroundColor: theme.surfaceAlt,
    },
    optionText: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.regular,
    },
    optionTextSelected: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
  };
}
