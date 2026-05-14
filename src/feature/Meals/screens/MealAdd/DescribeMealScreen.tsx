import { useMemo } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  ErrorBox,
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

const TEXT_PREVIEW_HEIGHT = 441;

export default function DescribeMealScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"DescribeMeal">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(["meals", "chat", "common"]);
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
    if (analysisState === "missing_description") {
      return t("text_ai_cta_missing_description", {
        ns: "meals",
        defaultValue: "Add a meal description to prepare a summary.",
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
        defaultValue:
          "You do not have enough AI Credits to prepare a summary.",
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

  return (
    <>
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <Pressable style={styles.fill} onPress={Keyboard.dismiss}>
          <MealAddPhotoScaffold
            topInset={previewTopInset}
            previewHeight={TEXT_PREVIEW_HEIGHT}
            preview={
              <View style={styles.preview}>
                <TextInput
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
                  numberOfLines={10}
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  spellCheck={false}
                  maxLength={300}
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
                  <ErrorBox message={descriptionError ?? submitError ?? ""} />
                ) : null}
                <Button
                  label={t("describe_meal_primary_cta", { ns: "meals" })}
                  onPress={onAnalyze}
                  disabled={analyzeDisabled}
                  loading={loading}
                  style={styles.primaryButton}
                />
                {ctaHelperText ? (
                  <Text
                    style={[
                      styles.inlineNote,
                      creditsNoteWarning ? styles.inlineNoteWarning : null,
                    ]}
                  >
                    {ctaHelperText}
                  </Text>
                ) : null}
                {showUpgradeLink ? (
                  <MealAddTextLink
                    label={t("limit.upgradeCta", { ns: "chat" })}
                    onPress={openPaywall}
                    disabled={loading}
                  />
                ) : null}
                <MealAddTextLink
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
          />
        </Pressable>

        <Modal
          visible={showLimitModal}
          title={t("limit.reachedTitle", { ns: "chat" })}
          message={t("limit.reachedShort", {
            ns: "chat",
            used: creditsUsed,
            limit: creditAllocation,
          })}
          primaryAction={{
            label: t("limit.upgradeCta", { ns: "chat" }),
            onPress: openPaywall,
          }}
          secondaryAction={{
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
      backgroundColor: theme.surface,
    },
    preview: {
      flex: 1,
      backgroundColor: theme.backgroundSecondary,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 24,
      gap: theme.spacing.md,
    },
    previewNameField: {
      marginBottom: 24,
    },
    previewDescriptionField: {
      flex: 1,
    },
    primaryButton: {
      minHeight: 48,
      borderRadius: theme.rounded.sm,
    },
    inlineNote: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
      marginTop: theme.spacing.xs,
    },
    inlineNoteWarning: {
      color: theme.accentWarm,
    },
    screenCornerNavStyle: {
      top: 0,
    },
  });
