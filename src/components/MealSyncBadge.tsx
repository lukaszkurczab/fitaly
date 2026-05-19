import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import type { MealSyncState } from "@/types/meal";

type Props = {
  syncState: MealSyncState;
  lastSyncedAt?: number | null;
  testID?: string;
};

type BadgeTone = "success" | "warning" | "error";

function toneForSyncState(syncState: MealSyncState): BadgeTone {
  if (syncState === "synced") return "success";
  if (syncState === "pending") return "warning";
  return "error";
}

function labelKeyForSyncState(syncState: MealSyncState): string {
  if (syncState === "synced") return "history.syncSynced";
  if (syncState === "pending") return "history.syncPending";
  return "history.syncFailed";
}

function formatLastSyncedAt(value?: number | null): string | null {
  if (!value || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MealSyncBadge({ syncState, lastSyncedAt, testID }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("meals");
  const tone = toneForSyncState(syncState);
  const syncedAt = formatLastSyncedAt(lastSyncedAt);

  const label = t(labelKeyForSyncState(syncState));

  const displayLabel =
    syncState === "synced" && syncedAt
      ? t("history.syncSyncedAt", {
        time: syncedAt,
        })
      : label;

  return (
    <View
      testID={testID ?? `meal-sync-badge-${syncState}`}
      style={[
        styles.badge,
        tone === "success"
          ? styles.success
          : tone === "warning"
            ? styles.warning
            : styles.error,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === "success"
            ? styles.successLabel
            : tone === "warning"
              ? styles.warningLabel
              : styles.errorLabel,
        ]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    badge: {
      borderRadius: theme.rounded.full,
      paddingVertical: 4,
      paddingHorizontal: 8,
      alignSelf: "flex-start",
    },
    label: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    success: {
      backgroundColor: theme.success.surface,
    },
    successLabel: {
      color: theme.success.text,
    },
    warning: {
      backgroundColor: theme.warning.surface,
    },
    warningLabel: {
      color: theme.warning.text,
    },
    error: {
      backgroundColor: theme.error.surface,
      borderColor: theme.error.border,
      borderWidth: 1,
    },
    errorLabel: {
      color: theme.error.text,
    },
  });
