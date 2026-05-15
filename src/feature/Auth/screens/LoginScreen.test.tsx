import React from "react";
import NetInfo from "@react-native-community/netinfo";
import { NetInfoStateType } from "@react-native-community/netinfo";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import LoginScreen from "@/feature/Auth/screens/LoginScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockLogin = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockReset = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

jest.mock("@/feature/Auth/components/AuthScreenLayout", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    AuthScreenLayout: ({
      banner,
      children,
      bottomAction,
      footer,
    }: {
      banner?: React.ReactNode;
      children: React.ReactNode;
      bottomAction?: React.ReactNode;
      footer?: React.ReactNode;
    }) =>
      React.createElement(
        View,
        null,
        banner,
        children,
        bottomAction,
        footer,
      ),
  };
});

jest.mock("@/components", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const {
    Pressable,
    Text,
    TextInput: RNTextInput,
    View,
  } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Button: ({
      label,
      onPress,
      disabled,
      loading,
      testID,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
      loading?: boolean;
      testID?: string;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: "button",
          accessibilityState: { busy: Boolean(loading), disabled: Boolean(disabled) },
          disabled,
          onPress: disabled ? undefined : onPress,
          testID,
        },
        React.createElement(Text, null, label),
      ),
    ErrorBox: ({ message }: { message: string }) =>
      React.createElement(Text, null, message),
    LinkText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    TextInput: (props: Record<string, unknown>) =>
      React.createElement(
        View,
        null,
        React.createElement(RNTextInput, props),
      ),
  };
});

jest.mock("@/feature/Auth/hooks/useLogin", () => ({
  useLogin: () => ({
    login: (...args: unknown[]) => mockLogin(...args),
    loading: false,
    errors: {},
    criticalError: null,
    reset: mockReset,
  }),
}));

describe("LoginScreen", () => {
  const navigation = {
    navigate: jest.fn(),
  } as unknown as React.ComponentProps<typeof LoginScreen>["navigation"];

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      type: NetInfoStateType.none,
      isConnected: false,
      isInternetReachable: false,
      details: null,
    });
    jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
      listener({
        type: NetInfoStateType.none,
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });
      return jest.fn();
    });
  });

  it("allows login retry after a stale offline event when fetch reports online", async () => {
    const { getByTestId, getByText } = renderWithTheme(
      <LoginScreen navigation={navigation} />,
    );

    await waitFor(() => {
      expect(getByText("common:no_internet")).toBeTruthy();
    });

    fireEvent.changeText(getByTestId("login-email-input"), "user@example.com");
    fireEvent.changeText(getByTestId("login-password-input"), "Strong1!");

    await waitFor(() => {
      expect(getByTestId("login-submit-button").props.accessibilityState).toEqual({
        busy: false,
        disabled: false,
      });
    });

    jest.mocked(NetInfo.fetch).mockResolvedValue({
      type: NetInfoStateType.wifi,
      isConnected: true,
      isInternetReachable: true,
      details: {
        ssid: null,
        bssid: null,
        strength: null,
        ipAddress: null,
        subnet: null,
        frequency: null,
        linkSpeed: null,
        rxLinkSpeed: null,
        txLinkSpeed: null,
        isConnectionExpensive: false,
      },
    });

    fireEvent.press(getByTestId("login-submit-button"));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("user@example.com", "Strong1!");
    });
  });

  it("keeps the request local when submit fetch confirms offline", async () => {
    const { getByTestId } = renderWithTheme(
      <LoginScreen navigation={navigation} />,
    );

    fireEvent.changeText(getByTestId("login-email-input"), "user@example.com");
    fireEvent.changeText(getByTestId("login-password-input"), "Strong1!");
    fireEvent.press(getByTestId("login-submit-button"));

    await waitFor(() => {
      expect(NetInfo.fetch).toHaveBeenCalled();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
