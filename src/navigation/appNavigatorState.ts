import type { RootStackParamList } from "@/navigation/navigate";

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
  surveyCompleted: boolean | undefined,
): boolean {
  return (
    surveyCompleted === true &&
    (bootstrapState === "profileReady" ||
      bootstrapState === "offlineCached" ||
      bootstrapState === "profileMissing")
  );
}

export function resolveInitialRouteName(
  bootstrapState: AppBootstrapState,
  surveyCompleted: boolean | undefined,
): keyof RootStackParamList {
  if (shouldRenderProductStack(bootstrapState, surveyCompleted)) {
    return "Home";
  }

  if (bootstrapState === "profileReady" || bootstrapState === "offlineCached") {
    return "Onboarding";
  }

  if (bootstrapState === "profileMissing") {
    return "Onboarding";
  }

  return "Loading";
}
