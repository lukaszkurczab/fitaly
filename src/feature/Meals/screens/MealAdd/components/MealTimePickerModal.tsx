import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Clock12h, Clock24h } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MealTimePickerModalProps = {
  visible: boolean;
  prefers12h: boolean;
  pickerDate: Date;
  onChangePickerDate: (nextDate: Date) => void;
  onClose: () => void;
  onApply: () => void;
};

export default function MealTimePickerModal({
  visible,
  prefers12h,
  pickerDate,
  onChangePickerDate,
  onClose,
  onApply,
}: MealTimePickerModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation(["meals", "common"]);
  const styles = createStyles(theme);
  const sheetMaxHeight = Math.max(
    280,
    Math.min(windowHeight * 0.68, windowHeight - insets.top - theme.spacing.md),
  );

  return (
    <RNModal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("close_time_picker", {
            ns: "meals",
            defaultValue: "Close meal time picker",
          })}
        />
        <View
          testID="meal-time-picker-sheet"
          style={[
            styles.sheet,
            {
              paddingBottom: theme.spacing.xl + insets.bottom,
              maxHeight: sheetMaxHeight,
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {t("meal_time", { ns: "meals", defaultValue: "Meal time" })}
          </Text>

          {prefers12h ? (
            <Clock12h value={pickerDate} onChange={onChangePickerDate} />
          ) : (
            <Clock24h value={pickerDate} onChange={onChangePickerDate} />
          )}

          <Text style={styles.sheetHelperText}>
            {t("review_meal_time_sheet_hint", {
              ns: "meals",
              defaultValue: "Adjust the meal time, then apply.",
            })}
          </Text>

          <View style={styles.sheetActions}>
            <Button
              testID="meal-time-picker-cancel-button"
              variant="secondary"
              label={t("cancel", { ns: "common" })}
              onPress={onClose}
              style={styles.sheetActionButton}
              fullWidth={false}
            />
            <Button
              testID="meal-time-picker-apply-button"
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
      flex: 1,
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
    sheetHelperText: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
      marginTop: -theme.spacing.xs,
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
