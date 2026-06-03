#!/usr/bin/env node

import "dotenv/config";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readinessLib from "./check-launch-readiness.lib.js";

const TARGET_ANDROID_APP_ID = "com.lkurczab.fitaly";
const TARGET_IOS_APP_ID = "com.lkurczab.foodscannerai";
const { PRODUCTION_BUILD_PROFILE, validateEasApiBaseUrlProfiles } =
  readinessLib;
const {
  validateAndroidTargetSdkConfig,
  validateEasRuntimeContractProfiles,
} = readinessLib;

const profile = (process.argv[2] ?? process.env.EAS_BUILD_PROFILE ?? "")
  .trim()
  .toLowerCase();
const platform = (process.argv[3] ?? "").trim().toLowerCase();
const rootDir = process.cwd();
const errors = [];
let expoConfigCache = null;

function readJson(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  const text = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(text);
}

function shouldCheckPlatform(targetPlatform) {
  return !platform || platform === targetPlatform;
}

function normalizeIdentifier(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/^"(.*)"$/, "$1");
}

function readExpoConfig() {
  if (expoConfigCache) {
    return expoConfigCache;
  }

  try {
    const output = execFileSync("npx", ["expo", "config", "--json"], {
      cwd: rootDir,
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    expoConfigCache = JSON.parse(output);
    return expoConfigCache;
  } catch (error) {
    const stderr = String(error?.stderr || error?.message || "").trim();
    errors.push(
      `Unable to resolve Expo config via "npx expo config --json". ${stderr}`,
    );
    return null;
  }
}

function isHttpUrl(value) {
  return value.startsWith("https://") || value.startsWith("http://");
}

function checkLegalUrls() {
  const termsUrl = (process.env.TERMS_URL ?? "").trim();
  const privacyUrl = (process.env.PRIVACY_URL ?? "").trim();

  if (!isHttpUrl(termsUrl)) {
    errors.push("TERMS_URL is missing or invalid (expected http/https URL).");
  }
  if (!isHttpUrl(privacyUrl)) {
    errors.push("PRIVACY_URL is missing or invalid (expected http/https URL).");
  }
}

function checkEasAndroidBuildType() {
  const eas = readJson("eas.json");
  const buildType = eas?.build?.production?.android?.buildType;
  if (buildType !== "app-bundle") {
    errors.push(
      `eas.json production android.buildType must be \"app-bundle\" (got: ${String(buildType)}).`,
    );
  }
}

function checkAndroidTargetSdk() {
  if (!shouldCheckPlatform("android")) {
    return;
  }

  const expoConfig = readExpoConfig();
  errors.push(...validateAndroidTargetSdkConfig(expoConfig));
}

function checkApiBaseUrlMapping() {
  const eas = readJson("eas.json");
  const mappingErrors = validateEasApiBaseUrlProfiles(eas);
  errors.push(...mappingErrors);
}

function checkRuntimeContractMapping() {
  const eas = readJson("eas.json");
  const runtimeContractErrors = validateEasRuntimeContractProfiles(eas);
  errors.push(...runtimeContractErrors);
}

function checkAndroidFirebaseConfig() {
  if (!shouldCheckPlatform("android")) {
    return;
  }

  const googleServices = readJson("google-services.json");
  const clients = Array.isArray(googleServices?.client)
    ? googleServices.client
    : [];

  const packageNames = new Set();
  for (const client of clients) {
    const androidPackage =
      client?.client_info?.android_client_info?.package_name;
    if (typeof androidPackage === "string" && androidPackage) {
      packageNames.add(androidPackage);
    }

    const oauthClients = Array.isArray(client?.oauth_client)
      ? client.oauth_client
      : [];
    for (const oauthClient of oauthClients) {
      const oauthPackage = oauthClient?.android_info?.package_name;
      if (typeof oauthPackage === "string" && oauthPackage) {
        packageNames.add(oauthPackage);
      }
    }
  }

  if (!packageNames.has(TARGET_ANDROID_APP_ID)) {
    errors.push(
      `google-services.json is not configured for ${TARGET_ANDROID_APP_ID}. Replace Firebase Android config before production release.`,
    );
  }
}

function checkIosExpoBundleIdentifier() {
  if (!shouldCheckPlatform("ios")) {
    return;
  }

  const expoConfig = readExpoConfig();
  const bundleId = normalizeIdentifier(expoConfig?.ios?.bundleIdentifier);
  if (bundleId !== TARGET_IOS_APP_ID) {
    errors.push(
      `Expo iOS bundleIdentifier must be ${TARGET_IOS_APP_ID} for App Store builds (got: ${bundleId || "missing"}).`,
    );
  }
}

function checkIosFirebaseConfig() {
  if (!shouldCheckPlatform("ios")) {
    return;
  }
}

function checkIosNativeBundleIdentifier() {
  if (!shouldCheckPlatform("ios")) {
    return;
  }
}

function checkProductionEasFlags() {
  const eas = readJson("eas.json");
  const prodEnv = eas?.build?.production?.env ?? {};

  if (
    String(prodEnv.EXPO_PUBLIC_ENABLE_BACKEND_LOGGING).toLowerCase() === "true"
  ) {
    errors.push(
      'eas.json production env: EXPO_PUBLIC_ENABLE_BACKEND_LOGGING must not be "true" in production (privacy risk).',
    );
  }
  if (String(prodEnv.DEBUG_OCR).toLowerCase() === "true") {
    errors.push(
      'eas.json production env: DEBUG_OCR must not be "true" in production.',
    );
  }
}

function checkProductionRuntimeFlags() {
  if (String(process.env.FORCE_PREMIUM ?? "").toLowerCase() === "true") {
    errors.push('FORCE_PREMIUM must not be "true" in a production build.');
  }
  if (String(process.env.DISABLE_BILLING ?? "").toLowerCase() === "true") {
    errors.push('DISABLE_BILLING must not be "true" in a production build.');
  }
}

function checkRevenueCatKeys() {
  if (platform === "android" || !platform) {
    if (!process.env.RC_ANDROID_API_KEY) {
      errors.push(
        "RC_ANDROID_API_KEY is not set — RevenueCat billing will not work on Android.",
      );
    }
  }
  if (platform === "ios" || !platform) {
    if (!process.env.RC_IOS_API_KEY) {
      errors.push(
        "RC_IOS_API_KEY is not set — RevenueCat billing will not work on iOS.",
      );
    }
  }
}

function checkSentryDsn() {
  const sentryDsn = (process.env.SENTRY_DSN ?? "").trim();
  if (sentryDsn) return;

  const assumeEasSecrets =
    String(process.env.READINESS_ASSUME_EAS_SECRETS ?? "")
      .trim()
      .toLowerCase() === "true";

  if (assumeEasSecrets) {
    console.log(
      "[launch-readiness] SENTRY_DSN is not set locally. Assuming EAS secrets provide SENTRY_DSN for cloud build.",
    );
    return;
  }

  console.warn(
    "[launch-readiness] WARNING: SENTRY_DSN is not set — production crashes will not be tracked.",
  );
}

if (profile !== PRODUCTION_BUILD_PROFILE) {
  if (profile === "smoke") {
    checkApiBaseUrlMapping();
    checkRuntimeContractMapping();

    if (errors.length > 0) {
      console.error(
        "[launch-readiness] Blocking smoke runtime config due to configuration errors:",
      );
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      process.exit(1);
    }

    console.log("[launch-readiness] Smoke runtime config checks passed.");
    process.exit(0);
  }

  console.log(
    `[launch-readiness] Skipped checks for profile "${profile || "unknown"}".`,
  );
  process.exit(0);
}

checkLegalUrls();
checkEasAndroidBuildType();
checkAndroidTargetSdk();
checkApiBaseUrlMapping();
checkRuntimeContractMapping();
checkAndroidFirebaseConfig();
checkIosExpoBundleIdentifier();
checkIosFirebaseConfig();
checkIosNativeBundleIdentifier();
checkProductionEasFlags();
checkProductionRuntimeFlags();
checkRevenueCatKeys();
checkSentryDsn();

if (errors.length > 0) {
  console.error(
    `[launch-readiness] Blocking ${platform || "release"} build due to configuration errors:`,
  );
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `[launch-readiness] Production checks passed for ${platform || "release"}.`,
);
