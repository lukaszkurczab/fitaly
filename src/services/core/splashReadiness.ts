import type { AppBootstrapState } from "@/navigation/appNavigatorState";

export function shouldHideNativeSplash(params: {
  fontsLoaded: boolean;
  launchReadinessIssue: string | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  profileBootstrapState: AppBootstrapState;
}): boolean {
  if (params.launchReadinessIssue) {
    return true;
  }

  if (!params.fontsLoaded || params.authLoading) {
    return false;
  }

  if (!params.isAuthenticated) {
    return true;
  }

  return params.profileBootstrapState !== "profileLoading";
}
