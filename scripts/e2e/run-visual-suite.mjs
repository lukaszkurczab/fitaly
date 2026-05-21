#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const suites = JSON.parse(readFileSync(path.join(__dirname, "suites.json"), "utf8"));
const suiteName = "visual-audit";
const flows = suites[suiteName];

if (!Array.isArray(flows)) {
  console.error(`[e2e:visual] Missing "${suiteName}" suite in scripts/e2e/suites.json`);
  process.exit(1);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function findFiles(dir, predicate, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findFiles(fullPath, predicate, acc);
    } else if (predicate(fullPath)) {
      acc.push(fullPath);
    }
  }
  return acc.sort();
}

function expectedScreenshots() {
  const names = [];
  for (const flow of flows) {
    const contents = readFileSync(path.join(rootDir, flow), "utf8");
    const matches = contents.matchAll(/takeScreenshot:\s*([A-Za-z0-9._-]+)/g);
    for (const match of matches) names.push(match[1]);
  }
  return names;
}

function writeManifest(runDir, manifest) {
  writeFileSync(
    path.join(runDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

const runId = process.env.E2E_VISUAL_AUDIT_RUN_ID || timestamp();
const runDir = path.join(rootDir, "e2e", "artifacts", suiteName, runId);
const latestDir = path.join(rootDir, "e2e", "artifacts", suiteName, "latest");
const maestroTestOutputDir = runDir;
const screenshotsDir = path.join(runDir, "screenshots");
const reportsDir = path.join(runDir, "reports");
const logsDir = path.join(runDir, "logs");

mkdirSync(screenshotsDir, { recursive: true });
mkdirSync(reportsDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });

const startedAt = new Date().toISOString();
const baseManifest = {
  suite: suiteName,
  runId,
  startedAt,
  platform: process.env.E2E_PLATFORM || "ios",
  flows,
  output: {
    runDir: path.relative(rootDir, runDir),
    latestDir: path.relative(rootDir, latestDir),
    maestroTestOutputDir: path.relative(rootDir, maestroTestOutputDir),
    latestScreenshotsDir: path.relative(rootDir, path.join(latestDir, "screenshots")),
    latestReportsDir: path.relative(rootDir, path.join(latestDir, "reports")),
    latestManifest: path.relative(rootDir, path.join(latestDir, "manifest.json")),
  },
  reportsDir: path.relative(rootDir, reportsDir),
  screenshotsDir: path.relative(rootDir, screenshotsDir),
  expectedScreenshots: expectedScreenshots(),
  screenshots: [],
  status: "running",
};

writeManifest(runDir, baseManifest);

const env = {
  ...process.env,
  E2E_ARTIFACT_DIR: runDir,
  E2E_RESULTS_DIR: reportsDir,
  E2E_RESULTS_PATH: path.join(reportsDir, "results.xml"),
  E2E_DEBUG_OUTPUT_DIR: logsDir,
  E2E_TEST_OUTPUT_DIR: maestroTestOutputDir,
  E2E_SUITE_NAME: suiteName,
  E2E_CONTINUE_ON_FAILURE: "1",
};

console.log(`[e2e:visual] Run directory: ${path.relative(rootDir, runDir)}`);

const child = spawn(
  process.execPath,
  ["scripts/e2e/run-suite.mjs", suiteName, "--continue-on-failure"],
  {
    cwd: rootDir,
    env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  const screenshotFiles = findFiles(
    screenshotsDir,
    (file) => /\.(png|jpg|jpeg)$/i.test(file),
  ).map((file) => path.relative(rootDir, file));
  const reportFiles = findFiles(reportsDir, (file) => /\.xml$/i.test(file)).map((file) =>
    path.relative(rootDir, file),
  );
  const status = signal ? "interrupted" : code === 0 ? "passed" : "failed";
  const finishedAt = new Date().toISOString();

  writeManifest(runDir, {
    ...baseManifest,
    finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    reports: reportFiles,
    screenshots: screenshotFiles,
    status,
    exitCode: code,
    signal,
  });

  rmSync(latestDir, { recursive: true, force: true });
  try {
    symlinkSync(runId, latestDir, "dir");
  } catch {
    cpSync(runDir, latestDir, { recursive: true });
  }

  process.exit(code ?? 1);
});
