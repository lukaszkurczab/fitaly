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

      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.key} testID={`statistics-average-${item.key}`} style={styles.card}>
            <View style={[styles.accentBar, { backgroundColor: item.color }]} />
            <View style={styles.content}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>{item.value}</Text>
              <Text style={styles.caption}>{t("statistics:dailyAveragesSuffix")}</Text>
            </View>
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
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    card: {
      width: "48%",
      minHeight: 72,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surface,
      flexDirection: "row",
      overflow: "hidden",
      paddingVertical: theme.spacing.sm,
      paddingRight: theme.spacing.sm,
    },
    accentBar: {
      width: theme.spacing.xxs,
      borderTopLeftRadius: theme.rounded.xs,
      borderBottomLeftRadius: theme.rounded.xs,
      marginVertical: theme.spacing.xxs,
    },
    content: {
      flex: 1,
      paddingLeft: theme.spacing.sm,
      justifyContent: "center",
      gap: theme.spacing.xxs,
    },
    label: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    value: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
    },
    caption: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
    },
  });
