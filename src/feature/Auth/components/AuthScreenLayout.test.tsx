import React from "react";
import { Keyboard, Platform, Text, View } from "react-native";
import { act } from "@testing-library/react-native";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { AuthScreenLayout } from "@/feature/Auth/components/AuthScreenLayout";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: RNView } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Layout: ({ children }: { children: React.ReactNode }) =>
      React.createElement(RNView, null, children),
  };
});

describe("AuthScreenLayout", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the compact auth composition while the keyboard is visible", () => {
    const listeners = new Map<string, (event?: unknown) => void>();
    jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation(((eventName: string, callback: unknown) => {
        listeners.set(eventName, callback as (event?: unknown) => void);
        return { remove: jest.fn() } as never;
      }) as typeof Keyboard.addListener);

    const { getByText, queryByText } = renderWithTheme(
      <AuthScreenLayout
        brand="Fitaly"
        title="Witaj ponownie"
        compactOnKeyboardVisible
      >
        <Text>login-form</Text>
      </AuthScreenLayout>,
    );

    expect(getByText("italy")).toBeTruthy();
    expect(getByText("Witaj ponownie")).toBeTruthy();

    const showEventName =
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";

    act(() => {
      listeners.get(showEventName)?.({
        endCoordinates: { height: 320 },
      });
    });

    expect(getByText("italy")).toBeTruthy();
    expect(queryByText("Witaj ponownie")).toBeNull();
    expect(getByText("login-form")).toBeTruthy();
  });

  it("keeps the full composition when compact keyboard mode is not enabled", () => {
    jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation((() => ({ remove: jest.fn() })) as never);

    const { getByText, UNSAFE_getAllByType } = renderWithTheme(
      <AuthScreenLayout brand="Fitaly" title="Witaj ponownie">
        <Text>login-form</Text>
      </AuthScreenLayout>,
    );

    expect(getByText("italy")).toBeTruthy();
    expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
  });
});
