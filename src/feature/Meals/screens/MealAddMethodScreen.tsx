import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import type { RootStackParamList } from "@/navigation/navigate";
import AppIcon from "@/components/AppIcon";
import { useTranslation } from "react-i18next";
import { useMealAddMethodState } from "@/feature/Meals/hooks/useMealAddMethodState";
import { ResumeDraftSheet } from "@/feature/Meals/components/ResumeDraftSheet";

type MealAddMethodNavigationProp = StackNavigationProp<
  RootStackParamList,
  "MealAddMethod"
>;
type MealAddMethodRouteProp = RouteProp<RootStackParamList, "MealAddMethod">;

const MealAddMethodScreen = () => {
  const navigation = useNavigation<MealAddMethodNavigationProp>();
  const route = useRoute<MealAddMethodRouteProp>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["meals"]);
  const closeLabel = t("close", { ns: "common", defaultValue: "Close" });
  const persistSelection = route.params?.selectionMode === "persistDefault";
  const resetStackOnStart = route.params?.origin === "mealAddFlow";

  const state = useMealAddMethodState({
    navigation,
    replaceOnStart: true,
    persistSelection,
    resetStackOnStart,
  });

  return (
    <View style={styles.overlay}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={() => navigation.goBack()}
        style={styles.dismissArea}
      />

      <View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(
              insets.bottom + theme.spacing.sm,
              theme.spacing.lg,
            ),
          },
        ]}
      >
        <View style={styles.topBar}>
          <View style={styles.handle} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            hitSlop={8}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.closeButtonPressed : null,
            ]}
            testID="meal-add-method-close-button"
          >
            <AppIcon name="close" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <AppIcon name="sparkles" size={18} color={theme.primaryStrong} />
          </View>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.eyebrow}>
              {t("title")}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={styles.title}
            >
              {t("subtitle")}
            </Text>
          </View>
        </View>

        <View style={styles.optionsWrap}>
          {state.options.map((option) => {
            const isPreferred = option.key === state.preferredMethodKey;

            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={t(option.titleKey)}
                onPress={() => {
                  void state.handleOptionPress(option);
                }}
                style={({ pressed }) => [
                  styles.optionRow,
                  isPreferred ? styles.optionRowPreferred : null,
                  pressed ? styles.optionRowPressed : null,
                ]}
                testID={`meal-add-option-${option.key}`}
              >
                <View
                  style={[
                    styles.optionIconBox,
                    isPreferred ? styles.optionIconBoxPreferred : null,
                  ]}
                >
                  <AppIcon
                    name={option.icon}
                    size={20}
                    color={isPreferred ? theme.primaryStrong : theme.primary}
                  />
                </View>

                <View style={styles.optionContent}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    style={styles.optionTitle}
                  >
                    {t(option.titleKey)}
                  </Text>
                  <Text numberOfLines={2} style={styles.optionDescription}>
                    {t(option.descKey)}
                  </Text>
                </View>

                <View style={styles.optionChevron}>
                  <AppIcon
                    name="chevron"
                    rotation="180deg"
                    size={20}
                    color={theme.textTertiary}
                    testID={`meal-add-option-${option.key}-chevron`}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {state.showResumeModal ? (
        <ResumeDraftSheet
          meal={state.resumeDraftMeal}
          onResume={() => {
            void state.handleContinueDraft();
          }}
          onDiscard={() => {
            void state.handleDiscardDraft();
          }}
          onClose={state.closeResumeModal}
        />
      ) : null}
    </View>
  );
};

export default MealAddMethodScreen;

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: "flex-end",
    },
    dismissArea: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      backgroundColor: theme.surfaceElevated,
      borderTopLeftRadius: theme.rounded.xxl,
      borderTopRightRadius: theme.rounded.xxl,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      paddingTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.screenPadding,
      gap: theme.spacing.md,
      ...theme.depth.modal,
    },
    topBar: {
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.borderSoft,
      alignSelf: "center",
    },
    closeButton: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    closeButtonPressed: {
      opacity: 0.72,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.success.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    eyebrow: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
      textTransform: "uppercase",
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    optionsWrap: {
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: 74,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      ...theme.depth.raised,
    },
    optionRowPreferred: {
      borderColor: theme.primarySoft,
      backgroundColor: theme.success.surface,
    },
    optionRowPressed: {
      opacity: 0.88,
    },
    optionIconBox: {
      width: 44,
      height: 44,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
    },
    optionIconBoxPreferred: {
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.primarySoft,
    },
    optionContent: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    optionTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    optionDescription: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    optionChevron: {
      width: 20,
      alignItems: "center",
      justifyContent: "center",
    },
  });
