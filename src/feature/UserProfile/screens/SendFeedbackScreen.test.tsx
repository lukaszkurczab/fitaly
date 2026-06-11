import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import SendFeedbackScreen from "@/feature/UserProfile/screens/SendFeedbackScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import mockEnProfile from "@/locales/en/profile.json";
import NetInfo from "@react-native-community/netinfo";
import * as ImagePicker from "expo-image-picker";
import { sendFeedback } from "@/services/feedback/feedbackService";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const profileCopy = mockEnProfile as Record<string, unknown>;
      const rawValue = profileCopy[key];
      return typeof rawValue === "string"
        ? rawValue
        : (options?.defaultValue ?? key);
    },
  }),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
  },
}));

jest.mock("expo-device", () => ({
  modelName: "iPhone",
  osName: "iOS",
  osVersion: "18",
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({
    firebaseUser: {
      uid: "user-1",
      email: "user@example.com",
    },
  }),
}));

jest.mock("@/services/feedback/feedbackService", () => ({
  sendFeedback: jest.fn(),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components", () => {
  const { Pressable, Text, TextInput, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Button: ({
      label,
      onPress,
      disabled,
      loading,
      testID,
    }: {
      label?: string;
      onPress?: () => void;
      disabled?: boolean;
      loading?: boolean;
      testID?: string;
    }) => (
      <Pressable
        testID={testID}
        onPress={disabled || loading ? undefined : onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{
          disabled: Boolean(disabled),
          busy: Boolean(loading),
        }}
      >
        <Text>{label}</Text>
      </Pressable>
    ),
    FormScreenShell: ({
      title,
      intro,
      onBack,
      children,
      testID,
      actionLabel,
      onActionPress,
      actionDisabled,
      actionLoading,
      actionTestID,
      secondaryActionLabel,
      secondaryActionPress,
      secondaryActionDisabled,
      secondaryActionLoading,
    }: {
      title: string;
      intro?: string;
      onBack: () => void;
      children: ReactNode;
      testID?: string;
      actionLabel?: string;
      onActionPress?: () => void;
      actionDisabled?: boolean;
      actionLoading?: boolean;
      actionTestID?: string;
      secondaryActionLabel?: string;
      secondaryActionPress?: () => void;
      secondaryActionDisabled?: boolean;
      secondaryActionLoading?: boolean;
    }) => (
      <View testID={testID}>
        <Pressable testID="screen-back" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Text>{title}</Text>
        {intro ? <Text>{intro}</Text> : null}
        {children}
        {secondaryActionLabel ? (
          <Pressable
            testID="send-feedback-secondary-action"
            onPress={
              secondaryActionDisabled || secondaryActionLoading
                ? undefined
                : secondaryActionPress
            }
            accessibilityRole="button"
            accessibilityLabel={secondaryActionLabel}
          >
            <Text>{secondaryActionLabel}</Text>
          </Pressable>
        ) : null}
        {actionLabel ? (
          <Pressable
            testID={actionTestID}
            onPress={
              actionDisabled || actionLoading ? undefined : onActionPress
            }
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text>{actionLabel}</Text>
          </Pressable>
        ) : null}
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
    LongTextInput: ({
      label,
      value,
      onChangeText,
      placeholder,
      testID,
    }: {
      label?: string;
      value: string;
      onChangeText: (text: string) => void;
      placeholder?: string;
      testID?: string;
    }) => (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
        />
      </View>
    ),
    SettingsSection: ({
      title,
      footer,
      children,
    }: {
      title?: string;
      footer?: string;
      children: ReactNode;
    }) => (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
        {footer ? <Text>{footer}</Text> : null}
      </View>
    ),
    SettingsRow: ({
      title,
      onPress,
      testID,
      leading,
    }: {
      title: string;
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
      </Pressable>
    ),
    UnsavedChangesModal: () => null,
  };
});

const mockFetch = jest.mocked(NetInfo.fetch);
const mockLaunchImageLibraryAsync = jest.mocked(
  ImagePicker.launchImageLibraryAsync,
);
const mockSendFeedback = jest.mocked(sendFeedback);

const onlineState = {
  isConnected: true,
  isInternetReachable: true,
} as Awaited<ReturnType<typeof NetInfo.fetch>>;

const offlineState = {
  isConnected: false,
  isInternetReachable: false,
} as Awaited<ReturnType<typeof NetInfo.fetch>>;

function renderScreen() {
  const navigation = {
    addListener: jest.fn(() => jest.fn()),
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const screen = renderWithTheme(
    <SendFeedbackScreen navigation={navigation as never} />,
  );

  return { navigation, screen };
}

async function pickAttachment(screen: ReturnType<typeof renderScreen>["screen"]) {
  fireEvent.press(screen.getByTestId("send-feedback-attachment-picker"));

  await waitFor(() => {
    expect(
      screen.getByTestId("send-feedback-attachment-preview").props.source,
    ).toEqual({ uri: "file:///tmp/feedback-shot.jpg" });
  });
}

describe("SendFeedbackScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(onlineState);
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/feedback-shot.jpg" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);
    mockSendFeedback.mockResolvedValue(undefined);
  });

  it("preserves message and attachment after attachment send failure and retries with the same input", async () => {
    mockSendFeedback
      .mockRejectedValueOnce(new Error("upload failed"))
      .mockResolvedValueOnce(undefined);
    const { screen } = renderScreen();

    fireEvent.changeText(
      screen.getByTestId("send-feedback-message"),
      "The barcode screen froze",
    );
    await pickAttachment(screen);
    fireEvent.press(screen.getByTestId("send-feedback-submit"));

    await waitFor(() => {
      expect(screen.getByText("Attachment was not sent")).toBeTruthy();
    });
    expect(
      screen.getByText(
        "Your message and screenshot are still here. Try sending again, or remove the attachment and send the message without it.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("send-feedback-message").props.value).toBe(
      "The barcode screen froze",
    );
    expect(
      screen.getByTestId("send-feedback-attachment-preview").props.source,
    ).toEqual({ uri: "file:///tmp/feedback-shot.jpg" });

    fireEvent.press(screen.getByTestId("send-feedback-submit"));

    await waitFor(() => {
      expect(mockSendFeedback).toHaveBeenCalledTimes(2);
    });
    expect(mockSendFeedback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: "The barcode screen froze",
        attachmentUri: "file:///tmp/feedback-shot.jpg",
      }),
    );
    expect(screen.getByText("Thank you for your feedback!")).toBeTruthy();
  });

  it("shows preview failure without discarding the attachment or blocking send", async () => {
    const { screen } = renderScreen();

    fireEvent.changeText(
      screen.getByTestId("send-feedback-message"),
      "The preview is blank",
    );
    await pickAttachment(screen);

    fireEvent(screen.getByTestId("send-feedback-attachment-preview"), "error");

    expect(
      screen.getByText("Attachment preview could not load"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Your screenshot is still attached. You can send it anyway, replace it, or remove it.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("send-feedback-message").props.value).toBe(
      "The preview is blank",
    );
    expect(
      screen.getByTestId("send-feedback-attachment-preview").props.source,
    ).toEqual({ uri: "file:///tmp/feedback-shot.jpg" });

    fireEvent.press(screen.getByTestId("send-feedback-remove-attachment"));

    expect(screen.queryByText("Attachment preview could not load")).toBeNull();
    expect(screen.queryByTestId("send-feedback-attachment-preview")).toBeNull();
    expect(screen.getByTestId("send-feedback-message").props.value).toBe(
      "The preview is blank",
    );

    await pickAttachment(screen);
    fireEvent(screen.getByTestId("send-feedback-attachment-preview"), "error");

    fireEvent.press(screen.getByTestId("send-feedback-submit"));

    await waitFor(() => {
      expect(mockSendFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "The preview is blank",
          attachmentUri: "file:///tmp/feedback-shot.jpg",
        }),
      );
    });
  });

  it("discards failed attachment without losing the typed message and sends without attachment", async () => {
    mockSendFeedback
      .mockRejectedValueOnce(new Error("upload failed"))
      .mockResolvedValueOnce(undefined);
    const { screen } = renderScreen();

    fireEvent.changeText(
      screen.getByTestId("send-feedback-message"),
      "Keep this message",
    );
    await pickAttachment(screen);
    fireEvent.press(screen.getByTestId("send-feedback-submit"));

    await waitFor(() => {
      expect(screen.getByText("Attachment was not sent")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("send-feedback-remove-attachment"));

    expect(screen.queryByText("Attachment was not sent")).toBeNull();
    expect(screen.queryByTestId("send-feedback-attachment-preview")).toBeNull();
    expect(screen.getByTestId("send-feedback-message").props.value).toBe(
      "Keep this message",
    );

    fireEvent.press(screen.getByTestId("send-feedback-submit"));

    await waitFor(() => {
      expect(mockSendFeedback).toHaveBeenCalledTimes(2);
    });
    expect(mockSendFeedback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: "Keep this message",
        attachmentUri: null,
      }),
    );
  });

  it("keeps no-attachment send failures on generic feedback error copy", async () => {
    mockSendFeedback.mockRejectedValueOnce(new Error("send failed"));
    const { screen } = renderScreen();

    fireEvent.changeText(
      screen.getByTestId("send-feedback-message"),
      "Plain feedback",
    );
    fireEvent.press(screen.getByTestId("send-feedback-submit"));

    await waitFor(() => {
      expect(screen.getByText("Failed to send feedback. Try again later.")).toBeTruthy();
    });
    expect(screen.queryByText("Attachment was not sent")).toBeNull();
  });

  it("shows offline warning before sending and does not label it as attachment failure", async () => {
    mockFetch.mockResolvedValue(offlineState);
    const { screen } = renderScreen();

    fireEvent.changeText(
      screen.getByTestId("send-feedback-message"),
      "Offline with screenshot",
    );
    await pickAttachment(screen);
    fireEvent.press(screen.getByTestId("send-feedback-submit"));

    await waitFor(() => {
      expect(screen.getByText("No internet connection")).toBeTruthy();
    });
    expect(screen.queryByText("Attachment was not sent")).toBeNull();
    expect(mockSendFeedback).not.toHaveBeenCalled();
    expect(screen.getByTestId("send-feedback-message").props.value).toBe(
      "Offline with screenshot",
    );
    expect(screen.getByTestId("send-feedback-attachment-preview")).toBeTruthy();
  });

  it("clears message and attachment after a successful send", async () => {
    const { screen } = renderScreen();

    fireEvent.changeText(
      screen.getByTestId("send-feedback-message"),
      "This should clear",
    );
    await pickAttachment(screen);
    fireEvent.press(screen.getByTestId("send-feedback-submit"));

    await waitFor(() => {
      expect(screen.getByText("Thank you for your feedback!")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("send-feedback-secondary-action"));

    expect(screen.getByTestId("send-feedback-message").props.value).toBe("");
    expect(screen.queryByTestId("send-feedback-attachment-preview")).toBeNull();
  });
});
