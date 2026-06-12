#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { callAuthenticatedJson, smokeEndpoint, smokeResponseError } from "./smoke-auth-lib.mjs";

const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
const requiredKeys = [
  "profile",
  "meals",
  "myMeals",
  "chatMessages",
  "notifications",
  "notificationPrefs",
  "feedback",
];

function assertExportShape(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Smoke export returned an invalid JSON payload.");
  }

  for (const key of requiredKeys) {
    if (!(key in payload)) {
      throw new Error(`Smoke export payload is missing required key: ${key}`);
    }
  }
}

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
  endpoint: smokeEndpoint(url),
  smokeUserRef,
  status: response.status,
  counts: {
    meals: Array.isArray(payload.meals) ? payload.meals.length : null,
    myMeals: Array.isArray(payload.myMeals) ? payload.myMeals.length : null,
    chatMessages: Array.isArray(payload.chatMessages) ? payload.chatMessages.length : null,
    notifications: Array.isArray(payload.notifications) ? payload.notifications.length : null,
    feedback: Array.isArray(payload.feedback) ? payload.feedback.length : null,
  },
};

const serialized = `${JSON.stringify(summary, null, 2)}\n`;
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, "utf8");
}

process.stdout.write(serialized);
