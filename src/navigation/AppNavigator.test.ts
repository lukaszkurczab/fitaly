import {
  resolveInitialRouteName,
  shouldRenderProductStack,
} from "@/navigation/appNavigatorState";

describe("AppNavigator onboarding gate", () => {
  it("keeps first-run users out of the product stack until completion", () => {
    expect(shouldRenderProductStack("profileReady", false)).toBe(false);
    expect(resolveInitialRouteName("profileReady", false)).toBe("Onboarding");
  });

  it("keeps missing profiles gated instead of exposing Home", () => {
    expect(shouldRenderProductStack("profileMissing", undefined)).toBe(false);
    expect(resolveInitialRouteName("profileMissing", undefined)).toBe(
      "Onboarding",
    );
  });

  it("renders Home only after canonical onboarding completion", () => {
    expect(shouldRenderProductStack("profileReady", true)).toBe(true);
    expect(resolveInitialRouteName("profileReady", true)).toBe("Home");
  });

  it("lets a locally completed profile recover into the product stack", () => {
    expect(shouldRenderProductStack("profileMissing", true)).toBe(true);
    expect(resolveInitialRouteName("profileMissing", true)).toBe("Home");
  });
});
