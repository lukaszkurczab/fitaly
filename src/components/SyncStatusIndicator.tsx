import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { MealSyncState } from "@/types/meal";

type Props = {
  syncState: MealSyncState;
  testID?: string;
};

export function SyncStatusIndicator({ syncState, testID }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("meals");

  if (syncState === "synced") return null;

  const isPending = syncState === "pending";
  const label =
    syncState === "conflict"
      ? t("history.syncConflict")
      : t(isPending ? "history.syncPending" : "history.syncFailed");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID ?? `sync-status-indicator-${syncState}`}
      style={[styles.indicator, isPending ? styles.pending : styles.failed]}
    >
      <AppIcon
        name={isPending ? "refresh" : "wifi-off"}
        size={14}
        color={isPending ? theme.textTertiary : theme.error.text}
      />
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    indicator: {
      width: 20,
      height: 20,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    pending: {
      opacity: 0.72,
    },
    failed: {
      backgroundColor: theme.error.surface,
      borderColor: theme.error.border,
      borderWidth: 1,
    },
  });
