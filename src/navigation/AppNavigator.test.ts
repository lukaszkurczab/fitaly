import {
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

  it("keeps missing profiles gated instead of exposing Home", () => {
    expect(shouldRenderProductStack("profileMissing", undefined)).toBe(false);
    expect(resolveInitialRouteName("profileMissing", undefined)).toBe(
      "Onboarding",
    );
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
    expect(shouldRenderProductStack("profileMissing", "ready")).toBe(true);
    expect(resolveInitialRouteName("profileMissing", "ready")).toBe("Home");
  });
});
