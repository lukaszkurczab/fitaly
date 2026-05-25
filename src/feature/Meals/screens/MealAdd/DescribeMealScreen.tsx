import { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  ErrorBox,
  KeyboardAwareScrollView,
  Layout,
  Modal,
  ScreenCornerNavButton,
  TextInput,
  UnsavedChangesModal,
} from "@/components";
import { AiCreditsBadge } from "@/components/AiCreditsBadge";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { useMealTextAiState } from "@/feature/Meals/hooks/useMealTextAiState";
import {
  MealAddPhotoScaffold,
  MealAddTextLink,
} from "@/feature/Meals/components/MealAddPhotoScaffold";
import { useTheme } from "@/theme/useTheme";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

const DESCRIPTION_LINES = 8;

export default function DescribeMealScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"DescribeMeal">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(["meals", "chat", "common"]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isKeyboardVisible = keyboardHeight > 0;
  const previewTopInset = useMemo(
    () =>
      Math.max(
        theme.spacing.xxl,
        Math.round(insets.top * 0.65) + theme.spacing.xs,
      ),
    [insets.top, theme.spacing.xs, theme.spacing.xxl],
  );

  const {
    name,
    quickDescription,
    loading,
    showLimitModal,
    creditsUsed,
    creditsBalance,
    textMealCost,
    remainingCreditsAfterAnalyze,
    descriptionError,
    submitError,
    analyzeDisabled,
    analysisState,
    creditAllocation,
    onNameChange,
    onQuickDescriptionChange,
    onAnalyze,
    closeLimitModal,
    openPaywall,
  } = useMealTextAiState({
    t,
    language: i18n?.language,
    flow,
    initialValues: params,
  });

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

    if (analysisState === "missing_description") {
      return t("text_ai_cta_missing_description", {
        ns: "meals",
        defaultValue: "Add a meal description to prepare a summary.",
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
    name.trim().length > 0 || quickDescription.trim().length > 0;

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

  useEffect(() => {
    const showEventName =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEventName =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEventName, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEventName, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const renderAnalyzeButton = (style = styles.primaryButton) => (
    <Button
      testID="add-meal-text-analyze-button"
      label={t("describe_meal_primary_cta", { ns: "meals" })}
      onPress={onAnalyze}
      disabled={analyzeDisabled}
      loading={loading}
      style={style}
    />
  );

  const renderCtaHelperText = () =>
    ctaHelperText ? (
      <View
        accessible
        accessibilityLabel="add-meal-text-credits-explanation"
      >
        <Text
          testID="add-meal-text-credits-explanation"
          style={[
            styles.inlineNote,
            creditsNoteWarning ? styles.inlineNoteWarning : null,
          ]}
        >
          {ctaHelperText}
        </Text>
      </View>
    ) : null;

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
          <KeyboardAwareScrollView
            style={styles.scroller}
            contentContainerStyle={styles.scrollContent}
            extraScrollOffset={theme.spacing.xs}
            showsVerticalScrollIndicator={false}
          >
              <MealAddPhotoScaffold
                topInset={previewTopInset}
                previewHeight={360}
                preview={
                  <View style={styles.preview}>
                    <TextInput
                      testID="add-meal-text-name-input"
                      label={t("meal_name", { ns: "meals" })}
                      value={name}
                      onChangeText={onNameChange}
                      placeholder={t("describe_meal_name_placeholder", {
                        ns: "meals",
                      })}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      maxLength={80}
                    />
                    <TextInput
                      testID="add-meal-text-description-input"
                      label={t("describe_meal_quick_description_label", {
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
                      numberOfLines={DESCRIPTION_LINES}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      maxLength={300}
                      style={styles.previewDescriptionField}
                      fieldStyle={styles.previewDescriptionInputShell}
                      inputStyle={styles.previewDescriptionInput}
                      scrollEnabled
                    />
                  </View>
                }
                topAction={
                  <ScreenCornerNavButton
                    icon={canStepBack ? "back" : "close"}
                    onPress={guard.requestExit}
                    accessibilityLabel={t(canStepBack ? "back" : "close", {
                      ns: "common",
                      defaultValue: canStepBack ? "Back" : "Close",
                    })}
                    containerStyle={styles.screenCornerNavStyle}
                  />
                }
                eyebrow={t("describe_meal_sheet_overline", { ns: "meals" })}
                title={t("describe_meal_sheet_title", { ns: "meals" })}
                description={t("describe_meal_sheet_subtitle", { ns: "meals" })}
                accessory={
                  <AiCreditsBadge
                    text={`✦ ${String(t("credits.costSingle", { ns: "chat" }))}`}
                    tone="success"
                  />
                }
                content={
                  <>
                    {descriptionError || submitError ? (
                      <ErrorBox
                        testID="add-meal-text-error"
                        message={descriptionError ?? submitError ?? ""}
                      />
                    ) : null}
                    {!isKeyboardVisible ? (
                      <>
                        {renderCtaHelperText()}
                        {renderAnalyzeButton()}
                      </>
                    ) : null}
                    {showUpgradeLink && !isKeyboardVisible ? (
                      <MealAddTextLink
                        testID="add-meal-text-upgrade-button"
                        label={t("limit.upgradeCta", { ns: "chat" })}
                        onPress={openPaywall}
                        disabled={loading}
                      />
                    ) : null}
                    <MealAddTextLink
                      testID="add-meal-text-change-method-button"
                      label={t("change_method", { ns: "meals" })}
                      onPress={() =>
                        navigation.navigate("MealAddMethod", {
                          selectionMode: "temporary",
                          origin: "mealAddFlow",
                        })
                      }
                      disabled={loading}
                    />
                  </>
                }
                sheetVisible={!isKeyboardVisible}
                sheetFitContent
                contentPlacement="start"
              />
          </KeyboardAwareScrollView>
        </Pressable>

        {isKeyboardVisible ? (
          <View
            style={[
              styles.keyboardActionBar,
              { bottom: keyboardHeight + theme.spacing.sm },
            ]}
          >
            {renderCtaHelperText()}
            {renderAnalyzeButton(styles.keyboardPrimaryButton)}
            {showUpgradeLink ? (
              <MealAddTextLink
                testID="add-meal-text-upgrade-button"
                label={t("limit.upgradeCta", { ns: "chat" })}
                onPress={openPaywall}
                disabled={loading}
              />
            ) : null}
          </View>
        ) : null}

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
      paddingTop: 0,
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
    preview: {
      flex: 1,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: theme.spacing.lg,
      paddingRight: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    previewDescriptionField: {
      flex: 1,
    },
    previewDescriptionInputShell: {
      flex: 1,
      flexShrink: 1,
    },
    previewDescriptionInput: {
      flex: 1,
    },
    primaryButton: {
      minHeight: 48,
      borderRadius: theme.rounded.lg,
    },
    keyboardPrimaryButton: {
      minHeight: 46,
      borderRadius: theme.rounded.lg,
    },
    keyboardActionBar: {
      position: "absolute",
      left: theme.spacing.lg,
      right: theme.spacing.lg,
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      ...theme.depth.floating,
    },
    inlineNote: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
    },
    inlineNoteWarning: {
      color: theme.accentWarm,
    },
    screenCornerNavStyle: {
      top: 0,
    },
  });
