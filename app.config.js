import "dotenv/config";

const PRODUCTION_BUILD_PROFILE = "production";

function normalizeEnvString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readBooleanEnv(name, defaultValue = false) {
  const normalized = normalizeEnvString(process.env[name]).toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  return normalized === "true";
}

const iosGoogleServicesFile =
  process.env.GOOGLE_SERVICES_FILE_IOS || "./GoogleService-Info.plist";
const androidGoogleServicesFile =
  process.env.GOOGLE_SERVICES_FILE_ANDROID || "./google-services.json";
const configuredApiBaseUrl = normalizeEnvString(
  process.env.EXPO_PUBLIC_API_BASE_URL,
);
const sentryOrganization = normalizeEnvString(
  process.env.SENTRY_ORG || "lukaszkurczab",
);
const sentryProject = normalizeEnvString(
  process.env.SENTRY_PROJECT || "fitaly-frontend",
);
const buildProfile = normalizeEnvString(process.env.EAS_BUILD_PROFILE);
const isLocalDevelopmentRuntime = process.env.EAS_BUILD !== "true";
const isProductionBuildProfile =
  buildProfile.toLowerCase() === PRODUCTION_BUILD_PROFILE;
const resolvedApiBaseUrl =
  configuredApiBaseUrl ||
  (!isProductionBuildProfile && isLocalDevelopmentRuntime
    ? "http://localhost:8000/"
    : "");

export default {
  expo: {
    name: "Fitaly",
    scheme: "fitaly",
    slug: "fitaly",
    owner: "lkurczab",
    version: "1.0.1",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    assetBundlePatterns: ["**/*"],
    icon: "./assets/icon.png",
    ios: {
      supportsTablet: false,
      // Legacy App Store identifier: production App Store builds must keep
      // com.lkurczab.foodscannerai because the listing is already bound to it.
      // Do not "align" this value to Android/package naming. This divergence is
      // an accepted long-term project convention.
      bundleIdentifier: "com.lkurczab.foodscannerai",
      googleServicesFile: iosGoogleServicesFile,
      icon: "./assets/appstore.png",
      infoPlist: {
        EXDevMenuShowFloatingActionButton: false,
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          "Fitaly uses the camera to scan meals and barcodes and to take profile photos.",
        NSPhotoLibraryUsageDescription:
          "Fitaly allows you to select photos from your library for profile pictures and feedback attachments.",
      },
    },
    android: {
      icon: "./assets/playstore.png",
      adaptiveIcon: {
        foregroundImage: "./assets/playstore.png",
        backgroundColor: "#FFFDF8",
      },
      permissions: ["POST_NOTIFICATIONS"],
      package: "com.lkurczab.fitaly",
      googleServicesFile: androidGoogleServicesFile,
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/splash.png",
          imageWidth: 180,
          backgroundColor: "#EFE7DA",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Fitaly uses the camera to scan meals and barcodes and to take profile photos.",
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-build-properties",
        {
          android: { targetSdkVersion: 35 },
          ios: { useFrameworks: "static", deploymentTarget: "15.5" },
        },
      ],
      "expo-font",
      "expo-asset",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      [
        "expo-notifications",
        {
          defaultChannel: "default",
          icon: "./assets/notification-icon.png",
          color: "#4F684B",
        },
      ],
      "expo-task-manager",
      "expo-background-task",
      [
        "@sentry/react-native/expo",
        { organization: sentryOrganization, project: sentryProject },
      ],
      "./plugins/with-non-modular-headers-fix.js",
    ],
    extra: {
      apiBaseUrl: resolvedApiBaseUrl,
      apiVersion: process.env.EXPO_PUBLIC_API_VERSION || "v1",
      backendLoggingEnabled: readBooleanEnv(
        "EXPO_PUBLIC_ENABLE_BACKEND_LOGGING",
        false,
      ),
      telemetryEnabled: readBooleanEnv("EXPO_PUBLIC_ENABLE_TELEMETRY", false),
      smartRemindersEnabled: readBooleanEnv(
        "EXPO_PUBLIC_ENABLE_SMART_REMINDERS",
        true,
      ),
      foodLibraryEnabled: readBooleanEnv(
        "EXPO_PUBLIC_ENABLE_FOOD_LIBRARY",
        false,
      ),
      smartMemoryEnabled: readBooleanEnv(
        "EXPO_PUBLIC_ENABLE_SMART_MEMORY",
        false,
      ),
      knownPatternsEnabled: readBooleanEnv(
        "EXPO_PUBLIC_ENABLE_KNOWN_PATTERNS",
        false,
      ),
      recipeCatalogEnabled: readBooleanEnv(
        "EXPO_PUBLIC_ENABLE_RECIPE_CATALOG",
        false,
      ),
      planningEnabled: readBooleanEnv("EXPO_PUBLIC_ENABLE_PLANNING", false),
      homeNextActionEnabled: readBooleanEnv(
        "EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION",
        false,
      ),
      reviewMemoryExplanationEnabled: readBooleanEnv(
        "EXPO_PUBLIC_ENABLE_REVIEW_MEMORY_EXPLANATION",
        false,
      ),
      debugOcr: (process.env.DEBUG_OCR || "false").toLowerCase() === "true",
      e2e: (process.env.E2E || "").toLowerCase() === "true",
      firebaseAuthEmulatorHost: normalizeEnvString(
        process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
      ),
      e2eMockChatReply:
        process.env.E2E_MOCK_CHAT_REPLY ||
        "E2E_MOCK_CHAT_REPLY: Keep hydration and protein consistent every day.",
      revenuecatAndroidKey: process.env.RC_ANDROID_API_KEY || "",
      revenuecatIosKey: process.env.RC_IOS_API_KEY || "",
      billingDisabled: readBooleanEnv("DISABLE_BILLING", false),
      firebaseProjectId: normalizeEnvString(
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      ),
      termsUrl: normalizeEnvString(process.env.TERMS_URL),
      privacyUrl: normalizeEnvString(process.env.PRIVACY_URL),
      sentryDsn: process.env.SENTRY_DSN || "",
      sentryEnvironment:
        normalizeEnvString(process.env.SENTRY_ENVIRONMENT) || "development",
      sentryOrganization,
      sentryProject,
      buildProfile,
      eas: {
        projectId: "74cb0678-596b-4dc2-bec0-cb1e3a206caa",
      },
    },
  },
};
