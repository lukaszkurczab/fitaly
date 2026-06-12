#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { callAuthenticatedJson, smokeEndpoint, smokeResponseError } from "./smoke-auth-lib.mjs";

const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";

const { payload, response, smokeUserRef, url } = await callAuthenticatedJson(
  "/api/v1/users/me/delete",
  {
    method: "POST",
    emailEnvName: "SMOKE_DELETE_TEST_EMAIL",
    passwordEnvName: "SMOKE_DELETE_TEST_PASSWORD",
  },
);

if (!response.ok) {
  throw new Error(smokeResponseError("Manual smoke delete", { response, url, payload }));
}

if (!payload || payload.deleted !== true) {
  throw new Error(`Manual smoke delete returned invalid contract endpoint=${smokeEndpoint(url)}; response body redacted.`);
}

const summary = {
  checkedAt: new Date().toISOString(),
  smokeApiBaseUrl: new URL(url).origin,
  endpoint: smokeEndpoint(url),
  smokeUserRef,
  status: response.status,
  deleted: true,
};

const serialized = `${JSON.stringify(summary, null, 2)}\n`;
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, "utf8");
}

process.stdout.write(serialized);
