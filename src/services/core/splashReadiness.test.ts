import { shouldHideNativeSplash } from "@/services/core/splashReadiness";

describe("shouldHideNativeSplash", () => {
  const base = {
    fontsLoaded: true,
    launchReadinessIssue: null,
    authLoading: false,
    isAuthenticated: false,
    profileBootstrapState: "profileMissing" as const,
  };

  it("hides immediately for launch-readiness block so the blocking screen is visible", () => {
    expect(
      shouldHideNativeSplash({
        ...base,
        fontsLoaded: false,
        launchReadinessIssue: "Missing API URL",
        authLoading: true,
        profileBootstrapState: "authLoading",
      }),
    ).toBe(true);
  });

  it("waits for fonts and initial Firebase auth state", () => {
    expect(
      shouldHideNativeSplash({
        ...base,
        fontsLoaded: false,
      }),
    ).toBe(false);
    expect(
      shouldHideNativeSplash({
        ...base,
        authLoading: true,
        profileBootstrapState: "authLoading",
      }),
    ).toBe(false);
  });

  it("hides for signed-out users after auth resolves", () => {
    expect(shouldHideNativeSplash(base)).toBe(true);
  });

  it("waits for authenticated profile bootstrap to leave loading", () => {
    expect(
      shouldHideNativeSplash({
        ...base,
        isAuthenticated: true,
        profileBootstrapState: "profileLoading",
      }),
    ).toBe(false);
    expect(
      shouldHideNativeSplash({
        ...base,
        isAuthenticated: true,
        profileBootstrapState: "profileReady",
      }),
    ).toBe(true);
    expect(
      shouldHideNativeSplash({
        ...base,
        isAuthenticated: true,
        profileBootstrapState: "bootstrapFailed",
      }),
    ).toBe(true);
  });
});
