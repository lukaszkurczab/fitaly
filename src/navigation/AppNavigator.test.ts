import {
  resolveEffectiveBootstrapState,
  resolveInitialRouteName,
  shouldRenderProfileGateStack,
  shouldRenderProductStack,
} from "@/navigation/appNavigatorState";

describe("AppNavigator onboarding gate", () => {
  it("starts unauthenticated users on a registered auth screen", () => {
    expect(resolveInitialRouteName("unauthenticated", undefined)).toBe("Login");
  });

  it("keeps first-run users out of the product stack until profile readiness", () => {
    expect(shouldRenderProductStack("profileReady", "needs_profile")).toBe(false);
    expect(resolveInitialRouteName("profileReady", "needs_profile")).toBe("Onboarding");
  });

  it("routes missing authenticated profiles back to Login instead of onboarding recovery", () => {
    expect(shouldRenderProfileGateStack("profileMissing")).toBe(false);
    expect(shouldRenderProductStack("profileMissing", undefined)).toBe(false);
    expect(resolveInitialRouteName("profileMissing", undefined)).toBe("Login");
  });

  it("keeps a transient missing profile on Loading during signup profile initialization", () => {
    const bootstrapState = resolveEffectiveBootstrapState({
      bootstrapState: "profileMissing",
      signupProfileBootstrapPending: true,
    });

    expect(bootstrapState).toBe("profileLoading");
    expect(shouldRenderProfileGateStack(bootstrapState)).toBe(false);
    expect(resolveInitialRouteName(bootstrapState, undefined)).toBe("Loading");
  });

  it("keeps profile bootstrap failures on the loading retry screen", () => {
    expect(shouldRenderProfileGateStack("bootstrapFailed")).toBe(false);
    expect(shouldRenderProductStack("bootstrapFailed", undefined)).toBe(false);
    expect(resolveInitialRouteName("bootstrapFailed", undefined)).toBe(
      "Loading",
    );
  });

  it("renders the product stack when profile is complete and AI consent is pending", () => {
    expect(shouldRenderProductStack("profileReady", "needs_ai_consent")).toBe(true);
    expect(resolveInitialRouteName("profileReady", "needs_ai_consent")).toBe("Home");
  });

  it("renders Home after canonical readiness", () => {
    expect(shouldRenderProductStack("profileReady", "ready")).toBe(true);
    expect(resolveInitialRouteName("profileReady", "ready")).toBe("Home");
    expect(shouldRenderProductStack("profileMissing", "ready")).toBe(false);
    expect(resolveInitialRouteName("profileMissing", "ready")).toBe("Login");
  });
});
