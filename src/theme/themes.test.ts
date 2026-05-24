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
          elevation: 3,
        }),
        modal: expect.objectContaining({
          shadowRadius: 24,
          elevation: 10,
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
});
