import { describe, expect, it } from "@jest/globals";
import { themes } from "@/theme/themes";

describe("themes", () => {
  it("defines input state tokens for the light theme", () => {
    expect(themes.light.input).toEqual(
      expect.objectContaining({
        background: "#FFFDF8",
        backgroundError: "#F9E9E5",
        backgroundDisabled: "#EFE7DA",
        border: "#CFC5B8",
        borderDisabled: "#E2D7C7",
        borderFocused: "#6F8A69",
        borderError: "#C24E3D",
      }),
    );
  });

  it("defines input state tokens for the dark theme", () => {
    expect(themes.dark.input).toEqual(
      expect.objectContaining({
        background: "#202520",
        backgroundError: "#2D201D",
        backgroundDisabled: "#1B1F1B",
        borderDisabled: "#2E342E",
        borderFocused: "#6F8A69",
        borderError: "#C85D4C",
      }),
    );
  });

  it("defines premium depth tokens for light and dark surfaces", () => {
    expect(themes.light.depth).toEqual(
      expect.objectContaining({
        raised: expect.objectContaining({
          shadowColor: "#2F312B",
          elevation: 4,
        }),
        modal: expect.objectContaining({
          shadowRadius: 28,
          elevation: 11,
        }),
      }),
    );

    expect(themes.dark.depth).toEqual(
      expect.objectContaining({
        raised: expect.objectContaining({
          shadowColor: "#121512",
          elevation: 3,
        }),
        tabBar: expect.objectContaining({
          shadowRadius: 22,
          elevation: 12,
        }),
      }),
    );
  });

  it("defines canonical material background gradients for light and dark", () => {
    expect(themes.light.material.backgroundGradient).toEqual([
      expect.objectContaining({
        colors: ["#F8F0E4", "#F7F2EA", "#EFE7DA"],
      }),
      expect.objectContaining({
        colors: expect.arrayContaining(["rgba(111, 138, 105, 0.075)"]),
      }),
    ]);

    expect(themes.dark.material.backgroundGradient).toEqual([
      expect.objectContaining({
        colors: ["#171A17", "#181D18", "#1E221E"],
      }),
      expect.objectContaining({
        colors: expect.arrayContaining(["rgba(199, 126, 97, 0.045)"]),
      }),
    ]);
  });
});
