import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../../..");
const mobileSha = "a".repeat(40);
const backendSha = "b".repeat(40);

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

    execFileSync("node", ["scripts/render-release-evidence.mjs", outputPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        MOBILE_SHA: mobileSha,
        BACKEND_SHA: backendSha,
        TARGET_ENVIRONMENT: "production",
        EXPORT_SUMMARY_PATH: exportSummaryPath,
        FLOW_SUMMARY_PATH: flowSummaryPath,
      },
    });

    const evidence = fs.readFileSync(outputPath, "utf8");
    expect(evidence).toContain(`- Mobile commit SHA: ${mobileSha}`);
    expect(evidence).toContain(`- Backend commit SHA: ${backendSha}`);
    expect(evidence).toContain("- Target environment: production");
    expect(evidence).toContain(
      `- Smoke runtime backend SHA: verified smoke_export=${backendSha}, smoke_flow_contracts=${backendSha}`,
    );
    expect(evidence).toContain('"EXPO_PUBLIC_ENABLE_TELEMETRY":"true"');
    expect(evidence).toContain('"DISABLE_BILLING":"false"');
    expect(evidence).toContain('"EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION":"false"');
    expect(evidence).toContain('"EXPO_PUBLIC_ENABLE_SMART_MEMORY":"false"');
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
