import { logWarning } from "@/services/core/errorLogger";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";

export const REQUIRED_RUNTIME_CONFIG = {
  apiBaseUrl: "Backend API base URL",
  apiVersion: "API version (e.g. v1)",
} as const;

export const OPTIONAL_RUNTIME_CONFIG = {
  backendLoggingEnabled: "Enable backend error logging",
  telemetryEnabled: "Enable telemetry",
  smartRemindersEnabled: "Enable smart reminders canonical surface",
  billingDisabled: "Disable billing",
} as const;

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEnv(): { valid: boolean; missing: string[] } {
  const config = getRuntimeConfig();
  const missing = Object.keys(REQUIRED_RUNTIME_CONFIG).filter((key) => {
    const value = config[key as keyof typeof REQUIRED_RUNTIME_CONFIG];
    return typeof value !== "string" || !hasValue(value);
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function warnMissingEnv(): void {
  const result = validateEnv();

  if (result.missing.length === 0) {
    return;
  }

  logWarning("missing required runtime config", { missing: result.missing });

  if (__DEV__) {
    console.warn(
      `[envValidation] Missing required runtime config: ${result.missing.join(", ")}`,
    );
  }
}
