import type { RootStackParamList } from "@/navigation/navigate";
import type { ReadinessStatus } from "@/types";

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
