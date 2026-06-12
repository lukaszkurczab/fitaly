#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { callAuthenticatedJson, smokeResponseError } from "./smoke-auth-lib.mjs";

const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
const maxLatencyMs = Number.parseInt(process.env.MAX_FLOW_LATENCY_MS || "5000", 10);
const weeklyExpectedStatus = Number.parseInt(process.env.WEEKLY_EXPECTED_STATUS || "403", 10);

if (!Number.isInteger(maxLatencyMs) || maxLatencyMs <= 0) {
  throw new Error(`MAX_FLOW_LATENCY_MS must be a positive integer (got: ${process.env.MAX_FLOW_LATENCY_MS})`);
}

if (weeklyExpectedStatus !== 200 && weeklyExpectedStatus !== 403) {
  throw new Error(`WEEKLY_EXPECTED_STATUS must be 200 or 403 (got: ${process.env.WEEKLY_EXPECTED_STATUS})`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function timedCall(pathname, options) {
  const startedAt = Date.now();
  return callAuthenticatedJson(pathname, options).then((result) => ({
    ...result,
    latencyMs: Date.now() - startedAt,
  }));
}

function assertLatency(latencyMs, label) {
  assert(
    latencyMs <= maxLatencyMs,
    `${label} latency ${latencyMs}ms exceeded threshold ${maxLatencyMs}ms.`,
  );
}

function mostRecentSundayIso() {
  const now = new Date();
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const sundayTimestamp = utcMidnight - now.getUTCDay() * 24 * 60 * 60 * 1000;
  return new Date(sundayTimestamp).toISOString().slice(0, 10);
}

function assertCreditsContract(payload) {
  assert(payload && typeof payload === "object" && !Array.isArray(payload), "AI credits payload must be an object.");
  assert(
    payload.tier === "free" || payload.tier === "premium",
    "AI credits payload must contain tier in {free,premium}.",
  );
  assert(Number.isInteger(payload.balance), "AI credits balance must be an integer.");
  assert(Number.isInteger(payload.allocation), "AI credits allocation must be an integer.");
}

function assertWeeklyContract(payload) {
  if (weeklyExpectedStatus === 403) {
    assert(payload && typeof payload === "object" && !Array.isArray(payload), "Weekly report 403 payload must be an object.");
    assert(
      payload.detail === "WEEKLY_REPORT_PREMIUM_REQUIRED",
      "Weekly report 403 payload must return detail=WEEKLY_REPORT_PREMIUM_REQUIRED.",
    );
    return;
  }

  assert(payload && typeof payload === "object" && !Array.isArray(payload), "Weekly report payload must be an object.");
  assert(typeof payload.status === "string", "Weekly report 200 payload must contain status.");
}

const summary = {
  checkedAt: new Date().toISOString(),
  smokeApiBaseUrl: null,
  smokeUserRef: null,
  checks: [],
};

const creditsResult = await timedCall("/api/v1/ai/credits");
assert(
  creditsResult.response.ok,
  smokeResponseError("AI credits check", creditsResult),
);
assertLatency(creditsResult.latencyMs, "ai_credits");
assertCreditsContract(creditsResult.payload);
summary.smokeApiBaseUrl = new URL(creditsResult.url).origin;
summary.smokeUserRef = creditsResult.smokeUserRef;
summary.checks.push({
  name: "ai_credits",
  status: creditsResult.response.status,
  latencyMs: creditsResult.latencyMs,
  tier: creditsResult.payload?.tier ?? null,
});

const weekEnd = mostRecentSundayIso();
const weeklyResult = await timedCall(`/api/v2/users/me/reports/weekly?weekEnd=${weekEnd}`);
assert(
  weeklyResult.response.status === weeklyExpectedStatus,
  smokeResponseError("Weekly report check", {
    ...weeklyResult,
    expectedStatus: weeklyExpectedStatus,
  }),
);
assertLatency(weeklyResult.latencyMs, "weekly_report");
assertWeeklyContract(weeklyResult.payload);
summary.checks.push({
  name: "weekly_report",
  status: weeklyResult.response.status,
  latencyMs: weeklyResult.latencyMs,
  weekEnd,
});

const serialized = `${JSON.stringify(summary, null, 2)}\n`;
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, "utf8");
}

process.stdout.write(serialized);
