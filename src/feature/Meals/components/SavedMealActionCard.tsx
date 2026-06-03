import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import type { Meal } from "@/types/meal";
import { calculateTotalNutrients } from "@/utils/calculateTotalNutrients";
import { MealThumbnail } from "@/feature/Meals/components/MealThumbnail";
import { formatMealRelativeTime } from "@/feature/Meals/utils/formatMealRelativeTime";

type SavedMealActionCardProps = {
  meal: Meal;
  onAdd: (meal: Meal) => void;
};

export function SavedMealActionCard({
  meal,
  onAdd,
}: SavedMealActionCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation(["meals"]);

  const totals = calculateTotalNutrients([meal]);
  const usedAgo = formatMealRelativeTime(
    meal.updatedAt || meal.createdAt,
    i18n.language,
  );
  const mealTypeLabel = t(meal.type || "other");

  return (
    <View style={styles.card}>
      <MealThumbnail
        meal={meal}
        size={62}
        borderRadius={14}
        placeholderLabel={t("saved_list_no_photo", "No\nphoto")}
        showPlaceholderIcon
      />

      <View style={styles.copyWrap}>
        <Text numberOfLines={2} style={styles.name}>
          {meal.name || t("meal", { ns: "home", defaultValue: "Meal" })}
        </Text>
        <Text numberOfLines={1} style={styles.primaryMeta}>
          {mealTypeLabel} • {totals.kcal} {t("kcal", { defaultValue: "kcal" })}
        </Text>
        <Text numberOfLines={1} style={styles.secondaryMeta}>
          {usedAgo
            ? t("saved_list_used", {
                time: usedAgo,
                defaultValue: "Used {{time}}",
              })
            : t("saved_list_recent", "Recently used")}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("saved_list_add", "Add")} ${meal.name || t("meal", { ns: "home", defaultValue: "Meal" })}`}
        onPress={() => onAdd(meal)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.addButton,
          pressed ? styles.addButtonPressed : null,
        ]}
        testID={`saved-meal-add-${meal.cloudId || meal.mealId}`}
      >
        <Text style={styles.addButtonLabel}>
          {t("saved_list_add", "Add")}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 92,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      ...theme.depth.raised,
    },
    copyWrap: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    name: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 16,
      lineHeight: 21,
    },
    primaryMeta: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 13,
      lineHeight: 18,
    },
    secondaryMeta: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 13,
      lineHeight: 18,
    },
    addButton: {
      minWidth: 64,
      minHeight: 38,
      paddingHorizontal: 13,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.success.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.96,
    },
    addButtonPressed: {
      opacity: 0.78,
    },
    addButtonLabel: {
      color: theme.primaryStrong,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 14,
      lineHeight: 18,
    },
  });
