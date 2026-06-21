#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  callAuthenticatedJson,
  smokeEndpoint,
  smokeResponseError,
  verifySmokeRuntimeBackendSha,
} from "./smoke-auth-lib.mjs";

const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
const requiredKeys = [
  "profile",
  "meals",
  "myMeals",
  "chatMessages",
  "chatMemory",
  "aiRuns",
  "notifications",
  "notificationPrefs",
  "feedback",
  "mealMutationDedupe",
  "mealEffectOutbox",
  "ingredientProducts",
  "smartMemoryItems",
  "smartMemoryCandidates",
  "smartMemorySettings",
  "smartMemoryTombstones",
  "smartMemoryMutationDedupe",
  "knownPatternControls",
  "knownPatternMutationDedupe",
  "plannedMealItems",
  "plannedMealMutationDedupe",
  "billing",
  "aiCredits",
  "aiCreditTransactions",
  "aiCreditIdempotency",
  "badges",
  "streak",
  "reminderDailyStats",
  "telemetryEvents",
  "exportManifest",
];

const recordCountKeys = requiredKeys.filter((key) => key !== "exportManifest");

function exportRecordCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value === null || value === undefined) return 0;
  if (typeof value === "object") return Object.keys(value).length > 0 ? 1 : 0;
  return 1;
}

function assertExportShape(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Smoke export returned an invalid JSON payload.");
  }

  for (const key of requiredKeys) {
    if (!(key in payload)) {
      throw new Error(`Smoke export payload is missing required key: ${key}`);
    }
  }

  const manifest = payload.exportManifest;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Smoke export payload is missing exportManifest.");
  }
  if (manifest.schemaVersion !== "user-export-manifest-v1") {
    throw new Error(
      `Smoke export manifest has unsupported schemaVersion: ${manifest.schemaVersion}`,
    );
  }
  if (
    !manifest.recordCounts ||
    typeof manifest.recordCounts !== "object" ||
    Array.isArray(manifest.recordCounts)
  ) {
    throw new Error("Smoke export manifest is missing recordCounts.");
  }

  for (const key of recordCountKeys) {
    const expected = exportRecordCount(payload[key]);
    const actual = manifest.recordCounts[key];
    if (actual !== expected) {
      throw new Error(
        `Smoke export manifest count mismatch for ${key}: expected ${expected}, got ${actual}`,
      );
    }
  }

  const expectedCountKeys = new Set(recordCountKeys);
  for (const key of Object.keys(manifest.recordCounts)) {
    if (!expectedCountKeys.has(key)) {
      throw new Error(`Smoke export manifest has unsupported recordCounts key: ${key}`);
    }
  }
}

const backendVersion = await verifySmokeRuntimeBackendSha();
const { payload, response, smokeUserRef, url } = await callAuthenticatedJson(
  "/api/v1/users/me/export",
);

if (!response.ok) {
  throw new Error(smokeResponseError("Smoke export check", { response, url, payload }));
}

assertExportShape(payload);

const summary = {
  checkedAt: new Date().toISOString(),
  smokeApiBaseUrl: new URL(url).origin,
  backendVersion,
  endpoint: smokeEndpoint(url),
  smokeUserRef,
  status: response.status,
  exportManifest: payload.exportManifest,
  counts: payload.exportManifest.recordCounts,
};

const serialized = `${JSON.stringify(summary, null, 2)}\n`;
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, "utf8");
}

process.stdout.write(serialized);
