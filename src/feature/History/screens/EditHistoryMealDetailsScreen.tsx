import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "@/context/AuthContext";
import { useMeals } from "@/hooks/useMeals";
import type { RootStackParamList } from "@/navigation/navigate";
import { MealDetailsFormScreen } from "@/feature/Meals/screens/MealAdd/MealDetailsFormScreen";
import type { MealAddFlowApi } from "@/feature/Meals/feature/MapMealAddScreens";
import type { Meal } from "@/types/meal";
import { pickMealPhotoUri } from "@/utils/mealImage";
import {
  selectLocalMealByCloudId,
  subscribeLocalMeals,
} from "@/services/meals/localMealsStore";

type EditHistoryMealDetailsNavigation = StackNavigationProp<
  RootStackParamList,
  "EditHistoryMealDetails"
>;
type EditHistoryMealDetailsRoute = RouteProp<
  RootStackParamList,
  "EditHistoryMealDetails"
>;

function buildEditMeal(meal: Meal): Meal {
  return {
    ...meal,
    localPhotoUrl:
      meal.localPhotoUrl ?? meal.photoLocalPath ?? meal.photoUrl ?? null,
    photoLocalPath:
      meal.photoLocalPath ?? meal.localPhotoUrl ?? meal.photoUrl ?? null,
  };
}

export default function EditHistoryMealDetailsScreen({
  navigation,
}: {
  navigation: EditHistoryMealDetailsNavigation;
}) {
  const route = useRoute<EditHistoryMealDetailsRoute>();
  const { t } = useTranslation(["common", "meals"]);
  const { uid } = useAuthContext();
  const { updateMeal } = useMeals(uid || "");
  const mealCloudId = route.params.cloudId;
  const [editMeal, setEditMeal] = useState<Meal | null>(null);

  const reloadFromLocal = useCallback(() => {
    if (!uid || !mealCloudId) {
      setEditMeal(null);
      return;
    }

    const localMeal = selectLocalMealByCloudId(uid, mealCloudId);
    setEditMeal(localMeal ? buildEditMeal(localMeal) : null);
  }, [mealCloudId, uid]);

  useEffect(() => {
    reloadFromLocal();

    if (!uid) return undefined;
    return subscribeLocalMeals(uid, reloadFromLocal);
  }, [reloadFromLocal, uid]);

  const flow = useMemo<MealAddFlowApi>(
    () => ({
      goTo: () => {},
      replace: () => {},
      goBack: () => {
        navigation.goBack();
      },
      canGoBack: () => true,
    }),
    [navigation],
  );

  const handleReviewSubmit = useCallback(
    async (meal: Meal) => {
      await updateMeal({
        ...meal,
        userUid: uid || meal.userUid,
        cloudId: meal.cloudId || mealCloudId,
        localPhotoUrl: undefined,
      });
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("HistoryList");
      }
    },
    [mealCloudId, navigation, uid, updateMeal],
  );
  const handleCancelEdit = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const reviewPhotoUri = pickMealPhotoUri(editMeal);
  const draftAdapter = useMemo(
    () => ({
      uid: uid || null,
      meal: editMeal,
      persistMeal: (nextMeal: Meal) => {
        setEditMeal(nextMeal);
      },
      retryLoadDraft: reloadFromLocal,
    }),
    [editMeal, reloadFromLocal, uid],
  );

  return (
    <MealDetailsFormScreen
      navigation={navigation}
      flow={flow}
      mode="review"
      submitIntent="goBack"
      showAddMealFlowHeader
      onReviewSubmit={handleReviewSubmit}
      reviewSubmitLabel={t("save_changes", {
        ns: "common",
        defaultValue: "Save changes",
      })}
      reviewFallbackLabel={t("cancel", {
        ns: "common",
        defaultValue: "Cancel",
      })}
      onReviewFallback={handleCancelEdit}
      onFlowHeaderBack={handleCancelEdit}
      onFlowHeaderClose={handleCancelEdit}
      flowHeaderExitGuardEnabled={false}
      reviewPhotoUri={reviewPhotoUri}
      reviewPhotoActionLabel={t("add_photo", {
        ns: "meals",
        defaultValue: "Add photo",
      })}
      onReviewPhotoPress={() => {
        const currentMeal = editMeal;
        if (!currentMeal) return;
        navigation.replace("SavedMealsCamera", {
          id: currentMeal.cloudId,
          meal: currentMeal,
          returnTo: "EditHistoryMealDetails",
        });
      }}
      draftAdapter={draftAdapter}
    />
  );
}
