import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Linking } from "react-native";
import type { ReactNode } from "react";
import LegalPrivacyHubScreen from "@/feature/UserProfile/screens/LegalPrivacyHubScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import mockEnProfile from "@/locales/en/profile.json";

const mockGetTermsUrl = jest.fn(() => "");
const mockExportUserData = jest.fn<() => Promise<string>>();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { defaultValue?: string; filename?: string; path?: string },
    ) => {
      const profileCopy = mockEnProfile as Record<string, unknown>;
      const rawValue = profileCopy[key];
      const value =
        typeof rawValue === "string" ? rawValue : (options?.defaultValue ?? key);

      if (key === "exportSavedSuccess" && options?.filename) {
        return `Your data export was saved as ${options.filename}.`;
      }

      if (key === "exportSavedPathHint" && options?.path) {
        return `File location: ${options.path}`;
      }

      return value;
    },
  }),
}));

jest.mock("@/utils/legalUrls", () => ({
  getTermsUrl: () => mockGetTermsUrl(),
}));

jest.mock("@/context/UserAccountContext", () => ({
  useUserAccountContext: () => ({
    exportUserData: mockExportUserData,
  }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components", () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    FormScreenShell: ({
      title,
      onBack,
      children,
      testID,
    }: {
      title: string;
      onBack: () => void;
      children: ReactNode;
      testID?: string;
    }) => (
      <View testID={testID}>
        <Pressable testID="screen-back" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Text>{title}</Text>
        {children}
      </View>
    ),
    InfoBlock: ({
      title,
      body,
    }: {
      title: string;
      body: string;
    }) => (
      <View>
        <Text>{title}</Text>
        <Text>{body}</Text>
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
      title,
      subtitle,
      onPress,
      testID,
      leading,
    }: {
      title: string;
      subtitle?: string;
      onPress?: () => void;
      testID?: string;
      leading?: ReactNode;
    }) => (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={title}
      >
        {leading}
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </Pressable>
    ),
    Modal: ({
      visible,
      title,
      message,
      primaryAction,
    }: {
      visible: boolean;
      title?: string;
      message?: string;
      primaryAction?: { label: string; onPress?: () => void };
    }) =>
      visible ? (
        <View testID="legal-export-modal">
          {title ? <Text>{title}</Text> : null}
          {message ? <Text>{message}</Text> : null}
          {primaryAction ? (
            <Pressable onPress={primaryAction.onPress}>
              <Text>{primaryAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null,
  };
});

function renderScreen(overrides?: Partial<{ canGoBack: boolean }>) {
  const navigation = {
    canGoBack: jest.fn(() => overrides?.canGoBack ?? true),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const screen = renderWithTheme(
    <LegalPrivacyHubScreen navigation={navigation as never} />,
  );

  return { navigation, screen };
}

describe("LegalPrivacyHubScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTermsUrl.mockReturnValue("");
    mockExportUserData.mockResolvedValue("/tmp/fitaly_user_data.pdf");
  });

  it("keeps the hub lightweight with natural privacy naming and grouped rows", () => {
    const { screen } = renderScreen();

    expect(screen.getByTestId("legal-privacy-screen")).toBeTruthy();
    expect(screen.getByText("Legal & privacy")).toBeTruthy();
    expect(screen.getByText("Privacy & documents")).toBeTruthy();
    expect(screen.queryByText("Trust documents")).toBeNull();
    expect(screen.getByText("Legal documents")).toBeTruthy();
    expect(screen.getByText("Data transparency")).toBeTruthy();
    expect(screen.getByTestId("legal-privacy-policy-row")).toBeTruthy();
    expect(screen.getByTestId("legal-terms-row")).toBeTruthy();
    expect(screen.getByTestId("legal-privacy-ai-settings-row")).toBeTruthy();
    expect(screen.getByTestId("legal-data-ai-row")).toBeTruthy();
    expect(screen.getByTestId("legal-download-data-row")).toBeTruthy();
  });

  it("keeps legal documents and data clarity navigation on the canonical routes", async () => {
    const openUrlSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined);
    const { navigation, screen } = renderScreen();

    fireEvent.press(screen.getByTestId("legal-privacy-policy-row"));
    expect(navigation.navigate).toHaveBeenCalledWith("Privacy");

    fireEvent.press(screen.getByTestId("legal-terms-row"));
    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith("Terms");
    });
    expect(openUrlSpy).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("legal-data-ai-row"));
    expect(navigation.navigate).toHaveBeenCalledWith("DataAiClarity");

    fireEvent.press(screen.getByTestId("legal-privacy-ai-settings-row"));
    expect(navigation.navigate).toHaveBeenCalledWith("PrivacyAiSettings");

    mockGetTermsUrl.mockReturnValue("https://example.com/terms");
    const { screen: externalTermsScreen } = renderScreen();

    fireEvent.press(externalTermsScreen.getByTestId("legal-terms-row"));
    await waitFor(() => {
      expect(openUrlSpy).toHaveBeenCalledWith("https://example.com/terms");
    });
  });

  it("keeps export data on the existing account export action", async () => {
    const { screen } = renderScreen();

    fireEvent.press(screen.getByTestId("legal-download-data-row"));

    await waitFor(() => {
      expect(mockExportUserData).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("legal-export-modal")).toBeTruthy();
    });
    expect(screen.getAllByText("Download your data")).toHaveLength(2);
    expect(
      screen.getByText(
        "Your data export was saved as fitaly_user_data.pdf.\nFile location: /tmp/fitaly_user_data.pdf",
      ),
    ).toBeTruthy();
  });

  it("uses the profile fallback when there is no back stack", () => {
    const { navigation, screen } = renderScreen({ canGoBack: false });

    fireEvent.press(screen.getByTestId("screen-back"));

    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith("Profile");
  });
});
