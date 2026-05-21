import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { KeyboardAwareScrollView, Layout } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { useMealDetailsForm } from "@/feature/Meals/hooks/useMealDetailsForm";
import type { MealDetailsDraftAdapter } from "@/feature/Meals/hooks/useMealDetailsForm";
import {
  formatMealTime,
  getMealDateOrNow,
} from "@/feature/Meals/hooks/useMealDetailsForm";
import MealDetailsEmptyState from "@/feature/Meals/screens/MealAdd/components/MealDetailsEmptyState";
import MealPhotoSection from "@/feature/Meals/screens/MealAdd/components/MealPhotoSection";
import MealBasicsSection from "@/feature/Meals/screens/MealAdd/components/MealBasicsSection";
import IngredientListSection from "@/feature/Meals/screens/MealAdd/components/IngredientListSection";
import MealDetailsFooter from "@/feature/Meals/screens/MealAdd/components/MealDetailsFooter";
import MealTypePickerModal from "@/feature/Meals/screens/MealAdd/components/MealTypePickerModal";
import MealTimePickerModal from "@/feature/Meals/screens/MealAdd/components/MealTimePickerModal";
import IngredientEditorModal from "@/feature/Meals/screens/MealAdd/components/IngredientEditorModal";
import type { Meal } from "@/types/meal";
import type { MealAddFlowApi } from "@/feature/Meals/feature/MapMealAddScreens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthContext } from "@/context/AuthContext";
import { useMealDraftContext } from "@contexts/MealDraftContext";

type Mode = "review";

type Props = {
  flow: MealAddFlowApi;
  navigation: {
    navigate: (
      screen: "Home" | "MealAddMethod",
      params?: { selectionMode: "temporary"; origin: "mealAddFlow" },
    ) => void;
  };
  mode: Mode;
  onReviewSubmit?: (meal: Meal) => Promise<void> | void;
  reviewSubmitLabel?: string;
  reviewFallbackLabel?: string;
  onReviewFallback?: () => void;
  reviewPhotoUri?: string | null;
  reviewPhotoActionLabel?: string;
  onReviewPhotoPress?: () => void;
  draftAdapter?: MealDetailsDraftAdapter;
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
  const { meal, loadDraft, saveDraft, setMeal, setLastScreen } =
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
      retryLoadDraft: async () => {
        if (!uid) return;
        await loadDraft(uid);
      },
    }),
    [loadDraft, meal, saveDraft, setMeal, uid],
  );

  return <MealDetailsFormScreenInner {...props} draftAdapter={draftAdapter} />;
}

function MealDetailsFormScreenInner({
  flow,
  mode,
  onReviewSubmit,
  reviewSubmitLabel,
  reviewFallbackLabel,
  onReviewFallback,
  reviewPhotoUri,
  reviewPhotoActionLabel,
  onReviewPhotoPress,
  draftAdapter,
}: Omit<Props, "draftAdapter"> & { draftAdapter: MealDetailsDraftAdapter }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["meals", "common"]);
  const insets = useSafeAreaInsets();
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
  } = useMealDetailsForm({
    mode,
    flow,
    onReviewSubmit,
    draftAdapter,
  });

  const selectedAt = getMealDateOrNow(mealTimestamp);
  const mealTypeLabel = t(meal?.type ?? "other", { ns: "meals" });
  const mealTimeLabel = formatMealTime(selectedAt, locale, prefers12h);

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
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <View style={styles.screen} testID="meal-details-form-screen">
        <KeyboardAwareScrollView
          style={styles.scrollArea}
          extraScrollOffset={theme.spacing.xs}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                theme.spacing.xxxl + 92 + footerBottomInset,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
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
          footerBottomInset={footerBottomInset}
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
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingLeft: theme.spacing.screenPaddingWide,
      paddingRight: theme.spacing.screenPaddingWide,
    },
    screen: {
      flex: 1,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      gap: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
  });
