import { Pressable, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { Ingredient } from "@/types/meal";

type IngredientListSectionProps = {
  ingredients: Ingredient[];
  onOpenIngredientEditor: (index: number | null) => void;
};

function formatIngredientAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatMacroValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function IngredientListSection({
  ingredients,
  onOpenIngredientEditor,
}: IngredientListSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation("meals");
  const styles = createStyles(theme);

  return (
    <View style={styles.sectionBlock} testID="ingredient-list-section">
      <LinearGradient
        pointerEvents="none"
        colors={
          theme.isDark
            ? [
                "rgba(255, 255, 255, 0.035)",
                "rgba(126, 153, 120, 0.055)",
                "rgba(0, 0, 0, 0)",
              ]
            : [
                "rgba(255, 255, 255, 0.94)",
                "rgba(250, 247, 240, 0.8)",
                "rgba(126, 153, 120, 0.075)",
              ]
        }
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      />
      <View style={styles.ingredientsHeader}>
        <Text style={styles.ingredientsTitle}>
          {t("review_meal_ingredients_title", {
            defaultValue: "Ingredients",
          })}
        </Text>
        <Text style={styles.ingredientsSubtitle}>
          {t("review_meal_edit_ingredients_subtitle", {
            defaultValue: "Edit items and amounts. Totals update below.",
          })}
        </Text>
      </View>

      {ingredients.length > 0 ? (
        <View style={styles.ingredientsList}>
          {ingredients.map((ingredient, index) => (
            <Pressable
              key={ingredient.id || `ingredient-${index}`}
              testID={`ingredient-row-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`${t("edit_ingredient", {
                defaultValue: "Edit ingredient",
              })}: ${ingredient.name}`}
              onPress={() => onOpenIngredientEditor(index)}
              style={({ pressed }) => [
                styles.ingredientRow,
                pressed ? styles.selectionFieldPressed : null,
              ]}
            >
              <View style={styles.ingredientCopy}>
                <Text style={styles.ingredientName} numberOfLines={1}>
                  {ingredient.name}
                </Text>
                {Number(ingredient.kcal) > 0 ? (
                  <Text style={styles.ingredientNutrition} numberOfLines={1}>
                    {`${formatMacroValue(ingredient.kcal)} ${t("kcal", {
                      defaultValue: "kcal",
                    })} | ${t("protein_short", {
                      defaultValue: "P",
                    })} ${formatMacroValue(ingredient.protein)} g | ${t(
                      "carbs_short",
                      {
                        defaultValue: "C",
                      },
                    )} ${formatMacroValue(ingredient.carbs)} g | ${t(
                      "fat_short",
                      {
                        defaultValue: "F",
                      },
                    )} ${formatMacroValue(ingredient.fat)} g`}
                  </Text>
                ) : null}
              </View>
              <View style={styles.ingredientMeta}>
                <Text style={styles.ingredientAmount}>
                  {`${formatIngredientAmount(ingredient.amount)} ${ingredient.unit ?? "g"}`}
                </Text>
                <AppIcon
                  name="chevron"
                  rotation="180deg"
                  size={18}
                  color={theme.textSecondary}
                />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyIngredientsCard} testID="ingredient-empty-state">
          <Text style={styles.emptyIngredientsTitle}>
            {t("review_meal_edit_no_ingredients_title", {
              defaultValue: "No ingredients yet",
            })}
          </Text>
          <Text style={styles.emptyIngredientsDescription}>
            {t("review_meal_edit_no_ingredients_description", {
              defaultValue: "Add ingredients if you want to refine nutrition.",
            })}
          </Text>
        </View>
      )}

      <Pressable
        testID="ingredient-add-button"
        accessibilityRole="button"
        hitSlop={theme.spacing.xs}
        accessibilityLabel={t(
          ingredients.length > 0
            ? "add_ingredient"
            : "review_meal_edit_add_first_ingredient",
          {
            defaultValue:
              ingredients.length > 0
                ? "Add ingredient"
                : "Add first ingredient",
          },
        )}
        onPress={() => onOpenIngredientEditor(null)}
        style={({ pressed }) => [
          styles.addIngredientAction,
          pressed ? styles.selectionFieldPressed : null,
        ]}
      >
        <Text style={styles.addIngredientPlus}>+</Text>
        <Text style={styles.addIngredientLabel}>
          {t(
            ingredients.length > 0
              ? "add_ingredient"
              : "review_meal_edit_add_first_ingredient",
            {
              defaultValue:
                ingredients.length > 0
                  ? "Add ingredient"
                  : "Add first ingredient",
            },
          )}
        </Text>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    sectionBlock: {
      position: "relative",
      overflow: "hidden",
      gap: theme.spacing.sm,
      borderRadius: theme.rounded.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      padding: theme.spacing.md,
      ...theme.depth.raised,
    },
    cardGradient: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: theme.rounded.xl,
    },
    ingredientsHeader: {
      gap: 3,
    },
    ingredientsTitle: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 22,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    ingredientsSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      maxWidth: 280,
    },
    ingredientsList: {
      gap: theme.spacing.xs,
    },
    ingredientRow: {
      minHeight: 58,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.input.background,
      paddingHorizontal: theme.spacing.sm + 2,
      paddingVertical: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    selectionFieldPressed: {
      opacity: 0.72,
    },
    ingredientCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    ingredientName: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
    },
    ingredientNutrition: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    ingredientMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    ingredientAmount: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    emptyIngredientsCard: {
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.background,
      padding: theme.spacing.md,
      gap: theme.spacing.xxs,
    },
    emptyIngredientsTitle: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 22,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    emptyIngredientsDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    addIngredientAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      alignSelf: "flex-start",
      minHeight: 44,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.rounded.sm,
    },
    addIngredientPlus: {
      color: theme.primary,
      fontSize: 18,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
    },
    addIngredientLabel: {
      color: theme.primary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
  });
