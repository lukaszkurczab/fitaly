#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const suitesPath = path.join(__dirname, "suites.json");
const suites = JSON.parse(readFileSync(suitesPath, "utf8"));

function usage(exitCode = 0) {
  const names = Object.keys(suites).sort().join(", ");
  console.log("Usage: node scripts/e2e/run-suite.mjs <suite> [--list] [--validate] [--continue-on-failure]");
  console.log(`Suites: ${names}`);
  process.exit(exitCode);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) usage(0);

const suiteName = args.find((arg) => !arg.startsWith("--"));
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const supportedFlags = new Set(["--list", "--validate", "--continue-on-failure"]);

for (const flag of flags) {
  if (!supportedFlags.has(flag)) {
    console.error(`[e2e:suite] Unsupported flag: ${flag}`);
    usage(1);
  }
}

if (!suiteName) usage(1);

const flows = suites[suiteName];
if (!Array.isArray(flows)) {
  console.error(`[e2e:suite] Unknown suite: ${suiteName}`);
  usage(1);
}

function validateFlows() {
  const missing = flows.filter((flow) => !existsSync(path.join(rootDir, flow)));
  if (missing.length > 0) {
    console.error(`[e2e:suite] Suite "${suiteName}" references missing flow(s):`);
    for (const flow of missing) console.error(`  - ${flow}`);
    return false;
  }
  return true;
}

if (flags.has("--list")) {
  console.log(`[e2e:suite] ${suiteName}`);
  for (const flow of flows) console.log(flow);
  process.exit(0);
}

if (!validateFlows()) process.exit(1);

if (flags.has("--validate")) {
  console.log(`[e2e:suite] ${suiteName}: ${flows.length} flow(s) validated`);
  process.exit(0);
}

const artifactDir = path.resolve(
  rootDir,
  process.env.E2E_ARTIFACT_DIR || path.join("e2e", "artifacts", suiteName),
);
const reportsDir = path.join(artifactDir, "reports");
const logsDir = path.join(artifactDir, "logs");
const screenshotsDir = path.join(artifactDir, "screenshots");

mkdirSync(reportsDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });
if (suiteName === "visual-audit" || process.env.E2E_TEST_OUTPUT_DIR) {
  mkdirSync(process.env.E2E_TEST_OUTPUT_DIR || screenshotsDir, { recursive: true });
}

const env = {
  ...process.env,
  E2E_RESULTS_DIR: process.env.E2E_RESULTS_DIR || reportsDir,
  E2E_RESULTS_PATH: process.env.E2E_RESULTS_PATH || path.join(reportsDir, "results.xml"),
  E2E_DEBUG_OUTPUT_DIR: process.env.E2E_DEBUG_OUTPUT_DIR || logsDir,
  E2E_SUITE_NAME: process.env.E2E_SUITE_NAME || suiteName,
};

if (suiteName === "visual-audit" || process.env.E2E_TEST_OUTPUT_DIR) {
  env.E2E_TEST_OUTPUT_DIR = process.env.E2E_TEST_OUTPUT_DIR || screenshotsDir;
}

if (flags.has("--continue-on-failure")) {
  env.E2E_CONTINUE_ON_FAILURE = "1";
}

console.log(`[e2e:suite] Running "${suiteName}" (${flows.length} flow(s))`);
console.log(`[e2e:suite] Reports: ${path.relative(rootDir, env.E2E_RESULTS_DIR)}`);
console.log(`[e2e:suite] Logs: ${path.relative(rootDir, env.E2E_DEBUG_OUTPUT_DIR)}`);
if (env.E2E_TEST_OUTPUT_DIR) {
  console.log(`[e2e:suite] Screenshots: ${path.relative(rootDir, env.E2E_TEST_OUTPUT_DIR)}`);
}

const child = spawn("bash", ["scripts/run-e2e-local.sh", ...flows], {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[e2e:suite] Suite "${suiteName}" stopped by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
