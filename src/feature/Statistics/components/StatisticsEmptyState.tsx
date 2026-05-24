import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { StatisticsEmptyKind } from "@/feature/Statistics/types";

type Props = {
  kind: StatisticsEmptyKind;
  isOffline: boolean;
  accessWindowDays?: number;
  onManageSubscription?: () => void;
};

export function StatisticsEmptyState({
  kind,
  isOffline,
  accessWindowDays,
  onManageSubscription,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["statistics"]);
  const isLimitedByFreeWindow = kind === "limited_by_free_window";

  const resolvedTitle =
    isOffline && kind === "no_history"
      ? t("statistics:offlineEmpty.title")
      : isLimitedByFreeWindow
        ? t("statistics:limitedRange.title")
      : kind === "no_entries_in_range"
        ? t("statistics:emptyRange.title")
        : t("statistics:empty.title");

  const resolvedBody =
    isOffline && kind === "no_history"
      ? t("statistics:offlineEmpty.desc")
      : isLimitedByFreeWindow
        ? t("statistics:limitedRange.desc", { days: accessWindowDays })
      : kind === "no_entries_in_range"
        ? t("statistics:emptyRange.desc")
        : t("statistics:empty.desc");

  const resolvedFoot =
    isLimitedByFreeWindow
      ? t("statistics:limitedRange.foot", { days: accessWindowDays })
      : kind === "no_entries_in_range"
      ? t("statistics:emptyRange.foot")
      : t("statistics:empty.foot");

  return (
    <View style={styles.root} testID={`statistics-empty-state-${kind}`}>
      <View style={styles.motifCluster}>
        <View style={styles.motifFrame}>
          <AppIcon name="trend-up" size={32} color={theme.primaryStrong} />
        </View>
      </View>

      <Text style={styles.title}>{resolvedTitle}</Text>
      <Text style={styles.body}>{resolvedBody}</Text>

      {isLimitedByFreeWindow && onManageSubscription ? (
        <Pressable
          testID="statistics-empty-manage-subscription-button"
          accessibilityRole="button"
          accessibilityLabel={t("statistics:limitedRange.cta")}
          onPress={onManageSubscription}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed ? styles.ctaPressed : null,
          ]}
        >
          <Text style={styles.ctaLabel}>{t("statistics:limitedRange.cta")}</Text>
        </Pressable>
      ) : null}

      <View style={styles.footPill}>
        <View style={styles.footDot} />
        <Text style={styles.footText}>{resolvedFoot}</Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.display,
    },
    motifCluster: {
      width: 120,
      height: 92,
      alignItems: "center",
      justifyContent: "center",
    },
    motifFrame: {
      width: 88,
      height: 64,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      ...theme.depth.raised,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      textAlign: "center",
    },
    body: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      textAlign: "center",
      maxWidth: 280,
    },
    ctaButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    ctaPressed: {
      opacity: 0.9,
    },
    ctaLabel: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    footPill: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    footDot: {
      width: theme.spacing.xxs + 2,
      height: theme.spacing.xxs + 2,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primary,
    },
    footText: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
  });
