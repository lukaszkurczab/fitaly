const REQUIRED_NON_PROD_BUILD_PROFILES = [
  "smoke",
  "development",
  "preview",
  "internal",
  "e2e-test",
];
const PRODUCTION_BUILD_PROFILE = "production";
const MIN_ANDROID_TARGET_SDK = 35;
const EXPO_BUILD_PROPERTIES_PLUGIN = "expo-build-properties";
const EXPECTED_DEV_API_BASE_URL =
  "https://fitaly-backend-smoke.up.railway.app";
const EXPECTED_PRODUCTION_API_BASE_URL =
  "https://fitaly-backend-production.up.railway.app";
const LAUNCH_LIKE_RUNTIME_PROFILES = ["smoke", "production"];

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpsUrl(value) {
  return /^https:\/\//i.test(normalizeString(value));
}

function isLocalhostUrl(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function getProfileEnv(easConfig, profileName, seenProfiles = new Set()) {
  const profile = easConfig?.build?.[profileName];
  if (!profile || typeof profile !== "object") {
    return {};
  }

  const normalizedProfileName = normalizeString(profileName);
  if (normalizedProfileName) {
    if (seenProfiles.has(normalizedProfileName)) {
      return {};
    }
    seenProfiles.add(normalizedProfileName);
  }

  const parentProfileName = normalizeString(profile.extends);
  const inheritedEnv = parentProfileName
    ? getProfileEnv(easConfig, parentProfileName, seenProfiles)
    : {};
  const ownEnv =
    profile?.env && typeof profile.env === "object" ? profile.env : {};

  if (normalizedProfileName) {
    seenProfiles.delete(normalizedProfileName);
  }

  return {
    ...inheritedEnv,
    ...ownEnv,
  };
}

function getApiBaseUrlForProfile(easConfig, profileName) {
  const profileEnv = getProfileEnv(easConfig, profileName);
  return normalizeString(profileEnv.EXPO_PUBLIC_API_BASE_URL);
}

function validateEasApiBaseUrlProfiles(easConfig) {
  const errors = [];

  for (const profileName of REQUIRED_NON_PROD_BUILD_PROFILES) {
    const value = getApiBaseUrlForProfile(easConfig, profileName);
    if (!value) {
      errors.push(
        `eas.json build.${profileName}.env.EXPO_PUBLIC_API_BASE_URL is missing.`,
      );
      continue;
    }
    if (!isHttpsUrl(value)) {
      errors.push(
        `eas.json build.${profileName}.env.EXPO_PUBLIC_API_BASE_URL must be an https URL (got: ${value}).`,
      );
    }
    if (value !== EXPECTED_DEV_API_BASE_URL) {
      errors.push(
        `eas.json build.${profileName}.env.EXPO_PUBLIC_API_BASE_URL must equal ${EXPECTED_DEV_API_BASE_URL} (got: ${value}).`,
      );
    }
    if (value.toLowerCase().includes("food-scanner")) {
      errors.push(
        `eas.json build.${profileName}.env.EXPO_PUBLIC_API_BASE_URL points to legacy domain (${value}).`,
      );
    }
  }

  const productionValue = getApiBaseUrlForProfile(
    easConfig,
    PRODUCTION_BUILD_PROFILE,
  );
  if (!productionValue) {
    errors.push(
      "eas.json build.production.env.EXPO_PUBLIC_API_BASE_URL is missing.",
    );
  } else {
    if (!isHttpsUrl(productionValue)) {
      errors.push(
        `eas.json build.production.env.EXPO_PUBLIC_API_BASE_URL must be an https URL (got: ${productionValue}).`,
      );
    }
    if (isLocalhostUrl(productionValue)) {
      errors.push(
        `eas.json build.production.env.EXPO_PUBLIC_API_BASE_URL cannot use localhost (got: ${productionValue}).`,
      );
    }
    if (productionValue !== EXPECTED_PRODUCTION_API_BASE_URL) {
      errors.push(
        `eas.json build.production.env.EXPO_PUBLIC_API_BASE_URL must equal ${EXPECTED_PRODUCTION_API_BASE_URL} (got: ${productionValue}).`,
      );
    }
    if (productionValue.toLowerCase().includes("food-scanner")) {
      errors.push(
        `eas.json build.production.env.EXPO_PUBLIC_API_BASE_URL points to legacy domain (${productionValue}).`,
      );
    }
  }

  return errors;
}

function normalizeBooleanString(value) {
  return normalizeString(value).toLowerCase();
}

function validateEasRuntimeContractProfiles(easConfig) {
  const errors = [];

  for (const profileName of LAUNCH_LIKE_RUNTIME_PROFILES) {
    const env = getProfileEnv(easConfig, profileName);
    const telemetryEnabled = normalizeBooleanString(
      env.EXPO_PUBLIC_ENABLE_TELEMETRY,
    );
    const smartRemindersEnabled = normalizeBooleanString(
      env.EXPO_PUBLIC_ENABLE_SMART_REMINDERS,
    );
    const billingDisabled = normalizeBooleanString(env.DISABLE_BILLING);

    if (telemetryEnabled !== "true") {
      errors.push(
        `eas.json build.${profileName}.env.EXPO_PUBLIC_ENABLE_TELEMETRY must be \"true\" for launch-like runtime contract (got: ${telemetryEnabled || "missing"}).`,
      );
    }
    if (smartRemindersEnabled !== "true") {
      errors.push(
        `eas.json build.${profileName}.env.EXPO_PUBLIC_ENABLE_SMART_REMINDERS must be \"true\" for launch-like runtime contract (got: ${smartRemindersEnabled || "missing"}).`,
      );
    }
    if (billingDisabled !== "false") {
      errors.push(
        `eas.json build.${profileName}.env.DISABLE_BILLING must be \"false\" for launch-like runtime contract (got: ${billingDisabled || "missing"}).`,
      );
    }
  }

  return errors;
}

function getExpoConfigPlugins(expoConfig) {
  const plugins = expoConfig?.plugins ?? expoConfig?.expo?.plugins;
  return Array.isArray(plugins) ? plugins : [];
}

function getExpoBuildPropertiesPluginConfig(expoConfig) {
  for (const plugin of getExpoConfigPlugins(expoConfig)) {
    if (plugin === EXPO_BUILD_PROPERTIES_PLUGIN) {
      return {};
    }

    if (
      Array.isArray(plugin) &&
      plugin[0] === EXPO_BUILD_PROPERTIES_PLUGIN &&
      plugin[1] &&
      typeof plugin[1] === "object" &&
      !Array.isArray(plugin[1])
    ) {
      return plugin[1];
    }
  }

  return null;
}

function validateAndroidTargetSdkConfig(
  expoConfig,
  minTargetSdkVersion = MIN_ANDROID_TARGET_SDK,
) {
  const errors = [];
  const buildPropertiesConfig = getExpoBuildPropertiesPluginConfig(expoConfig);
  const targetSdkVersion = buildPropertiesConfig?.android?.targetSdkVersion;

  if (targetSdkVersion == null) {
    errors.push(
      `expo-build-properties android.targetSdkVersion must be set for managed Android release readiness (minimum ${minTargetSdkVersion}).`,
    );
    return errors;
  }

  if (
    typeof targetSdkVersion !== "number" ||
    !Number.isInteger(targetSdkVersion)
  ) {
    errors.push("Android targetSdkVersion is not a valid integer.");
    return errors;
  }

  if (targetSdkVersion < minTargetSdkVersion) {
    errors.push(
      `Android targetSdkVersion must be >= ${minTargetSdkVersion} (got: ${targetSdkVersion}).`,
    );
  }

  return errors;
}

module.exports = {
  REQUIRED_NON_PROD_BUILD_PROFILES,
  PRODUCTION_BUILD_PROFILE,
  MIN_ANDROID_TARGET_SDK,
  EXPECTED_DEV_API_BASE_URL,
  EXPECTED_PRODUCTION_API_BASE_URL,
  isHttpsUrl,
  isLocalhostUrl,
  getApiBaseUrlForProfile,
  validateEasApiBaseUrlProfiles,
  validateEasRuntimeContractProfiles,
  getExpoBuildPropertiesPluginConfig,
  validateAndroidTargetSdkConfig,
};
