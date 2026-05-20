import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import type { Meal } from "@/types/meal";
import { useTranslation } from "react-i18next";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

type Props = {
  meals: Meal[];
  onOpenMeal?: (meal: Meal) => void;
};

export const TodaysMealsList = ({ meals, onOpenMeal }: Props) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation("home");
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language || undefined),
    [i18n.language],
  );

  return (
    <View style={styles.container} testID="home-today-meals-list">
      {meals.map((meal, index) => {
        const kcal =
          Array.isArray(meal.ingredients) && meal.ingredients.length
            ? meal.ingredients.reduce((sum, ingredient) => sum + (ingredient.kcal ?? 0), 0)
            : (meal.totals?.kcal ?? 0);

        const subtitle =
          Array.isArray(meal.ingredients) && meal.ingredients.length
            ? meal.ingredients
                .slice(0, 3)
                .map((ingredient) => ingredient.name?.trim())
                .filter((value): value is string => !!value)
                .join(", ")
            : null;

        const isLast = index === meals.length - 1;

        return (
          <Pressable
            key={meal.cloudId || meal.mealId || `${meal.name}-${meal.timestamp}`}
            testID={`home-today-meal-row-${index}`}
            onPress={onOpenMeal ? () => onOpenMeal(meal) : undefined}
            accessibilityRole="button"
            accessibilityLabel={`${meal.name || t("meal")}, ${numberFormatter.format(Math.max(0, Math.round(kcal)))} kcal`}
            style={({ pressed }) => [
              styles.row,
              !isLast ? styles.rowDivider : null,
              pressed ? styles.rowPressed : null,
            ]}
          >
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text numberOfLines={2} style={styles.name}>
                  {meal.name || t("meal")}
                </Text>
                <SyncStatusIndicator
                  syncState={meal.syncState}
                  testID={`home-meal-sync-${meal.syncState}-${index}`}
                />
              </View>
              {subtitle ? (
                <Text numberOfLines={1} style={styles.subtitle}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.kcal}>
              {numberFormatter.format(Math.max(0, Math.round(kcal)))} kcal
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: theme.rounded.lg,
      paddingHorizontal: theme.spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderSoft,
    },
    rowPressed: {
      opacity: 0.88,
    },
    info: {
      flex: 1,
      gap: 3,
      paddingRight: theme.spacing.xs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    name: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
      flexShrink: 1,
    },
    subtitle: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    kcal: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
      minWidth: 56,
      textAlign: "right",
      paddingTop: 1,
    },
  });
