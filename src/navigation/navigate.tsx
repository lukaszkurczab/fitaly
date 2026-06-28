import { createNavigationContainerRef, CommonActions } from "@react-navigation/native";
import type { Meal } from "@/types";

export type RootStackParamList = {
  AddMeal:
    | {
        start?:
          | "CameraDefault"
          | "BarcodeScan"
          | "DescribeMeal"
          | "ReviewMeal"
          | "EditMealDetails"
          | "SelectSavedMeal";
        id?: string;
        skipDetection?: boolean;
        attempt?: number;
        fullscreenPreferred?: boolean;
        code?: string;
        showManualEntry?: boolean;
        image?: string;
        submitIntent?: "goBack" | "replaceReview";
        reason?:
          | "not_recognized"
          | "ai_unavailable"
          | "offline"
          | "timeout";
      }
    | undefined;

  Home: undefined;
  WeeklyReport: undefined;
  Login: undefined;
  CheckMailbox: { email: string };
  ChangeEmailCheckMailbox: { email: string };
  Onboarding: { mode?: "first" | "refill" } | undefined;
  OnboardingRefill: { mode?: "refill" } | undefined;
  Profile: undefined;
  ResetPassword: undefined;
  Terms: undefined;
  MealAddMethod:
    | {
        selectionMode?: "persistDefault" | "temporary";
        origin?: "default" | "mealAddFlow";
      }
    | undefined;
  Statistics: undefined;
  Privacy: undefined;
  ManageSubscription: undefined;
  LegalPrivacyHub: undefined;
  PrivacyAiSettings: undefined;
  DataAiClarity: undefined;
  MemoryCenter: undefined;
  RecipeCatalog: undefined;
  Planning: undefined;
  HelpFeedback: undefined;
  ContactSupport: undefined;
  AppSettings: undefined;
  ChangePassword: undefined;
  SendFeedback: undefined;
  Language: undefined;
  UsernameChange: undefined;
  Register: undefined;
  SavedMeals: undefined;
  EditUserData: undefined;
  DeleteAccount: undefined;
  ChangeEmail: undefined;
  ProfilePhotoPreview: undefined;
  AvatarCamera: { returnDepth?: number } | undefined;
  HistoryList: undefined;
  Chat: undefined;
  Notifications: undefined;
  Loading: undefined;
  MealDetails: {
    cloudId: string;
  };
  EditHistoryMealDetails: { cloudId: string };
  MealShare: { meal: Meal; returnTo: "MealDetails" | "ReviewMeal" };
  SavedMealsCamera:
    | {
        id?: string;
        meal?: Meal;
        returnTo?: "MealDetails" | "EditHistoryMealDetails";
      }
    | undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
let navigationReady = false;
const pendingNavigationOperations: Array<() => void> = [];

function flushPendingNavigationOperations(): void {
  if (!navigationReady || !navigationRef.isReady()) {
    return;
  }

  while (pendingNavigationOperations.length > 0) {
    const operation = pendingNavigationOperations.shift();
    operation?.();

    if (!navigationReady || !navigationRef.isReady()) {
      return;
    }
  }
}

function runOrQueueNavigationOperation(operation: () => void): void {
  if (!navigationReady || !navigationRef.isReady()) {
    pendingNavigationOperations.push(operation);
    return;
  }

  operation();
}

export function markNavigationReady(): void {
  navigationReady = true;
  flushPendingNavigationOperations();
}

export function markNavigationUnavailable(): void {
  navigationReady = false;
}

export function getCurrentRouteNameSafe():
  | keyof RootStackParamList
  | undefined {
  if (!navigationReady || !navigationRef.isReady()) {
    return undefined;
  }

  try {
    return navigationRef.getCurrentRoute()?.name;
  } catch {
    return undefined;
  }
}

type ScreenNames = keyof RootStackParamList;
type ScreensWithOptionalParams = {
  [Name in ScreenNames]: undefined extends RootStackParamList[Name]
    ? Name
    : never;
}[ScreenNames];
type ScreensWithRequiredParams = Exclude<ScreenNames, ScreensWithOptionalParams>;

export function navigate<Name extends ScreensWithOptionalParams>(
  name: Name,
  params?: RootStackParamList[Name],
): void;
export function navigate<Name extends ScreensWithRequiredParams>(
  name: Name,
  params: RootStackParamList[Name],
): void;
export function navigate<Name extends ScreenNames>(
  name: Name,
  params?: RootStackParamList[Name],
): void {
  runOrQueueNavigationOperation(() => {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: name as string,
        params,
      }),
    );
  });
}

export function resetNavigation<Name extends ScreensWithOptionalParams>(
  name: Name,
  params?: RootStackParamList[Name],
): void;
export function resetNavigation<Name extends ScreensWithRequiredParams>(
  name: Name,
  params: RootStackParamList[Name],
): void;
export function resetNavigation<Name extends ScreenNames>(
  name: Name,
  params?: RootStackParamList[Name],
): void {
  runOrQueueNavigationOperation(() => {
    navigationRef.reset({ index: 0, routes: [{ name, params }] });
  });
}

export function __resetNavigationForTests(): void {
  navigationReady = false;
  pendingNavigationOperations.length = 0;
}
