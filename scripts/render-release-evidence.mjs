#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("release-evidence.md");
const exportSummaryPath = (process.env.EXPORT_SUMMARY_PATH || "").trim();
const exportSummary = exportSummaryPath ? JSON.parse(fs.readFileSync(exportSummaryPath, "utf8")) : null;
const flowSummaryPath = (process.env.FLOW_SUMMARY_PATH || "").trim();
const flowSummary = flowSummaryPath ? JSON.parse(fs.readFileSync(flowSummaryPath, "utf8")) : null;
const EXACT_SHA_PATTERN = /^[0-9a-fA-F]{40}$/;
const FEATURE_FLAG_KEYS = [
  "EXPO_PUBLIC_ENABLE_BACKEND_LOGGING",
  "EXPO_PUBLIC_ENABLE_TELEMETRY",
  "EXPO_PUBLIC_ENABLE_SMART_REMINDERS",
  "EXPO_PUBLIC_ENABLE_FOOD_LIBRARY",
  "EXPO_PUBLIC_ENABLE_SMART_MEMORY",
  "EXPO_PUBLIC_ENABLE_KNOWN_PATTERNS",
  "EXPO_PUBLIC_ENABLE_RECIPE_CATALOG",
  "EXPO_PUBLIC_ENABLE_PLANNING",
  "EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION",
  "EXPO_PUBLIC_ENABLE_REVIEW_MEMORY_EXPLANATION",
  "DISABLE_BILLING",
  "DEBUG_OCR",
  "FORCE_PREMIUM",
  "E2E",
];
const PRODUCTION_OFF_FEATURE_FLAG_KEYS = [
  "EXPO_PUBLIC_ENABLE_FOOD_LIBRARY",
  "EXPO_PUBLIC_ENABLE_SMART_MEMORY",
  "EXPO_PUBLIC_ENABLE_KNOWN_PATTERNS",
  "EXPO_PUBLIC_ENABLE_RECIPE_CATALOG",
  "EXPO_PUBLIC_ENABLE_PLANNING",
  "EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION",
  "EXPO_PUBLIC_ENABLE_REVIEW_MEMORY_EXPLANATION",
];

function value(name, fallback = "not provided") {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
}

function bullet(label, content) {
  return `- ${label}: ${content}`;
}

function smokeUser(summary) {
  return summary?.smokeUserRef || "not provided";
}

function requireExactSha(name) {
  const raw = value(name, "");
  if (!EXACT_SHA_PATTERN.test(raw)) {
    throw new Error(`${name} must be an exact 40-character commit SHA.`);
  }
  return raw;
}

function readJsonIfExists(relativePath) {
  const fullPath = path.resolve(relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function assertProductionNewDomainFlagsOff(snapshot) {
  for (const key of PRODUCTION_OFF_FEATURE_FLAG_KEYS) {
    const value = snapshot[key];
    if (value === undefined || value === "missing") {
      throw new Error(
        `Production feature flag snapshot is missing ${key}; declare it explicitly as false before release evidence.`,
      );
    }
    if (String(value).trim().toLowerCase() !== "false") {
      throw new Error(
        `Production feature flag ${key} must be false until its C2 feature gate passes; got ${value}.`,
      );
    }
  }
}

function featureFlagSnapshot(targetEnvironment) {
  const explicit = value("FEATURE_FLAG_SNAPSHOT", "");
  if (explicit) {
    if (targetEnvironment === "production") {
      assertProductionNewDomainFlagsOff(JSON.parse(explicit));
    }
    return explicit;
  }

  const easConfig = readJsonIfExists("eas.json");
  const profileEnv = easConfig?.build?.[targetEnvironment]?.env ?? {};
  const snapshot = {};
  for (const key of FEATURE_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(profileEnv, key)) {
      snapshot[key] = String(profileEnv[key]);
    } else {
      snapshot[key] = "missing";
    }
  }

  if (targetEnvironment === "production") {
    assertProductionNewDomainFlagsOff(snapshot);
  }

  return JSON.stringify(snapshot, Object.keys(snapshot).sort());
}

function validateSmokeRuntimeBackendSha(summary, label, expectedBackendSha) {
  if (!summary) {
    return null;
  }

  const backendVersion = summary.backendVersion;
  const actualSha = String(backendVersion?.commitSha || "").trim();
  const expectedSha = String(backendVersion?.expectedCommitSha || "").trim();
  if (backendVersion?.verified !== true || !actualSha) {
    throw new Error(`${label} summary is missing verified backendVersion.commitSha.`);
  }
  if (actualSha !== expectedBackendSha) {
    throw new Error(
      `${label} summary backendVersion.commitSha must match BACKEND_SHA (${expectedBackendSha}); got ${actualSha}.`,
    );
  }
  if (expectedSha && expectedSha !== expectedBackendSha) {
    throw new Error(
      `${label} summary backendVersion.expectedCommitSha must match BACKEND_SHA (${expectedBackendSha}); got ${expectedSha}.`,
    );
  }

  return `${label}=${actualSha}`;
}

function smokeRuntimeBackendShaStatus(expectedBackendSha) {
  const checks = [
    validateSmokeRuntimeBackendSha(exportSummary, "smoke_export", expectedBackendSha),
    validateSmokeRuntimeBackendSha(flowSummary, "smoke_flow_contracts", expectedBackendSha),
  ].filter(Boolean);

  if (checks.length === 0) {
    return "not provided";
  }

  return `verified ${checks.join(", ")}`;
}

const mobileSha = requireExactSha("MOBILE_SHA");
const backendSha = requireExactSha("BACKEND_SHA");
const targetEnvironment = value("TARGET_ENVIRONMENT", "unknown");

const lines = [
  "# Release Evidence",
  "",
  bullet("Generated at", value("EVIDENCE_GENERATED_AT", new Date().toISOString())),
  bullet("Mobile commit SHA", mobileSha),
  bullet("Backend commit SHA", backendSha),
  bullet("Target environment", targetEnvironment),
  bullet("Feature flag snapshot", featureFlagSnapshot(targetEnvironment)),
  bullet("Mobile CI", value("MOBILE_CI_STATUS", "unknown")),
  bullet("Backend CI", value("BACKEND_CI_STATUS", "unknown")),
  bullet("Selected E2E platform", value("E2E_PLATFORM", "unknown")),
  bullet("Smoke E2E", value("SMOKE_E2E_STATUS", "unknown")),
  bullet("Release gate E2E", value("RELEASE_GATE_E2E_STATUS", "unknown")),
  bullet("E2E results artifact", value("E2E_RESULTS_ARTIFACT_PATH", "unknown")),
  bullet("Skipped E2E suites", value("E2E_SKIPPED_SUITES", "none")),
  bullet("Smoke runtime backend SHA", smokeRuntimeBackendShaStatus(backendSha)),
  bullet("Smoke export", value("SMOKE_EXPORT_STATUS", "unknown")),
  bullet("Smoke flow contracts", value("SMOKE_FLOW_CONTRACT_STATUS", "unknown")),
  bullet("Android targetSdk check", value("TARGET_SDK_STATUS", "unknown")),
  bullet("Android AAB check", value("AAB_STATUS", "unknown")),
  bullet("Latest Firestore backup", value("BACKUP_RUN_URL", "missing")),
  bullet("Latest restore drill", value("RESTORE_RUN_URL", "missing")),
  bullet("Delete smoke evidence", value("DELETE_EVIDENCE_URL", "pending manual attachment")),
  bullet("Delete smoke note", value("DELETE_EVIDENCE_NOTE", "pending manual attachment")),
  bullet("Chat integrity tests", value("CHAT_INTEGRITY_TEST_STATUS", "unknown")),
  bullet("Atomic onboarding contract", value("ONBOARDING_ATOMIC_CONTRACT_STATUS", "unknown")),
  bullet("Weekly Report premium gate", value("WEEKLY_REPORT_PREMIUM_GATE_STATUS", "unknown")),
  bullet("Paywall truthfulness", value("PAYWALL_TRUTHFULNESS_STATUS", "pending manual attachment")),
  bullet("Privacy-safe logging e2e", value("PRIVACY_LOGGING_E2E_STATUS", "pending manual attachment")),
  bullet("Sentry scrubbing evidence", value("SENTRY_SCRUBBING_EVIDENCE_URL", "pending manual attachment")),
  bullet("Compliance evidence packet", value("COMPLIANCE_PACKET_URL", "pending manual attachment")),
  bullet("Rollback rehearsal note", value("RC_ROLLBACK_REHEARSAL_URL", "pending manual attachment")),
  "",
  "## Smoke Export Summary",
];

if (exportSummary) {
  lines.push(
    bullet("Checked at", exportSummary.checkedAt || "unknown"),
    bullet("Smoke API", exportSummary.smokeApiBaseUrl || "unknown"),
    bullet("Smoke user", smokeUser(exportSummary)),
    bullet("Export manifest schema", exportSummary.exportManifest?.schemaVersion || "unknown"),
    bullet("Meals count", String(exportSummary.counts?.meals ?? "unknown")),
    bullet("Saved meals count", String(exportSummary.counts?.myMeals ?? "unknown")),
    bullet("Chat messages count", String(exportSummary.counts?.chatMessages ?? "unknown")),
    bullet("Notifications count", String(exportSummary.counts?.notifications ?? "unknown")),
    bullet("Feedback count", String(exportSummary.counts?.feedback ?? "unknown")),
    bullet("Meal effect outbox count", String(exportSummary.counts?.mealEffectOutbox ?? "unknown")),
    bullet("Ingredient products count", String(exportSummary.counts?.ingredientProducts ?? "unknown")),
    bullet("Smart Memory items count", String(exportSummary.counts?.smartMemoryItems ?? "unknown")),
    bullet("Known Pattern controls count", String(exportSummary.counts?.knownPatternControls ?? "unknown")),
    bullet("Planned meal items count", String(exportSummary.counts?.plannedMealItems ?? "unknown")),
  );
} else {
  lines.push("- Smoke export summary was not generated.");
}

if (flowSummary) {
  lines.push("", "## Smoke Flow Contract Summary");
  lines.push(
    bullet("Checked at", flowSummary.checkedAt || "unknown"),
    bullet("Smoke API", flowSummary.smokeApiBaseUrl || "unknown"),
    bullet("Smoke user", smokeUser(flowSummary)),
  );
  for (const check of flowSummary.checks || []) {
    lines.push(
      bullet(
        `Check ${check.name || "unknown"}`,
        `status=${check.status ?? "unknown"}, latency=${check.latencyMs ?? "unknown"}ms`,
      ),
    );
  }
} else {
  lines.push("", "## Smoke Flow Contract Summary", "- Smoke flow summary was not generated.");
}

lines.push(
  "",
  "## Manual Follow-ups",
  "- Attach the disposable smoke delete log before final release approval.",
  "- Attach paywall screenshot + purchase/restore smoke note for visible offer.",
  "- Attach fake-PII logging evidence and Sentry data-scrubbing/retention screenshots.",
  "- Attach compliance packet link (retention matrix, processor list, DPA/SCC status, export/delete trail).",
  "- Attach rollback rehearsal note with candidate version/build identifiers.",
  "- Review any missing manual evidence explicitly as the release owner before rollout.",
  "- Confirm Sentry production alerts for backend 5xx spike and mobile crash/session drop route to Discord.",
  "",
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`${outputPath}\n`);
