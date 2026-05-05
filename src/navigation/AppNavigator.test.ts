import {
  resolveInitialRouteName,
  shouldRenderProductStack,
} from "@/navigation/appNavigatorState";

describe("AppNavigator onboarding gate", () => {
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

  it("renders the product stack when profile is complete and AI consent is pending", () => {
    expect(shouldRenderProductStack("profileReady", "needs_ai_consent")).toBe(true);
    expect(resolveInitialRouteName("profileReady", "needs_ai_consent")).toBe("Home");
  });

  it("renders Home after canonical readiness", () => {
    expect(shouldRenderProductStack("profileMissing", "ready")).toBe(true);
    expect(resolveInitialRouteName("profileMissing", "ready")).toBe("Home");
  });
});
