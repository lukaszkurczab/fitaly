import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Linking } from "react-native";
import type { ReactNode } from "react";
import DataAiClarityScreen from "@/feature/UserProfile/screens/DataAiClarityScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockGetTermsUrl = jest.fn(() => "");

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

jest.mock("@/utils/legalUrls", () => ({
  getTermsUrl: () => mockGetTermsUrl(),
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
      children,
      primaryAction,
      testID,
    }: {
      visible: boolean;
      title?: string;
      children?: ReactNode;
      primaryAction?: { label: string; onPress?: () => void; testID?: string };
      testID?: string;
    }) =>
      visible ? (
        <View testID={testID}>
          {title ? <Text>{title}</Text> : null}
          {children}
          {primaryAction ? (
            <Pressable
              testID={primaryAction.testID}
              onPress={primaryAction.onPress}
            >
              <Text>{primaryAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null,
  };
});

function renderScreen(overrides?: Partial<{
  canGoBack: boolean;
}>) {
  const navigation = {
    canGoBack: jest.fn(() => overrides?.canGoBack ?? true),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const screen = renderWithTheme(
    <DataAiClarityScreen navigation={navigation as never} />,
  );

  return { navigation, screen };
}

describe("DataAiClarityScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTermsUrl.mockReturnValue("");
  });

  it("renders a short overview with topic rows instead of detail copy", () => {
    const { screen } = renderScreen();

    expect(screen.getByTestId("data-ai-clarity-screen")).toBeTruthy();
    expect(screen.getByText("How Fitaly uses data")).toBeTruthy();
    expect(screen.getByText("Quick answers")).toBeTruthy();
    expect(screen.getByTestId("data-ai-topic-added-data")).toBeTruthy();
    expect(screen.getByTestId("data-ai-topic-ai-use")).toBeTruthy();
    expect(screen.getByTestId("data-ai-topic-account-record")).toBeTruthy();
    expect(screen.getByTestId("data-ai-topic-controls")).toBeTruthy();
    expect(screen.getByTestId("data-ai-topic-legal-docs")).toBeTruthy();
    expect(screen.queryByText("Photo analysis")).toBeNull();
    expect(screen.queryByText("Firebase supports authentication, database storage, analytics, and app reliability.")).toBeNull();
  });

  it("opens focused AI detail and closes it without navigation", () => {
    const { navigation, screen } = renderScreen();

    fireEvent.press(screen.getByTestId("data-ai-topic-ai-use"));

    expect(screen.getByTestId("data-ai-detail-modal")).toBeTruthy();
    expect(screen.getByTestId("data-ai-detail-ai-use")).toBeTruthy();
    expect(screen.getByText("AI in Fitaly")).toBeTruthy();
    expect(screen.getByText("Photo analysis")).toBeTruthy();
    expect(screen.getByText("Text and chat")).toBeTruthy();

    fireEvent.press(screen.getByTestId("data-ai-detail-close"));

    expect(screen.queryByTestId("data-ai-detail-modal")).toBeNull();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("keeps full legal documents reachable from the legal detail surface", async () => {
    const openUrlSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined);
    const { navigation, screen } = renderScreen();

    fireEvent.press(screen.getByTestId("data-ai-topic-legal-docs"));
    fireEvent.press(screen.getByTestId("data-ai-legal-privacy"));

    expect(navigation.navigate).toHaveBeenCalledWith("Privacy");

    fireEvent.press(screen.getByTestId("data-ai-topic-legal-docs"));
    fireEvent.press(screen.getByTestId("data-ai-legal-terms"));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith("Terms");
    });
    expect(openUrlSpy).not.toHaveBeenCalled();

    mockGetTermsUrl.mockReturnValue("https://example.com/terms");
    fireEvent.press(screen.getByTestId("data-ai-topic-legal-docs"));
    fireEvent.press(screen.getByTestId("data-ai-legal-terms"));

    await waitFor(() => {
      expect(openUrlSpy).toHaveBeenCalledWith("https://example.com/terms");
    });
  });

  it("uses the Legal & privacy fallback when there is no back stack", () => {
    const { navigation, screen } = renderScreen({ canGoBack: false });

    fireEvent.press(screen.getByTestId("screen-back"));

    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith("LegalPrivacyHub");
  });
});
