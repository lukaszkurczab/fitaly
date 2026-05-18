import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
import CheckMailboxScreen from "@/feature/Auth/screens/CheckMailboxScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockUseRoute = jest.fn<() => { params: { email: string } }>();
const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockNetInfoAddEventListener = jest.fn<
  (listener: unknown) => () => void
>();
const mockGetFirebaseAuth = jest.fn<() => Promise<unknown>>();
const mockAuthSendPasswordReset = jest.fn<(email: string) => Promise<void>>();

jest.mock("@react-navigation/native", () => ({
  useRoute: () => mockUseRoute(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: () => mockNetInfoFetch(),
    addEventListener: (listener: unknown) =>
      mockNetInfoAddEventListener(listener),
  },
}));

jest.mock("@/FirebaseConfig", () => ({
  getFirebaseAuth: () => mockGetFirebaseAuth(),
}));

jest.mock("@/feature/Auth/services/authService", () => ({
  authSendPasswordReset: (email: string) => mockAuthSendPasswordReset(email),
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: unknown }) =>
      createElement(View, null, children as never),
    ErrorBox: ({ message }: { message: string }) =>
      createElement(Text, null, message),
    ScreenCornerNavButton: ({
      onPress,
      accessibilityLabel,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
    }) =>
      createElement(
        Pressable,
        { onPress, accessibilityRole: "button", accessibilityLabel },
        createElement(Text, null, "close-button"),
      ),
  };
});

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { email?: string; seconds?: number }) => {
      if (key === "common:close") return "Close";
      if (key === "checkMailboxTitle") return "Check your inbox";
      if (key === "checkMailboxDesc") {
        return `We've sent a password reset link to ${options?.email ?? ""}.`;
      }
      if (key === "successGeneric") {
        return "If this email is linked to an account, we'll send a reset link shortly.";
      }
      if (key === "backToLogin") return "Back to login";
      if (key === "sendAgainInfo") {
        return `You can resend in ${options?.seconds ?? 0}s.`;
      }
      if (key === "sendAgain") return "Send again";
      if (key === "errorNoInternet") return "No internet connection";
      if (key === "errorDefault") return "Couldn't reset your password. Please try again.";
      return key;
    },
  }),
}));

const longEmail =
  "Very.Long.Email.Address+reset-flow-regression@example-subdomain.fitaly.test";

describe("CheckMailboxScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseRoute.mockReturnValue({ params: { email: longEmail } });
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockNetInfoAddEventListener.mockReturnValue(jest.fn());
    mockGetFirebaseAuth.mockResolvedValue({});
    mockAuthSendPasswordReset.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("renders long email content and keeps the close action outside the centered flow", () => {
    const goBack = jest.fn();
    const navigate = jest.fn();
    const { getByLabelText, getByText } = renderWithTheme(
      <CheckMailboxScreen
        navigation={{ canGoBack: () => true, goBack, navigate } as never}
      />,
    );

    expect(getByText("Check your inbox")).toBeTruthy();
    expect(
      getByText(`We've sent a password reset link to ${longEmail}.`),
    ).toBeTruthy();

    fireEvent.press(getByLabelText("Close"));

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("enables resend after countdown and restarts disabled state after resend", async () => {
    const navigate = jest.fn();
    const { getByText } = renderWithTheme(
      <CheckMailboxScreen
        navigation={{ canGoBack: () => false, goBack: jest.fn(), navigate } as never}
      />,
    );

    expect(getByText("You can resend in 60s.")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(getByText("Send again")).toBeTruthy());

    fireEvent.press(getByText("Send again"));

    await waitFor(() => {
      expect(mockAuthSendPasswordReset).toHaveBeenCalledWith(
        longEmail.toLowerCase(),
      );
    });
    expect(getByText("You can resend in 60s.")).toBeTruthy();
  });

  it("shows reset error when resend fails after the timer is enabled", async () => {
    mockAuthSendPasswordReset.mockRejectedValueOnce({
      code: "auth/network-request-failed",
    });

    const { getByText } = renderWithTheme(
      <CheckMailboxScreen
        navigation={{ canGoBack: () => false, goBack: jest.fn(), navigate: jest.fn() } as never}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(getByText("Send again")).toBeTruthy());
    fireEvent.press(getByText("Send again"));

    await waitFor(() => {
      expect(getByText("No internet connection")).toBeTruthy();
    });
  });
});
