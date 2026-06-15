import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  KeyboardAwareScrollView,
  Layout,
  UnsavedChangesModal,
} from "@/components";
import { useTheme } from "@/theme/useTheme";
import { useMealDetailsForm } from "@/feature/Meals/hooks/useMealDetailsForm";
import type { MealDetailsDraftAdapter } from "@/feature/Meals/hooks/useMealDetailsForm";
import {
  formatMealTime,
  getMealDateOrNow,
} from "@/feature/Meals/hooks/useMealDetailsForm";
import AddMealFlowHeader from "@/feature/Meals/screens/MealAdd/components/AddMealFlowHeader";
import MealDetailsEmptyState from "@/feature/Meals/screens/MealAdd/components/MealDetailsEmptyState";
import MealPhotoSection from "@/feature/Meals/screens/MealAdd/components/MealPhotoSection";
import MealBasicsSection from "@/feature/Meals/screens/MealAdd/components/MealBasicsSection";
import IngredientListSection from "@/feature/Meals/screens/MealAdd/components/IngredientListSection";
import MealDetailsFooter from "@/feature/Meals/screens/MealAdd/components/MealDetailsFooter";
import MealTypePickerModal from "@/feature/Meals/screens/MealAdd/components/MealTypePickerModal";
import MealTimePickerModal from "@/feature/Meals/screens/MealAdd/components/MealTimePickerModal";
import IngredientEditorModal from "@/feature/Meals/screens/MealAdd/components/IngredientEditorModal";
import type { Meal } from "@/types/meal";
import type {
  MealAddEditSubmitIntent,
  MealAddFlowApi,
} from "@/feature/Meals/feature/MapMealAddScreens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthContext } from "@/context/AuthContext";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { RootStackParamList } from "@/navigation/navigate";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

type Mode = "review";
type MealDetailsFormNavigation = Pick<
  NavigationProp<RootStackParamList>,
  "addListener" | "canGoBack" | "dispatch" | "goBack" | "navigate"
>;

type Props = {
  flow: MealAddFlowApi;
  navigation: MealDetailsFormNavigation;
  mode: Mode;
  submitIntent?: MealAddEditSubmitIntent;
  showAddMealFlowHeader?: boolean;
  onReviewSubmit?: (meal: Meal) => Promise<void> | void;
  reviewSubmitLabel?: string;
  reviewFallbackLabel?: string;
  onReviewFallback?: () => void;
  reviewPhotoUri?: string | null;
  reviewPhotoActionLabel?: string;
  onReviewPhotoPress?: () => void;
  draftAdapter?: MealDetailsDraftAdapter;
  onFlowHeaderBack?: () => void;
  onFlowHeaderClose?: () => void;
  flowHeaderExitGuardEnabled?: boolean;
};

export function MealDetailsFormScreen({
  draftAdapter,
  ...props
}: Props) {
  if (draftAdapter) {
    return (
      <MealDetailsFormScreenInner
        {...props}
        draftAdapter={draftAdapter}
      />
    );
  }

  return <MealDetailsFormScreenWithDraftContext {...props} />;
}

function MealDetailsFormScreenWithDraftContext(props: Omit<Props, "draftAdapter">) {
  const { uid } = useAuthContext();
  const { meal, clearMeal, loadDraft, saveDraft, setMeal, setLastScreen } =
    useMealDraftContext();

  useEffect(() => {
    if (uid) {
      void setLastScreen(uid, "EditMealDetails");
    }
  }, [setLastScreen, uid]);

  const draftAdapter = useMemo<MealDetailsDraftAdapter>(
    () => ({
      uid: uid || null,
      meal,
      persistMeal: async (nextMeal: Meal) => {
        setMeal(nextMeal);
        if (uid) {
          await saveDraft(uid, nextMeal);
        }
      },
      clearMeal,
      retryLoadDraft: async () => {
        if (!uid) return;
        await loadDraft(uid);
      },
    }),
    [clearMeal, loadDraft, meal, saveDraft, setMeal, uid],
  );

  return <MealDetailsFormScreenInner {...props} draftAdapter={draftAdapter} />;
}

function MealDetailsFormScreenInner({
  flow,
  navigation,
  mode,
  submitIntent = "replaceReview",
  showAddMealFlowHeader = false,
  onReviewSubmit,
  reviewSubmitLabel,
  reviewFallbackLabel,
  onReviewFallback,
  reviewPhotoUri,
  reviewPhotoActionLabel,
  onReviewPhotoPress,
  onFlowHeaderBack,
  onFlowHeaderClose,
  flowHeaderExitGuardEnabled = true,
  draftAdapter,
}: Omit<Props, "draftAdapter"> & { draftAdapter: MealDetailsDraftAdapter }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["meals", "common"]);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset({ includeSafeArea: true });
  const footerBottomInset = Math.max(insets.bottom, theme.spacing.sm);

  const {
    uid,
    meal,
    mealTimestamp,
    mealName,
    setMealName,
    typePickerVisible,
    typeDraft,
    setTypeDraft,
    timePickerVisible,
    pickerDate,
    setPickerDate,
    editingIngredientIndex,
    ingredientDraft,
    locale,
    prefers12h,
    ingredients,
    retryLoadDraft,
    handleNameBlur,
    handleOpenTypePicker,
    handleCloseTypePicker,
    handleApplyType,
    handleOpenTimePicker,
    handleCloseTimePicker,
    handleSaveTime,
    handleOpenIngredientEditor,
    handleCloseIngredientEditor,
    handleCommitIngredient,
    handleDeleteIngredient,
    handleSubmit,
    canSubmitReview,
  } = useMealDetailsForm({
    mode,
    flow,
    submitIntent,
    onReviewSubmit,
    draftAdapter,
  });
  const shouldUseExitGuard = showAddMealFlowHeader && flowHeaderExitGuardEnabled;
  const guard = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges: Boolean(uid && meal),
    enabled: shouldUseExitGuard,
    interceptHardwareBack: shouldUseExitGuard,
    onDiscard: () => {
      if (!uid) return;
      void draftAdapter.clearMeal?.(uid);
    },
    onExit: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate("Home");
    },
  });

  const selectedAt = getMealDateOrNow(mealTimestamp);
  const mealTypeLabel = t(meal?.type ?? "other", { ns: "meals" });
  const mealTimeLabel = formatMealTime(selectedAt, locale, prefers12h);
  const handleSecondaryFooterAction = () => {
    if (submitIntent === "goBack") {
      flow.goBack();
      return;
    }

    navigation.navigate("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  };
  const handleFlowHeaderBack = onFlowHeaderBack ?? (() => {
    void handleSubmit();
  });
  const handleFlowHeaderClose = onFlowHeaderClose ?? guard.requestExit;

  if (!meal || !uid) {
    return (
      <Layout showNavigation={false}>
        <MealDetailsEmptyState
          uid={uid}
          reviewFallbackLabel={reviewFallbackLabel}
          onRetry={() => {
            void retryLoadDraft();
          }}
          onSecondaryAction={() =>
            (onReviewFallback ?? flow.goBack)()
          }
        />
      </Layout>
    );
  }

  return (
    <Layout
      showNavigation={false}
      disableScroll
      keyboardAvoiding={false}
      style={styles.layout}
    >
      <View style={styles.screen} testID="meal-details-form-screen">
        {showAddMealFlowHeader ? (
          <AddMealFlowHeader
            progress={flow.progress}
            onBack={handleFlowHeaderBack}
            onClose={handleFlowHeaderClose}
            testID="edit-meal-flow-header"
            backTestID="edit-meal-back"
            closeTestID="edit-meal-close"
          />
        ) : null}

        <KeyboardAwareScrollView
          style={styles.scrollArea}
          extraScrollOffset={theme.spacing.xs}
          keyboardShouldPersistTaps="never"
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: showAddMealFlowHeader
                ? theme.spacing.sm
                : theme.spacing.lg,
              paddingBottom:
                theme.spacing.xxxl + 92 + footerBottomInset,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.headerEyebrow}>
              {t("review_meal_edit_eyebrow", {
                ns: "meals",
                defaultValue: "Correction",
              })}
            </Text>
            <Text style={styles.headerTitle}>
              {t("review_meal_edit_title", {
                ns: "meals",
                defaultValue: "Adjust your meal",
              })}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t("review_meal_edit_correction_subtitle", {
                ns: "meals",
                defaultValue:
                  "Adjust only what needs correcting.",
              })}
            </Text>
          </View>

          {onReviewPhotoPress ? (
            <MealPhotoSection
              reviewPhotoUri={reviewPhotoUri}
              reviewPhotoActionLabel={reviewPhotoActionLabel}
              onPress={onReviewPhotoPress}
            />
          ) : null}

          <MealBasicsSection
            mealName={mealName}
            mealTypeLabel={mealTypeLabel}
            mealTimeLabel={mealTimeLabel}
            onMealNameChange={setMealName}
            onMealNameBlur={() => {
              void handleNameBlur();
            }}
            onOpenTypePicker={handleOpenTypePicker}
            onOpenTimePicker={handleOpenTimePicker}
          />

          <IngredientListSection
            ingredients={ingredients}
            onOpenIngredientEditor={handleOpenIngredientEditor}
          />
        </KeyboardAwareScrollView>

        <MealDetailsFooter
          reviewSubmitLabel={reviewSubmitLabel}
          submitIntent={submitIntent}
          footerBottomInset={footerBottomInset}
          keyboardInset={keyboardInset}
          disabled={!onReviewSubmit && !canSubmitReview}
          onSecondaryAction={handleSecondaryFooterAction}
          onSubmit={() => {
            void handleSubmit();
          }}
        />
      </View>

      <MealTypePickerModal
        visible={typePickerVisible}
        typeDraft={typeDraft}
        onTypeDraftChange={setTypeDraft}
        onClose={handleCloseTypePicker}
        onApply={() => {
          void handleApplyType(typeDraft);
        }}
      />

      <MealTimePickerModal
        visible={timePickerVisible}
        prefers12h={prefers12h}
        pickerDate={pickerDate}
        onChangePickerDate={setPickerDate}
        onClose={handleCloseTimePicker}
        onApply={() => {
          void handleSaveTime();
        }}
      />

      <IngredientEditorModal
        visible={ingredientDraft !== null}
        uid={uid}
        locale={locale}
        ingredientDraft={ingredientDraft}
        editingIngredientIndex={editingIngredientIndex}
        onClose={handleCloseIngredientEditor}
        onCommit={(updated) => {
          void handleCommitIngredient(updated);
        }}
        onDelete={() => {
          void handleDeleteIngredient();
        }}
      />

      {shouldUseExitGuard ? (
        <UnsavedChangesModal
          visible={guard.confirmVisible}
          title={t("confirm_exit_title", { ns: "meals" })}
          message={t("confirm_exit_message", { ns: "meals" })}
          discardLabel={t("leave", { ns: "common" })}
          continueEditingLabel={t("cancel", { ns: "common" })}
          onDiscard={guard.confirmExit}
          onContinueEditing={guard.cancelExit}
        />
      ) : null}
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingLeft: theme.spacing.screenPaddingWide,
      paddingRight: theme.spacing.screenPaddingWide,
      paddingBottom: 0,
    },
    screen: {
      flex: 1,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      gap: theme.spacing.sm,
    },
    headerBlock: {
      gap: theme.spacing.xxs,
      paddingBottom: theme.spacing.xs,
    },
    headerEyebrow: {
      color: theme.primary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
      textTransform: "uppercase",
    },
    headerTitle: {
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.bold,
    },
    headerSubtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      maxWidth: 330,
    },
  });
