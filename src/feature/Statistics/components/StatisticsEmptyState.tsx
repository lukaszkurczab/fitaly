import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
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
      <View
        style={styles.motifCluster}
        testID="statistics-empty-growth-motif"
        accessible={false}
      >
        <View style={styles.motifHalo}>
          <View style={styles.groundLine} />
          <View style={styles.stem} />
          <View style={[styles.leaf, styles.leafLeft]} />
          <View style={[styles.leaf, styles.leafRight]} />
          <View style={[styles.progressDot, styles.progressDotOne]} />
          <View style={[styles.progressDot, styles.progressDotTwo]} />
          <View style={[styles.progressDot, styles.progressDotThree]} />
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
      justifyContent: "flex-start",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.hero,
      paddingBottom: theme.spacing.display,
    },
    motifCluster: {
      width: 104,
      height: 82,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.xs,
    },
    motifHalo: {
      width: 78,
      height: 78,
      borderRadius: theme.rounded.full,
      borderWidth: 1,
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.22)"
        : "rgba(111, 138, 105, 0.22)",
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.035)"
        : "rgba(255, 253, 248, 0.68)",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    groundLine: {
      position: "absolute",
      bottom: 21,
      left: 24,
      width: 30,
      height: 4,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.isDark
        ? "rgba(213, 154, 129, 0.18)"
        : "rgba(199, 126, 97, 0.18)",
    },
    stem: {
      position: "absolute",
      bottom: 24,
      left: 39,
      width: 2,
      height: 34,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primaryStrong,
      opacity: theme.isDark ? 0.82 : 0.9,
      transform: [{ rotate: "-16deg" }],
    },
    leaf: {
      position: "absolute",
      width: 24,
      height: 13,
      borderTopLeftRadius: theme.rounded.full,
      borderTopRightRadius: theme.rounded.full,
      borderBottomLeftRadius: theme.rounded.full,
      borderBottomRightRadius: 4,
      backgroundColor: theme.isDark
        ? "rgba(166, 189, 160, 0.68)"
        : "rgba(111, 138, 105, 0.66)",
    },
    leafLeft: {
      left: 21,
      top: 34,
      transform: [{ rotate: "-136deg" }],
    },
    leafRight: {
      right: 18,
      top: 24,
      transform: [{ rotate: "38deg" }],
    },
    progressDot: {
      position: "absolute",
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primaryStrong,
    },
    progressDotOne: {
      left: 19,
      bottom: 32,
      width: 5,
      height: 5,
      opacity: 0.18,
    },
    progressDotTwo: {
      left: 26,
      bottom: 43,
      width: 6,
      height: 6,
      opacity: 0.24,
    },
    progressDotThree: {
      left: 37,
      bottom: 55,
      width: 7,
      height: 7,
      opacity: 0.3,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      textAlign: "center",
      maxWidth: 320,
    },
    body: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      textAlign: "center",
      maxWidth: 312,
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
      justifyContent: "center",
      gap: theme.spacing.xs,
      maxWidth: "100%",
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
      textAlign: "center",
      flexShrink: 1,
    },
  });
