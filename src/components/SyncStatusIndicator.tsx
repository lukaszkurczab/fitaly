import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon, { type AppIconName } from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { MealSyncState } from "@/types/meal";

type Props = {
  syncState: MealSyncState;
  testID?: string;
  variant?: "compact" | "detail";
};

type VisibleSyncState = Exclude<MealSyncState, "synced">;

const STATUS_COPY_KEYS: Record<
  VisibleSyncState,
  { label: string; description: string }
> = {
  pending: {
    label: "history.syncStatus.pending.label",
    description: "history.syncStatus.pending.description",
  },
  failed: {
    label: "history.syncStatus.failed.label",
    description: "history.syncStatus.failed.description",
  },
  conflict: {
    label: "history.syncStatus.conflict.label",
    description: "history.syncStatus.conflict.description",
  },
};

export function getSyncStatusLabelKey(
  syncState: MealSyncState,
): string | null {
  if (syncState === "synced") return null;
  return STATUS_COPY_KEYS[syncState].label;
}

export function SyncStatusIndicator({
  syncState,
  testID,
  variant = "compact",
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("meals");

  if (syncState === "synced") return null;

  const copy = STATUS_COPY_KEYS[syncState];
  const label = t(copy.label);
  const description = t(copy.description);
  const textStyle =
    syncState === "pending"
      ? styles.pendingText
      : syncState === "conflict"
        ? styles.conflictText
        : styles.failedText;
  const iconWrapStyle =
    syncState === "pending"
      ? styles.pendingIconWrap
      : syncState === "conflict"
        ? styles.conflictIconWrap
        : styles.failedIconWrap;
  const iconColor =
    syncState === "pending"
      ? theme.primaryStrong
      : syncState === "conflict"
        ? theme.warning.text
        : theme.error.text;
  const iconName: AppIconName =
    syncState === "failed" ? "wifi-off" : "refresh";

  if (variant === "detail") {
    return (
      <View
        accessible
        accessibilityLabel={`${label}. ${description}`}
        testID={testID ?? `sync-status-indicator-${syncState}`}
        style={styles.detail}
      >
        <View style={[styles.detailIconWrap, iconWrapStyle]}>
          <AppIcon name={iconName} size={14} color={iconColor} />
        </View>
        <View style={styles.detailCopy}>
          <Text numberOfLines={1} style={[styles.detailLabel, textStyle]}>
            {label}
          </Text>
          <Text style={styles.detailDescription}>{description}</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID ?? `sync-status-indicator-${syncState}`}
      style={[styles.compact, iconWrapStyle]}
    >
      <AppIcon
        name={iconName}
        size={13}
        color={iconColor}
        testID={`${testID ?? `sync-status-indicator-${syncState}`}-icon`}
      />
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    compact: {
      width: 22,
      height: 22,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    pendingIconWrap: {
      backgroundColor: theme.isDark
        ? "rgba(127, 160, 122, 0.12)"
        : "rgba(79, 104, 75, 0.08)",
      borderColor: theme.isDark
        ? "rgba(127, 160, 122, 0.18)"
        : "rgba(79, 104, 75, 0.12)",
      borderWidth: 1,
    },
    failedIconWrap: {
      backgroundColor: theme.isDark
        ? "rgba(200, 93, 76, 0.12)"
        : "rgba(194, 78, 61, 0.08)",
      borderColor: theme.isDark
        ? "rgba(200, 93, 76, 0.22)"
        : "rgba(194, 78, 61, 0.14)",
      borderWidth: 1,
    },
    conflictIconWrap: {
      backgroundColor: theme.isDark
        ? "rgba(209, 161, 91, 0.12)"
        : "rgba(185, 133, 60, 0.08)",
      borderColor: theme.isDark
        ? "rgba(209, 161, 91, 0.22)"
        : "rgba(185, 133, 60, 0.14)",
      borderWidth: 1,
    },
    pendingText: {
      color: theme.primaryStrong,
    },
    failedText: {
      color: theme.error.text,
    },
    conflictText: {
      color: theme.warning.text,
    },
    detail: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    detailIconWrap: {
      width: 24,
      height: 24,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
    },
    detailCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    detailLabel: {
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    detailDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
