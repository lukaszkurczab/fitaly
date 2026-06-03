import { Fragment, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTheme } from "@/theme/useTheme";
import type { Meal } from "@/types/meal";
import { useTranslation } from "react-i18next";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { MealThumbnail } from "@/feature/Meals/components/MealThumbnail";

type Props = {
  meals: Meal[];
  onOpenMeal?: (meal: Meal) => void;
};

export const TodaysMealsList = ({ meals, onOpenMeal }: Props) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation(["home", "common", "meals"]);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language || undefined),
    [i18n.language],
  );
  const cardAccentColors: [string, string, string] = theme.isDark
    ? [
        "rgba(255, 253, 248, 0.02)",
        "rgba(111, 138, 105, 0.025)",
        "rgba(199, 126, 97, 0.006)",
      ]
    : [
        "rgba(255, 253, 248, 0.38)",
        "rgba(111, 138, 105, 0.016)",
        "rgba(199, 126, 97, 0.008)",
      ];

  return (
    <View style={styles.container} testID="home-today-meals-list">
      <LinearGradient
        pointerEvents="none"
        colors={cardAccentColors}
        locations={[0, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardWash}
      />
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{t("home:todaysMeals")}</Text>
      </View>
      {meals.map((meal, index) => {
        const ingredientTotals =
          Array.isArray(meal.ingredients) && meal.ingredients.length
            ? meal.ingredients.reduce(
                (sum, ingredient) => ({
                  kcal: sum.kcal + (ingredient.kcal ?? 0),
                  protein: sum.protein + (ingredient.protein ?? 0),
                  carbs: sum.carbs + (ingredient.carbs ?? 0),
                  fat: sum.fat + (ingredient.fat ?? 0),
                }),
                { kcal: 0, protein: 0, carbs: 0, fat: 0 },
              )
            : null;
        const kcal = ingredientTotals?.kcal ?? meal.totals?.kcal ?? 0;
        const protein = Math.max(
          0,
          Math.round(ingredientTotals?.protein ?? meal.totals?.protein ?? 0),
        );
        const carbs = Math.max(
          0,
          Math.round(ingredientTotals?.carbs ?? meal.totals?.carbs ?? 0),
        );
        const fat = Math.max(
          0,
          Math.round(ingredientTotals?.fat ?? meal.totals?.fat ?? 0),
        );

        const mealTime = formatMealTime(meal.timestamp, i18n.language);
        const mealInitial = (meal.name || t("home:meal"))
          .trim()
          .slice(0, 1)
          .toUpperCase();

        return (
          <Fragment
            key={
              meal.cloudId || meal.mealId || `${meal.name}-${meal.timestamp}`
            }
          >
            <Pressable
              testID={`home-today-meal-row-${index}`}
              onPress={onOpenMeal ? () => onOpenMeal(meal) : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${meal.name || t("meal")}, ${numberFormatter.format(Math.max(0, Math.round(kcal)))} kcal`}
              style={({ pressed }) => [
                styles.row,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <MealThumbnail
                meal={meal}
                size={60}
                borderRadius={theme.rounded.lg}
                placeholderLabel={mealInitial}
              />
              <View style={styles.info}>
                <View style={styles.titleRow}>
                  <Text numberOfLines={2} style={styles.name}>
                    {meal.name || t("home:meal")}
                  </Text>
                  <SyncStatusIndicator
                    syncState={meal.syncState}
                    testID={`home-meal-sync-${meal.syncState}-${index}`}
                  />
                </View>
                <Text numberOfLines={1} style={styles.meta}>
                  {[
                    mealTime,
                    `${numberFormatter.format(Math.max(0, Math.round(kcal)))} kcal`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <View style={styles.chipsRow}>
                  <Text style={[styles.chip, styles.proteinChip]}>
                    {t("meals:protein", "Protein")}
                    {": "}
                    {numberFormatter.format(protein)}g
                  </Text>
                  <Text style={[styles.chip, styles.carbsChip]}>
                    {t("meals:carbs", "Carbs")}: {numberFormatter.format(carbs)}
                    g
                  </Text>
                  <Text style={[styles.chip, styles.fatChip]}>
                    {t("meals:fat", "Fat")}: {numberFormatter.format(fat)}g
                  </Text>
                </View>
              </View>
            </Pressable>
            {index < meals.length - 1 ? (
              <View style={styles.separator} />
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
};

function formatMealTime(
  timestamp: Meal["timestamp"],
  locale?: string,
): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale || undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.72)"
        : "rgba(255, 253, 248, 0.68)",
      borderRadius: theme.rounded.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      paddingHorizontal: theme.spacing.cardPaddingLarge,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.xs,
      overflow: "hidden",
      position: "relative",
    },
    cardWash: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 1,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.semiBold,
      flexShrink: 1,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      backgroundColor: "transparent",
      paddingVertical: theme.spacing.xs,
      zIndex: 1,
    },
    rowPressed: {
      opacity: 0.88,
    },
    info: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    name: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      flexShrink: 1,
    },
    meta: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.xxs,
    },
    chip: {
      borderRadius: theme.rounded.full,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      overflow: "hidden",
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
    proteinChip: {
      color: theme.chart.protein,
      backgroundColor: theme.macro.proteinSoft,
    },
    carbsChip: {
      color: theme.chart.carbs,
      backgroundColor: theme.macro.carbsSoft,
    },
    fatChip: {
      color: theme.chart.fat,
      backgroundColor: theme.macro.fatSoft,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.borderSoft,
      zIndex: 1,
    },
  });
