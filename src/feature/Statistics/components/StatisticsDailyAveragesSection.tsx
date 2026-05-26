import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";

type Props = {
  avgKcal: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
};

export function StatisticsDailyAveragesSection({
  avgKcal,
  avgProtein,
  avgCarbs,
  avgFat,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["statistics", "common"]);

  const items = [
    {
      key: "kcal",
      label: t("statistics:tiles.calories"),
      value: `${Math.round(avgKcal)} ${t("common:kcal")}`,
      color: theme.chart.calories,
    },
    {
      key: "protein",
      label: t("statistics:tiles.protein"),
      value: `${Math.round(avgProtein)} ${t("common:gram")}`,
      color: theme.chart.protein,
    },
    {
      key: "carbs",
      label: t("statistics:tiles.carbs"),
      value: `${Math.round(avgCarbs)} ${t("common:gram")}`,
      color: theme.chart.carbs,
    },
    {
      key: "fat",
      label: t("statistics:tiles.fat"),
      value: `${Math.round(avgFat)} ${t("common:gram")}`,
      color: theme.chart.fat,
    },
  ] as const;

  return (
    <View style={styles.root} testID="statistics-daily-averages-section">
      <Text style={styles.title}>{t("statistics:dailyAveragesTitle")}</Text>

      <View style={styles.card}>
        {items.map((item, index) => (
          <View key={item.key}>
            <View
              testID={`statistics-average-${item.key}`}
              style={styles.averageRow}
            >
              <View style={[styles.metricDot, { backgroundColor: item.color }]} />
              <View style={styles.copy}>
                <Text style={styles.label} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.caption}>
                  {t("statistics:dailyAveragesSuffix")}
                </Text>
              </View>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {item.value}
              </Text>
            </View>
            {index < items.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.sm,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surfaceElevated,
      overflow: "hidden",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      ...theme.depth.floating,
    },
    averageRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    metricDot: {
      width: 10,
      height: 10,
      borderRadius: theme.rounded.full,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    label: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      minWidth: 0,
    },
    value: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      textAlign: "right",
      minWidth: 84,
    },
    caption: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
      marginLeft: 22,
    },
  });
