import { Modal as RNModal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { MealType } from "@/types/meal";

const mealTypeOptions: Array<{ labelKey: string; value: MealType }> = [
  { value: "breakfast", labelKey: "breakfast" },
  { value: "lunch", labelKey: "lunch" },
  { value: "dinner", labelKey: "dinner" },
  { value: "snack", labelKey: "snack" },
  { value: "other", labelKey: "other" },
];

type MealTypePickerModalProps = {
  visible: boolean;
  typeDraft: MealType;
  onTypeDraftChange: (nextType: MealType) => void;
  onClose: () => void;
  onApply: () => void;
};

export default function MealTypePickerModal({
  visible,
  typeDraft,
  onTypeDraftChange,
  onClose,
  onApply,
}: MealTypePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation(["meals", "common"]);
  const styles = createStyles(theme);

  return (
    <RNModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("close_type_picker", {
            ns: "meals",
            defaultValue: "Close meal type picker",
          })}
        />
        <View style={styles.sheet} testID="meal-type-picker-sheet">
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {t("review_meal_type_label", {
              ns: "meals",
              defaultValue: "Meal type",
            })}
          </Text>
          <View style={styles.sheetOptionList}>
            {mealTypeOptions.map((option) => {
              const selected = option.value === typeDraft;
              return (
                <Pressable
                  key={option.value}
                  testID={`meal-type-picker-option-${option.value}`}
                  accessibilityRole="button"
                  accessibilityLabel={t(option.labelKey, { ns: "meals" })}
                  onPress={() => onTypeDraftChange(option.value)}
                  style={({ pressed }) => [
                    styles.sheetOption,
                    selected ? styles.sheetOptionSelected : null,
                    pressed ? styles.selectionFieldPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetOptionLabel,
                      selected ? styles.sheetOptionLabelSelected : null,
                    ]}
                  >
                    {t(option.labelKey, { ns: "meals" })}
                  </Text>
                  {selected ? (
                    <AppIcon name="check" size={18} color={theme.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sheetActions}>
            <Button
              testID="meal-type-picker-cancel-button"
              variant="secondary"
              label={t("cancel", { ns: "common" })}
              onPress={onClose}
              style={styles.sheetActionButton}
              fullWidth={false}
            />
            <Button
              testID="meal-type-picker-apply-button"
              label={t("apply", {
                ns: "common",
                defaultValue: "Apply",
              })}
              onPress={onApply}
              style={styles.sheetActionButton}
              fullWidth={false}
            />
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    sheetOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
    },
    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.isDark
        ? "rgba(0, 0, 0, 0.48)"
        : "rgba(47, 49, 43, 0.42)",
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: theme.rounded.xxl,
      borderTopRightRadius: theme.rounded.xxl,
      paddingTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.bottomSheetPadding,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.sm,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.4 : 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -6 },
      elevation: 12,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.borderSoft,
      alignSelf: "center",
    },
    sheetTitle: {
      color: theme.text,
      fontSize: 20,
      lineHeight: 26,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "center",
    },
    sheetOptionList: {
      gap: theme.spacing.sm,
    },
    sheetOption: {
      minHeight: 46,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.background,
      paddingHorizontal: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    selectionFieldPressed: {
      opacity: 0.72,
    },
    sheetOptionSelected: {
      borderColor: theme.primarySoft,
    },
    sheetOptionLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
    },
    sheetOptionLabelSelected: {
      color: theme.primary,
    },
    sheetActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    sheetActionButton: {
      flex: 1,
    },
  });
