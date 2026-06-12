#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const coveragePath = path.join(__dirname, "release-coverage.ch-08-003.json");
const suitesPath = path.join(__dirname, "suites.json");

const requiredCoverageIds = [
  "auth-login-validation",
  "register-onboarding",
  "offline-onboarding-finish",
  "add-meal-manual",
  "add-meal-text",
  "add-meal-photo",
  "add-meal-barcode",
  "add-meal-saved-template",
  "offline-save-sync",
  "history-edit-delete",
  "home-stats-propagation",
  "chat-success-history",
  "chat-no-credit-error-states",
  "paywall-restore",
  "paywall-entitlement-failure-states",
  "weekly-reminders",
  "account-settings-delete",
  "account-data-export",
  "account-transition-user-switch-isolation",
  "share-export",
];

const assertionPrimitivePattern =
  /\b(assertVisible|assertNotVisible|extendedWaitUntil|copyTextFrom|evalScript)\b/;
const releaseCriticalForbiddenEvidencePattern = /(^|\/)(visual-audit|repair-loop)(\/|$)/;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function hasConcreteGap(gap) {
  return (
    gap &&
    typeof gap === "object" &&
    isNonEmptyString(gap.reason) &&
    isNonEmptyString(gap.nextAction)
  );
}

const definition = readJson(coveragePath);
const suites = readJson(suitesPath);
const errors = [];

const suiteNames = Object.keys(suites);
const flowToSuites = new Map();

for (const [suiteName, flows] of Object.entries(suites)) {
  if (!Array.isArray(flows)) {
    errors.push(`Suite "${suiteName}" must be an array in scripts/e2e/suites.json.`);
    continue;
  }
  for (const flow of flows) {
    const owners = flowToSuites.get(flow) || [];
    owners.push(suiteName);
    flowToSuites.set(flow, owners);
  }
}

const manifestIds = new Set(list(definition.requiredCoverageIds));
for (const requiredId of requiredCoverageIds) {
  if (!manifestIds.has(requiredId)) {
    errors.push(`release-coverage.ch-08-003.json requiredCoverageIds is missing "${requiredId}".`);
  }
}

for (const manifestId of manifestIds) {
  if (!requiredCoverageIds.includes(manifestId)) {
    errors.push(`release-coverage.ch-08-003.json declares unknown requiredCoverageId "${manifestId}".`);
  }
}

const entries = list(definition.coverage);
const entriesById = new Map();

for (const entry of entries) {
  if (!isNonEmptyString(entry.id)) {
    errors.push("Coverage entry is missing a non-empty id.");
    continue;
  }
  if (entriesById.has(entry.id)) {
    errors.push(`Coverage id "${entry.id}" is duplicated.`);
  }
  entriesById.set(entry.id, entry);
}

for (const requiredId of requiredCoverageIds) {
  if (!entriesById.has(requiredId)) {
    errors.push(`Coverage entry "${requiredId}" is missing.`);
  }
}

for (const entry of entries) {
  const id = isNonEmptyString(entry.id) ? entry.id : "<missing-id>";
  const status = entry.status;
  const flows = list(entry.flows);
  const suiteOwnership = list(entry.suiteOwnership);
  const assertionTypes = list(entry.assertionTypes).filter(isNonEmptyString);

  if (!["covered", "gap"].includes(status)) {
    errors.push(`${id}: status must be "covered" or "gap".`);
    continue;
  }

  if (!isNonEmptyString(entry.flowClass)) {
    errors.push(`${id}: flowClass must be a non-empty string.`);
  }

  if (!isNonEmptyString(entry.evidenceTier)) {
    errors.push(`${id}: evidenceTier must be a non-empty string.`);
  }

  if (!isNonEmptyString(entry.expectedEvidence)) {
    errors.push(`${id}: expectedEvidence must be a non-empty string.`);
  }

  for (const suiteName of suiteOwnership) {
    if (!suiteNames.includes(suiteName)) {
      errors.push(`${id}: suiteOwnership references unknown suite "${suiteName}".`);
    }
  }

  if (status === "gap") {
    if (!hasConcreteGap(entry.currentGap)) {
      errors.push(`${id}: gap entries need currentGap.reason and currentGap.nextAction.`);
    }
    if (flows.length > 0) {
      errors.push(`${id}: gap entries must not list covered flow paths.`);
    }
    continue;
  }

  if (flows.length === 0) {
    errors.push(`${id}: covered entries must list at least one flow path.`);
  }

  if (assertionTypes.length === 0) {
    errors.push(`${id}: covered entries must list at least one assertion/evidence type.`);
  }

  if (entry.currentGap !== null) {
    errors.push(`${id}: covered entries must use currentGap: null.`);
  }

  if (entry.releaseCritical === true) {
    if (releaseCriticalForbiddenEvidencePattern.test(entry.evidenceTier)) {
      errors.push(`${id}: release-critical evidenceTier cannot use visual-audit or repair-loop acceptance.`);
    }
    for (const suiteName of suiteOwnership) {
      if (releaseCriticalForbiddenEvidencePattern.test(suiteName)) {
        errors.push(`${id}: release-critical suiteOwnership cannot use ${suiteName} acceptance.`);
      }
    }
  }

  for (const flow of flows) {
    const absoluteFlowPath = path.join(rootDir, flow);
    if (!existsSync(absoluteFlowPath)) {
      errors.push(`${id}: referenced flow does not exist: ${flow}`);
      continue;
    }

    const owningSuites = flowToSuites.get(flow) || [];
    if (owningSuites.length === 0) {
      errors.push(`${id}: referenced flow is not present in any suite in scripts/e2e/suites.json: ${flow}`);
    } else if (!owningSuites.some((suiteName) => suiteOwnership.includes(suiteName))) {
      errors.push(
        `${id}: referenced flow is owned by suites [${owningSuites.join(", ")}] but entry suiteOwnership is [${suiteOwnership.join(", ")}]: ${flow}`,
      );
    }

    if (
      entry.releaseCritical === true &&
      releaseCriticalForbiddenEvidencePattern.test(flow)
    ) {
      errors.push(`${id}: release-critical flow cannot use visual-audit or repair-loop acceptance: ${flow}`);
    }

    const yaml = readFileSync(absoluteFlowPath, "utf8");
    if (!assertionPrimitivePattern.test(yaml)) {
      errors.push(`${id}: flow lacks a behavior/state assertion primitive: ${flow}`);
    }
  }
}

if (errors.length > 0) {
  console.error("[e2e:coverage] CH-08-003 release coverage validation failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const coveredCount = entries.filter((entry) => entry.status === "covered").length;
const gapCount = entries.filter((entry) => entry.status === "gap").length;
const flowCount = entries.reduce((count, entry) => count + list(entry.flows).length, 0);

console.log(
  `[e2e:coverage] CH-08-003 coverage definition validated: ${coveredCount} covered, ${gapCount} gap(s), ${flowCount} flow reference(s).`,
);
console.log("[e2e:coverage] Static definition only; no Maestro runtime pass or release acceptance is claimed.");
