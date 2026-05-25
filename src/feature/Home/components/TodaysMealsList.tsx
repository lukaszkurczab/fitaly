import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import type { Meal } from "@/types/meal";
import { useTranslation } from "react-i18next";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import AppIcon from "@/components/AppIcon";
import { MealThumbnail } from "@/feature/Meals/components/MealThumbnail";

type Props = {
  meals: Meal[];
  onOpenMeal?: (meal: Meal) => void;
};

export const TodaysMealsList = ({ meals, onOpenMeal }: Props) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation(["home", "common"]);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language || undefined),
    [i18n.language],
  );

  return (
    <View style={styles.container} testID="home-today-meals-list">
      <Text style={styles.sectionTitle}>{t("home:todaysMeals")}</Text>
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
        const kcal = ingredientTotals?.kcal ?? (meal.totals?.kcal ?? 0);
        const protein = Math.max(
          0,
          Math.round(ingredientTotals?.protein ?? (meal.totals?.protein ?? 0)),
        );
        const carbs = Math.max(
          0,
          Math.round(ingredientTotals?.carbs ?? (meal.totals?.carbs ?? 0)),
        );
        const fat = Math.max(
          0,
          Math.round(ingredientTotals?.fat ?? (meal.totals?.fat ?? 0)),
        );

        const subtitle =
          Array.isArray(meal.ingredients) && meal.ingredients.length
            ? meal.ingredients
                .slice(0, 3)
                .map((ingredient) => ingredient.name?.trim())
                .filter((value): value is string => !!value)
                .join(", ")
            : null;
        const mealTime = formatMealTime(meal.timestamp, i18n.language);
        const mealInitial = (meal.name || t("home:meal"))
          .trim()
          .slice(0, 1)
          .toUpperCase();

        return (
          <Pressable
            key={meal.cloudId || meal.mealId || `${meal.name}-${meal.timestamp}`}
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
                {[mealTime, `${numberFormatter.format(Math.max(0, Math.round(kcal)))} kcal`]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={styles.subtitle}>
                  {subtitle}
                </Text>
              ) : null}
              <View style={styles.chipsRow}>
                <Text style={[styles.chip, styles.proteinChip]}>
                  B {numberFormatter.format(protein)}g
                </Text>
                <Text style={[styles.chip, styles.carbsChip]}>
                  W {numberFormatter.format(carbs)}g
                </Text>
                <Text style={[styles.chip, styles.fatChip]}>
                  T {numberFormatter.format(fat)}g
                </Text>
              </View>
            </View>
            <View style={styles.moreWrap}>
              <AppIcon name="more" size={24} color={theme.textSecondary} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

function formatMealTime(timestamp: Meal["timestamp"], locale?: string): string | null {
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
      backgroundColor: theme.surfaceElevated,
      borderRadius: theme.rounded.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      padding: theme.spacing.sm,
      gap: theme.spacing.sm,
      ...theme.depth.floating,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      backgroundColor: theme.surfaceElevated,
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      padding: theme.spacing.xs,
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
    subtitle: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      paddingTop: 2,
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
    moreWrap: {
      width: 28,
      alignItems: "center",
      justifyContent: "center",
    },
  });
