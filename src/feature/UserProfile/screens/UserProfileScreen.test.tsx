import { fireEvent } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import {
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import UserProfileScreen from "@/feature/UserProfile/screens/UserProfileScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockHandleLogout = jest.fn<() => Promise<void>>();
const mockRetryProfileSync = jest.fn<() => Promise<void>>();
const mockDiscardAvatarUploadDeadLetter = jest.fn<() => Promise<void>>();

const mockBaseState = {
  userData: {
    uid: "u1",
    username: "neo",
    email: "neo@example.com",
  },
  loadingUser: false,
  isOnline: true,
  syncState: "synced",
  hasAvatarUploadDeadLetter: false,
  retryProfileSync: mockRetryProfileSync,
  discardAvatarUploadDeadLetter: mockDiscardAvatarUploadDeadLetter,
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
      style,
      testID,
    }: {
      title: string;
      subtitle: string;
      onPress?: () => void;
      style?: StyleProp<ViewStyle>;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} style={style} testID={testID}>
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
    InfoBlock: ({
      title,
      body,
      testID,
    }: {
      title: string;
      body: string;
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        <Text>{body}</Text>
      </View>
    ),
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
      style,
      testID,
    }: {
      title: string;
      onPress?: () => void;
      style?: StyleProp<ViewStyle>;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} style={style} testID={testID}>
        <Text>{title}</Text>
      </Pressable>
    ),
    SettingsSection: ({
      title,
      children,
      contentStyle,
    }: {
      title?: string;
      children: ReactNode;
      contentStyle?: StyleProp<ViewStyle>;
    }) => (
      <View testID={title ? `settings-section-${title}` : undefined}>
        {title ? <Text>{title}</Text> : null}
        <View
          testID={title ? `settings-section-${title}-content` : undefined}
          style={contentStyle}
        >
          {children}
        </View>
      </View>
    ),
  };
});

describe("UserProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleLogout.mockResolvedValue(undefined);
    mockRetryProfileSync.mockResolvedValue(undefined);
    mockDiscardAvatarUploadDeadLetter.mockResolvedValue(undefined);
    mockBaseState.syncState = "synced";
    mockBaseState.hasAvatarUploadDeadLetter = false;
    mockBaseState.retryingProfileSync = false;
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

  it("links to Memory Center from the profile control area", () => {
    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    fireEvent.press(screen.getByTestId("account-memory-center-row"));

    expect(navigation.navigate).toHaveBeenCalledWith("MemoryCenter");
  });

  it("links to the read-only recipe catalog from the profile area", () => {
    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    fireEvent.press(screen.getByTestId("account-recipe-catalog-row"));

    expect(navigation.navigate).toHaveBeenCalledWith("RecipeCatalog");
  });

  it("shows pending sync copy without retry action", () => {
    mockBaseState.syncState = "pending";

    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    expect(screen.getByTestId("account-sync-pending-notice")).toBeTruthy();
    expect(screen.getByText("sync.pendingTitle")).toBeTruthy();
    expect(screen.getByText("sync.pending")).toBeTruthy();
    expect(screen.queryByTestId("account-sync-retry-button")).toBeNull();
  });

  it("shows generic profile dead-letter sync copy and wires retry action", () => {
    mockBaseState.syncState = "dead-letter";
    mockBaseState.hasAvatarUploadDeadLetter = false;

    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    expect(screen.getByTestId("account-sync-dead-letter-notice")).toBeTruthy();
    expect(screen.getByText("sync.deadLetterTitle")).toBeTruthy();
    expect(screen.getByText("sync.deadLetter")).toBeTruthy();
    expect(screen.queryByText("sync.avatarDeadLetterTitle")).toBeNull();
    expect(screen.queryByText("sync.avatarDeadLetter")).toBeNull();
    expect(screen.queryByText("sync.conflictTitle")).toBeNull();
    expect(screen.queryByText("sync.conflict")).toBeNull();
    expect(
      screen.queryByTestId("account-sync-avatar-discard-button"),
    ).toBeNull();

    fireEvent.press(screen.getByTestId("account-sync-retry-button"));

    expect(mockRetryProfileSync).toHaveBeenCalledTimes(1);
  });

  it("shows avatar-specific dead-letter copy when avatar upload failed", () => {
    mockBaseState.syncState = "dead-letter";
    mockBaseState.hasAvatarUploadDeadLetter = true;

    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    expect(screen.getByTestId("account-sync-dead-letter-notice")).toBeTruthy();
    expect(screen.getByText("sync.avatarDeadLetterTitle")).toBeTruthy();
    expect(screen.getByText("sync.avatarDeadLetter")).toBeTruthy();
    expect(screen.queryByText("sync.deadLetterTitle")).toBeNull();
    expect(screen.queryByText("sync.deadLetter")).toBeNull();
    expect(
      screen.getByTestId("account-sync-avatar-discard-button"),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("account-sync-avatar-discard-button"));

    expect(mockDiscardAvatarUploadDeadLetter).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId("account-sync-retry-button"));

    expect(mockRetryProfileSync).toHaveBeenCalledTimes(1);
  });

  it("keeps profile material translucent without heavy panels or clipped raised section shadows", () => {
    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    const screen = renderWithTheme(
      <UserProfileScreen navigation={navigation as never} />,
    );

    const identityStyle = StyleSheet.flatten(
      screen.getByTestId("account-identity-card").props.style,
    );
    const sectionStyle = StyleSheet.flatten(
      screen.getByTestId("settings-section-profileSectionTitle-content").props
        .style,
    );
    const rowStyle = StyleSheet.flatten(
      screen.getByTestId("account-manage-subscription-row").props.style,
    );

    expect(identityStyle.backgroundColor).toContain("0.72");
    expect(identityStyle.borderColor).toContain("rgba");
    expect(identityStyle.shadowOpacity).toBeUndefined();
    expect(identityStyle.elevation).toBeUndefined();
    expect(sectionStyle.backgroundColor).toContain("0.58");
    expect(sectionStyle.borderColor).toContain("rgba");
    expect(sectionStyle.shadowOpacity).toBeUndefined();
    expect(sectionStyle.elevation).toBeUndefined();
    expect(rowStyle.borderBottomColor).toContain("rgba");
  });
});
