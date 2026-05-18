import "@/i18n";
import "@/FirebaseConfig";
import "react-native-get-random-values";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SplashScreen from "expo-splash-screen";

import { ThemeController } from "@/theme/ThemeController";
import AppNavigator from "@/navigation/AppNavigator";
import { NavigationContainer } from "@react-navigation/native";
import {
  markNavigationReady,
  markNavigationUnavailable,
  navigationRef,
} from "@/navigation/navigate";
import { AuthProvider } from "@/context/AuthContext";
import { useAuthContext } from "@/context/AuthContext";
import { UserProvider } from "@/context/UserContext";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { MealDraftProvider } from "@/context/MealDraftContext";
import { PremiumProvider } from "@/context/PremiumContext";
import { HistoryProvider } from "@/context/HistoryContext";
import { AiCreditsProvider } from "@/context/AiCreditsContext";
import { AccessProvider } from "@/context/AccessContext";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  Linking,
} from "react-native";
import { useEffect, useRef } from "react";
import { useAppFonts } from "@hooks/useAppFonts";
import { ToastBridge } from "@/components";
import { isE2EModeEnabled } from "@/services/e2e/config";
import { handleE2EDeepLink } from "@/services/e2e/deepLink";
import { E2EStatusOverlay } from "@/services/e2e/status";
import {
  initNotificationTelemetry,
  stopNotificationTelemetry,
} from "@/services/notifications/notificationTelemetry";
import { initNotificationPresentationPolicy } from "@/services/notifications/notificationPresentationPolicy";
import {
  initTelemetryClient,
  stopTelemetryClient,
} from "@/services/telemetry/telemetryClient";
import {
  initTelemetryLifecycle,
  stopTelemetryLifecycle,
} from "@/services/telemetry/telemetryLifecycle";
import {
  initReminderRuntime,
  setReminderRuntimeUid,
  stopReminderRuntime,
} from "@/services/reminders/reminderRuntime";
import {
  initMealSideEffectsRuntime,
  setMealSideEffectsRuntimeUid,
  stopMealSideEffectsRuntime,
} from "@/services/meals/mealSideEffectsRuntime";
import { sanitizeSentryEvent } from "@/services/core/loggingPrivacy";
import { captureException, logWarning } from "@/services/core/errorLogger";
import { warnMissingEnv } from "@/services/core/envValidation";
import { getLaunchReadinessIssue } from "@/services/release/launchReadiness";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useProductReadiness } from "@/hooks/useProductReadiness";
import { shouldHideNativeSplash } from "@/services/core/splashReadiness";

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
const sentryDsn = typeof extra?.sentryDsn === "string" ? extra.sentryDsn : "";
const sentryEnvironment =
  typeof extra?.sentryEnvironment === "string"
    ? extra.sentryEnvironment
    : "development";
const isPhysicalDevice = Device.isDevice === true;
const shouldDisableSentryReplay = !isPhysicalDevice;
const shouldEnableSentryDebug = sentryEnvironment !== "production" && isPhysicalDevice;
const shouldTrackAppHangs = sentryEnvironment === "production";
let nativeSplashHidden = false;

void SplashScreen.preventAutoHideAsync().catch((error) => {
  logWarning("native splash prevent auto hide failed", null, error);
});

function runBestEffortStartupTask(
  taskName: string,
  task: () => Promise<void>,
): void {
  void task().catch((error) => {
    logWarning("startup_task_failed", { taskName }, error);
  });
}

function hideNativeSplash(reason: string): void {
  if (nativeSplashHidden) return;
  nativeSplashHidden = true;

  void SplashScreen.hideAsync().catch((error) => {
    nativeSplashHidden = false;
    logWarning("native splash hide failed", { reason }, error);
  });
}

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,
    enableNative: true,
    enableAppHangTracking: shouldTrackAppHangs,
    appHangTimeoutInterval: 5,
    sendDefaultPii: false,
    tracesSampleRate: sentryEnvironment === "production" ? 0.05 : 0.0,
    attachStacktrace: true,
    debug: shouldEnableSentryDebug,
    beforeSend: (event) => sanitizeSentryEvent(event),
    ...(shouldDisableSentryReplay
      ? {
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0,
        }
      : {}),
    integrations: (defaultIntegrations) =>
      defaultIntegrations.filter(
        (integration) =>
          integration.name !== "ExpoUpdatesListener" &&
          (!shouldDisableSentryReplay || integration.name !== "MobileReplay"),
      ),
  });
}

function Root() {
  const fontsLoaded = useAppFonts();
  const launchIssueLoggedRef = useRef(false);
  const launchReadinessIssue = getLaunchReadinessIssue();

  useEffect(() => {
    warnMissingEnv();
  }, []);

  useEffect(() => {
    if (!launchReadinessIssue || launchIssueLoggedRef.current) {
      return;
    }
    launchIssueLoggedRef.current = true;
    captureException("launch_readiness_blocked", {
      reason: launchReadinessIssue,
    });
  }, [launchReadinessIssue]);

  useEffect(() => {
    if (launchReadinessIssue) {
      hideNativeSplash("launch_readiness_blocked");
    }
  }, [launchReadinessIssue]);

  useEffect(() => {
    if (launchReadinessIssue) {
      return;
    }

    let cancelled = false;
    const bootTask = setTimeout(() => {
      runBestEffortStartupTask("app_runtime_bootstrap", async () => {
        if (cancelled) return;
        await initTelemetryClient();
        if (cancelled) return;
        initNotificationPresentationPolicy();
        initNotificationTelemetry();
        await initTelemetryLifecycle();
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(bootTask);
      stopMealSideEffectsRuntime();
      stopReminderRuntime();
      stopNotificationTelemetry();
      stopTelemetryLifecycle();
      stopTelemetryClient();
    };
  }, [launchReadinessIssue]);

  useEffect(() => {
    return () => {
      markNavigationUnavailable();
    };
  }, []);

  useEffect(() => {
    if (launchReadinessIssue) return;
    if (!isE2EModeEnabled()) return;

    const handleUrl = (url: string) => {
      void handleE2EDeepLink(url);
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    }).catch(() => {
      // Initial URL is optional and not required in every launch.
    });

    const sub = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => {
      sub.remove();
    };
  }, [launchReadinessIssue]);

  if (launchReadinessIssue) {
    return (
      <View style={styles.launchBlockedContainer}>
        <Text style={styles.launchBlockedTitle}>Launch readiness blocked</Text>
        <Text style={styles.launchBlockedMessage}>{launchReadinessIssue}</Text>
      </View>
    );
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        markNavigationReady();
      }}
    >
      <UserProvider>
        <NativeSplashGate
          fontsLoaded={fontsLoaded}
          launchReadinessIssue={launchReadinessIssue}
        />
        <ProductRuntimeBootstrap launchReadinessIssue={launchReadinessIssue} />
        <AccessProvider>
          <AiCreditsProvider>
            <PremiumProvider>
              <MealDraftProvider>
                <HistoryProvider>
                  <ThemeController>
                    <AppNavigator />
                    <ToastBridge />
                    <E2EStatusOverlay />
                  </ThemeController>
                </HistoryProvider>
              </MealDraftProvider>
            </PremiumProvider>
          </AiCreditsProvider>
        </AccessProvider>
      </UserProvider>
    </NavigationContainer>
  );
}

function NativeSplashGate({
  fontsLoaded,
  launchReadinessIssue,
}: {
  fontsLoaded: boolean;
  launchReadinessIssue: string | null;
}) {
  const { authLoading, isAuthenticated } = useAuthContext();
  const { profileBootstrapState } = useUserProfileContext();
  const shouldHide = shouldHideNativeSplash({
    fontsLoaded,
    launchReadinessIssue,
    authLoading,
    isAuthenticated,
    profileBootstrapState,
  });

  useEffect(() => {
    if (shouldHide) {
      hideNativeSplash("bootstrap_ready");
    }
  }, [shouldHide]);

  return null;
}

function ProductRuntimeBootstrap({
  launchReadinessIssue,
}: {
  launchReadinessIssue: string | null;
}) {
  const { uid: productReadyUid } = useProductReadiness();

  useEffect(() => {
    if (launchReadinessIssue) {
      return;
    }

    if (!productReadyUid) {
      setMealSideEffectsRuntimeUid(null);
      runBestEffortStartupTask("reminder_runtime_clear_uid", async () => {
        await setReminderRuntimeUid(null);
      });
      return;
    }

    setMealSideEffectsRuntimeUid(productReadyUid);
    let cancelled = false;
    const bootTask = setTimeout(() => {
      runBestEffortStartupTask("product_runtime_bootstrap", async () => {
        initMealSideEffectsRuntime();
        await initReminderRuntime();
        if (cancelled) return;
        await setReminderRuntimeUid(productReadyUid);
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(bootTask);
      setMealSideEffectsRuntimeUid(null);
    };
  }, [launchReadinessIssue, productReadyUid]);

  return null;
}

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  launchBlockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FFFDF8",
  },
  launchBlockedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2F312B",
    marginBottom: 12,
    textAlign: "center",
  },
  launchBlockedMessage: {
    fontSize: 16,
    color: "#575B52",
    textAlign: "center",
  },
});
