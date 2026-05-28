import BarcodeScanScreen from "../screens/MealAdd/BarcodeScanScreen";
import DescribeMealScreen from "../screens/MealAdd/DescribeMealScreen";
import EditMealDetailsScreen from "../screens/MealAdd/EditMealDetailsScreen";
import IngredientsNotRecognizedScreen from "../screens/MealAdd/IngredientsNotRecognizedScreen";
import MealCameraScreen from "../screens/MealAdd/MealCameraScreen";
import PreparingReviewPhotoScreen from "../screens/MealAdd/PreparingReviewPhotoScreen";
import ReviewMealScreen from "../screens/MealAdd/ReviewMealScreen";
import SelectSavedMealScreen from "../screens/SelectSavedMealsScreen";
import TextAnalyzingScreen from "../screens/MealAdd/TextAnalyzingScreen";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import type { MealAddFlowProgress } from "@/feature/Meals/utils/mealAddFlowProgress";

export type MealAddScreenName =
  | "CameraDefault"
  | "BarcodeScan"
  | "PreparingReviewPhoto"
  | "DescribeMeal"
  | "TextAnalyzing"
  | "ReviewMeal"
  | "EditMealDetails"
  | "SelectSavedMeal"
  | "IngredientsNotRecognized";

export type MealAddSimulatorCreditsState = "ok" | "low" | "none";

export type MealAddSimulatorReviewState =
  | "success"
  | "slow"
  | "failed"
  | "offline";

export type MealAddBarcodeCodeSource = "scan" | "manual";

export type MealAddTextIngredientInput = {
  id: string;
  name: string;
  amount: string;
};

export type MealAddStepParams = {
  CameraDefault: {
    id?: string;
    skipDetection?: boolean;
    attempt?: number;
    fullscreenPreferred?: boolean;
    showPremiumModal?: boolean;
    simulatorCreditsState?: MealAddSimulatorCreditsState;
    simulatorReviewState?: MealAddSimulatorReviewState;
  };
  BarcodeScan: {
    code?: string;
    codeSource?: MealAddBarcodeCodeSource;
    showManualEntry?: boolean;
  };
  PreparingReviewPhoto: {
    image: string;
    id?: string;
    attempt?: number;
    simulatorCreditsState?: MealAddSimulatorCreditsState;
    simulatorReviewState?: MealAddSimulatorReviewState;
  };
  DescribeMeal: {
    name?: string;
    quickDescription?: string;
    textIngredients?: MealAddTextIngredientInput[];
    servingAmount?: string;
    retries?: number;
    nameError?: string;
    submitError?: string;
    showLimitModal?: boolean;
  };
  TextAnalyzing: {
    analysisRequestId: string;
    name: string;
    quickDescription: string;
    textIngredients?: MealAddTextIngredientInput[];
    servingAmount?: string;
    retries?: number;
  };
  ReviewMeal: Record<string, never>;
  EditMealDetails: Record<string, never>;
  SelectSavedMeal: Record<string, never>;
  IngredientsNotRecognized: {
    image?: string;
    id?: string;
    attempt?: number;
    reason?: "not_recognized" | "ai_unavailable" | "offline" | "timeout";
  };
};

export type MealAddFlowApi = {
  goTo: <N extends MealAddScreenName>(
    name: N,
    params?: MealAddStepParams[N],
  ) => void;
  replace: <N extends MealAddScreenName>(
    name: N,
    params?: MealAddStepParams[N],
  ) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  goBackOrExit?: () => void;
  progress?: MealAddFlowProgress;
};

export type MealAddScreenProps<N extends MealAddScreenName> = {
  navigation: StackNavigationProp<RootStackParamList, "AddMeal">;
  flow: MealAddFlowApi;
  params: MealAddStepParams[N];
};

const MapMealAddScreens = (screenName: MealAddScreenName) => {
  switch (screenName) {
    case "CameraDefault":
      return MealCameraScreen;
    case "BarcodeScan":
      return BarcodeScanScreen;
    case "PreparingReviewPhoto":
      return PreparingReviewPhotoScreen;
    case "DescribeMeal":
      return DescribeMealScreen;
    case "TextAnalyzing":
      return TextAnalyzingScreen;
    case "ReviewMeal":
      return ReviewMealScreen;
    case "EditMealDetails":
      return EditMealDetailsScreen;
    case "SelectSavedMeal":
      return SelectSavedMealScreen;
    case "IngredientsNotRecognized":
      return IngredientsNotRecognizedScreen;
    default:
      throw new Error(`Unknown screen: ${screenName}`);
  }
};

export default MapMealAddScreens;
