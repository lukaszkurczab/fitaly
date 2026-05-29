import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { MealDetailsFormScreen } from "./MealDetailsFormScreen";
import { pickMealPhotoUri } from "@/utils/mealImage";

export default function EditMealDetailsScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"EditMealDetails">) {
  const { meal } = useMealDraftContext();
  const reviewPhotoUri = pickMealPhotoUri(meal);

  return (
    <MealDetailsFormScreen
      navigation={navigation}
      flow={flow}
      mode="review"
      submitIntent={params.submitIntent}
      showAddMealFlowHeader
      reviewPhotoUri={reviewPhotoUri}
      onReviewPhotoPress={() => {
        if (!meal?.mealId) return;
        flow.goTo("CameraDefault", {
          id: meal.mealId,
          skipDetection: true,
        });
      }}
    />
  );
}
