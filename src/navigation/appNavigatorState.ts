import type { RootStackParamList } from "@/navigation/navigate";
import type { ReadinessStatus } from "@/types";

export const PRODUCT_STACK_NON_AI_SURFACE_ROUTE_NAMES = {
  home: "Home",
  historyList: "HistoryList",
  addMeal: "AddMeal",
  statistics: "Statistics",
} as const satisfies Record<string, keyof RootStackParamList>;

export const PRODUCT_STACK_NON_AI_SURFACE_ROUTES = [
  PRODUCT_STACK_NON_AI_SURFACE_ROUTE_NAMES.home,
  PRODUCT_STACK_NON_AI_SURFACE_ROUTE_NAMES.historyList,
  PRODUCT_STACK_NON_AI_SURFACE_ROUTE_NAMES.addMeal,
  PRODUCT_STACK_NON_AI_SURFACE_ROUTE_NAMES.statistics,
] as const satisfies readonly (keyof RootStackParamList)[];

export type AppBootstrapState =
  | "authLoading"
  | "unauthenticated"
  | "profileLoading"
  | "profileReady"
  | "profileMissing"
  | "offlineCached"
  | "bootstrapFailed";

export function resolveBootstrapState(params: {
  authLoading: boolean;
  isAuthenticated: boolean;
  profileBootstrapState: AppBootstrapState;
}): AppBootstrapState {
  if (params.authLoading) return "authLoading";
  if (!params.isAuthenticated) return "unauthenticated";
  return params.profileBootstrapState;
}

export function resolveEffectiveBootstrapState(params: {
  bootstrapState: AppBootstrapState;
  signupProfileBootstrapPending: boolean;
}): AppBootstrapState {
  if (
    params.bootstrapState === "profileMissing" &&
    params.signupProfileBootstrapPending
  ) {
    return "profileLoading";
  }

  return params.bootstrapState;
}

export function shouldRenderProductStack(
  bootstrapState: AppBootstrapState,
  readinessStatus: ReadinessStatus | undefined,
): boolean {
  return (
    (readinessStatus === "needs_ai_consent" || readinessStatus === "ready") &&
    (bootstrapState === "profileReady" ||
      bootstrapState === "offlineCached")
  );
}

export function shouldRenderProfileGateStack(
  bootstrapState: AppBootstrapState,
): boolean {
  return (
    bootstrapState === "profileReady" ||
    bootstrapState === "offlineCached"
  );
}

export function resolveInitialRouteName(
  bootstrapState: AppBootstrapState,
  readinessStatus: ReadinessStatus | undefined,
): keyof RootStackParamList {
  if (shouldRenderProductStack(bootstrapState, readinessStatus)) {
    return "Home";
  }

  if (bootstrapState === "unauthenticated") {
    return "Login";
  }

  if (bootstrapState === "profileReady" || bootstrapState === "offlineCached") {
    return "Onboarding";
  }

  if (bootstrapState === "profileMissing") {
    return "Login";
  }

  return "Loading";
}
