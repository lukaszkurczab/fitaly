import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../../..");
const mobileSha = "a".repeat(40);
const backendSha = "b".repeat(40);
const productionOffFeatureSnapshot = {
  DISABLE_BILLING: "false",
  EXPO_PUBLIC_ENABLE_TELEMETRY: "true",
  EXPO_PUBLIC_ENABLE_FOOD_LIBRARY: "false",
  EXPO_PUBLIC_ENABLE_SMART_MEMORY: "false",
  EXPO_PUBLIC_ENABLE_KNOWN_PATTERNS: "false",
  EXPO_PUBLIC_ENABLE_RECIPE_CATALOG: "false",
  EXPO_PUBLIC_ENABLE_PLANNING: "false",
  EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION: "false",
  EXPO_PUBLIC_ENABLE_REVIEW_MEMORY_EXPLANATION: "false",
};

function writeJUnitReport(
  reportsDir: string,
  id: string,
  options: {
    suiteName?: string;
    failures?: number;
    errors?: number;
    skipped?: number;
    status?: string;
    includeFailureNode?: boolean;
    includeErrorNode?: boolean;
    includeSkippedNode?: boolean;
  } = {},
): void {
  fs.mkdirSync(reportsDir, { recursive: true });

  const suiteName = options.suiteName ?? "core-release-gate";
  const failures = options.failures ?? 0;
  const errors = options.errors ?? 0;
  const skipped = options.skipped ?? 0;
  const status = options.status ?? "SUCCESS";
  const nodes = [
    options.includeFailureNode ? '<failure message="failed"/>' : "",
    options.includeErrorNode ? '<error message="errored"/>' : "",
    options.includeSkippedNode ? '<skipped message="skipped"/>' : "",
  ]
    .filter(Boolean)
    .join("");
  const testcase = nodes
    ? `<testcase id="${id}" name="${id}" classname="${id}" file="${id}.yaml" time="1.0" status="${status}">${nodes}</testcase>`
    : `<testcase id="${id}" name="${id}" classname="${id}" file="${id}.yaml" time="1.0" status="${status}"/>`;

  fs.writeFileSync(
    path.join(reportsDir, `${id}.xml`),
    [
      "<?xml version='1.0' encoding='UTF-8'?>",
      "<testsuites>",
      `  <testsuite name="${suiteName}" tests="1" failures="${failures}" errors="${errors}" skipped="${skipped}" time="1.0">`,
      `    ${testcase}`,
      "  </testsuite>",
      "</testsuites>",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeSuiteConfig(tempDir: string, flowIds: string[]): string {
  const suitePath = path.join(tempDir, "suites.json");
  fs.writeFileSync(
    suitePath,
    JSON.stringify({
      "core-release-gate": flowIds.map((id) => `e2e/maestro/release-gate/${id}.yaml`),
    }),
    "utf8",
  );
  return "suites.json";
}

function makeCleanGitDir(prefix: string): string {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execFileSync("git", ["init", "-q"], { cwd: repoDir });
  return repoDir;
}

function makeCleanGitDirWithCommit(
  prefix: string,
  ignoredPaths: string[] = [],
): { repoDir: string; sha: string } {
  const repoDir = makeCleanGitDir(prefix);
  if (ignoredPaths.length > 0) {
    fs.writeFileSync(path.join(repoDir, ".gitignore"), `${ignoredPaths.join("\n")}\n`, "utf8");
  }
  fs.writeFileSync(path.join(repoDir, "tracked.txt"), "tracked\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: repoDir });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Fitaly Test",
      "-c",
      "user.email=fitaly-test@example.com",
      "commit",
      "-m",
      "initial",
      "--quiet",
    ],
    { cwd: repoDir },
  );
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoDir,
    encoding: "utf8",
  }).trim();
  return { repoDir, sha };
}

function completeReadinessEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    MOBILE_CI_STATUS: "verified mobile CI run https://ci.example/mobile",
    BACKEND_CI_STATUS: "verified backend CI run https://ci.example/backend",
    E2E_PLATFORM: "verified iOS and Android release runners",
    SMOKE_E2E_STATUS: "verified smoke E2E run https://ci.example/smoke",
    E2E_RESULTS_ARTIFACT_PATH: "https://ci.example/artifacts/e2e",
    SMOKE_EXPORT_STATUS: "verified smoke export https://ci.example/export",
    SMOKE_FLOW_CONTRACT_STATUS: "verified smoke flow contracts https://ci.example/flow",
    TARGET_SDK_STATUS: "verified targetSdk 35",
    AAB_STATUS: "verified Android release artifact is AAB",
    BACKUP_RUN_URL: "https://ops.example/backup",
    RESTORE_RUN_URL: "https://ops.example/restore",
    DELETE_EVIDENCE_URL: "https://ops.example/delete",
    DELETE_EVIDENCE_NOTE: "verified disposable smoke user delete completed",
    CHAT_INTEGRITY_TEST_STATUS: "verified chat integrity tests https://ci.example/chat",
    ONBOARDING_ATOMIC_CONTRACT_STATUS:
      "verified atomic onboarding contract https://ci.example/onboarding",
    WEEKLY_REPORT_PREMIUM_GATE_STATUS:
      "verified weekly report premium gate https://ci.example/weekly",
    PAYWALL_TRUTHFULNESS_STATUS: "verified paywall/store offer evidence https://ops.example/paywall",
    PRIVACY_LOGGING_E2E_STATUS: "verified privacy logging evidence https://ops.example/privacy",
    SENTRY_SCRUBBING_EVIDENCE_URL: "https://ops.example/sentry",
    COMPLIANCE_PACKET_URL: "https://ops.example/compliance",
    RC_ROLLBACK_REHEARSAL_URL: "https://ops.example/rollback",
    ...overrides,
  };
}

function makeReadinessEvidenceFixture(flowIds: string[] = ["flow-one", "flow-two"]): {
  backendRepo: { repoDir: string; sha: string };
  exportSummaryPath: string;
  flowSummaryPath: string;
  mobileRepo: { repoDir: string; sha: string };
  outputPath: string;
  suitesPath: string;
} {
  const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-", [
    "reports/",
    "smoke-export-summary.json",
    "smoke-flow-summary.json",
    "suites.json",
  ]);
  const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
  const reportsDir = path.join(mobileRepo.repoDir, "reports");
  const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);
  const exportSummaryPath = path.join(mobileRepo.repoDir, "smoke-export-summary.json");
  const flowSummaryPath = path.join(mobileRepo.repoDir, "smoke-flow-summary.json");
  const suitesPath = writeSuiteConfig(mobileRepo.repoDir, flowIds);
  for (const flowId of flowIds) {
    writeJUnitReport(reportsDir, flowId);
  }
  const backendVersion = {
    verified: true,
    commitSha: backendRepo.sha,
    expectedCommitSha: backendRepo.sha,
  };
  fs.writeFileSync(exportSummaryPath, JSON.stringify({ backendVersion, counts: {} }), "utf8");
  fs.writeFileSync(flowSummaryPath, JSON.stringify({ backendVersion, checks: [] }), "utf8");
  return { backendRepo, exportSummaryPath, flowSummaryPath, mobileRepo, outputPath, suitesPath };
}

function runBackendRefResolver(env: Record<string, string>): string {
  return execFileSync("bash", ["scripts/resolve-backend-contract-ref.sh"], {
    cwd: rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function formatCommandError(error: unknown): string {
  return [
    String((error as { stdout?: Buffer | string }).stdout ?? ""),
    String((error as { stderr?: Buffer | string }).stderr ?? ""),
    String((error as Error).message ?? ""),
  ].join("\n");
}

function expectCommandToFail(command: () => void): string {
  try {
    command();
  } catch (error) {
    return formatCommandError(error);
  }

  throw new Error("Expected command to fail.");
}

function expectExecFileToFail(
  executable: string,
  args: string[],
  options: Parameters<typeof execFile>[2],
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, options, (error, stdout, stderr) => {
      if (!error) {
        reject(new Error("Expected command to fail."));
        return;
      }
      resolve([stdout, stderr, error.message].join("\n"));
    });
  });
}

function execFileAsync(
  executable: string,
  args: string[],
  options: Parameters<typeof execFile>[2],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error([stdout, stderr, error.message].join("\n")));
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

async function withVersionServer(
  payload: Record<string, unknown>,
  testBody: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer((request, response) => {
    if (request.url === "/api/v1/version") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ detail: "not found" }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  server.unref();

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to resolve local server address.");
    }
    await testBody(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        server.closeAllConnections();
        resolve();
      }, 250);
      server.close((error) => {
        clearTimeout(timeout);
        if (error) {
          server.closeAllConnections();
        }
        resolve();
      });
      server.closeAllConnections();
    });
  }
}

function exportRecordCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value === null || value === undefined) return 0;
  if (typeof value === "object") return Object.keys(value).length > 0 ? 1 : 0;
  return 1;
}

function withExportManifest(payload: Record<string, unknown>): Record<string, unknown> {
  const recordCounts = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, exportRecordCount(value)]),
  );
  return {
    ...payload,
    exportManifest: {
      schemaVersion: "user-export-manifest-v1",
      recordCounts,
    },
  };
}

function smokeExportPayload(): Record<string, unknown> {
  return withExportManifest({
    profile: { uid: "smoke-user" },
    meals: [{ id: "meal-1" }, { id: "meal-2" }],
    myMeals: [{ id: "saved-1" }],
    chatMessages: [],
    chatMemory: [],
    aiRuns: [],
    notifications: [],
    notificationPrefs: {},
    feedback: [],
    mealMutationDedupe: [],
    mealEffectOutbox: [{ eventId: "meal-effect-1" }],
    ingredientProducts: [{ id: "ingredient-product-1" }],
    smartMemoryItems: [{ id: "memory-item-1" }],
    smartMemoryCandidates: [],
    smartMemorySettings: [],
    smartMemoryTombstones: [],
    smartMemoryMutationDedupe: [],
    knownPatternControls: [{ id: "known-pattern-control-1" }],
    knownPatternMutationDedupe: [],
    plannedMealItems: [{ id: "planned-meal-1" }],
    plannedMealMutationDedupe: [],
    billing: [],
    aiCredits: [],
    aiCreditTransactions: [],
    aiCreditIdempotency: [],
    badges: [],
    streak: [],
    reminderDailyStats: [],
    telemetryEvents: [],
  });
}

async function withSmokeExportServer(
  exportPayload: Record<string, unknown>,
  testBody: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer((request, response) => {
    if (request.url === "/api/v1/version") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ version: "0.1.0", commitSha: backendSha }));
      return;
    }
    if (request.url?.startsWith("/accounts:signInWithPassword")) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ idToken: "token-1", localId: "local-user-1" }));
      return;
    }
    if (request.url === "/api/v1/users/me/export") {
      if (request.headers.authorization !== "Bearer token-1") {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ detail: "UNAUTHENTICATED" }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(exportPayload));
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ detail: "not found" }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  server.unref();

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to resolve local server address.");
    }
    await testBody(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        server.closeAllConnections();
        resolve();
      }, 250);
      server.close((error) => {
        clearTimeout(timeout);
        if (error) {
          server.closeAllConnections();
        }
        resolve();
      });
      server.closeAllConnections();
    });
  }
}

async function withTelemetrySmokeServer(
  options: {
    disabled?: boolean;
    malformedIngest?: boolean;
    slowHealth?: boolean;
    versionSha?: string;
  },
  testBody: (baseUrl: string) => Promise<void>,
): Promise<void> {
  let telemetryCalls = 0;
  const server = http.createServer((request, response) => {
    if (request.url === "/api/v1/version") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ version: "0.1.0", commitSha: options.versionSha ?? backendSha }));
      return;
    }
    if (request.url === "/api/v1/health") {
      if (options.slowHealth) {
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (request.url?.startsWith("/accounts:signInWithPassword")) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ idToken: "test-token-should-not-leak", localId: "raw-user-id-should-not-leak" }));
      return;
    }
    if (request.url === "/api/v2/telemetry/events/batch") {
      if (request.headers.authorization !== "Bearer test-token-should-not-leak") {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ detail: "UNAUTHENTICATED" }));
        return;
      }
      if (options.disabled) {
        response.writeHead(503, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ detail: { code: "TELEMETRY_DISABLED" } }));
        return;
      }
      if (options.malformedIngest) {
        response.writeHead(202, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ acceptedCount: 1 }));
        return;
      }
      telemetryCalls += 1;
      response.writeHead(202, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        acceptedCount: telemetryCalls === 1 ? 1 : 0,
        duplicateCount: telemetryCalls === 1 ? 0 : 1,
        rejectedCount: 0,
        rejectedEvents: [],
      }));
      return;
    }
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ detail: "not found" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  server.unref();
  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to resolve local telemetry server address.");
    }
    await testBody(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractYamlBlock(
  content: string,
  startPattern: RegExp,
  nextPeerPattern: RegExp,
  label: string,
): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => startPattern.test(line));
  if (start === -1) {
    throw new Error(`Missing workflow block: ${label}`);
  }

  const relativeEnd = lines
    .slice(start + 1)
    .findIndex((line) => nextPeerPattern.test(line));
  const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;
  return lines.slice(start, end).join("\n");
}

function workflowJob(workflow: string, jobId: string): string {
  return extractYamlBlock(
    workflow,
    new RegExp(`^  ${escapeRegExp(jobId)}:\\s*$`),
    /^ {2}[A-Za-z0-9_-]+:\s*$/,
    `job ${jobId}`,
  );
}

function workflowStep(job: string, stepName: string): string {
  return extractYamlBlock(
    job,
    new RegExp(`^      - name: ${escapeRegExp(stepName)}\\s*$`),
    /^ {6}- name: /,
    `step ${stepName}`,
  );
}

describe("release candidate workflow evidence wiring", () => {
  it("uses JUnit-backed core release gate evidence instead of a manual passed status", () => {
    const workflow = fs.readFileSync(
      path.join(rootDir, ".github/workflows/release-candidate.yml"),
      "utf8",
    );
    const releaseGateJob = workflowJob(workflow, "release-gate-e2e");
    const releaseEvidenceJob = workflowJob(workflow, "release-evidence");
    const telemetryJob = workflowJob(workflow, "smoke-telemetry");
    const runStep = workflowStep(releaseGateJob, "Run core release gate E2E suite");
    const uploadStep = workflowStep(releaseGateJob, "Upload core release gate JUnit reports");
    const downloadStep = workflowStep(
      releaseEvidenceJob,
      "Download core release gate E2E reports",
    );
    const renderStep = workflowStep(releaseEvidenceJob, "Render release evidence markdown");

    expect(releaseGateJob).not.toContain("run: npm run e2e:release-gate");
    expect(telemetryJob).toContain("node scripts/verify-smoke-telemetry.mjs artifacts/smoke-telemetry-summary.json");
    expect(telemetryJob).toContain("EXPECTED_BACKEND_COMMIT_SHA: ${{ needs.validate-release-pair.outputs.backend_sha }}");
    expect(telemetryJob).toContain("name: smoke-telemetry-summary");
    expect(telemetryJob).not.toContain("continue-on-error");
    expect(releaseEvidenceJob).toContain("- smoke-telemetry");
    expect(releaseEvidenceJob).toContain("name: smoke-telemetry-summary");
    expect(releaseGateJob).toContain('E2E_SKIP_API_HEALTH: "0"');
    expect(releaseGateJob).toContain("E2E_API_BASE_URL: http://127.0.0.1:8000");
    expect(releaseGateJob).toContain("FIRESTORE_EMULATOR_HOST: 127.0.0.1:8080");
    expect(releaseGateJob).toContain("FIREBASE_AUTH_EMULATOR_HOST: 127.0.0.1:9099");
    expect(releaseGateJob).toContain("Start backend API on port 8000");
    expect(releaseGateJob).toContain("Wait for local backend health");
    expect(releaseGateJob).toContain("E2E_EMAIL: e2e@example.com");
    expect(releaseGateJob).not.toContain("secrets.SMOKE_EXPORT_TEST_EMAIL");
    expect(releaseGateJob).not.toContain("secrets.SMOKE_EXPORT_TEST_PASSWORD");
    expect(runStep).toContain("run: npm run e2e:core-release-gate");
    expect(uploadStep).toContain("name: e2e-core-release-gate-${{ env.E2E_PLATFORM }}");
    expect(uploadStep).toContain("path: release-gate-reports/*.xml");
    expect(uploadStep).toContain("if-no-files-found: error");
    expect(downloadStep).toContain("name: e2e-core-release-gate-${{ inputs.platform || 'ios' }}");
    expect(downloadStep).toContain("path: release-gate-reports");
    expect(renderStep).toContain("RELEASE_GATE_RESULTS_DIR: release-gate-reports");
    expect(renderStep).toContain('RELEASE_GATE_EXPECTED_FLOW_COUNT: "20"');
    expect(renderStep).toContain("RELEASE_GATE_EXPECTED_SUITE_KEY: core-release-gate");
    expect(renderStep).toContain("RELEASE_GATE_SUITE_NAME: core-release-gate");
    expect(renderStep).toContain("MOBILE_CI_STATUS: verified mobile-ci job in");
    expect(renderStep).toContain("BACKEND_CI_STATUS: verified backend-ci job in");
    expect(renderStep).toContain("SMOKE_E2E_STATUS: verified smoke-e2e job in");
    expect(renderStep).toContain("SMOKE_EXPORT_STATUS: verified smoke-export job in");
    expect(renderStep).toContain(
      "SMOKE_FLOW_CONTRACT_STATUS: verified smoke-flow-contracts job in",
    );
    expect(renderStep).toContain("TARGET_SDK_STATUS: verified via launch-readiness gate in");
    expect(renderStep).toContain("AAB_STATUS: verified via launch-readiness gate in");
    expect(renderStep).toContain("CHAT_INTEGRITY_TEST_STATUS: verified via mobile CI in");
    expect(renderStep).toContain(
      "ONBOARDING_ATOMIC_CONTRACT_STATUS: verified via backend CI in",
    );
    expect(renderStep).toContain(
      "WEEKLY_REPORT_PREMIUM_GATE_STATUS: verified via backend CI in",
    );
    expect(renderStep).toContain(
      "E2E_RESULTS_ARTIFACT_PATH: GitHub Actions artifact e2e-core-release-gate-${{ inputs.platform || 'ios' }} in",
    );
    expect(renderStep).not.toMatch(/(?:MOBILE_CI_STATUS|BACKEND_CI_STATUS|SMOKE_E2E_STATUS|SMOKE_EXPORT_STATUS|SMOKE_FLOW_CONTRACT_STATUS):\s*["']?passed["']?\b/);
    expect(renderStep).not.toMatch(/RELEASE_GATE_E2E_STATUS:\s*["']?passed["']?\b/);
    expect(renderStep).not.toMatch(
      /EVIDENCE_DECISION:\s*["']?(CORE_RC_READY|FULL_1_1_RC_READY)["']?\b/,
    );
  });
});

describe("resolve-backend-contract-ref exact SHA mode", () => {
  it("accepts an exact backend SHA and writes it to GITHUB_OUTPUT", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-ref-"));
    const outputPath = path.join(tempDir, "github-output");

    const stdout = runBackendRefResolver({
      BACKEND_CONTRACT_REF_INPUT: backendSha,
      BACKEND_CONTRACT_REF_REQUIRE_EXACT_SHA: "true",
      GITHUB_OUTPUT: outputPath,
    });

    expect(stdout).toContain(`Selected backend contract ref: ${backendSha}`);
    expect(fs.readFileSync(outputPath, "utf8")).toContain(`sha=${backendSha}`);
  });

  it("rejects a moving branch ref in exact SHA mode", () => {
    const output = expectCommandToFail(() =>
      runBackendRefResolver({
        BACKEND_CONTRACT_REF_INPUT: "main",
        BACKEND_CONTRACT_REF_REQUIRE_EXACT_SHA: "true",
      }),
    );

    expect(output).toContain("must be an exact 40-character commit SHA");
  });

  it("rejects a PR marker branch ref in exact SHA mode", () => {
    const output = expectCommandToFail(() =>
      runBackendRefResolver({
        BACKEND_CONTRACT_REF_REQUIRE_EXACT_SHA: "true",
        PR_BODY: "Backend-Contract-Ref: feature/backend-contract",
      }),
    );

    expect(output).toContain("must be an exact 40-character commit SHA");
  });
});

describe("render-release-evidence release pair fields", () => {
  it("writes exact mobile/backend SHAs, target environment, and feature flags", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-"));
    const outputPath = path.join(tempDir, "release-evidence.md");
    const exportSummaryPath = path.join(tempDir, "smoke-export-summary.json");
    const flowSummaryPath = path.join(tempDir, "smoke-flow-summary.json");
    const backendVersion = {
      verified: true,
      commitSha: backendSha,
      expectedCommitSha: backendSha,
      endpoint: "/api/v1/version",
      status: 200,
    };

    fs.writeFileSync(
      exportSummaryPath,
      JSON.stringify({ backendVersion, counts: {} }),
      "utf8",
    );
    fs.writeFileSync(
      flowSummaryPath,
      JSON.stringify({ backendVersion, checks: [] }),
      "utf8",
    );

    const evidenceRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-clean-"));
    execFileSync("git", ["init", "-q"], { cwd: evidenceRepoDir });

    execFileSync(
      "node",
      [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath],
      {
        cwd: evidenceRepoDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "dirty: ignored env status",
          BACKEND_SHA: backendSha,
          BACKEND_WORKTREE_STATUS: "clean",
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "BLOCKED_EXTERNAL_DEPENDENCY",
          EVIDENCE_LIMITATIONS: "provider evidence not supplied",
          EXPORT_SUMMARY_PATH: exportSummaryPath,
          FLOW_SUMMARY_PATH: flowSummaryPath,
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      },
    );

    const evidence = fs.readFileSync(outputPath, "utf8");
    expect(evidence).toContain(`- Mobile commit SHA: ${mobileSha}`);
    expect(evidence).toContain("- Mobile worktree status: clean");
    expect(evidence).toContain(`- Backend commit SHA: ${backendSha}`);
    expect(evidence).toContain("- Backend worktree status: clean");
    expect(evidence).toContain("- Target environment: production");
    expect(evidence).toContain("- Evidence decision: BLOCKED_EXTERNAL_DEPENDENCY");
    expect(evidence).toContain("- Evidence limitations: provider evidence not supplied");
    expect(evidence).toContain(
      `- Smoke runtime backend SHA: verified smoke_export=${backendSha}, smoke_flow_contracts=${backendSha}`,
    );
    expect(evidence).toContain('"EXPO_PUBLIC_ENABLE_TELEMETRY":"true"');
    expect(evidence).toContain('"DISABLE_BILLING":"false"');
    expect(evidence).toContain('"EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION":"false"');
    expect(evidence).toContain('"EXPO_PUBLIC_ENABLE_SMART_MEMORY":"false"');
  });

  it("writes verified release gate status from JUnit reports when a results directory is provided", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-junit-"));
    const reportsDir = path.join(tempDir, "reports");
    const outputPath = path.join(tempDir, "release-evidence.md");
    writeJUnitReport(reportsDir, "flow-one");
    writeJUnitReport(reportsDir, "flow-two");
    const suitesPath = writeSuiteConfig(tempDir, ["flow-one", "flow-two"]);

    execFileSync(
      "node",
      [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath],
      {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "dirty: 1 modified",
          BACKEND_SHA: backendSha,
          BACKEND_WORKTREE_STATUS: "dirty: 1 modified",
          TARGET_ENVIRONMENT: "production",
          RELEASE_GATE_E2E_STATUS: "manually claimed pass",
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
          RELEASE_GATE_EXPECTED_SUITE_KEY: "core-release-gate",
          RELEASE_GATE_SUITES_PATH: suitesPath,
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      },
    );

    const evidence = fs.readFileSync(outputPath, "utf8");
    expect(evidence).toContain(
      "- Release gate E2E: verified 2/2 flow report(s), 2 testcase(s), failures=0, errors=0, skipped=0 from reports",
    );
    expect(evidence).not.toContain("manually claimed pass");
  });

  it("rejects incomplete release gate JUnit report directories", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-junit-"));
    const reportsDir = path.join(tempDir, "reports");
    const outputPath = path.join(tempDir, "release-evidence.md");
    writeJUnitReport(reportsDir, "flow-one");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "clean",
          BACKEND_SHA: backendSha,
          BACKEND_WORKTREE_STATUS: "clean",
          TARGET_ENVIRONMENT: "production",
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain("Release gate expected 2 JUnit XML report(s), found 1");
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release gate JUnit flow id mismatches", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-junit-"));
    const reportsDir = path.join(tempDir, "reports");
    const outputPath = path.join(tempDir, "release-evidence.md");
    const suitesPath = writeSuiteConfig(tempDir, ["flow-one", "flow-two"]);
    writeJUnitReport(reportsDir, "flow-one");
    writeJUnitReport(reportsDir, "unexpected-flow");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "clean",
          BACKEND_SHA: backendSha,
          BACKEND_WORKTREE_STATUS: "clean",
          TARGET_ENVIRONMENT: "production",
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
          RELEASE_GATE_EXPECTED_SUITE_KEY: "core-release-gate",
          RELEASE_GATE_SUITES_PATH: suitesPath,
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain(
      "Release gate JUnit flow id mismatch. Missing: flow-two. Unexpected: unexpected-flow.",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects failed release gate JUnit reports", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-junit-"));
    const reportsDir = path.join(tempDir, "reports");
    const outputPath = path.join(tempDir, "release-evidence.md");
    writeJUnitReport(reportsDir, "flow-one", { failures: 1, includeFailureNode: true });

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "clean",
          BACKEND_SHA: backendSha,
          BACKEND_WORKTREE_STATUS: "clean",
          TARGET_ENVIRONMENT: "production",
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "1",
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain(
      "Release gate JUnit reports contain failures=1, errors=0, skipped=0",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects skipped release gate JUnit reports", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-junit-"));
    const reportsDir = path.join(tempDir, "reports");
    const outputPath = path.join(tempDir, "release-evidence.md");
    writeJUnitReport(reportsDir, "flow-one", { skipped: 1, includeSkippedNode: true });

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "clean",
          BACKEND_SHA: backendSha,
          BACKEND_WORKTREE_STATUS: "clean",
          TARGET_ENVIRONMENT: "production",
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "1",
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain(
      "Release gate JUnit reports contain failures=0, errors=0, skipped=1",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions with missing evidence fields", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-");
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain(
      "Release readiness decision CORE_RC_READY requires complete evidence",
    );
    expect(output).toContain('Mobile CI="unknown"');
    expect(output).toContain('Latest Firestore backup="missing"');
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions with negated verified evidence", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-");
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          MOBILE_CI_STATUS: "not verified",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain("requires complete evidence");
    expect(output).toContain('Mobile CI="not verified"');
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions without JUnit-verified release gate evidence", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-ready-"));
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-");
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const outputPath = path.join(tempDir, "release-evidence.md");
    const exportSummaryPath = path.join(tempDir, "smoke-export-summary.json");
    const flowSummaryPath = path.join(tempDir, "smoke-flow-summary.json");
    const backendVersion = {
      verified: true,
      commitSha: backendRepo.sha,
      expectedCommitSha: backendRepo.sha,
    };
    fs.writeFileSync(exportSummaryPath, JSON.stringify({ backendVersion, counts: {} }), "utf8");
    fs.writeFileSync(flowSummaryPath, JSON.stringify({ backendVersion, checks: [] }), "utf8");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          ...completeReadinessEnv(),
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
          EXPORT_SUMMARY_PATH: exportSummaryPath,
          FLOW_SUMMARY_PATH: flowSummaryPath,
          RELEASE_GATE_E2E_STATUS:
            "verified manually claimed release gate without junit https://ci.example/release",
        },
      }),
    );

    expect(output).toContain(
      "requires RELEASE_GATE_RESULTS_DIR JUnit evidence for Release gate E2E",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions without expected release gate JUnit breadth", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-", [
      "reports/",
      "smoke-export-summary.json",
      "smoke-flow-summary.json",
    ]);
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const reportsDir = path.join(mobileRepo.repoDir, "reports");
    const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);
    const exportSummaryPath = path.join(mobileRepo.repoDir, "smoke-export-summary.json");
    const flowSummaryPath = path.join(mobileRepo.repoDir, "smoke-flow-summary.json");
    writeJUnitReport(reportsDir, "single-flow");
    const backendVersion = {
      verified: true,
      commitSha: backendRepo.sha,
      expectedCommitSha: backendRepo.sha,
    };
    fs.writeFileSync(exportSummaryPath, JSON.stringify({ backendVersion, counts: {} }), "utf8");
    fs.writeFileSync(flowSummaryPath, JSON.stringify({ backendVersion, checks: [] }), "utf8");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          ...completeReadinessEnv(),
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          EVIDENCE_LIMITATIONS: "none",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
          EXPORT_SUMMARY_PATH: exportSummaryPath,
          FLOW_SUMMARY_PATH: flowSummaryPath,
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
        },
      }),
    );

    expect(output).toContain("requires RELEASE_GATE_EXPECTED_FLOW_COUNT");
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions when git-derived worktrees are dirty", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-");
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    fs.writeFileSync(path.join(mobileRepo.repoDir, "dirty.txt"), "local change", "utf8");
    const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain(
      "Mobile worktree status must be clean when clean worktree evidence is required",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions when declared SHA does not match git HEAD", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-");
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain("Mobile git HEAD must match declared MOBILE_SHA");
    expect(output).toContain(mobileSha);
    expect(output).toContain(mobileRepo.sha);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions with local-only evidence fields", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-", [
      "reports/",
      "smoke-export-summary.json",
      "smoke-flow-summary.json",
      "suites.json",
    ]);
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const reportsDir = path.join(mobileRepo.repoDir, "reports");
    const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);
    const exportSummaryPath = path.join(mobileRepo.repoDir, "smoke-export-summary.json");
    const flowSummaryPath = path.join(mobileRepo.repoDir, "smoke-flow-summary.json");
    const suitesPath = writeSuiteConfig(mobileRepo.repoDir, ["flow-one", "flow-two"]);
    writeJUnitReport(reportsDir, "flow-one");
    writeJUnitReport(reportsDir, "flow-two");
    const backendVersion = {
      verified: true,
      commitSha: backendRepo.sha,
      expectedCommitSha: backendRepo.sha,
    };
    fs.writeFileSync(exportSummaryPath, JSON.stringify({ backendVersion, counts: {} }), "utf8");
    fs.writeFileSync(flowSummaryPath, JSON.stringify({ backendVersion, checks: [] }), "utf8");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          ...completeReadinessEnv({
            E2E_PLATFORM: "verified local iOS simulator no-provider",
            SMOKE_E2E_STATUS: "verified local smoke run",
          }),
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          EVIDENCE_LIMITATIONS: "none",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
          EXPORT_SUMMARY_PATH: exportSummaryPath,
          FLOW_SUMMARY_PATH: flowSummaryPath,
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
          RELEASE_GATE_EXPECTED_SUITE_KEY: "core-release-gate",
          RELEASE_GATE_SUITES_PATH: suitesPath,
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
        },
      }),
    );

    expect(output).toContain("requires external/provider-backed evidence");
    expect(output).toContain('Selected E2E platform="verified local iOS simulator no-provider"');
    expect(output).toContain('Smoke E2E="verified local smoke run"');
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions with literal placeholder evidence", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-", [
      "reports/",
      "smoke-export-summary.json",
      "smoke-flow-summary.json",
      "suites.json",
    ]);
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const reportsDir = path.join(mobileRepo.repoDir, "reports");
    const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);
    const exportSummaryPath = path.join(mobileRepo.repoDir, "smoke-export-summary.json");
    const flowSummaryPath = path.join(mobileRepo.repoDir, "smoke-flow-summary.json");
    const suitesPath = writeSuiteConfig(mobileRepo.repoDir, ["flow-one", "flow-two"]);
    writeJUnitReport(reportsDir, "flow-one");
    writeJUnitReport(reportsDir, "flow-two");
    const backendVersion = {
      verified: true,
      commitSha: backendRepo.sha,
      expectedCommitSha: backendRepo.sha,
    };
    fs.writeFileSync(exportSummaryPath, JSON.stringify({ backendVersion, counts: {} }), "utf8");
    fs.writeFileSync(flowSummaryPath, JSON.stringify({ backendVersion, checks: [] }), "utf8");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          ...completeReadinessEnv({ BACKUP_RUN_URL: "placeholder" }),
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          EVIDENCE_LIMITATIONS: "none",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
          EXPORT_SUMMARY_PATH: exportSummaryPath,
          FLOW_SUMMARY_PATH: flowSummaryPath,
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
          RELEASE_GATE_EXPECTED_SUITE_KEY: "core-release-gate",
          RELEASE_GATE_SUITES_PATH: suitesPath,
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
        },
      }),
    );

    expect(output).toContain("requires complete evidence");
    expect(output).toContain('Latest Firestore backup="placeholder"');
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects release readiness decisions with generic passed evidence fields", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-", [
      "reports/",
      "smoke-export-summary.json",
      "smoke-flow-summary.json",
      "suites.json",
    ]);
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const reportsDir = path.join(mobileRepo.repoDir, "reports");
    const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}.md`);
    const exportSummaryPath = path.join(mobileRepo.repoDir, "smoke-export-summary.json");
    const flowSummaryPath = path.join(mobileRepo.repoDir, "smoke-flow-summary.json");
    const suitesPath = writeSuiteConfig(mobileRepo.repoDir, ["flow-one", "flow-two"]);
    writeJUnitReport(reportsDir, "flow-one");
    writeJUnitReport(reportsDir, "flow-two");
    const backendVersion = {
      verified: true,
      commitSha: backendRepo.sha,
      expectedCommitSha: backendRepo.sha,
    };
    fs.writeFileSync(exportSummaryPath, JSON.stringify({ backendVersion, counts: {} }), "utf8");
    fs.writeFileSync(flowSummaryPath, JSON.stringify({ backendVersion, checks: [] }), "utf8");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          ...completeReadinessEnv({
            MOBILE_CI_STATUS: "passed",
            BACKEND_CI_STATUS: "done",
            SMOKE_EXPORT_STATUS: "verified ok",
            SMOKE_FLOW_CONTRACT_STATUS: "verified passed",
          }),
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          EVIDENCE_LIMITATIONS: "none",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
          EXPORT_SUMMARY_PATH: exportSummaryPath,
          FLOW_SUMMARY_PATH: flowSummaryPath,
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
          RELEASE_GATE_EXPECTED_SUITE_KEY: "core-release-gate",
          RELEASE_GATE_SUITES_PATH: suitesPath,
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
        },
      }),
    );

    expect(output).toContain("requires proof-backed evidence");
    expect(output).toContain('Mobile CI="passed"');
    expect(output).toContain('Backend CI="done"');
    expect(output).toContain('Smoke export="verified ok"');
    expect(output).toContain('Smoke flow contracts="verified passed"');
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects full 1.1 release readiness backed only by the core release gate suite", () => {
    const fixture = makeReadinessEvidenceFixture();

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), fixture.outputPath], {
        cwd: fixture.mobileRepo.repoDir,
        env: {
          ...process.env,
          ...completeReadinessEnv(),
          MOBILE_SHA: fixture.mobileRepo.sha,
          BACKEND_SHA: fixture.backendRepo.sha,
          BACKEND_REPO: fixture.backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "FULL_1_1_RC_READY",
          EVIDENCE_LIMITATIONS: "none",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
          EXPORT_SUMMARY_PATH: fixture.exportSummaryPath,
          FLOW_SUMMARY_PATH: fixture.flowSummaryPath,
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
          RELEASE_GATE_EXPECTED_SUITE_KEY: "core-release-gate",
          RELEASE_GATE_SUITES_PATH: fixture.suitesPath,
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
        },
      }),
    );

    expect(output).toContain("requires RELEASE_GATE_EXPECTED_SUITE_KEY=release-gate");
    expect(output).toContain("got core-release-gate");
    expect(fs.existsSync(fixture.outputPath)).toBe(false);
  });

  it("rejects release readiness decisions with local file artifact evidence", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-", [
      "reports/",
      "smoke-export-summary.json",
      "smoke-flow-summary.json",
      "suites.json",
    ]);
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const reportsDir = path.join(mobileRepo.repoDir, "reports");
    const exportSummaryPath = path.join(mobileRepo.repoDir, "smoke-export-summary.json");
    const flowSummaryPath = path.join(mobileRepo.repoDir, "smoke-flow-summary.json");
    const suitesPath = writeSuiteConfig(mobileRepo.repoDir, ["flow-one", "flow-two"]);
    writeJUnitReport(reportsDir, "flow-one");
    writeJUnitReport(reportsDir, "flow-two");
    const backendVersion = {
      verified: true,
      commitSha: backendRepo.sha,
      expectedCommitSha: backendRepo.sha,
    };
    fs.writeFileSync(exportSummaryPath, JSON.stringify({ backendVersion, counts: {} }), "utf8");
    fs.writeFileSync(flowSummaryPath, JSON.stringify({ backendVersion, checks: [] }), "utf8");

    const localArtifactPaths = [
      "file:///Users/lukaszkurczab/Desktop/Projects/Fitaly/fitaly/e2e-artifact.zip",
      "/var/folders/q0l-artifact.zip",
      "/Volumes/build-artifacts/q0l.zip",
    ];

    for (const [index, artifactPath] of localArtifactPaths.entries()) {
      const outputPath = path.join(os.tmpdir(), `fitaly-evidence-${Date.now()}-${index}.md`);
      const output = expectCommandToFail(() =>
        execFileSync(
          "node",
          [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath],
          {
            cwd: mobileRepo.repoDir,
            env: {
              ...process.env,
              ...completeReadinessEnv({
                E2E_RESULTS_ARTIFACT_PATH: artifactPath,
              }),
              MOBILE_SHA: mobileRepo.sha,
              BACKEND_SHA: backendRepo.sha,
              BACKEND_REPO: backendRepo.repoDir,
              TARGET_ENVIRONMENT: "production",
              EVIDENCE_DECISION: "CORE_RC_READY",
              EVIDENCE_LIMITATIONS: "none",
              FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
              EXPORT_SUMMARY_PATH: exportSummaryPath,
              FLOW_SUMMARY_PATH: flowSummaryPath,
              RELEASE_GATE_RESULTS_DIR: "reports",
              RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
              RELEASE_GATE_EXPECTED_SUITE_KEY: "core-release-gate",
              RELEASE_GATE_SUITES_PATH: suitesPath,
              RELEASE_GATE_SUITE_NAME: "core-release-gate",
            },
          },
        ),
      );

      expect(output).toContain("requires external/provider-backed evidence");
      expect(output).toContain(`E2E results artifact="${artifactPath}"`);
      expect(fs.existsSync(outputPath)).toBe(false);
    }
  });

  it("allows release readiness decisions only with complete verified evidence", () => {
    const mobileRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-mobile-", [
      "reports/",
      "smoke-export-summary.json",
      "smoke-flow-summary.json",
      "suites.json",
    ]);
    const backendRepo = makeCleanGitDirWithCommit("fitaly-evidence-ready-backend-");
    const reportsDir = path.join(mobileRepo.repoDir, "reports");
    const outputPath = path.join(mobileRepo.repoDir, "release-evidence.md");
    const exportSummaryPath = path.join(mobileRepo.repoDir, "smoke-export-summary.json");
    const flowSummaryPath = path.join(mobileRepo.repoDir, "smoke-flow-summary.json");
    const suitesPath = writeSuiteConfig(mobileRepo.repoDir, ["flow-one", "flow-two"]);
    writeJUnitReport(reportsDir, "flow-one");
    writeJUnitReport(reportsDir, "flow-two");
    const backendVersion = {
      verified: true,
      commitSha: backendRepo.sha,
      expectedCommitSha: backendRepo.sha,
    };
    fs.writeFileSync(exportSummaryPath, JSON.stringify({ backendVersion, counts: {} }), "utf8");
    fs.writeFileSync(flowSummaryPath, JSON.stringify({ backendVersion, checks: [] }), "utf8");

    execFileSync(
      "node",
      [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath],
      {
        cwd: mobileRepo.repoDir,
        env: {
          ...process.env,
          ...completeReadinessEnv(),
          MOBILE_SHA: mobileRepo.sha,
          BACKEND_SHA: backendRepo.sha,
          BACKEND_REPO: backendRepo.repoDir,
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "CORE_RC_READY",
          EVIDENCE_LIMITATIONS: "none",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
          EXPORT_SUMMARY_PATH: exportSummaryPath,
          FLOW_SUMMARY_PATH: flowSummaryPath,
          RELEASE_GATE_RESULTS_DIR: "reports",
          RELEASE_GATE_EXPECTED_FLOW_COUNT: "2",
          RELEASE_GATE_EXPECTED_SUITE_KEY: "core-release-gate",
          RELEASE_GATE_SUITES_PATH: suitesPath,
          RELEASE_GATE_SUITE_NAME: "core-release-gate",
        },
      },
    );

    const evidence = fs.readFileSync(outputPath, "utf8");
    expect(evidence).toContain("- Evidence decision: CORE_RC_READY");
    expect(evidence).toContain(
      "- Release gate E2E: verified 2/2 flow report(s), 2 testcase(s), failures=0, errors=0, skipped=0",
    );
    expect(evidence).toContain(
      `- Smoke runtime backend SHA: verified smoke_export=${backendRepo.sha}, smoke_flow_contracts=${backendRepo.sha}`,
    );
    expect(evidence).toContain("- Mobile worktree status: clean");
    expect(evidence).toContain("- Backend worktree status: clean");
  });

  it("allows dirty worktree evidence from env only when repo status is unavailable", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-"));
    const outputPath = path.join(tempDir, "release-evidence.md");

    execFileSync(
      "node",
      [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath],
      {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "dirty: 2 modified files",
          BACKEND_SHA: backendSha,
          BACKEND_WORKTREE_STATUS: "dirty: 1 untracked file",
          TARGET_ENVIRONMENT: "production",
          EVIDENCE_DECISION: "BLOCKED_EXTERNAL_DEPENDENCY",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      },
    );

    const evidence = fs.readFileSync(outputPath, "utf8");
    expect(evidence).toContain("- Mobile worktree status: dirty: 2 modified files");
    expect(evidence).toContain("- Backend worktree status: dirty: 1 untracked file");
    expect(evidence).toContain("- Evidence decision: BLOCKED_EXTERNAL_DEPENDENCY");
  });

  it("auto-records git dirty status when worktree status env is omitted", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-git-"));
    const backendDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-backend-git-"));
    execFileSync("git", ["init", "-q"], { cwd: tempDir });
    execFileSync("git", ["init", "-q"], { cwd: backendDir });
    fs.writeFileSync(path.join(tempDir, "dirty.txt"), "local change", "utf8");
    const outputPath = path.join(tempDir, "release-evidence.md");

    execFileSync(
      "node",
      [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath],
      {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          BACKEND_SHA: backendSha,
          BACKEND_REPO: backendDir,
          TARGET_ENVIRONMENT: "production",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      },
    );

    const evidence = fs.readFileSync(outputPath, "utf8");
    expect(evidence).toContain("- Mobile worktree status: dirty: 1 untracked");
    expect(evidence).toContain("- Backend worktree status: clean");
  });

  it("rejects dirty worktree evidence when clean worktrees are required", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-dirty-"));
    const backendDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-clean-backend-"));
    execFileSync("git", ["init", "-q"], { cwd: tempDir });
    execFileSync("git", ["init", "-q"], { cwd: backendDir });
    fs.writeFileSync(path.join(tempDir, "dirty.txt"), "local change", "utf8");
    const outputPath = path.join(tempDir, "release-evidence.md");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "clean",
          BACKEND_SHA: backendSha,
          BACKEND_REPO: backendDir,
          BACKEND_WORKTREE_STATUS: "clean",
          TARGET_ENVIRONMENT: "production",
          REQUIRE_CLEAN_WORKTREE: "true",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain(
      "Mobile worktree status must be clean when clean worktree evidence is required",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects backend-only dirty worktree evidence when clean worktrees are required", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-clean-mobile-"));
    const backendDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-dirty-backend-"));
    execFileSync("git", ["init", "-q"], { cwd: tempDir });
    execFileSync("git", ["init", "-q"], { cwd: backendDir });
    fs.writeFileSync(path.join(backendDir, "dirty.txt"), "local change", "utf8");
    const outputPath = path.join(tempDir, "release-evidence.md");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "clean",
          BACKEND_SHA: backendSha,
          BACKEND_REPO: backendDir,
          BACKEND_WORKTREE_STATUS: "clean",
          TARGET_ENVIRONMENT: "production",
          REQUIRE_CLEAN_WORKTREE: "true",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain(
      "Backend worktree status must be clean when clean worktree evidence is required",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects clean-worktree evidence without backend git evidence", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-clean-mobile-"));
    execFileSync("git", ["init", "-q"], { cwd: tempDir });
    const outputPath = path.join(tempDir, "release-evidence.md");

    const output = expectCommandToFail(() =>
      execFileSync("node", [path.join(rootDir, "scripts/render-release-evidence.mjs"), outputPath], {
        cwd: tempDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          MOBILE_WORKTREE_STATUS: "clean",
          BACKEND_SHA: backendSha,
          BACKEND_WORKTREE_STATUS: "clean",
          TARGET_ENVIRONMENT: "production",
          REQUIRE_CLEAN_WORKTREE: "true",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(productionOffFeatureSnapshot),
        },
      }),
    );

    expect(output).toContain(
      "Backend worktree status must come from git when clean worktree evidence is required",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects missing production C2 feature flags in explicit evidence snapshot", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-"));
    const outputPath = path.join(tempDir, "release-evidence.md");
    const snapshot = {
      EXPO_PUBLIC_ENABLE_FOOD_LIBRARY: "false",
      EXPO_PUBLIC_ENABLE_KNOWN_PATTERNS: "false",
      EXPO_PUBLIC_ENABLE_RECIPE_CATALOG: "false",
      EXPO_PUBLIC_ENABLE_PLANNING: "false",
      EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION: "false",
      EXPO_PUBLIC_ENABLE_REVIEW_MEMORY_EXPLANATION: "false",
    };

    const output = expectCommandToFail(() =>
      execFileSync("node", ["scripts/render-release-evidence.mjs", outputPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          BACKEND_SHA: backendSha,
          TARGET_ENVIRONMENT: "production",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(snapshot),
        },
      }),
    );

    expect(output).toContain(
      "Production feature flag snapshot is missing EXPO_PUBLIC_ENABLE_SMART_MEMORY",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects enabled production C2 feature flags in explicit evidence snapshot", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-"));
    const outputPath = path.join(tempDir, "release-evidence.md");
    const snapshot = {
      EXPO_PUBLIC_ENABLE_FOOD_LIBRARY: "false",
      EXPO_PUBLIC_ENABLE_SMART_MEMORY: "false",
      EXPO_PUBLIC_ENABLE_KNOWN_PATTERNS: "false",
      EXPO_PUBLIC_ENABLE_RECIPE_CATALOG: "true",
      EXPO_PUBLIC_ENABLE_PLANNING: "false",
      EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION: "false",
      EXPO_PUBLIC_ENABLE_REVIEW_MEMORY_EXPLANATION: "false",
    };

    const output = expectCommandToFail(() =>
      execFileSync("node", ["scripts/render-release-evidence.mjs", outputPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          BACKEND_SHA: backendSha,
          TARGET_ENVIRONMENT: "production",
          FEATURE_FLAG_SNAPSHOT: JSON.stringify(snapshot),
        },
      }),
    );

    expect(output).toContain(
      "Production feature flag EXPO_PUBLIC_ENABLE_RECIPE_CATALOG must be false",
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects non-SHA backend evidence", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-"));
    const outputPath = path.join(tempDir, "release-evidence.md");

    const output = expectCommandToFail(() =>
      execFileSync("node", ["scripts/render-release-evidence.mjs", outputPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          BACKEND_SHA: "main",
          TARGET_ENVIRONMENT: "production",
        },
      }),
    );

    expect(output).toContain("BACKEND_SHA must be an exact 40-character commit SHA");
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("rejects smoke summary runtime SHA mismatch", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-evidence-"));
    const outputPath = path.join(tempDir, "release-evidence.md");
    const exportSummaryPath = path.join(tempDir, "smoke-export-summary.json");

    fs.writeFileSync(
      exportSummaryPath,
      JSON.stringify({
        backendVersion: {
          verified: true,
          commitSha: "c".repeat(40),
          expectedCommitSha: backendSha,
        },
      }),
      "utf8",
    );

    const output = expectCommandToFail(() =>
      execFileSync("node", ["scripts/render-release-evidence.mjs", outputPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          MOBILE_SHA: mobileSha,
          BACKEND_SHA: backendSha,
          TARGET_ENVIRONMENT: "production",
          EXPORT_SUMMARY_PATH: exportSummaryPath,
        },
      }),
    );

    expect(output).toContain("summary backendVersion.commitSha must match BACKEND_SHA");
    expect(fs.existsSync(outputPath)).toBe(false);
  });
});

describe("smoke runtime backend SHA verification", () => {
  it("writes sanitized telemetry smoke evidence after accepted and duplicate ingest", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-smoke-telemetry-"));
    const outputPath = path.join(tempDir, "summary.json");

    await withTelemetrySmokeServer({}, async (baseUrl) => {
      await execFileAsync("node", ["scripts/verify-smoke-telemetry.mjs", outputPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          EXPECTED_BACKEND_COMMIT_SHA: backendSha,
          SMOKE_API_BASE_URL: baseUrl,
          FIREBASE_AUTH_BASE_URL: baseUrl,
          FIREBASE_WEB_API_KEY: "unused-key",
          SMOKE_EXPORT_TEST_EMAIL: "user@example.com",
          SMOKE_EXPORT_TEST_PASSWORD: "unused-password",
          SMOKE_TELEMETRY_TIMEOUT_MS: "1000",
        },
      });
    });

    const summary = fs.readFileSync(outputPath, "utf8");
    expect(summary).toContain('"result": "passed"');
    expect(summary).toContain('"acceptedCount": 1');
    expect(summary).toContain('"duplicateCount": 1');
    expect(summary).not.toContain("test-token-should-not-leak");
    expect(summary).not.toContain("raw-user-id-should-not-leak");
    expect(summary).not.toContain("user@example.com");
  });

  it("fails telemetry smoke for disabled, wrong-SHA, malformed, and timeout responses", async () => {
    const cases = [
      { options: { disabled: true }, expected: "ingest failed with HTTP 503" },
      { options: { versionSha: "c".repeat(40) }, expected: "SHA did not match" },
      { options: { malformedIngest: true }, expected: "unexpected batch counts" },
      { options: { slowHealth: true }, expected: "request timed out" },
    ];

    for (const testCase of cases) {
      await withTelemetrySmokeServer(testCase.options, async (baseUrl) => {
        const outputPath = path.join(
          os.tmpdir(),
          `fitaly-smoke-telemetry-failure-${Date.now()}.json`,
        );
        const output = await expectExecFileToFail(
          "node",
          ["scripts/verify-smoke-telemetry.mjs", outputPath],
          {
            cwd: rootDir,
            env: {
              ...process.env,
              EXPECTED_BACKEND_COMMIT_SHA: backendSha,
              SMOKE_API_BASE_URL: baseUrl,
              FIREBASE_AUTH_BASE_URL: baseUrl,
              FIREBASE_WEB_API_KEY: "unused-key",
              SMOKE_EXPORT_TEST_EMAIL: "user@example.com",
              SMOKE_EXPORT_TEST_PASSWORD: "unused-password",
              SMOKE_TELEMETRY_TIMEOUT_MS: "50",
            },
          },
        );
        expect(output).toContain(testCase.expected);
        expect(output).not.toContain("unused-password");
        expect(fs.existsSync(outputPath)).toBe(false);
      });
    }
  });

  it("writes smoke export summary from backend export manifest counts", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitaly-smoke-export-"));
    const outputPath = path.join(tempDir, "summary.json");

    await withSmokeExportServer(smokeExportPayload(), async (baseUrl) => {
      await execFileAsync("node", ["scripts/verify-smoke-export.mjs", outputPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          EXPECTED_BACKEND_COMMIT_SHA: backendSha,
          SMOKE_API_BASE_URL: baseUrl,
          FIREBASE_AUTH_BASE_URL: baseUrl,
          FIREBASE_WEB_API_KEY: "unused",
          SMOKE_EXPORT_TEST_EMAIL: "unused@example.com",
          SMOKE_EXPORT_TEST_PASSWORD: "unused",
        },
      });
    });

    const summary = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
      counts: Record<string, number>;
      exportManifest: { schemaVersion: string };
    };
    expect(summary.exportManifest.schemaVersion).toBe("user-export-manifest-v1");
    expect(summary.counts.meals).toBe(2);
    expect(summary.counts.mealEffectOutbox).toBe(1);
    expect(summary.counts.smartMemoryItems).toBe(1);
    expect(summary.counts.knownPatternControls).toBe(1);
    expect(summary.counts.plannedMealItems).toBe(1);
  });

  it("fails smoke export when manifest count disagrees with payload", async () => {
    const payload = smokeExportPayload();
    const manifest = payload.exportManifest as {
      recordCounts: Record<string, number>;
    };
    manifest.recordCounts.meals = 999;

    await withSmokeExportServer(payload, async (baseUrl) => {
      const output = await expectExecFileToFail(
        "node",
        ["scripts/verify-smoke-export.mjs"],
        {
          cwd: rootDir,
          env: {
            ...process.env,
            EXPECTED_BACKEND_COMMIT_SHA: backendSha,
            SMOKE_API_BASE_URL: baseUrl,
            FIREBASE_AUTH_BASE_URL: baseUrl,
            FIREBASE_WEB_API_KEY: "unused",
            SMOKE_EXPORT_TEST_EMAIL: "unused@example.com",
            SMOKE_EXPORT_TEST_PASSWORD: "unused",
          },
        },
      );

      expect(output).toContain("manifest count mismatch for meals");
    });
  });

  it("fails smoke export when manifest includes unsupported count keys", async () => {
    const payload = smokeExportPayload();
    const manifest = payload.exportManifest as {
      recordCounts: Record<string, number>;
    };
    manifest.recordCounts.legacyFallback = 1;

    await withSmokeExportServer(payload, async (baseUrl) => {
      const output = await expectExecFileToFail(
        "node",
        ["scripts/verify-smoke-export.mjs"],
        {
          cwd: rootDir,
          env: {
            ...process.env,
            EXPECTED_BACKEND_COMMIT_SHA: backendSha,
            SMOKE_API_BASE_URL: baseUrl,
            FIREBASE_AUTH_BASE_URL: baseUrl,
            FIREBASE_WEB_API_KEY: "unused",
            SMOKE_EXPORT_TEST_EMAIL: "unused@example.com",
            SMOKE_EXPORT_TEST_PASSWORD: "unused",
          },
        },
      );

      expect(output).toContain("unsupported recordCounts key: legacyFallback");
    });
  });

  it("fails smoke export when version endpoint omits commitSha", async () => {
    await withVersionServer({ version: "0.1.0" }, async (baseUrl) => {
      const output = await expectExecFileToFail(
        "node",
        ["scripts/verify-smoke-export.mjs"],
        {
          cwd: rootDir,
          env: {
            ...process.env,
            EXPECTED_BACKEND_COMMIT_SHA: backendSha,
            SMOKE_API_BASE_URL: baseUrl,
            FIREBASE_WEB_API_KEY: "unused",
            SMOKE_EXPORT_TEST_EMAIL: "unused@example.com",
            SMOKE_EXPORT_TEST_PASSWORD: "unused",
          },
        },
      );

      expect(output).toContain("did not return commitSha");
    });
  });

  it("fails smoke flow contracts when version endpoint commitSha mismatches", async () => {
    await withVersionServer(
      { version: "0.1.0", commitSha: "c".repeat(40) },
      async (baseUrl) => {
        const output = await expectExecFileToFail(
          "node",
          ["scripts/verify-smoke-flow-contracts.mjs"],
          {
            cwd: rootDir,
            env: {
              ...process.env,
              EXPECTED_BACKEND_COMMIT_SHA: backendSha,
              SMOKE_API_BASE_URL: baseUrl,
              FIREBASE_WEB_API_KEY: "unused",
              SMOKE_EXPORT_TEST_EMAIL: "unused@example.com",
              SMOKE_EXPORT_TEST_PASSWORD: "unused",
            },
          },
        );

        expect(output).toContain(`expected commitSha=${backendSha}`);
      },
    );
  });
});
