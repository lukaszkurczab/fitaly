#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const EXACT_SHA = /^[0-9a-f]{40}$/;
const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";

function requiredEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function smokeBaseUrl() {
  const raw = requiredEnv("SMOKE_API_BASE_URL");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("SMOKE_API_BASE_URL must be an absolute URL.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("SMOKE_API_BASE_URL must be an origin without a path, query, or fragment.");
  }
  return parsed.origin;
}

function expectedBackendSha() {
  const sha = requiredEnv("EXPECTED_BACKEND_COMMIT_SHA");
  if (!EXACT_SHA.test(sha)) {
    throw new Error("EXPECTED_BACKEND_COMMIT_SHA must be an exact 40-character lowercase commit SHA.");
  }
  return sha;
}

function timeoutMs() {
  const raw = requiredEnv("SMOKE_TELEMETRY_TIMEOUT_MS");
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0 || value > 60_000) {
    throw new Error("SMOKE_TELEMETRY_TIMEOUT_MS must be a positive integer no greater than 60000.");
  }
  return value;
}

async function requestJson(url, options, expectedOrigin, requestTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Smoke telemetry request timed out.");
    }
    throw new Error("Smoke telemetry request failed.");
  } finally {
    clearTimeout(timeout);
  }

  if (response.redirected || new URL(response.url).origin !== expectedOrigin) {
    throw new Error("Smoke telemetry request redirected to a different host.");
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Smoke telemetry response was malformed for HTTP ${response.status}.`);
  }
  return { payload, response };
}

function assertExactShaVersion(payload, expectedSha) {
  const actualSha = typeof payload?.commitSha === "string" ? payload.commitSha : "";
  if (!EXACT_SHA.test(actualSha) || actualSha !== expectedSha) {
    throw new Error("Smoke telemetry runtime backend SHA did not match EXPECTED_BACKEND_COMMIT_SHA.");
  }
  return actualSha;
}

function assertHealth(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Smoke telemetry health response was malformed.");
  }
}

function assertBatchResult(payload, expected) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Smoke telemetry ingest response was malformed.");
  }
  const { acceptedCount, duplicateCount, rejectedCount, rejectedEvents } = payload;
  if (
    acceptedCount !== expected.acceptedCount ||
    duplicateCount !== expected.duplicateCount ||
    rejectedCount !== 0 ||
    !Array.isArray(rejectedEvents) ||
    rejectedEvents.length !== 0
  ) {
    throw new Error("Smoke telemetry ingest returned unexpected batch counts.");
  }
  return { acceptedCount, duplicateCount, rejectedCount };
}

async function signIn(authBaseUrl, requestTimeoutMs) {
  const apiKey = requiredEnv("FIREBASE_WEB_API_KEY");
  const email = requiredEnv("SMOKE_EXPORT_TEST_EMAIL");
  const password = requiredEnv("SMOKE_EXPORT_TEST_PASSWORD");
  const endpoint = `${authBaseUrl.replace(/\/$/, "")}/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
  const { payload, response } = await requestJson(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
    new URL(authBaseUrl).origin,
    requestTimeoutMs,
  );
  const idToken = typeof payload?.idToken === "string" ? payload.idToken.trim() : "";
  const localId = typeof payload?.localId === "string" ? payload.localId.trim() : "";
  if (!response.ok || !idToken || !localId) {
    throw new Error("Smoke telemetry authentication failed.");
  }
  return { idToken, localId };
}

if (!outputPath) {
  throw new Error("A summary artifact output path is required.");
}

const baseUrl = smokeBaseUrl();
const expectedSha = expectedBackendSha();
const requestTimeoutMs = timeoutMs();
const authBaseUrl = (process.env.FIREBASE_AUTH_BASE_URL || "https://identitytoolkit.googleapis.com/v1").trim();
if (!authBaseUrl) {
  throw new Error("FIREBASE_AUTH_BASE_URL must not be empty when provided.");
}

const versionResult = await requestJson(
  `${baseUrl}/api/v1/version`,
  { headers: { Accept: "application/json" } },
  baseUrl,
  requestTimeoutMs,
);
if (!versionResult.response.ok) {
  throw new Error(`Smoke telemetry version check failed with HTTP ${versionResult.response.status}.`);
}
const actualSha = assertExactShaVersion(versionResult.payload, expectedSha);

const healthResult = await requestJson(
  `${baseUrl}/api/v1/health`,
  { headers: { Accept: "application/json" } },
  baseUrl,
  requestTimeoutMs,
);
if (!healthResult.response.ok) {
  throw new Error(`Smoke telemetry health check failed with HTTP ${healthResult.response.status}.`);
}
assertHealth(healthResult.payload);

const { idToken, localId } = await signIn(authBaseUrl, requestTimeoutMs);
const now = new Date().toISOString();
const eventId = `evt_smoke_${crypto.randomUUID()}`;
const eventName = "session_start";
const event = {
  eventId,
  name: eventName,
  ts: now,
  occurredAt: now,
  sessionId: `sess_smoke_${crypto.randomUUID()}`,
  actor: { userId: localId },
  platform: "release_smoke",
  appVersion: "release-candidate",
  build: expectedSha.slice(0, 12),
  locale: "en-US",
  timezone: "UTC",
  tzOffsetMin: 0,
  schemaVersion: 2,
  props: { origin: "app_boot" },
};
const batch = {
  sessionId: event.sessionId,
  app: { platform: event.platform, appVersion: event.appVersion, build: event.build },
  device: { locale: event.locale, tzOffsetMin: event.tzOffsetMin },
  events: [event],
};
const ingestUrl = `${baseUrl}/api/v2/telemetry/events/batch`;
const requestOptions = {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  },
  body: JSON.stringify(batch),
};

const firstResult = await requestJson(ingestUrl, requestOptions, baseUrl, requestTimeoutMs);
if (!firstResult.response.ok) {
  throw new Error(`Smoke telemetry ingest failed with HTTP ${firstResult.response.status}.`);
}
const accepted = assertBatchResult(firstResult.payload, { acceptedCount: 1, duplicateCount: 0 });

const duplicateResult = await requestJson(ingestUrl, requestOptions, baseUrl, requestTimeoutMs);
if (!duplicateResult.response.ok) {
  throw new Error(`Smoke telemetry duplicate ingest failed with HTTP ${duplicateResult.response.status}.`);
}
const duplicate = assertBatchResult(duplicateResult.payload, { acceptedCount: 0, duplicateCount: 1 });

const summary = {
  checkedAtUtc: new Date().toISOString(),
  smokeHost: baseUrl,
  expectedBackendSha: expectedSha,
  actualBackendSha: actualSha,
  eventName,
  firstIngest: accepted,
  duplicateIngest: duplicate,
  result: "passed",
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(summary)}\n`);
