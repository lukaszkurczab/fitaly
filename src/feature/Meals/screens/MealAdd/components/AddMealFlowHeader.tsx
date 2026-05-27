import { memo, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { MealAddFlowProgress } from "@/feature/Meals/utils/mealAddFlowProgress";

type Props = {
  onBack: () => void;
  onClose: () => void;
  progress?: MealAddFlowProgress;
  backAccessibilityLabel?: string;
  closeAccessibilityLabel?: string;
  testID?: string;
  backTestID?: string;
  closeTestID?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

function AddMealFlowHeader({
  onBack,
  onClose,
  backAccessibilityLabel,
  closeAccessibilityLabel,
  progress,
  testID = "add-meal-flow-header",
  backTestID = "add-meal-flow-header-back",
  closeTestID = "add-meal-flow-header-close",
  containerStyle,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["meals", "common"]);
  const progressLabel = progress
    ? t("meal_add_flow_step_counter", {
        ns: "meals",
        current: progress.current,
        total: progress.total,
        defaultValue: "Step {{current}} of {{total}}",
      })
    : null;

  return (
    <View style={[styles.header, containerStyle]} testID={testID}>
      <View style={styles.sideSlot}>
        <Pressable
          testID={backTestID}
          accessibilityRole="button"
          accessibilityLabel={
            backAccessibilityLabel ??
            t("back", { ns: "common", defaultValue: "Back" })
          }
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [
            styles.iconButton,
            pressed ? styles.iconButtonPressed : null,
          ]}
        >
          <AppIcon name="arrow" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.centerSlot}>
        {progress ? (
          <View
            style={styles.progressTrack}
            accessibilityLabel={String(progressLabel)}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 1,
              max: progress.total,
              now: progress.current,
            }}
            testID={`${testID}-progress`}
          >
            {Array.from({ length: progress.total }).map((_, index) => {
              const active = index < progress.current;

              return (
                <View
                  key={`${progress.path}-${index}`}
                  style={[
                    styles.progressSegment,
                    active
                      ? styles.progressSegmentActive
                      : styles.progressSegmentInactive,
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={[styles.sideSlot, styles.rightSlot]}>
        <Pressable
          testID={closeTestID}
          accessibilityRole="button"
          accessibilityLabel={
            closeAccessibilityLabel ??
            t("close", { ns: "common", defaultValue: "Close" })
          }
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [
            styles.iconButton,
            pressed ? styles.iconButtonPressed : null,
          ]}
        >
          <AppIcon name="close" size={18} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    header: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    sideSlot: {
      width: 44,
      height: 44,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    rightSlot: {
      alignItems: "flex-end",
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
    },
    iconButtonPressed: {
      opacity: 0.72,
    },
    centerSlot: {
      flex: 1,
      minWidth: 0,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    progressTrack: {
      maxWidth: 120,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
    },
    progressSegment: {
      width: 26,
      height: 4,
      borderRadius: theme.rounded.full,
    },
    progressSegmentActive: {
      backgroundColor: theme.primary,
    },
    progressSegmentInactive: {
      backgroundColor: theme.borderSoft,
    },
  });

export default memo(AddMealFlowHeader);
