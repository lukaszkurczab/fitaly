import { describe, expect, it } from "@jest/globals";
import { Button } from "@/components/Button";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import { baseColors } from "@/theme/colors";

describe("Button", () => {
  it("uses semantic primary pressed and disabled colors", () => {
    const { UNSAFE_root, rerender } = renderWithTheme(
      <Button label="Save" onPress={() => undefined} />,
    );

    const enabledButton = UNSAFE_root.find(
      (node) =>
        node.props.accessibilityRole === "button" &&
        node.props.accessibilityLabel === "Save" &&
        typeof node.props.style === "function",
    );
    const enabledStyle = enabledButton.props.style({ pressed: true }) as Array<unknown>;

    expect(enabledStyle).toContainEqual(
      expect.objectContaining({
        backgroundColor: baseColors.olive700,
        borderColor: baseColors.olive700,
      }),
    );

    rerender(<Button label="Save" onPress={() => undefined} disabled />);

    const disabledButton = UNSAFE_root.find(
      (node) =>
        node.props.accessibilityRole === "button" &&
        node.props.accessibilityLabel === "Save" &&
        typeof node.props.style === "function",
    );
    const disabledStyle = disabledButton.props.style({ pressed: false }) as Array<unknown>;

    expect(disabledStyle).toContainEqual(
      expect.objectContaining({
        backgroundColor: baseColors.sand100,
        borderColor: baseColors.sand100,
      }),
    );
  });

  it("supports secondary, ghost, and destructive variants", () => {
    const { UNSAFE_root, rerender } = renderWithTheme(
      <Button label="Secondary" variant="secondary" onPress={() => undefined} />,
    );

    const secondaryButton = UNSAFE_root.find(
      (node) =>
        node.props.accessibilityRole === "button" &&
        node.props.accessibilityLabel === "Secondary" &&
        typeof node.props.style === "function",
    );
    const secondaryStyle = secondaryButton.props.style({ pressed: true }) as Array<unknown>;
    expect(secondaryStyle).toContainEqual(
      expect.objectContaining({
        backgroundColor: baseColors.cream50,
        borderColor: baseColors.sand300,
      }),
    );

    rerender(<Button label="Ghost" variant="ghost" onPress={() => undefined} />);
    const ghostButton = UNSAFE_root.find(
      (node) =>
        node.props.accessibilityRole === "button" &&
        node.props.accessibilityLabel === "Ghost" &&
        typeof node.props.style === "function",
    );
    const ghostStyle = ghostButton.props.style({ pressed: true }) as Array<unknown>;
    expect(ghostStyle).toContainEqual(
      expect.objectContaining({
        backgroundColor: baseColors.cream50,
        borderColor: "transparent",
      }),
    );

    rerender(
      <Button label="Delete" variant="destructive" onPress={() => undefined} />,
    );
    const destructiveButton = UNSAFE_root.find(
      (node) =>
        node.props.accessibilityRole === "button" &&
        node.props.accessibilityLabel === "Delete" &&
        typeof node.props.style === "function",
    );
    const destructiveStyle = destructiveButton.props.style({
      pressed: true,
    }) as Array<unknown>;
    expect(destructiveStyle).toContainEqual(
      expect.objectContaining({
        backgroundColor: baseColors.terracotta700,
        borderColor: baseColors.terracotta700,
      }),
    );
  });

  it("supports intrinsic width buttons", () => {
    const { UNSAFE_root } = renderWithTheme(
      <Button
        label="Inline action"
        onPress={() => undefined}
        fullWidth={false}
      />,
    );

    const button = UNSAFE_root.find(
      (node) =>
        node.props.accessibilityRole === "button" &&
        node.props.accessibilityLabel === "Inline action" &&
        typeof node.props.style === "function",
    );
    const styles = button.props.style({ pressed: false }) as Array<unknown>;
    expect(styles).toContainEqual(expect.objectContaining({ alignSelf: "flex-start" }));
  });
});
