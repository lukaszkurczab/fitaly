import { fireEvent } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import UserProfileScreen from "@/feature/UserProfile/screens/UserProfileScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockHandleLogout = jest.fn<() => Promise<void>>();

const mockBaseState = {
  userData: {
    uid: "u1",
    username: "neo",
    email: "neo@example.com",
  },
  loadingUser: false,
  isOnline: true,
  syncState: "synced",
  retryProfileSync: jest.fn<() => Promise<void>>(),
  retryingProfileSync: false,
  avatarSrc: "",
  safeBadges: [],
  overrideColor: undefined,
  overrideEmoji: undefined,
  handleLogout: mockHandleLogout,
  handleRetryProfileLoad: jest.fn<() => Promise<void>>(),
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

jest.mock("@/feature/UserProfile/hooks/useUserProfileState", () => ({
  useUserProfileState: () => mockBaseState,
}));

jest.mock("@/context/PremiumContext", () => ({
  usePremiumContext: () => ({ isPremium: false }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/AvatarBadge", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/feature/UserProfile/components/AccountIdentityCard", () => {
  const { Pressable, Text } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    AccountIdentityCard: ({
      title,
      subtitle,
      onPress,
      testID,
    }: {
      title: string;
      subtitle: string;
      onPress?: () => void;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
      </Pressable>
    ),
  };
});

jest.mock("@/components", () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Button: ({
      label,
      onPress,
      testID,
    }: {
      label: string;
      onPress?: () => void;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
        <Text>{label}</Text>
      </Pressable>
    ),
    InfoBlock: () => null,
    Layout: ({ children }: { children: ReactNode }) => <View>{children}</View>,
    Modal: ({
      visible,
      title,
      message,
      primaryAction,
      secondaryAction,
    }: {
      visible: boolean;
      title?: string;
      message?: string;
      primaryAction?: { label: string; onPress?: () => void; testID?: string };
      secondaryAction?: {
        label: string;
        onPress?: () => void;
        testID?: string;
      };
    }) =>
      visible ? (
        <View>
          {title ? <Text>{title}</Text> : null}
          {message ? <Text>{message}</Text> : null}
          {secondaryAction ? (
            <Pressable
              onPress={secondaryAction.onPress}
              testID={secondaryAction.testID}
            >
              <Text>{secondaryAction.label}</Text>
            </Pressable>
          ) : null}
          {primaryAction ? (
            <Pressable
              onPress={primaryAction.onPress}
              testID={primaryAction.testID}
            >
              <Text>{primaryAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null,
    SettingsRow: ({
      title,
      onPress,
      testID,
    }: {
      title: string;
      onPress?: () => void;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
        <Text>{title}</Text>
      </Pressable>
    ),
    SettingsSection: ({
      title,
      children,
    }: {
      title?: string;
      children: ReactNode;
    }) => (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
      </View>
    ),
  };
});

describe("UserProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleLogout.mockResolvedValue(undefined);
  });

  it("opens a confirmation modal before logging out", () => {
    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    expect(screen.queryByText("logOutConfirmTitle")).toBeNull();

    fireEvent.press(screen.getByTestId("account-logout-row"));

    expect(screen.getByText("logOutConfirmTitle")).toBeTruthy();
    expect(screen.getByText("logOutConfirmMessage")).toBeTruthy();
    expect(mockHandleLogout).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("account-logout-confirm-button"));

    expect(mockHandleLogout).toHaveBeenCalledTimes(1);
  });

  it("closes the logout confirmation without logging out", () => {
    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    fireEvent.press(screen.getByTestId("account-logout-row"));
    fireEvent.press(screen.getByTestId("account-logout-cancel-button"));

    expect(screen.queryByText("logOutConfirmTitle")).toBeNull();
    expect(mockHandleLogout).not.toHaveBeenCalled();
  });

  it("uses the identity card as the single profile details entry", () => {
    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    expect(screen.queryByTestId("account-profile-details-row")).toBeNull();

    fireEvent.press(screen.getByTestId("account-identity-card"));

    expect(navigation.navigate).toHaveBeenCalledWith("EditUserData");
  });
});
