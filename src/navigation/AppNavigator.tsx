import { useEffect, useRef } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { RootStackParamList } from "./navigate";
import { useAuthContext } from "@/context/AuthContext";
import { useUserProfileContext } from "@/context/UserProfileContext";
import HomeScreen from "@/feature/Home/screens/HomeScreen";
import WeeklyReportScreen from "@/feature/Home/screens/WeeklyReportScreen";
import HistoryListScreen from "@/feature/History/screens/HistoryListScreen";
import StatisticsScreen from "@/feature/Statistics/screens/StatisticsScreen";
import LoginScreen from "@/feature/Auth/screens/LoginScreen";
import RegisterScreen from "@/feature/Auth/screens/RegisterScreen";
import MealAddMethodScreen from "@/feature/Meals/screens/MealAddMethodScreen";
import ProfileScreen from "@feature/UserProfile/screens/UserProfileScreen";
import TermsScreen from "@/feature/Auth/screens/TermsScreen";
import PrivacyScreen from "@/feature/Auth/screens/PrivacyScreen";
import ResetPasswordScreen from "@/feature/Auth/screens/ResetPasswordScreen";
import CheckMailboxScreen from "@/feature/Auth/screens/CheckMailboxScreen";
import OnboardingScreen from "@/feature/Onboarding/screens/OnboardingScreen";
import LoadingScreen from "@/screens/LoadingScreen";
import MealDetailsScreen from "@/feature/History/screens/MealDetailsScreen";
import EditHistoryMealDetailsScreen from "@/feature/History/screens/EditHistoryMealDetailsScreen";
import EditUserDataScreen from "@/feature/UserProfile/screens/EditUserDataScreen";
import ProfilePhotoPreviewScreen from "@/feature/UserProfile/screens/ProfilePhotoPreviewScreen";
import AvatarCameraScreen from "@/feature/UserProfile/screens/AvatarCameraScreen";
import UsernameChangeScreen from "@/feature/UserProfile/screens/UsernameChangeScreen";
import ChangeEmailScreen from "@/feature/UserProfile/screens/ChangeEmailScreen";
import ChangeEmailCheckMailboxScreen from "@/feature/UserProfile/screens/ChangeEmailCheckMailboxScreen";
import ChangePasswordScreen from "@/feature/UserProfile/screens/ChangePasswordScreen";
import LanguageScreen from "@/feature/UserProfile/screens/LanguageScreen";
import SendFeedbackScreen from "@/feature/UserProfile/screens/SendFeedbackScreen";
import LegalPrivacyHubScreen from "@/feature/UserProfile/screens/LegalPrivacyHubScreen";
import DataAiClarityScreen from "@/feature/UserProfile/screens/DataAiClarityScreen";
import HelpFeedbackHubScreen from "@/feature/UserProfile/screens/HelpFeedbackHubScreen";
import ContactSupportScreen from "@/feature/UserProfile/screens/ContactSupportScreen";
import AppSettingsScreen from "@/feature/UserProfile/screens/AppSettingsScreen";
import ManageSubscriptionScreen from "@/feature/Subscription/screens/ManageSubscriptionScreen";
import SavedMealsScreen from "@/feature/History/screens/SavedMealsScreen";
import SelectSavedMealScreen from "@/feature/Meals/screens/SelectSavedMealsScreen";
import NotificationsScreen from "@/feature/UserProfile/screens/NotificationsScreen";
import DeleteAccountScreen from "@/feature/UserProfile/screens/DeleteAccountScreen";
import MealShareScreen from "@/feature/Meals/screens/MealShareScreen";
import ChatScreen from "@/feature/AI/screens/ChatScreen";
import SavedMealsCameraScreen from "@/feature/History/screens/SavedMealsCameraScreen";
import AddMealScreen from "@feature/Meals/screens/AddMealScreen";
import { isE2EModeEnabled } from "@/services/e2e/config";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ensureStreakDoc, resetIfMissed } from "@/services/gamification/streakService";
import { primeBadges } from "@/services/gamification/badgeService";
import { logWarning } from "@/services/core/errorLogger";
import { authLogout } from "@/feature/Auth/services/authService";
import {
  resolveBootstrapState,
  resolveInitialRouteName,
  shouldRenderProfileGateStack,
  shouldRenderProductStack,
} from "@/navigation/appNavigatorState";

const Stack = createStackNavigator<RootStackParamList>();

function renderAuthScreens() {
  return (
    <>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="CheckMailbox" component={CheckMailboxScreen} />
    </>
  );
}

function renderAppScreens({
  onboardingMode = "first",
}: {
  onboardingMode?: "first" | "refill";
} = {}) {
  return (
    <>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
      <Stack.Screen name="SavedMeals" component={SavedMealsScreen} />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        initialParams={{ mode: onboardingMode }}
      />
      <Stack.Screen name="AvatarCamera" component={AvatarCameraScreen} />
      <Stack.Screen
        name="ProfilePhotoPreview"
        component={ProfilePhotoPreviewScreen}
      />
      <Stack.Screen name="HistoryList" component={HistoryListScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Statistics" component={StatisticsScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="EditUserData" component={EditUserDataScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="MealDetails" component={MealDetailsScreen} />
      <Stack.Screen
        name="EditHistoryMealDetails"
        component={EditHistoryMealDetailsScreen}
      />
      <Stack.Screen
        name="SelectSavedMeal"
        component={SelectSavedMealScreen}
      />
      <Stack.Screen
        name="UsernameChange"
        component={UsernameChangeScreen}
      />
      <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
      <Stack.Screen
        name="ChangeEmailCheckMailbox"
        component={ChangeEmailCheckMailboxScreen}
      />
      <Stack.Screen
        name="ManageSubscription"
        component={ManageSubscriptionScreen}
      />
      <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
      <Stack.Screen
        name="LegalPrivacyHub"
        component={LegalPrivacyHubScreen}
      />
      <Stack.Screen
        name="DataAiClarity"
        component={DataAiClarityScreen}
      />
      <Stack.Screen name="HelpFeedback" component={HelpFeedbackHubScreen} />
      <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
      />
      <Stack.Screen name="SendFeedback" component={SendFeedbackScreen} />
      <Stack.Screen
        name="MealAddMethod"
        component={MealAddMethodScreen}
        options={{
          presentation: "transparentModal",
          cardStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen name="AddMeal" component={AddMealScreen} />
      <Stack.Screen
        name="SavedMealsCamera"
        component={SavedMealsCameraScreen}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="MealShare" component={MealShareScreen} />
    </>
  );
}

function renderOnboardingGateScreens({
  onboardingMode = "first",
}: {
  onboardingMode?: "first" | "refill";
} = {}) {
  return (
    <>
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        initialParams={{ mode: onboardingMode }}
      />
    </>
  );
}

function renderSharedScreens() {
  return (
    <>
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
    </>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, authLoading, uid } = useAuthContext();
  const { userData, profileBootstrapState } = useUserProfileContext();
  const disableAnimations = isE2EModeEnabled();
  const primedUidRef = useRef<string | null>(null);
  const missingProfileLogoutUidRef = useRef<string | null>(null);
  const bootstrapState = resolveBootstrapState({
    authLoading,
    isAuthenticated,
    profileBootstrapState,
  });
  const initialRouteName = resolveInitialRouteName(
    bootstrapState,
    userData?.profile.readiness.status,
  );
  const renderProductStack = shouldRenderProductStack(
    bootstrapState,
    userData?.profile.readiness.status,
  );

  useEffect(() => {
    if (!renderProductStack || !userData?.uid) {
      return;
    }
    if (primedUidRef.current === userData.uid) {
      return;
    }
    primedUidRef.current = userData.uid;

    void (async () => {
      try {
        await ensureStreakDoc(userData.uid);
        await resetIfMissed(userData.uid);
        await primeBadges(userData.uid);
      } catch (error) {
        logWarning("post-bootstrap user runtime priming failed", {
          uid: userData.uid,
          bootstrapState,
        }, error);
      }
    })();
  }, [bootstrapState, renderProductStack, userData?.uid]);

  useEffect(() => {
    if (bootstrapState !== "profileMissing" || !uid) {
      return;
    }
    if (missingProfileLogoutUidRef.current === uid) {
      return;
    }
    missingProfileLogoutUidRef.current = uid;

    void authLogout().catch((error) => {
      logWarning("profile missing logout failed", { uid }, error);
    });
  }, [bootstrapState, uid]);

  const showAuthStack =
    bootstrapState === "unauthenticated" || bootstrapState === "profileMissing";
  const showProfileStack = shouldRenderProfileGateStack(bootstrapState);

  return (
    <ErrorBoundary>
      <Stack.Navigator
        key={`${bootstrapState}:${renderProductStack ? "product" : "gate"}`}
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          animation: disableAnimations ? "none" : "default",
        }}
      >
        {showAuthStack
          ? renderAuthScreens()
          : showProfileStack
            ? renderProductStack
              ? renderAppScreens({
                  onboardingMode: "first",
                })
              : renderOnboardingGateScreens({
                  onboardingMode: "first",
                })
            : <Stack.Screen name="Loading" component={LoadingScreen} />}
        {renderSharedScreens()}
      </Stack.Navigator>
    </ErrorBoundary>
  );
}
