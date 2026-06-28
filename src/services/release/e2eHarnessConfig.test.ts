import { execFileSync } from "node:child_process";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../../..");

function readHarnessConfig(flow: string, extraEnv: Record<string, string> = {}) {
  const output = execFileSync("bash", ["scripts/run-e2e-local.sh", flow], {
    cwd: rootDir,
    env: {
      ...process.env,
      ...extraEnv,
      E2E_CONFIG_DRY_RUN: "1",
    },
    encoding: "utf8",
  });

  return Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

describe("run-e2e-local flow-specific config", () => {
  it("enables Home Next Action dependencies only for matching flows", () => {
    const planned = readHarnessConfig(
      "e2e/maestro/release-gate/home-next-action-planned-item.yaml",
    );
    const knownPattern = readHarnessConfig(
      "e2e/maestro/release-gate/home-next-action-known-pattern.yaml",
    );

    expect(planned.EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION).toBe("true");
    expect(planned.EXPO_PUBLIC_ENABLE_PLANNING).toBe("true");
    expect(planned.EXPO_PUBLIC_ENABLE_SMART_MEMORY).toBe("");

    expect(knownPattern.EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION).toBe("true");
    expect(knownPattern.EXPO_PUBLIC_ENABLE_KNOWN_PATTERNS).toBe("true");
    expect(knownPattern.EXPO_PUBLIC_ENABLE_SMART_MEMORY).toBe("true");
  });

  it("enables Recipe Catalog only for recipe review flows", () => {
    const config = readHarnessConfig(
      "e2e/maestro/release-gate/recipe-catalog-review-draft.yaml",
    );

    expect(config.EXPO_PUBLIC_ENABLE_RECIPE_CATALOG).toBe("true");
    expect(config.EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION).toBe("");
  });

  it("enables Smart Memory for Smart Memory review and backend-pull flows", () => {
    const explanation = readHarnessConfig(
      "e2e/maestro/release-gate/review-memory-explanation.yaml",
    );
    const backendPull = readHarnessConfig(
      "e2e/maestro/release-gate/smart-memory-backend-pull.yaml",
    );

    expect(explanation.EXPO_PUBLIC_ENABLE_REVIEW_MEMORY_EXPLANATION).toBe(
      "true",
    );
    expect(explanation.EXPO_PUBLIC_ENABLE_SMART_MEMORY).toBe("true");
    expect(backendPull.EXPO_PUBLIC_ENABLE_SMART_MEMORY).toBe("true");
  });

  it("treats Android emulator host bridge as a local backend URL", () => {
    const android = readHarnessConfig(
      "e2e/maestro/release-gate/add-meal-text-save-propagates.yaml",
      { E2E_API_BASE_URL: "http://10.0.2.2:8000" },
    );
    const remote = readHarnessConfig(
      "e2e/maestro/release-gate/add-meal-text-save-propagates.yaml",
      { E2E_API_BASE_URL: "https://example.com" },
    );

    expect(android.API_BASE_URL).toBe("http://10.0.2.2:8000");
    expect(android.LOCAL_API_BASE_URL).toBe("1");
    expect(remote.LOCAL_API_BASE_URL).toBe("0");
  });
});
