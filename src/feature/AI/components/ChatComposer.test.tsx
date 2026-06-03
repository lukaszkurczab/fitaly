import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import {
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { ReactTestInstance } from "react-test-renderer";
import { ChatComposer } from "./ChatComposer";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import { rounded } from "@/theme/rounded";

const findAncestorStyle = (
  input: ReactTestInstance,
  predicate: (style: ViewStyle) => boolean,
) => {
  let current = input.parent;

  while (current) {
    const style = StyleSheet.flatten(
      current.props.style as StyleProp<ViewStyle>,
    );

    if (style && predicate(style)) {
      return style;
    }

    current = current.parent;
  }

  throw new Error("Expected composer ancestor style not found");
};

describe("ChatComposer", () => {
  it("starts at compact minimum height and grows up to max with scroll", () => {
    const screen = renderWithTheme(
      <ChatComposer
        placeholder="composer.placeholder"
        sendLabel="Send"
        disabled={false}
        onSend={() => undefined}
      />,
    );

    const input = screen.getByTestId("chat-input");
    const initialStyle = StyleSheet.flatten(input.props.style);
    const minHeight = initialStyle.height;
    const maxHeight = initialStyle.maxHeight;

    expect(input.props.numberOfLines).toBe(1);
    expect(input.props.scrollEnabled).toBe(false);
    expect(input.props.returnKeyType).toBe("done");
    expect(input.props.blurOnSubmit).toBe(true);
    expect(input.props.autoCapitalize).toBe("sentences");
    expect(input.props.autoCorrect).toBe(true);
    expect(input.props.spellCheck).toBe(true);
    expect(initialStyle).toEqual(
      expect.objectContaining({
        height: expect.any(Number),
        maxHeight: expect.any(Number),
      }),
    );

    fireEvent(input, "contentSizeChange", {
      nativeEvent: {
        contentSize: { height: Number(maxHeight) + 80, width: 140 },
      },
    });

    const grownInput = screen.getByTestId("chat-input");
    expect(grownInput.props.scrollEnabled).toBe(true);
    expect(StyleSheet.flatten(grownInput.props.style)).toEqual(
      expect.objectContaining({
        height: maxHeight,
        maxHeight,
      }),
    );
    expect(Number(minHeight)).toBeLessThan(Number(maxHeight));
  });

  it("uses typed length as a fallback so long prompts visibly grow before native size events arrive", () => {
    const screen = renderWithTheme(
      <ChatComposer
        placeholder="composer.placeholder"
        sendLabel="Send"
        disabled={false}
        onSend={() => undefined}
      />,
    );

    const input = screen.getByTestId("chat-input");
    const initialHeight = StyleSheet.flatten(input.props.style).height;

    fireEvent.changeText(
      input,
      "Czy możesz spokojnie podsumować mój dzień i podpowiedzieć jeden następny krok, gdy natywne zdarzenie rozmiaru jeszcze nie przyszło?",
    );

    const grownInput = screen.getByTestId("chat-input");
    const grownHeight = StyleSheet.flatten(grownInput.props.style).height;

    expect(Number(grownHeight)).toBeGreaterThan(Number(initialHeight));
  });

  it("keeps text inset and vertically balanced inside the composer field", () => {
    const screen = renderWithTheme(
      <ChatComposer
        placeholder="composer.placeholder"
        sendLabel="Send"
        disabled={false}
        onSend={() => undefined}
      />,
    );

    const input = screen.getByTestId("chat-input");
    const inputStyle = StyleSheet.flatten(
      input.props.style as StyleProp<TextStyle>,
    );
    const inputFieldStyle = findAncestorStyle(
      input,
      (style) => style.flexDirection === "row" && style.borderWidth === 0,
    );
    const composerSurfaceStyle = findAncestorStyle(
      input,
      (style) => style.flexDirection === "row" && style.borderWidth === 1,
    );
    const leftInset =
      Number(
        composerSurfaceStyle.paddingLeft ??
          composerSurfaceStyle.paddingHorizontal ??
          0,
      ) +
      Number(
        inputFieldStyle.paddingLeft ?? inputFieldStyle.paddingHorizontal ?? 0,
      );

    expect(Number(inputStyle.paddingBottom)).toBeGreaterThan(
      Number(inputStyle.paddingTop ?? 0),
    );
    expect(leftInset).toBeGreaterThanOrEqual(rounded.xl);
  });

  it("blocks composer when disabled and unlocks send flow when enabled", () => {
    const onSend = jest.fn();
    const screen = renderWithTheme(
      <ChatComposer
        placeholder="composer.placeholder"
        sendLabel="Send"
        disabled={false}
        onSend={onSend}
      />,
    );

    fireEvent.changeText(screen.getByTestId("chat-input"), "  hello world  ");
    fireEvent.press(screen.getByTestId("chat-send-button"));
    expect(onSend).toHaveBeenCalledWith("hello world");

    screen.rerender(
      <ChatComposer
        placeholder="composer.placeholder"
        sendLabel="Send"
        disabled
        onSend={onSend}
      />,
    );

    expect(screen.getByTestId("chat-input").props.editable).toBe(false);
    fireEvent.changeText(screen.getByTestId("chat-input"), "another message");
    fireEvent.press(screen.getByTestId("chat-send-button"));
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
