import { createServiceError } from "@/services/contracts/serviceError";
import { getRuntimeConfig, type RuntimeConfig } from "@/services/core/runtimeConfig";

export type RuntimeFeatureDomain =
  | "foodLibrary"
  | "smartMemory"
  | "knownPatterns"
  | "recipeCatalog"
  | "planning"
  | "homeNextAction";

const FEATURE_FLAGS: Record<
  RuntimeFeatureDomain,
  {
    configKey: keyof Pick<
      RuntimeConfig,
      | "foodLibraryEnabled"
      | "smartMemoryEnabled"
      | "knownPatternsEnabled"
      | "recipeCatalogEnabled"
      | "planningEnabled"
      | "homeNextActionEnabled"
    >;
    code: string;
  }
> = {
  foodLibrary: {
    configKey: "foodLibraryEnabled",
    code: "feature/food-library-disabled",
  },
  smartMemory: {
    configKey: "smartMemoryEnabled",
    code: "feature/smart-memory-disabled",
  },
  knownPatterns: {
    configKey: "knownPatternsEnabled",
    code: "feature/known-patterns-disabled",
  },
  recipeCatalog: {
    configKey: "recipeCatalogEnabled",
    code: "feature/recipe-catalog-disabled",
  },
  planning: {
    configKey: "planningEnabled",
    code: "feature/planning-disabled",
  },
  homeNextAction: {
    configKey: "homeNextActionEnabled",
    code: "feature/home-next-action-disabled",
  },
};

export function isRuntimeFeatureEnabled(domain: RuntimeFeatureDomain): boolean {
  const feature = FEATURE_FLAGS[domain];
  return getRuntimeConfig()[feature.configKey];
}

export function createRuntimeFeatureDisabledError(
  domain: RuntimeFeatureDomain,
) {
  const feature = FEATURE_FLAGS[domain];
  return createServiceError({
    code: feature.code,
    source: "FeatureFlagGuard",
    retryable: false,
    message: `${domain} is disabled by runtime config.`,
  });
}

export function requireRuntimeFeatureEnabled(
  domain: RuntimeFeatureDomain,
): void {
  if (!isRuntimeFeatureEnabled(domain)) {
    throw createRuntimeFeatureDisabledError(domain);
  }
}
