import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { TextInput } from "@/components";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";

type MealBasicsSectionProps = {
  mealName: string;
  mealTypeLabel: string;
  mealTimeLabel: string;
  onMealNameChange: (value: string) => void;
  onMealNameBlur: () => void;
  onOpenTypePicker: () => void;
  onOpenTimePicker: () => void;
};

export default function MealBasicsSection({
  mealName,
  mealTypeLabel,
  mealTimeLabel,
  onMealNameChange,
  onMealNameBlur,
  onOpenTypePicker,
  onOpenTimePicker,
}: MealBasicsSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation("meals");
  const styles = createStyles(theme);

  return (
    <View style={styles.sectionBlock}>
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
      <Text style={styles.sectionLabel}>
        {t("review_meal_edit_meal_basics", {
          defaultValue: "Main details",
        })}
      </Text>

      <TextInput
        testID="meal-name-input"
        label={t("meal_name")}
        value={mealName}
        onChangeText={onMealNameChange}
        onBlur={onMealNameBlur}
        placeholder={t("manual_meal_name_placeholder", {
          defaultValue: "Enter meal name",
        })}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        maxLength={80}
      />

      <View style={styles.fieldRow}>
        <Pressable
          testID="meal-type-picker-trigger"
          accessibilityRole="button"
          accessibilityLabel={t("review_meal_type_label", {
            defaultValue: "Meal type",
          })}
          onPress={onOpenTypePicker}
          style={({ pressed }) => [
            styles.selectionField,
            pressed ? styles.selectionFieldPressed : null,
          ]}
        >
          <View style={styles.selectionCopy}>
            <Text style={styles.fieldLabel}>
              {t("review_meal_type_label", {
                defaultValue: "Meal type",
              })}
            </Text>
            <Text style={styles.selectionValue}>{mealTypeLabel}</Text>
          </View>
          <AppIcon
            name="chevron"
            rotation="-90deg"
            size={18}
            color={theme.textSecondary}
          />
        </Pressable>

        <Pressable
          testID="meal-time-picker-trigger"
          accessibilityRole="button"
          accessibilityLabel={t("review_meal_time_label", {
            defaultValue: "Time",
          })}
          onPress={onOpenTimePicker}
          style={({ pressed }) => [
            styles.selectionField,
            pressed ? styles.selectionFieldPressed : null,
          ]}
        >
          <View style={styles.selectionCopy}>
            <Text style={styles.fieldLabel}>
              {t("review_meal_time_label", {
                defaultValue: "Time",
              })}
            </Text>
            <Text style={styles.selectionValue}>{mealTimeLabel}</Text>
          </View>
          <AppIcon
            name="chevron"
            rotation="-90deg"
            size={18}
            color={theme.textSecondary}
          />
        </Pressable>
      </View>
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
    sectionLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    fieldRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    selectionField: {
      flex: 1,
      minHeight: 54,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.input.background,
      paddingHorizontal: theme.spacing.sm + 2,
      paddingVertical: theme.spacing.xs + 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.xs,
    },
    selectionFieldPressed: {
      opacity: 0.72,
    },
    selectionCopy: {
      flex: 1,
      gap: 2,
    },
    fieldLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      lineHeight: 14,
      fontFamily: theme.typography.fontFamily.medium,
    },
    selectionValue: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
