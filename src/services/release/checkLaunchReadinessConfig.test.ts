import { describe, expect, it } from "@jest/globals";
import readinessLib from "../../../scripts/check-launch-readiness.lib.js";

type EasConfig = {
  build: Record<string, { env?: Record<string, string>; extends?: string }>;
};

const {
  EXPECTED_PRODUCTION_API_BASE_URL,
  EXPECTED_DEV_API_BASE_URL,
  getExpoBuildPropertiesPluginConfig,
  validateAndroidTargetSdkConfig,
  validateEasApiBaseUrlProfiles,
  validateEasRuntimeContractProfiles,
  validateProductionLegalUrls,
  validateProductionSentryDsn,
  C2_NEW_DOMAIN_FLAGS,
} = readinessLib as {
  EXPECTED_PRODUCTION_API_BASE_URL: string;
  EXPECTED_DEV_API_BASE_URL: string;
  getExpoBuildPropertiesPluginConfig: (config: unknown) => unknown;
  validateAndroidTargetSdkConfig: (config: unknown) => string[];
  validateEasApiBaseUrlProfiles: (config: EasConfig) => string[];
  validateEasRuntimeContractProfiles: (config: EasConfig) => string[];
  validateProductionLegalUrls: (urls: {
    termsUrl?: string;
    privacyUrl?: string;
  }) => string[];
  validateProductionSentryDsn: (config: {
    sentryDsn?: string;
  }) => string[];
  C2_NEW_DOMAIN_FLAGS: string[];
};

function createConfig(
  overrides?: Partial<Record<"smoke" | "development" | "preview" | "internal" | "e2e-test" | "production", string>>,
): EasConfig {
  const defaultValueByProfile = {
    smoke: EXPECTED_DEV_API_BASE_URL,
    development: EXPECTED_DEV_API_BASE_URL,
    preview: EXPECTED_DEV_API_BASE_URL,
    internal: EXPECTED_DEV_API_BASE_URL,
    "e2e-test": EXPECTED_DEV_API_BASE_URL,
    production: EXPECTED_PRODUCTION_API_BASE_URL,
  };

  const merged: Record<
    "smoke" | "development" | "preview" | "internal" | "e2e-test" | "production",
    string
  > = {
    ...defaultValueByProfile,
    ...overrides,
  };
  return {
    build: {
      smoke: { env: { EXPO_PUBLIC_API_BASE_URL: merged.smoke } },
      development: { env: { EXPO_PUBLIC_API_BASE_URL: merged.development } },
      preview: { env: { EXPO_PUBLIC_API_BASE_URL: merged.preview } },
      internal: { env: { EXPO_PUBLIC_API_BASE_URL: merged.internal } },
      "e2e-test": { env: { EXPO_PUBLIC_API_BASE_URL: merged["e2e-test"] } },
      production: { env: { EXPO_PUBLIC_API_BASE_URL: merged.production } },
    },
  };
}

describe("check-launch-readiness eas api mapping", () => {
  it("passes for expected dev and production mapping", () => {
    const config = createConfig();
    expect(validateEasApiBaseUrlProfiles(config)).toHaveLength(0);
  });

  it("passes when non-production profiles inherit env via eas profile extends", () => {
    const config: EasConfig = {
      build: {
        smoke: { env: { EXPO_PUBLIC_API_BASE_URL: EXPECTED_DEV_API_BASE_URL } },
        development: { extends: "smoke" },
        preview: { extends: "smoke" },
        internal: { extends: "smoke" },
        "e2e-test": { extends: "smoke" },
        production: {
          env: { EXPO_PUBLIC_API_BASE_URL: EXPECTED_PRODUCTION_API_BASE_URL },
        },
      },
    };

    expect(validateEasApiBaseUrlProfiles(config)).toHaveLength(0);
  });

  it("fails when production points to localhost", () => {
    const config = createConfig({
      production: "http://localhost:8000",
    });
    const errors = validateEasApiBaseUrlProfiles(config);
    expect(errors.join("\n")).toContain("cannot use localhost");
  });

  it("fails when non-production profile points to production URL", () => {
    const config = createConfig({
      preview: EXPECTED_PRODUCTION_API_BASE_URL,
    });
    const errors = validateEasApiBaseUrlProfiles(config);
    expect(errors.join("\n")).toContain("build.preview.env.EXPO_PUBLIC_API_BASE_URL must equal");
  });

  it("fails when profile URL is not https", () => {
    const config = createConfig({
      internal: "http://fitaly-backend-smoke.up.railway.app",
    });
    const errors = validateEasApiBaseUrlProfiles(config);
    expect(errors.join("\n")).toContain("build.internal.env.EXPO_PUBLIC_API_BASE_URL must be an https URL");
  });
});

describe("check-launch-readiness eas runtime contract", () => {
  function createLaunchLikeConfig(
    overrides?: Partial<Record<"smoke" | "production", Record<string, string>>>,
  ): EasConfig {
    const c2FlagsOff = Object.fromEntries(
      C2_NEW_DOMAIN_FLAGS.map((flagName) => [flagName, "false"]),
    );

    return {
      build: {
        smoke: {
          env: {
            EXPO_PUBLIC_ENABLE_TELEMETRY: "true",
            EXPO_PUBLIC_ENABLE_SMART_REMINDERS: "true",
            ...c2FlagsOff,
            DISABLE_BILLING: "false",
            ...overrides?.smoke,
          },
        },
        production: {
          env: {
            EXPO_PUBLIC_ENABLE_TELEMETRY: "true",
            EXPO_PUBLIC_ENABLE_SMART_REMINDERS: "true",
            ...c2FlagsOff,
            DISABLE_BILLING: "false",
            ...overrides?.production,
          },
        },
      },
    };
  }

  it("passes when smoke and production declare launch-like client flags", () => {
    expect(
      validateEasRuntimeContractProfiles(createLaunchLikeConfig()),
    ).toHaveLength(0);
  });

  it("fails when smoke telemetry is not launch-like", () => {
    const errors = validateEasRuntimeContractProfiles(
      createLaunchLikeConfig({
        smoke: { EXPO_PUBLIC_ENABLE_TELEMETRY: "false" },
      }),
    );

    expect(errors.join("\n")).toContain(
      "build.smoke.env.EXPO_PUBLIC_ENABLE_TELEMETRY must be",
    );
  });

  it("fails when production billing is disabled", () => {
    const errors = validateEasRuntimeContractProfiles(
      createLaunchLikeConfig({
        production: { DISABLE_BILLING: "true" },
      }),
    );

    expect(errors.join("\n")).toContain(
      "build.production.env.DISABLE_BILLING must be",
    );
  });

  it("fails when production omits a C2 new-domain flag", () => {
    const productionOverrides = Object.fromEntries(
      C2_NEW_DOMAIN_FLAGS.map((flagName) => [flagName, "false"]),
    );
    delete productionOverrides.EXPO_PUBLIC_ENABLE_SMART_MEMORY;
    const errors = validateEasRuntimeContractProfiles({
      build: {
        smoke: createLaunchLikeConfig().build.smoke,
        production: {
          env: {
            EXPO_PUBLIC_ENABLE_TELEMETRY: "true",
            EXPO_PUBLIC_ENABLE_SMART_REMINDERS: "true",
            DISABLE_BILLING: "false",
            ...productionOverrides,
          },
        },
      },
    });

    expect(errors.join("\n")).toContain(
      "build.production.env.EXPO_PUBLIC_ENABLE_SMART_MEMORY must be",
    );
    expect(errors.join("\n")).toContain("got: missing");
  });

  it("fails when production enables a C2 new-domain flag before its gate", () => {
    const errors = validateEasRuntimeContractProfiles(
      createLaunchLikeConfig({
        production: { EXPO_PUBLIC_ENABLE_RECIPE_CATALOG: "true" },
      }),
    );

    expect(errors.join("\n")).toContain(
      "build.production.env.EXPO_PUBLIC_ENABLE_RECIPE_CATALOG must be",
    );
    expect(errors.join("\n")).toContain("got: true");
  });

  it("allows smoke to explicitly enable a C2 domain for a focused gate", () => {
    const errors = validateEasRuntimeContractProfiles(
      createLaunchLikeConfig({
        smoke: { EXPO_PUBLIC_ENABLE_RECIPE_CATALOG: "true" },
      }),
    );

    expect(errors.join("\n")).not.toContain(
      "build.smoke.env.EXPO_PUBLIC_ENABLE_RECIPE_CATALOG",
    );
  });

  it("fails when smoke omits a C2 new-domain flag", () => {
    const smokeOverrides = Object.fromEntries(
      C2_NEW_DOMAIN_FLAGS.map((flagName) => [flagName, "false"]),
    );
    delete smokeOverrides.EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION;
    const errors = validateEasRuntimeContractProfiles({
      build: {
        smoke: {
          env: {
            EXPO_PUBLIC_ENABLE_TELEMETRY: "true",
            EXPO_PUBLIC_ENABLE_SMART_REMINDERS: "true",
            DISABLE_BILLING: "false",
            ...smokeOverrides,
          },
        },
        production: createLaunchLikeConfig().build.production,
      },
    });

    expect(errors.join("\n")).toContain(
      "build.smoke.env.EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION must be explicitly declared",
    );
    expect(errors.join("\n")).toContain("got: missing");
  });

  it("fails when smoke declares an invalid C2 flag value", () => {
    const errors = validateEasRuntimeContractProfiles(
      createLaunchLikeConfig({
        smoke: { EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION: "sometimes" },
      }),
    );

    expect(errors.join("\n")).toContain(
      "build.smoke.env.EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION must be explicitly declared",
    );
  });
});

describe("check-launch-readiness production legal URL checks", () => {
  it("passes for concrete production legal URLs", () => {
    expect(
      validateProductionLegalUrls({
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
      }),
    ).toHaveLength(0);
  });

  it.each([
    {
      name: "empty terms",
      urls: { termsUrl: "", privacyUrl: "https://fitaly.app/privacy" },
      expected: "TERMS_URL is missing or invalid",
    },
    {
      name: "localhost privacy",
      urls: {
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "http://localhost:3000/privacy",
      },
      expected: "PRIVACY_URL cannot use localhost",
    },
    {
      name: "example.com terms",
      urls: {
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://fitaly.app/privacy",
      },
      expected: "TERMS_URL cannot use example.com",
    },
  ])("fails for placeholder legal URL: $name", ({ urls, expected }) => {
    expect(validateProductionLegalUrls(urls).join("\n")).toContain(expected);
  });
});

describe("check-launch-readiness production Sentry checks", () => {
  it("blocks missing SENTRY_DSN by default", () => {
    expect(validateProductionSentryDsn({}).join("\n")).toContain(
      "SENTRY_DSN is not set",
    );
  });

  it("does not allow a bare EAS secret assumption to bypass missing SENTRY_DSN", () => {
    const bypassAttempt = { sentryDsn: "", assumeEasSecrets: "true" };

    expect(validateProductionSentryDsn(bypassAttempt)).not.toHaveLength(0);
  });

  it("passes when SENTRY_DSN is present", () => {
    expect(
      validateProductionSentryDsn({
        sentryDsn: "https://public@sentry.io/1",
      }),
    ).toHaveLength(0);
  });
});

describe("check-launch-readiness managed android target SDK", () => {
  it("passes when expo-build-properties declares a launch-safe target SDK", () => {
    const config = {
      plugins: [
        [
          "expo-build-properties",
          {
            android: { targetSdkVersion: 35 },
          },
        ],
      ],
    };

    expect(getExpoBuildPropertiesPluginConfig(config)).toEqual({
      android: { targetSdkVersion: 35 },
    });
    expect(validateAndroidTargetSdkConfig(config)).toHaveLength(0);
  });

  it("fails when managed Android target SDK is implicit", () => {
    const errors = validateAndroidTargetSdkConfig({
      plugins: ["expo-build-properties"],
    });

    expect(errors.join("\n")).toContain("android.targetSdkVersion must be set");
  });

  it("fails when managed Android target SDK is below the launch floor", () => {
    const errors = validateAndroidTargetSdkConfig({
      plugins: [
        [
          "expo-build-properties",
          {
            android: { targetSdkVersion: 34 },
          },
        ],
      ],
    });

    expect(errors.join("\n")).toContain("must be >= 35");
  });
});
