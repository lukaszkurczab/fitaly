import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AppSettingsScreen from "@/feature/UserProfile/screens/AppSettingsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { ReactNode } from "react";

const mockChangeLanguage = jest.fn<(code: string) => Promise<void>>();
const mockRuntimeFeatures: Record<string, boolean> = {
  smartMemory: true,
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

jest.mock("@/context/AppSettingsContext", () => ({
  useAppSettingsContext: () => ({
    language: "pl",
    changeLanguage: (code: string) => mockChangeLanguage(code),
  }),
}));

jest.mock("@/services/core/featureFlagGuard", () => ({
  isRuntimeFeatureEnabled: (domain: string) => mockRuntimeFeatures[domain] ?? true,
}));

jest.mock("@/components", () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    FormScreenShell: ({
      title,
      children,
    }: {
      title: string;
      children: ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
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
    SettingsRow: ({
      leading,
      title,
      subtitle,
      value,
      onPress,
      testID,
      trailing,
    }: {
      leading?: ReactNode;
      title: string;
      subtitle?: string;
      value?: string;
      onPress?: () => void;
      testID?: string;
      trailing?: ReactNode;
    }) => (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {leading}
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        {value ? <Text>{value}</Text> : null}
        {trailing}
      </Pressable>
    ),
    InfoBlock: ({
      title,
      body,
      icon,
    }: {
      title: string;
      body: string;
      icon?: ReactNode;
    }) => (
      <View>
        {icon}
        <Text>{title}</Text>
        <Text>{body}</Text>
      </View>
    ),
    ButtonToggle: ({ testID }: { testID?: string }) => <View testID={testID} />,
  };
});

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{name}</Text>;
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("AppSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChangeLanguage.mockResolvedValue(undefined);
    mockRuntimeFeatures.smartMemory = true;
  });

  it("opens the language picker sheet and updates language inline", async () => {
    const navigation = {
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      navigate: jest.fn(),
    };

    const { getByTestId, getByText } = renderWithTheme(
      <AppSettingsScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByTestId("app-settings-language-row"));

    expect(getByText("Available languages")).toBeTruthy();

    fireEvent.press(getByTestId("language-option-en"));

    await waitFor(() => {
      expect(mockChangeLanguage).toHaveBeenCalledWith("en");
    });

    expect(navigation.navigate).not.toHaveBeenCalledWith("Language");
  });

  it("exposes the dark mode toggle for E2E coverage", () => {
    const navigation = {
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      navigate: jest.fn(),
    };

    const { getByTestId } = renderWithTheme(
      <AppSettingsScreen navigation={navigation as never} />,
    );

    expect(getByTestId("app-settings-dark-mode-toggle")).toBeTruthy();
  });

  it("links to Memory Center from app settings", () => {
    const navigation = {
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      navigate: jest.fn(),
    };

    const { getByTestId } = renderWithTheme(
      <AppSettingsScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByTestId("app-settings-memory-center-row"));

    expect(navigation.navigate).toHaveBeenCalledWith("MemoryCenter");
  });

  it("hides the Memory Center row when Smart Memory is disabled", () => {
    mockRuntimeFeatures.smartMemory = false;
    const navigation = {
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      navigate: jest.fn(),
    };

    const { queryByTestId } = renderWithTheme(
      <AppSettingsScreen navigation={navigation as never} />,
    );

    expect(queryByTestId("app-settings-memory-center-row")).toBeNull();
    expect(navigation.navigate).not.toHaveBeenCalledWith("MemoryCenter");
  });
});
