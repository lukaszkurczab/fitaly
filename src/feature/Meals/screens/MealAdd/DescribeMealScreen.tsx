import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import {
  ErrorBox,
  KeyboardAwareScrollView,
  Layout,
  Modal,
  NumberInput,
  TextInput,
  UnsavedChangesModal,
} from "@/components";
import { BottomActionBar } from "@/components/BottomActionBar";
import { AiCreditsBadge } from "@/components/AiCreditsBadge";
import { useAuthContext } from "@/context/AuthContext";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { useMealTextAiState } from "@/feature/Meals/hooks/useMealTextAiState";
import {
  getTextDetailsExpandedPreference,
  setTextDetailsExpandedPreference,
} from "@/feature/Meals/services/textDetailsPreference";
import AddMealFlowHeader from "@/feature/Meals/screens/MealAdd/components/AddMealFlowHeader";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useTheme } from "@/theme/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DETAILS_LINES = 4;
const DETAILS_MAX_LENGTH = 300;

export default function DescribeMealScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"DescribeMeal">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const capturePanelGradientColors: [string, string, string] = theme.isDark
    ? [
        "rgba(255, 253, 248, 0.05)",
        "rgba(111, 138, 105, 0.06)",
        "rgba(199, 126, 97, 0.026)",
      ]
    : [
        "rgba(255, 253, 248, 0.48)",
        "rgba(111, 138, 105, 0.025)",
        "rgba(199, 126, 97, 0.015)",
      ];
  const { t, i18n } = useTranslation(["meals", "chat", "common"]);
  const { uid } = useAuthContext();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset({ includeSafeArea: true });
  const footerBottomInset = Math.max(insets.bottom, theme.spacing.sm);
  const hasRouteTextIngredients = Boolean(
    params.textIngredients?.some(
      (ingredient) =>
        ingredient.name.trim().length > 0 ||
        ingredient.amount.trim().length > 0,
    ),
  );
  const hasRouteDetails = Boolean(
    params.quickDescription?.trim() ||
    params.servingAmount?.trim() ||
    hasRouteTextIngredients,
  );
  const [detailsExpanded, setDetailsExpanded] = useState(hasRouteDetails);
  const detailsPreferenceTouchedRef = useRef(false);
  const isKeyboardVisible = keyboardInset > 0;

  const {
    name,
    quickDescription,
    textIngredients,
    servingAmount,
    loading,
    showLimitModal,
    creditsUsed,
    creditsBalance,
    textMealCost,
    remainingCreditsAfterAnalyze,
    nameError,
    submitError,
    analyzeDisabled,
    analysisState,
    creditAllocation,
    onNameChange,
    onQuickDescriptionChange,
    onServingAmountChange,
    onAddTextIngredient,
    onUpdateTextIngredient,
    onRemoveTextIngredient,
    onAnalyze,
    closeLimitModal,
    openPaywall,
  } = useMealTextAiState({
    t,
    language: i18n?.language,
    flow,
    initialValues: params,
  });

  useEffect(() => {
    detailsPreferenceTouchedRef.current = false;

    if (hasRouteDetails) {
      setDetailsExpanded(true);
      return;
    }

    let cancelled = false;
    void getTextDetailsExpandedPreference(uid).then((expanded) => {
      if (!cancelled && !detailsPreferenceTouchedRef.current) {
        setDetailsExpanded(expanded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hasRouteDetails, uid]);

  const toggleDetails = useCallback(() => {
    detailsPreferenceTouchedRef.current = true;
    setDetailsExpanded((current) => {
      const next = !current;
      void setTextDetailsExpandedPreference(uid, next);
      return next;
    });
  }, [uid]);

  const creditsNote = useMemo(() => {
    if (creditsBalance === null) {
      return undefined;
    }

    if (creditsBalance < textMealCost) {
      return t("text_ai_no_credits_note", {
        ns: "meals",
        cost: textMealCost,
        defaultValue: "You need {{cost}} credit to continue.",
      });
    }

    if (remainingCreditsAfterAnalyze === null) {
      return undefined;
    }

    if (remainingCreditsAfterAnalyze <= 2) {
      return t("text_ai_low_credits_note", {
        ns: "meals",
        count: remainingCreditsAfterAnalyze,
        defaultValue: "Only {{count}} credits left after this analysis",
      });
    }

    return t("text_ai_credits_remaining_note", {
      ns: "meals",
      count: remainingCreditsAfterAnalyze,
      defaultValue: "✦ {{count}} credits remaining",
    });
  }, [creditsBalance, remainingCreditsAfterAnalyze, t, textMealCost]);

  const ctaHelperText = useMemo(() => {
    if (analysisState === "missing_name") {
      return t("text_ai_cta_missing_name", {
        ns: "meals",
        defaultValue: "Enter a meal name to prepare a summary.",
      });
    }

    if (analysisState === "credits_unverified") {
      return t("text_ai_credits_unverified", {
        ns: "meals",
        defaultValue: "Checking available AI Credits...",
      });
    }

    if (analysisState === "insufficient_credits") {
      return t("text_ai_insufficient_credits_hard_stop", {
        ns: "meals",
        defaultValue: "You do not have enough AI Credits to prepare a summary.",
      });
    }

    return creditsNote;
  }, [analysisState, creditsNote, t]);

  const creditsNoteWarning =
    analysisState === "insufficient_credits" ||
    (creditsBalance !== null &&
      (creditsBalance < textMealCost ||
        (remainingCreditsAfterAnalyze !== null &&
          remainingCreditsAfterAnalyze <= 2)));
  const showUpgradeLink = analysisState === "insufficient_credits";
  const canStepBack = flow.canGoBack();
  const hasUnsavedChanges =
    name.trim().length > 0 ||
    quickDescription.trim().length > 0 ||
    servingAmount.trim().length > 0 ||
    textIngredients.some(
      (ingredient) =>
        ingredient.name.trim().length > 0 ||
        ingredient.amount.trim().length > 0,
    );
  const detailsCount = t("describe_meal_optional_details_count", {
    ns: "meals",
    count: quickDescription.length,
    max: DETAILS_MAX_LENGTH,
    defaultValue: "{{count}}/{{max}}",
  });

  const guard = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    onExit: () => {
      if (canStepBack) {
        flow.goBack();
        return;
      }

      navigation.goBack();
    },
  });

  const renderActions = () => (
    <BottomActionBar
      bottomInset={isKeyboardVisible ? theme.spacing.xs : footerBottomInset}
      keyboardInset={keyboardInset}
      compact={isKeyboardVisible}
      helperText={isKeyboardVisible ? undefined : ctaHelperText}
      helperTone={creditsNoteWarning ? "warning" : "default"}
      primaryAction={{
        testID: "add-meal-text-analyze-button",
        label: t("describe_meal_primary_cta", { ns: "meals" }),
        compactLabel: t("describe_meal_primary_cta_compact", {
          ns: "meals",
          defaultValue: "Analyze",
        }),
        onPress: onAnalyze,
        disabled: analyzeDisabled,
        loading,
      }}
      secondaryAction={
        isKeyboardVisible
          ? {
              testID: "add-meal-text-change-method-button",
              label: t("camera_change_method_short", {
                ns: "meals",
                defaultValue: "Change method",
              }),
              compactLabel: t("change_method_compact", {
                ns: "meals",
                defaultValue: "Change",
              }),
              onPress: () =>
                navigation.navigate("MealAddMethod", {
                  selectionMode: "temporary",
                  origin: "mealAddFlow",
                }),
              disabled: loading,
              variant: "secondary",
            }
          : undefined
      }
      linkActions={[
        ...(showUpgradeLink
          ? [
              {
                testID: "add-meal-text-upgrade-button",
                label: t("limit.upgradeCta", { ns: "chat" }),
                onPress: openPaywall,
                disabled: loading,
              },
            ]
          : []),
        ...(!isKeyboardVisible
          ? [
              {
                testID: "add-meal-text-change-method-button",
                label: t("change_method", { ns: "meals" }),
                onPress: () =>
                  navigation.navigate("MealAddMethod", {
                    selectionMode: "temporary",
                    origin: "mealAddFlow",
                  }),
                disabled: loading,
              },
            ]
          : []),
      ]}
    />
  );

  const flowHeader = (
    <AddMealFlowHeader
      progress={flow.progress}
      onBack={guard.requestExit}
      onClose={guard.requestExit}
      containerStyle={styles.flowHeader}
      testID="add-meal-text-flow-header"
      backTestID="add-meal-text-back"
      closeTestID="add-meal-text-close"
    />
  );

  return (
    <>
      <Layout
        showNavigation={false}
        disableScroll
        style={styles.layout}
        keyboardAvoiding={false}
      >
        <Pressable
          style={styles.fill}
          onPress={Keyboard.dismiss}
          testID="add-meal-text-screen"
          accessible={false}
        >
          {flowHeader}
          <KeyboardAwareScrollView
            style={styles.scroller}
            contentContainerStyle={[
              styles.scrollContent,
              isKeyboardVisible
                ? { paddingBottom: keyboardInset + 132 }
                : null,
            ]}
            extraScrollOffset={theme.spacing.xs}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.hero}>
                <View style={styles.eyebrowRow}>
                  <Text style={styles.eyebrow}>
                    {t("describe_meal_sheet_overline", { ns: "meals" })}
                  </Text>
                  <AiCreditsBadge
                    text={`✦ ${String(t("credits.costSingle", { ns: "chat" }))}`}
                    tone="success"
                  />
                </View>
                <Text style={styles.title}>
                  {t("describe_meal_sheet_title", { ns: "meals" })}
                </Text>
                <Text style={styles.subtitle}>
                  {t("describe_meal_sheet_subtitle", { ns: "meals" })}
                </Text>
              </View>

              <View style={styles.capturePanel}>
                <LinearGradient
                  pointerEvents="none"
                  colors={capturePanelGradientColors}
                  locations={[0, 0.68, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.capturePanelWash}
                />
                <View style={styles.capturePanelContent}>
                  <TextInput
                    testID="add-meal-text-name-input"
                    label={t("describe_meal_name_label", { ns: "meals" })}
                    value={name}
                    onChangeText={onNameChange}
                    placeholder={t("describe_meal_name_placeholder", {
                      ns: "meals",
                    })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    maxLength={80}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  <Pressable
                    testID="add-meal-text-details-toggle"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: detailsExpanded }}
                    onPress={toggleDetails}
                    style={({ pressed }) => [
                      styles.detailsToggle,
                      pressed ? styles.detailsTogglePressed : null,
                    ]}
                  >
                    <Text style={styles.detailsToggleTitle}>
                      {t("describe_meal_optional_details_title", {
                        ns: "meals",
                      })}
                    </Text>
                    <AppIcon
                      name="chevron"
                      rotation={detailsExpanded ? "270deg" : "180deg"}
                      size={18}
                      color={theme.primaryStrong}
                    />
                  </Pressable>

                  {detailsExpanded ? (
                    <View
                      testID="add-meal-text-details-expanded"
                      style={styles.detailsExpanded}
                    >
                      <TextInput
                        testID="add-meal-text-description-input"
                        label={t("describe_meal_description_label", {
                          ns: "meals",
                        })}
                        value={quickDescription}
                        onChangeText={onQuickDescriptionChange}
                        placeholder={t(
                          "describe_meal_quick_description_placeholder",
                          {
                            ns: "meals",
                          },
                        )}
                        multiline
                        numberOfLines={DETAILS_LINES}
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                        maxLength={DETAILS_MAX_LENGTH}
                        fieldStyle={styles.detailsInputShell}
                        inputStyle={styles.detailsInput}
                        scrollEnabled
                      />
                      <Text
                        testID="add-meal-text-details-count"
                        style={styles.detailsCount}
                      >
                        {detailsCount}
                      </Text>

                      <View style={styles.optionalSection}>
                        <View style={styles.sectionHeaderRow}>
                          <Text style={styles.sectionLabel}>
                            {t("describe_meal_ingredients_label", {
                              ns: "meals",
                            })}
                          </Text>
                          <Pressable
                            testID="add-meal-text-ingredients-add-button"
                            accessibilityRole="button"
                            onPress={onAddTextIngredient}
                            style={({ pressed }) => [
                              styles.addIngredientButton,
                              pressed ? styles.detailsTogglePressed : null,
                            ]}
                          >
                            <AppIcon
                              name="add"
                              size={16}
                              color={theme.primaryStrong}
                            />
                            <Text style={styles.addIngredientText}>
                              {t("describe_meal_add_ingredient", {
                                ns: "meals",
                              })}
                            </Text>
                          </Pressable>
                        </View>

                        {textIngredients.map((ingredient, index) => (
                          <View
                            key={ingredient.id}
                            style={styles.ingredientRow}
                          >
                            <TextInput
                              testID={`add-meal-text-ingredient-name-input-${index}`}
                              style={styles.ingredientNameField}
                              fieldStyle={styles.compactField}
                              accessibilityLabel={t(
                                "describe_meal_ingredient_name_label",
                                {
                                  ns: "meals",
                                },
                              )}
                              value={ingredient.name}
                              onChangeText={(value) =>
                                onUpdateTextIngredient(ingredient.id, {
                                  name: value,
                                })
                              }
                              placeholder={t(
                                "describe_meal_ingredient_name_placeholder",
                                { ns: "meals" },
                              )}
                              autoCapitalize="none"
                              autoCorrect={false}
                              spellCheck={false}
                              maxLength={80}
                              returnKeyType="next"
                            />
                            <NumberInput
                              testID={`add-meal-text-ingredient-amount-input-${index}`}
                              style={styles.ingredientAmountField}
                              fieldStyle={styles.compactField}
                              inputStyle={styles.numberInput}
                              accessibilityLabel={t(
                                "describe_meal_ingredient_amount_label",
                                {
                                  ns: "meals",
                                },
                              )}
                              value={ingredient.amount}
                              onChangeText={(value) =>
                                onUpdateTextIngredient(ingredient.id, {
                                  amount: value,
                                })
                              }
                              placeholder={t(
                                "describe_meal_ingredient_amount_label",
                                {
                                  ns: "meals",
                                },
                              )}
                              maxDecimals={0}
                              allowEmptyOnBlur
                              rightLabel={t("describe_meal_grams_suffix", {
                                ns: "meals",
                              })}
                            />
                            <Pressable
                              testID={`add-meal-text-ingredient-remove-button-${index}`}
                              accessibilityRole="button"
                              accessibilityLabel={t(
                                "describe_meal_remove_ingredient",
                                { ns: "meals" },
                              )}
                              onPress={() =>
                                onRemoveTextIngredient(ingredient.id)
                              }
                              style={({ pressed }) => [
                                styles.removeIngredientButton,
                                pressed ? styles.detailsTogglePressed : null,
                              ]}
                            >
                              <AppIcon
                                name="delete"
                                size={18}
                                color={theme.textTertiary}
                              />
                            </Pressable>
                          </View>
                        ))}
                      </View>

                      <NumberInput
                        testID="add-meal-text-serving-input"
                        label={t("describe_meal_serving_label", {
                          ns: "meals",
                        })}
                        value={servingAmount}
                        onChangeText={onServingAmountChange}
                        placeholder={t("describe_meal_serving_placeholder", {
                          ns: "meals",
                        })}
                        maxDecimals={0}
                        allowEmptyOnBlur
                        rightLabel={t("describe_meal_grams_suffix", {
                          ns: "meals",
                        })}
                        fieldStyle={styles.compactField}
                        inputStyle={styles.numberInput}
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              {nameError || submitError ? (
                <ErrorBox
                  testID="add-meal-text-error"
                  message={nameError ?? submitError ?? ""}
                />
              ) : null}

              <View style={styles.spacer} />

            </View>
          </KeyboardAwareScrollView>
        </Pressable>

        {renderActions()}

        <Modal
          testID="add-meal-text-limit-modal"
          visible={showLimitModal}
          title={t("limit.reachedTitle", { ns: "chat" })}
          message={t("limit.reachedShort", {
            ns: "chat",
            used: creditsUsed,
            limit: creditAllocation,
          })}
          primaryAction={{
            testID: "add-meal-text-limit-upgrade-button",
            label: t("limit.upgradeCta", { ns: "chat" }),
            onPress: openPaywall,
          }}
          secondaryAction={{
            testID: "add-meal-text-limit-cancel-button",
            label: t("cancel", { ns: "common" }),
            onPress: closeLimitModal,
          }}
          onClose={closeLimitModal}
        />
      </Layout>

      <UnsavedChangesModal
        visible={guard.confirmVisible}
        title={t("discard_changes_title", {
          ns: "meals",
          defaultValue: "Discard changes?",
        })}
        message={t("discard_changes_message", {
          ns: "meals",
          defaultValue:
            "You have unsaved changes. Do you want to discard them?",
        })}
        discardLabel={t("discard", { ns: "common", defaultValue: "Discard" })}
        continueEditingLabel={t("continue_editing", {
          ns: "common",
          defaultValue: "Continue editing",
        })}
        onDiscard={guard.confirmExit}
        onContinueEditing={guard.cancelExit}
      />
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    },
    fill: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scroller: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: theme.spacing.lg,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    flowHeader: {
      marginHorizontal: theme.spacing.lg,
    },
    hero: {
      gap: theme.spacing.xs,
    },
    eyebrowRow: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    eyebrow: {
      flexShrink: 1,
      color: theme.primarySoft,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.displayM,
      lineHeight: 32,
      fontFamily: theme.typography.fontFamily.bold,
      letterSpacing: 0,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.regular,
    },
    capturePanel: {
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      overflow: "hidden",
      position: "relative",
      ...theme.depth.raised,
    },
    capturePanelWash: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
    },
    capturePanelContent: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      zIndex: 1,
    },
    detailsToggle: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      alignSelf: "stretch",
      paddingVertical: theme.spacing.xs,
    },
    detailsTogglePressed: {
      opacity: 0.72,
    },
    detailsToggleTitle: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
      flex: 1,
    },
    detailsExpanded: {
      gap: theme.spacing.sm,
    },
    detailsInputShell: {
      minHeight: 112,
    },
    detailsInput: {
      minHeight: 88,
    },
    detailsCount: {
      alignSelf: "flex-end",
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    optionalSection: {
      gap: theme.spacing.xs,
    },
    sectionHeaderRow: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
      flexShrink: 1,
    },
    addIngredientButton: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xs,
    },
    addIngredientText: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    ingredientRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: theme.spacing.xs,
    },
    ingredientNameField: {
      flex: 1,
      minWidth: 0,
    },
    ingredientAmountField: {
      width: 112,
      flexShrink: 0,
    },
    compactField: {
      minHeight: 46,
      borderRadius: theme.rounded.sm,
    },
    numberInput: {
      fontVariant: ["tabular-nums"],
    },
    removeIngredientButton: {
      width: 42,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.rounded.sm,
    },
    spacer: {
      flex: 1,
      minHeight: theme.spacing.lg,
    },
  });
