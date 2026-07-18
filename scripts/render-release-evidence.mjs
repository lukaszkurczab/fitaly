#!/usr/bin/env node

import { execFileSync } from "node:child_process";
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
const READINESS_DECISIONS = new Set(["CORE_RC_READY", "FULL_1_1_RC_READY"]);
const REQUIRED_READINESS_FIELD_LABELS = [
  "Mobile CI",
  "Backend CI",
  "Selected E2E platform",
  "Smoke E2E",
  "Release gate E2E",
  "E2E results artifact",
  "Smoke runtime backend SHA",
  "Smoke export",
  "Smoke flow contracts",
  "Android targetSdk check",
  "Android AAB check",
  "Latest Firestore backup",
  "Latest restore drill",
  "Disposable delete evidence artifact",
  "Chat integrity tests",
  "Atomic onboarding contract",
  "Weekly Report premium gate",
  "Paywall truthfulness",
  "Privacy-safe logging e2e",
  "Sentry scrubbing evidence",
  "Compliance evidence packet",
  "Rollback rehearsal note",
];
const BLOCKING_EVIDENCE_PATTERNS = [
  /\bunknown\b/i,
  /\bmissing\b/i,
  /\bnot provided\b/i,
  /\bnot generated\b/i,
  /\bnot run\b/i,
  /\bnot built\b/i,
  /\bnot verified\b/i,
  /\bunverified\b/i,
  /\bunproven\b/i,
  /\bpending\b/i,
  /\bplaceholder\b/i,
  /\bfailed\b/i,
  /\berror\b/i,
];
const LOCAL_ONLY_EVIDENCE_PATTERNS = [
  /\blocal\b/i,
  /\bno-provider\b/i,
  /\bsimulator\b/i,
  /\bemulator\b/i,
  /\bmock\b/i,
  /\bfake\b/i,
  /\bfile:\/\//i,
  /\blocalhost\b/i,
  /\b127\.0\.0\.1\b/,
  /\b0\.0\.0\.0\b/,
  /\[::1\]/,
  /(^|[\s:=])\/(?!\/)\S+/i,
  /(^|[\s:=])~\//,
  /(^|[\s:=])\.\.?\//,
  /(^|[\s:=])(?:[\w.-]+\/)*(?:artifacts?|reports?|screenshots?|logs?|coverage|dist|build)\/\S+/i,
  /\be2e\/artifacts\b/i,
];
const PROOF_BACKED_EVIDENCE_PATTERNS = [
  /https?:\/\/\S+/i,
  /\bGitHub Actions artifact\b/i,
  /^verified\s+(?=.*(?:\b(?:run|job|runner|runners|artifact|evidence|gate|contract|targetSdk|AAB|smoke|delete|paywall|privacy|Sentry|compliance|rollback|backup|restore|flow|report|testcase|SHA|CI|E2E)\b|smoke_export|smoke_flow_contracts))/i,
];
const EXTERNAL_EVIDENCE_FIELD_LABELS = [
  "Mobile CI",
  "Backend CI",
  "Selected E2E platform",
  "Smoke E2E",
  "Release gate E2E",
  "E2E results artifact",
  "Smoke export",
  "Smoke flow contracts",
  "Android targetSdk check",
  "Android AAB check",
  "Latest Firestore backup",
  "Latest restore drill",
  "Disposable delete evidence artifact",
  "Chat integrity tests",
  "Atomic onboarding contract",
  "Weekly Report premium gate",
  "Paywall truthfulness",
  "Privacy-safe logging e2e",
  "Sentry scrubbing evidence",
  "Compliance evidence packet",
  "Rollback rehearsal note",
];

function value(name, fallback = "not provided") {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
}

const DELETE_EVIDENCE_ENV_NAMES = [
  "DELETE_EVIDENCE_URL",
  "DELETE_EVIDENCE_TIMESTAMP_UTC",
  "DELETE_EVIDENCE_TARGET_ENVIRONMENT",
  "DELETE_EVIDENCE_MOBILE_SHA",
  "DELETE_EVIDENCE_BACKEND_SHA",
  "DELETE_EVIDENCE_DISPOSABLE_USER_REF",
  "DELETE_EVIDENCE_BACKEND_DELETION",
  "DELETE_EVIDENCE_FIREBASE_AUTH_DELETION",
  "DELETE_EVIDENCE_STORAGE_CLEANUP",
  "DELETE_EVIDENCE_REACCESS_RESULT",
  "DELETE_EVIDENCE_OWNER",
];
const DELETE_EVIDENCE_FIELD_NAMES = {
  url: "DELETE_EVIDENCE_URL",
  timestampUtc: "DELETE_EVIDENCE_TIMESTAMP_UTC",
  targetEnvironment: "DELETE_EVIDENCE_TARGET_ENVIRONMENT",
  mobileSha: "DELETE_EVIDENCE_MOBILE_SHA",
  backendSha: "DELETE_EVIDENCE_BACKEND_SHA",
  disposableUserRef: "DELETE_EVIDENCE_DISPOSABLE_USER_REF",
  backendDeletion: "DELETE_EVIDENCE_BACKEND_DELETION",
  firebaseAuthDeletion: "DELETE_EVIDENCE_FIREBASE_AUTH_DELETION",
  storageCleanup: "DELETE_EVIDENCE_STORAGE_CLEANUP",
  reaccessResult: "DELETE_EVIDENCE_REACCESS_RESULT",
  owner: "DELETE_EVIDENCE_OWNER",
};

function deleteEvidenceValue(name) {
  return value(name, "");
}

function isDeleteEvidenceSupplied() {
  return DELETE_EVIDENCE_ENV_NAMES.some((name) => deleteEvidenceValue(name));
}

function assertDeleteEvidence(deleteEvidence, expectedMobileSha, expectedBackendSha, expectedEnvironment) {
  const required = Object.entries(deleteEvidence).filter(([, content]) => !content);
  if (required.length > 0) {
    throw new Error(
      `Disposable delete evidence is missing required fields: ${required
        .map(([name]) => DELETE_EVIDENCE_FIELD_NAMES[name])
        .join(", ")}.`,
    );
  }

  for (const [name, content] of Object.entries(deleteEvidence)) {
    if (/\b(pending|unknown|placeholder|not provided|skipped)\b/i.test(content)) {
      throw new Error(
        `${DELETE_EVIDENCE_FIELD_NAMES[name]} must contain completed evidence, not a placeholder.`,
      );
    }
  }

  if (deleteEvidence.targetEnvironment !== expectedEnvironment) {
    throw new Error(
      `DELETE_EVIDENCE_TARGET_ENVIRONMENT must match TARGET_ENVIRONMENT (${expectedEnvironment}); got ${deleteEvidence.targetEnvironment}.`,
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(deleteEvidence.timestampUtc) || Number.isNaN(Date.parse(deleteEvidence.timestampUtc))) {
    throw new Error("DELETE_EVIDENCE_TIMESTAMP_UTC must be an ISO 8601 UTC timestamp.");
  }
  if (!EXACT_SHA_PATTERN.test(deleteEvidence.mobileSha) || deleteEvidence.mobileSha !== expectedMobileSha) {
    throw new Error("DELETE_EVIDENCE_MOBILE_SHA must be an exact SHA matching MOBILE_SHA.");
  }
  if (!EXACT_SHA_PATTERN.test(deleteEvidence.backendSha) || deleteEvidence.backendSha !== expectedBackendSha) {
    throw new Error("DELETE_EVIDENCE_BACKEND_SHA must be an exact SHA matching BACKEND_SHA.");
  }
  if (!/^delete-run-[a-z0-9][a-z0-9-]{1,62}$/.test(deleteEvidence.disposableUserRef)) {
    throw new Error("DELETE_EVIDENCE_DISPOSABLE_USER_REF must be a pseudonymous delete-run token.");
  }
  if (deleteEvidence.backendDeletion !== "deleted") {
    throw new Error("DELETE_EVIDENCE_BACKEND_DELETION must be deleted.");
  }
  if (deleteEvidence.firebaseAuthDeletion !== "deleted") {
    throw new Error("DELETE_EVIDENCE_FIREBASE_AUTH_DELETION must be deleted.");
  }
  if (deleteEvidence.storageCleanup !== "deleted") {
    throw new Error("DELETE_EVIDENCE_STORAGE_CLEANUP must be deleted.");
  }
  if (deleteEvidence.reaccessResult !== "denied") {
    throw new Error("DELETE_EVIDENCE_REACCESS_RESULT must be denied.");
  }
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(deleteEvidence.owner)) {
    throw new Error("DELETE_EVIDENCE_OWNER must be a non-PII owner handle.");
  }

  let artifactUrl;
  try {
    artifactUrl = new URL(deleteEvidence.url);
  } catch {
    throw new Error("DELETE_EVIDENCE_URL must be an external HTTPS URL.");
  }
  if (
    artifactUrl.protocol !== "https:" ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(artifactUrl.hostname) ||
    /@|(?:uid|user[_-]?id)=/i.test(deleteEvidence.url)
  ) {
    throw new Error("DELETE_EVIDENCE_URL must be an external HTTPS URL without PII-like data.");
  }
}

function bullet(label, content) {
  return `- ${label}: ${content}`;
}

function addEvidence(fields, label, content) {
  fields.push([label, content]);
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

function summarizeGitStatus(statusOutput) {
  const lines = statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) {
    return "clean";
  }

  let untracked = 0;
  let modified = 0;
  let other = 0;
  for (const line of lines) {
    if (line.startsWith("??")) {
      untracked += 1;
    } else if (/^[ MARCUD?!]{2}\s+/.test(line)) {
      modified += 1;
    } else {
      other += 1;
    }
  }

  const parts = [];
  if (modified > 0) {
    parts.push(`${modified} modified`);
  }
  if (untracked > 0) {
    parts.push(`${untracked} untracked`);
  }
  if (other > 0) {
    parts.push(`${other} other`);
  }
  return `dirty: ${parts.join(", ")}`;
}

function gitWorktreeStatus(repoPath) {
  try {
    const output = execFileSync("git", ["status", "--short"], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return summarizeGitStatus(output);
  } catch {
    return "not provided";
  }
}

function gitHeadSha(repoPath) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "not provided";
  }
}

function normalizeWorktreeStatusEnv(name) {
  const status = value(name, "");
  if (!status) {
    return "not provided";
  }
  return status.replace(/\s+/g, " ").trim();
}

function resolvedWorktreeStatus(name, repoPath) {
  if (repoPath) {
    const gitStatus = gitWorktreeStatus(repoPath);
    if (gitStatus !== "not provided") {
      return gitStatus;
    }
  }
  return normalizeWorktreeStatusEnv(name);
}

function assertCleanWorktreeStatus(label, status) {
  if (status.toLowerCase() !== "clean") {
    throw new Error(
      `${label} worktree status must be clean when clean worktree evidence is required; got ${status}.`,
    );
  }
}

function requireGitWorktreeEvidence(label, repoPath) {
  if (!repoPath || gitWorktreeStatus(repoPath) === "not provided") {
    throw new Error(
      `${label} worktree status must come from git when clean worktree evidence is required.`,
    );
  }
}

function assertGitHeadSha(label, repoPath, expectedSha) {
  const actualSha = repoPath ? gitHeadSha(repoPath) : "not provided";
  if (actualSha !== expectedSha) {
    throw new Error(
      `${label} git HEAD must match declared ${label.toUpperCase()}_SHA (${expectedSha}) when release readiness is claimed; got ${actualSha}.`,
    );
  }
}

function requireCleanWorktreesIfRequested(
  mobileStatus,
  backendStatus,
  mobileRepoPath,
  backendRepoPath,
  mobileSha,
  backendSha,
) {
  const cleanRequired =
    value("REQUIRE_CLEAN_WORKTREE", "false").toLowerCase() === "true" ||
    READINESS_DECISIONS.has(value("EVIDENCE_DECISION", ""));
  if (!cleanRequired) {
    return;
  }

  requireGitWorktreeEvidence("Mobile", mobileRepoPath);
  requireGitWorktreeEvidence("Backend", backendRepoPath);
  assertCleanWorktreeStatus("Mobile", mobileStatus);
  assertCleanWorktreeStatus("Backend", backendStatus);
  if (READINESS_DECISIONS.has(value("EVIDENCE_DECISION", ""))) {
    assertGitHeadSha("Mobile", mobileRepoPath, mobileSha);
    assertGitHeadSha("Backend", backendRepoPath, backendSha);
  }
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

function xmlAttr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`));
  return match?.[1] ?? null;
}

function xmlAttrNumber(tag, name, filePath) {
  const raw = xmlAttr(tag, name);
  if (raw === null) {
    return 0;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`Release gate JUnit report ${filePath} has invalid ${name}="${raw}".`);
  }
  return Number.parseInt(raw, 10);
}

function countMatches(content, regex) {
  return [...content.matchAll(regex)].length;
}

function releaseGateExpectedFlowCount() {
  const raw = value("RELEASE_GATE_EXPECTED_FLOW_COUNT", "");
  if (!raw) {
    return null;
  }

  if (!/^\d+$/.test(raw) || Number.parseInt(raw, 10) <= 0) {
    throw new Error("RELEASE_GATE_EXPECTED_FLOW_COUNT must be a positive integer.");
  }
  return Number.parseInt(raw, 10);
}

function flowIdFromPath(flowPath) {
  return path.basename(flowPath, path.extname(flowPath));
}

function releaseGateExpectedFlowIds() {
  const explicit = value("RELEASE_GATE_EXPECTED_FLOW_IDS", "");
  if (explicit) {
    return explicit
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .sort();
  }

  const suiteKey = value("RELEASE_GATE_EXPECTED_SUITE_KEY", "");
  if (!suiteKey) {
    return null;
  }

  const suitesPath = path.resolve(value("RELEASE_GATE_SUITES_PATH", "scripts/e2e/suites.json"));
  const suites = JSON.parse(fs.readFileSync(suitesPath, "utf8"));
  const suiteFlows = suites?.[suiteKey];
  if (!Array.isArray(suiteFlows)) {
    throw new Error(`Release gate expected suite ${suiteKey} is missing in ${suitesPath}.`);
  }

  return suiteFlows.map((flowPath) => flowIdFromPath(String(flowPath))).sort();
}

function parseJUnitReport(filePath, expectedSuiteName) {
  const xml = fs.readFileSync(filePath, "utf8");
  const suiteTags = [...xml.matchAll(/<testsuite\b[^>]*>/g)].map((match) => match[0]);
  if (suiteTags.length === 0) {
    throw new Error(`Release gate JUnit report ${filePath} has no testsuite.`);
  }

  if (expectedSuiteName) {
    const mismatchedSuites = suiteTags
      .map((tag) => xmlAttr(tag, "name") || "")
      .filter((name) => name !== expectedSuiteName);
    if (mismatchedSuites.length > 0) {
      throw new Error(
        `Release gate JUnit report ${filePath} must use suite ${expectedSuiteName}.`,
      );
    }
  }

  const declaredTests = suiteTags.reduce(
    (sum, tag) => sum + xmlAttrNumber(tag, "tests", filePath),
    0,
  );
  const declaredFailures = suiteTags.reduce(
    (sum, tag) => sum + xmlAttrNumber(tag, "failures", filePath),
    0,
  );
  const declaredErrors = suiteTags.reduce(
    (sum, tag) => sum + xmlAttrNumber(tag, "errors", filePath),
    0,
  );
  const declaredSkipped = suiteTags.reduce(
    (sum, tag) => sum + xmlAttrNumber(tag, "skipped", filePath),
    0,
  );
  const testcaseCount = countMatches(xml, /<testcase\b/g);
  if (testcaseCount === 0) {
    throw new Error(`Release gate JUnit report ${filePath} has no testcase.`);
  }
  const testcaseIds = [...xml.matchAll(/<testcase\b[^>]*>/g)].map((match) => {
    const tag = match[0];
    return xmlAttr(tag, "id") || xmlAttr(tag, "name") || "";
  });

  const nonSuccessStatuses = [...xml.matchAll(/\bstatus=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((status) => status !== "SUCCESS");
  if (nonSuccessStatuses.length > 0) {
    throw new Error(
      `Release gate JUnit report ${filePath} contains non-success testcase status: ${[
        ...new Set(nonSuccessStatuses),
      ].join(", ")}.`,
    );
  }

  return {
    tests: declaredTests || testcaseCount,
    testcaseCount,
    testcaseIds,
    failures: Math.max(declaredFailures, countMatches(xml, /<failure\b/g)),
    errors: Math.max(declaredErrors, countMatches(xml, /<error\b/g)),
    skipped: Math.max(declaredSkipped, countMatches(xml, /<skipped\b/g)),
  };
}

function releaseGateReportPaths(resultsDir) {
  if (!fs.existsSync(resultsDir)) {
    throw new Error(`RELEASE_GATE_RESULTS_DIR does not exist: ${resultsDir}.`);
  }
  if (!fs.statSync(resultsDir).isDirectory()) {
    throw new Error(`RELEASE_GATE_RESULTS_DIR must be a directory: ${resultsDir}.`);
  }

  const reportPaths = fs
    .readdirSync(resultsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".xml"))
    .map((entry) => path.join(resultsDir, entry.name))
    .sort();
  if (reportPaths.length === 0) {
    throw new Error(`RELEASE_GATE_RESULTS_DIR has no JUnit XML reports: ${resultsDir}.`);
  }
  return reportPaths;
}

function releaseGateE2EStatus() {
  const resultsDirInput = value("RELEASE_GATE_RESULTS_DIR", "");
  if (!resultsDirInput) {
    return value("RELEASE_GATE_E2E_STATUS", "unknown");
  }

  const resultsDir = path.resolve(resultsDirInput);
  const expectedFlowIds = releaseGateExpectedFlowIds();
  const expectedFlowCount = releaseGateExpectedFlowCount() ?? expectedFlowIds?.length ?? null;
  const expectedSuiteName = value("RELEASE_GATE_SUITE_NAME", "");
  const reportPaths = releaseGateReportPaths(resultsDir);
  if (expectedFlowCount !== null && reportPaths.length !== expectedFlowCount) {
    throw new Error(
      `Release gate expected ${expectedFlowCount} JUnit XML report(s), found ${reportPaths.length}.`,
    );
  }

  const totals = reportPaths
    .map((reportPath) => parseJUnitReport(reportPath, expectedSuiteName))
    .reduce(
      (sum, report) => ({
        tests: sum.tests + report.tests,
        testcaseCount: sum.testcaseCount + report.testcaseCount,
        failures: sum.failures + report.failures,
        errors: sum.errors + report.errors,
        skipped: sum.skipped + report.skipped,
        testcaseIds: [...sum.testcaseIds, ...report.testcaseIds],
      }),
      { tests: 0, testcaseCount: 0, failures: 0, errors: 0, skipped: 0, testcaseIds: [] },
    );

  if (expectedFlowCount !== null && totals.testcaseCount !== expectedFlowCount) {
    throw new Error(
      `Release gate expected ${expectedFlowCount} testcase(s), found ${totals.testcaseCount}.`,
    );
  }
  if (totals.failures > 0 || totals.errors > 0 || totals.skipped > 0) {
    throw new Error(
      `Release gate JUnit reports contain failures=${totals.failures}, errors=${totals.errors}, skipped=${totals.skipped}.`,
    );
  }
  if (expectedFlowIds) {
    const actualFlowIds = [...new Set(totals.testcaseIds.filter(Boolean))].sort();
    const missingFlowIds = expectedFlowIds.filter((id) => !actualFlowIds.includes(id));
    const unexpectedFlowIds = actualFlowIds.filter((id) => !expectedFlowIds.includes(id));
    if (actualFlowIds.length !== totals.testcaseIds.length) {
      throw new Error("Release gate JUnit reports contain duplicate testcase ids.");
    }
    if (totals.testcaseIds.some((id) => !id)) {
      throw new Error("Release gate JUnit reports contain testcase without id or name.");
    }
    if (missingFlowIds.length > 0 || unexpectedFlowIds.length > 0) {
      throw new Error(
        `Release gate JUnit flow id mismatch. Missing: ${missingFlowIds.join(", ") || "none"}. Unexpected: ${unexpectedFlowIds.join(", ") || "none"}.`,
      );
    }
  }

  const expectedSuffix = expectedFlowCount === null ? "" : `/${expectedFlowCount}`;
  const displayDir = path.relative(process.cwd(), resultsDir) || ".";
  return `verified ${reportPaths.length}${expectedSuffix} flow report(s), ${totals.testcaseCount} testcase(s), failures=0, errors=0, skipped=0 from ${displayDir}`;
}

function hasBlockingEvidencePlaceholder(content) {
  return BLOCKING_EVIDENCE_PATTERNS.some((pattern) => pattern.test(String(content)));
}

function hasLocalOnlyEvidence(content) {
  return LOCAL_ONLY_EVIDENCE_PATTERNS.some((pattern) => pattern.test(String(content)));
}

function hasProofBackedEvidence(content) {
  return PROOF_BACKED_EVIDENCE_PATTERNS.some((pattern) => pattern.test(String(content)));
}

function evidenceFieldValue(fields, label) {
  return fields.find(([fieldLabel]) => fieldLabel === label)?.[1] ?? "missing";
}

function assertReleaseReadinessEvidence(decision, fields, targetEnvironment) {
  if (!READINESS_DECISIONS.has(decision)) {
    return;
  }

  if (targetEnvironment !== "production") {
    throw new Error(
      `Release readiness decision ${decision} requires TARGET_ENVIRONMENT=production; got ${targetEnvironment}.`,
    );
  }

  const missingOrBlocking = REQUIRED_READINESS_FIELD_LABELS.filter((label) =>
    hasBlockingEvidencePlaceholder(evidenceFieldValue(fields, label)),
  );
  if (missingOrBlocking.length > 0) {
    const details = missingOrBlocking
      .map((label) => `${label}="${evidenceFieldValue(fields, label)}"`)
      .join(", ");
    throw new Error(
      `Release readiness decision ${decision} requires complete evidence; blocking fields: ${details}.`,
    );
  }

  const localOnlyFields = EXTERNAL_EVIDENCE_FIELD_LABELS.filter((label) =>
    hasLocalOnlyEvidence(evidenceFieldValue(fields, label)),
  );
  if (localOnlyFields.length > 0) {
    const details = localOnlyFields
      .map((label) => `${label}="${evidenceFieldValue(fields, label)}"`)
      .join(", ");
    throw new Error(
      `Release readiness decision ${decision} requires external/provider-backed evidence for release-critical fields; local-only fields: ${details}.`,
    );
  }

  const unprovenFields = REQUIRED_READINESS_FIELD_LABELS.filter(
    (label) => !hasProofBackedEvidence(evidenceFieldValue(fields, label)),
  );
  if (unprovenFields.length > 0) {
    const details = unprovenFields
      .map((label) => `${label}="${evidenceFieldValue(fields, label)}"`)
      .join(", ");
    throw new Error(
      `Release readiness decision ${decision} requires proof-backed evidence for release-critical fields; unproven fields: ${details}.`,
    );
  }

  const releaseGateStatus = evidenceFieldValue(fields, "Release gate E2E");
  if (!value("RELEASE_GATE_RESULTS_DIR", "").trim()) {
    throw new Error(
      `Release readiness decision ${decision} requires RELEASE_GATE_RESULTS_DIR JUnit evidence for Release gate E2E.`,
    );
  }
  if (releaseGateExpectedFlowCount() === null) {
    throw new Error(
      `Release readiness decision ${decision} requires RELEASE_GATE_EXPECTED_FLOW_COUNT for Release gate E2E.`,
    );
  }
  if (
    !value("RELEASE_GATE_EXPECTED_SUITE_KEY", "").trim() &&
    !value("RELEASE_GATE_EXPECTED_FLOW_IDS", "").trim()
  ) {
    throw new Error(
      `Release readiness decision ${decision} requires RELEASE_GATE_EXPECTED_SUITE_KEY or RELEASE_GATE_EXPECTED_FLOW_IDS for Release gate E2E.`,
    );
  }
  const releaseGateSuiteKey = value("RELEASE_GATE_EXPECTED_SUITE_KEY", "").trim();
  if (decision === "CORE_RC_READY" && releaseGateSuiteKey !== "core-release-gate") {
    throw new Error(
      `Release readiness decision ${decision} requires RELEASE_GATE_EXPECTED_SUITE_KEY=core-release-gate; got ${releaseGateSuiteKey || "missing"}.`,
    );
  }
  if (decision === "FULL_1_1_RC_READY" && releaseGateSuiteKey !== "release-gate") {
    throw new Error(
      `Release readiness decision ${decision} requires RELEASE_GATE_EXPECTED_SUITE_KEY=release-gate; got ${releaseGateSuiteKey || "missing"}.`,
    );
  }
  if (!String(releaseGateStatus).startsWith("verified ")) {
    throw new Error(
      `Release readiness decision ${decision} requires JUnit-verified Release gate E2E evidence; got ${releaseGateStatus}.`,
    );
  }

  const runtimeShaStatus = evidenceFieldValue(fields, "Smoke runtime backend SHA");
  if (!String(runtimeShaStatus).startsWith("verified ")) {
    throw new Error(
      `Release readiness decision ${decision} requires verified Smoke runtime backend SHA evidence; got ${runtimeShaStatus}.`,
    );
  }
}

const mobileSha = requireExactSha("MOBILE_SHA");
const backendSha = requireExactSha("BACKEND_SHA");
const targetEnvironment = value("TARGET_ENVIRONMENT", "unknown");
const evidenceDecision = value("EVIDENCE_DECISION", "not approved");
const deleteEvidence = {
  url: deleteEvidenceValue("DELETE_EVIDENCE_URL"),
  timestampUtc: deleteEvidenceValue("DELETE_EVIDENCE_TIMESTAMP_UTC"),
  targetEnvironment: deleteEvidenceValue("DELETE_EVIDENCE_TARGET_ENVIRONMENT"),
  mobileSha: deleteEvidenceValue("DELETE_EVIDENCE_MOBILE_SHA"),
  backendSha: deleteEvidenceValue("DELETE_EVIDENCE_BACKEND_SHA"),
  disposableUserRef: deleteEvidenceValue("DELETE_EVIDENCE_DISPOSABLE_USER_REF"),
  backendDeletion: deleteEvidenceValue("DELETE_EVIDENCE_BACKEND_DELETION"),
  firebaseAuthDeletion: deleteEvidenceValue("DELETE_EVIDENCE_FIREBASE_AUTH_DELETION"),
  storageCleanup: deleteEvidenceValue("DELETE_EVIDENCE_STORAGE_CLEANUP"),
  reaccessResult: deleteEvidenceValue("DELETE_EVIDENCE_REACCESS_RESULT"),
  owner: deleteEvidenceValue("DELETE_EVIDENCE_OWNER"),
};
if (!READINESS_DECISIONS.has(evidenceDecision) && isDeleteEvidenceSupplied()) {
  assertDeleteEvidence(deleteEvidence, mobileSha, backendSha, targetEnvironment);
}
const mobileRepoPath = process.cwd();
const backendRepoPath = value("BACKEND_REPO", "");
const mobileWorktreeStatus = resolvedWorktreeStatus("MOBILE_WORKTREE_STATUS", mobileRepoPath);
const backendWorktreeStatus = resolvedWorktreeStatus(
  "BACKEND_WORKTREE_STATUS",
  backendRepoPath,
);
requireCleanWorktreesIfRequested(
  mobileWorktreeStatus,
  backendWorktreeStatus,
  mobileRepoPath,
  backendRepoPath,
  mobileSha,
  backendSha,
);

const evidenceFields = [];
addEvidence(evidenceFields, "Generated at", value("EVIDENCE_GENERATED_AT", new Date().toISOString()));
addEvidence(evidenceFields, "Mobile commit SHA", mobileSha);
addEvidence(evidenceFields, "Mobile worktree status", mobileWorktreeStatus);
addEvidence(evidenceFields, "Backend commit SHA", backendSha);
addEvidence(evidenceFields, "Backend worktree status", backendWorktreeStatus);
addEvidence(evidenceFields, "Target environment", targetEnvironment);
addEvidence(evidenceFields, "Evidence decision", evidenceDecision);
addEvidence(evidenceFields, "Evidence limitations", value("EVIDENCE_LIMITATIONS", "not provided"));
addEvidence(evidenceFields, "Feature flag snapshot", featureFlagSnapshot(targetEnvironment));
addEvidence(evidenceFields, "Mobile CI", value("MOBILE_CI_STATUS", "unknown"));
addEvidence(evidenceFields, "Backend CI", value("BACKEND_CI_STATUS", "unknown"));
addEvidence(evidenceFields, "Selected E2E platform", value("E2E_PLATFORM", "unknown"));
addEvidence(evidenceFields, "Smoke E2E", value("SMOKE_E2E_STATUS", "unknown"));
addEvidence(evidenceFields, "Release gate E2E", releaseGateE2EStatus());
addEvidence(evidenceFields, "E2E results artifact", value("E2E_RESULTS_ARTIFACT_PATH", "unknown"));
addEvidence(evidenceFields, "Skipped E2E suites", value("E2E_SKIPPED_SUITES", "none"));
addEvidence(evidenceFields, "Smoke runtime backend SHA", smokeRuntimeBackendShaStatus(backendSha));
addEvidence(evidenceFields, "Smoke export", value("SMOKE_EXPORT_STATUS", "unknown"));
addEvidence(evidenceFields, "Smoke flow contracts", value("SMOKE_FLOW_CONTRACT_STATUS", "unknown"));
addEvidence(evidenceFields, "Android targetSdk check", value("TARGET_SDK_STATUS", "unknown"));
addEvidence(evidenceFields, "Android AAB check", value("AAB_STATUS", "unknown"));
addEvidence(evidenceFields, "Latest Firestore backup", value("BACKUP_RUN_URL", "missing"));
addEvidence(evidenceFields, "Latest restore drill", value("RESTORE_RUN_URL", "missing"));
addEvidence(evidenceFields, "Disposable delete evidence timestamp UTC", deleteEvidence.timestampUtc || "not provided");
addEvidence(evidenceFields, "Disposable delete target environment", deleteEvidence.targetEnvironment || "not provided");
addEvidence(evidenceFields, "Disposable delete mobile SHA", deleteEvidence.mobileSha || "not provided");
addEvidence(evidenceFields, "Disposable delete backend SHA", deleteEvidence.backendSha || "not provided");
addEvidence(evidenceFields, "Disposable delete user reference", deleteEvidence.disposableUserRef || "not provided");
addEvidence(evidenceFields, "Disposable delete backend data", deleteEvidence.backendDeletion || "not provided");
addEvidence(evidenceFields, "Disposable delete Firebase Auth", deleteEvidence.firebaseAuthDeletion || "not provided");
addEvidence(evidenceFields, "Disposable delete Storage", deleteEvidence.storageCleanup || "not provided");
addEvidence(evidenceFields, "Disposable delete re-access", deleteEvidence.reaccessResult || "not provided");
addEvidence(evidenceFields, "Disposable delete evidence artifact", deleteEvidence.url || "not provided");
addEvidence(evidenceFields, "Disposable delete owner", deleteEvidence.owner || "not provided");
addEvidence(evidenceFields, "Chat integrity tests", value("CHAT_INTEGRITY_TEST_STATUS", "unknown"));
addEvidence(
  evidenceFields,
  "Atomic onboarding contract",
  value("ONBOARDING_ATOMIC_CONTRACT_STATUS", "unknown"),
);
addEvidence(
  evidenceFields,
  "Weekly Report premium gate",
  value("WEEKLY_REPORT_PREMIUM_GATE_STATUS", "unknown"),
);
addEvidence(
  evidenceFields,
  "Paywall truthfulness",
  value("PAYWALL_TRUTHFULNESS_STATUS", "pending manual attachment"),
);
addEvidence(
  evidenceFields,
  "Privacy-safe logging e2e",
  value("PRIVACY_LOGGING_E2E_STATUS", "pending manual attachment"),
);
addEvidence(
  evidenceFields,
  "Sentry scrubbing evidence",
  value("SENTRY_SCRUBBING_EVIDENCE_URL", "pending manual attachment"),
);
addEvidence(
  evidenceFields,
  "Compliance evidence packet",
  value("COMPLIANCE_PACKET_URL", "pending manual attachment"),
);
addEvidence(
  evidenceFields,
  "Rollback rehearsal note",
  value("RC_ROLLBACK_REHEARSAL_URL", "pending manual attachment"),
);
assertReleaseReadinessEvidence(evidenceDecision, evidenceFields, targetEnvironment);
if (READINESS_DECISIONS.has(evidenceDecision)) {
  assertDeleteEvidence(deleteEvidence, mobileSha, backendSha, targetEnvironment);
}

const lines = ["# Release Evidence", ""];
for (const [label, content] of evidenceFields) {
  lines.push(bullet(label, content));
}
lines.push("", "## Smoke Export Summary");

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
