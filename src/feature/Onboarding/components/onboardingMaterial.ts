import { StyleSheet } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";
import type { BackgroundGradientLayer } from "@/components";
import { useTheme } from "@/theme/useTheme";

type Theme = ReturnType<typeof useTheme>;

export function getOnboardingBackgroundGradient(
  theme: Theme,
): BackgroundGradientLayer[] {
  if (theme.isDark) {
    return [
      {
        colors: ["#151914", theme.background, theme.backgroundSecondary],
        locations: [0, 0.54, 1],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      },
      {
        colors: [
          "rgba(127, 160, 122, 0.12)",
          "rgba(127, 160, 122, 0.02)",
          "rgba(199, 126, 97, 0.08)",
        ],
        locations: [0, 0.48, 1],
        start: { x: 1, y: 0 },
        end: { x: 0, y: 1 },
      },
      {
        colors: [
          "rgba(255, 253, 248, 0.04)",
          "rgba(255, 253, 248, 0.00)",
        ],
        locations: [0, 1],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
      },
    ];
  }

  return [
    {
      colors: ["#F8F0E4", theme.background, "#F2E8DC"],
      locations: [0, 0.54, 1],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
    {
      colors: [
        "rgba(255, 253, 248, 0.58)",
        "rgba(255, 253, 248, 0.10)",
        "rgba(111, 138, 105, 0.08)",
      ],
      locations: [0, 0.58, 1],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
    {
      colors: [
        "rgba(199, 126, 97, 0.08)",
        "rgba(199, 126, 97, 0.00)",
        "rgba(255, 253, 248, 0.18)",
      ],
      locations: [0, 0.48, 1],
      start: { x: 1, y: 0 },
      end: { x: 0, y: 1 },
    },
  ];
}

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

  const footer: ViewStyle = {
    marginHorizontal: -theme.spacing.screenPadding,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.isDark
      ? "rgba(255, 253, 248, 0.08)"
      : "rgba(207, 197, 184, 0.36)",
    backgroundColor: theme.isDark
      ? "rgba(27, 31, 27, 0.96)"
      : "rgba(255, 253, 248, 0.84)",
    shadowColor: theme.isDark ? "#000000" : "#2F312B",
    shadowOpacity: theme.isDark ? 0.34 : 0.09,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -10 },
    elevation: 10,
  };

  const footerActions: ViewStyle = {
    paddingTop: 0,
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
    footer,
    footerActions,
    inputField,
    optionalBadge,
    optionalBadgeText,
  };
}
