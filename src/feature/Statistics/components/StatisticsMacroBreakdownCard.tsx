import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon, { type AppIconName } from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";

type Props = {
  protein: number;
  carbs: number;
  fat: number;
  targets?: {
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  } | null;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export function StatisticsMacroBreakdownCard({
  protein,
  carbs,
  fat,
  targets,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["statistics", "common"]);

  const total = Math.max(1, protein + carbs + fat);
  const gramLabel = t("common:gram");

  const items = [
    {
      key: "protein",
      label: t("statistics:tiles.protein"),
      grams: Math.round(protein),
      percent: Math.round((protein / total) * 100),
      target: targets?.proteinGrams ?? null,
      color: theme.chart.protein,
      softColor: theme.chart.proteinSoft,
      icon: "macro-protein-drumstick" as AppIconName,
    },
    {
      key: "carbs",
      label: t("statistics:tiles.carbs"),
      grams: Math.round(carbs),
      percent: Math.round((carbs / total) * 100),
      target: targets?.carbsGrams ?? null,
      color: theme.chart.carbs,
      softColor: theme.chart.carbsSoft,
      icon: "macro-carbs-grain" as AppIconName,
    },
    {
      key: "fat",
      label: t("statistics:tiles.fat"),
      grams: Math.round(fat),
      percent: Math.round((fat / total) * 100),
      target: targets?.fatGrams ?? null,
      color: theme.chart.fat,
      softColor: theme.chart.fatSoft,
      icon: "macro-fat-drop" as AppIconName,
    },
  ] as const;

  return (
    <View style={styles.card} testID="statistics-macro-breakdown-card">
      <Text style={styles.title}>{t("statistics:macroBreakdownTitle")}</Text>
      <Text style={styles.description}>{t("statistics:macroBreakdownDescription")}</Text>

      <View style={styles.macroRows}>
        {items.map((item) => {
          const progressPercent =
            item.target && item.target > 0
              ? Math.round((item.grams / item.target) * 100)
              : item.percent;
          const targetText =
            item.target && item.target > 0
              ? t("statistics:macro.target", {
                  value: item.target,
                  unit: gramLabel,
                })
              : t("statistics:macro.share", { percent: item.percent });

          return (
            <View
              key={item.key}
              style={styles.macroRow}
              testID={`statistics-macro-row-${item.key}`}
            >
              <View style={[styles.iconBubble, { backgroundColor: item.softColor }]}>
                <AppIcon name={item.icon} size={20} color={item.color} />
              </View>
              <View style={styles.macroRowContent}>
                <View style={styles.macroHeader}>
                  <View style={styles.macroCopy}>
                    <Text style={styles.macroLabel}>{item.label}</Text>
                    <Text style={styles.macroGrams}>
                      {`${item.grams} ${gramLabel}`}
                    </Text>
                  </View>
                  <View style={styles.macroValues}>
                    <Text style={styles.targetText}>{targetText}</Text>
                    <View
                      style={[
                        styles.macroPercentBadge,
                        { backgroundColor: item.softColor },
                      ]}
                    >
                      <Text style={[styles.macroPercent, { color: item.color }]}>
                        {`${progressPercent}%`}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${clampPercent(progressPercent)}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.11)"
        : "rgba(207, 197, 184, 0.72)",
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.018)"
        : "rgba(255, 253, 248, 0.54)",
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
    },
    description: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    macroRows: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    macroRow: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.08)"
        : "rgba(207, 197, 184, 0.52)",
      paddingTop: theme.spacing.sm,
    },
    iconBubble: {
      width: 44,
      height: 44,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    macroRowContent: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    macroHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    macroCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    macroLabel: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    macroGrams: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    macroValues: {
      alignItems: "flex-end",
      gap: 3,
      flexShrink: 0,
    },
    targetText: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    macroPercentBadge: {
      borderRadius: theme.rounded.full,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
    },
    macroPercent: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    progressTrack: {
      height: 7,
      borderRadius: theme.rounded.full,
      overflow: "hidden",
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.075)"
        : "rgba(239, 231, 218, 0.86)",
    },
    progressFill: {
      height: "100%",
      borderRadius: theme.rounded.full,
    },
  });
