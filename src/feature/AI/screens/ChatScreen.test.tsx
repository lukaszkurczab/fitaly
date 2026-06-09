import { act, fireEvent, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { ChatMessage } from "@/types";
import type { ReactNode } from "react";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import ChatScreen from "@/feature/AI/screens/ChatScreen";
import type { UserAiConsent, UserData, UserReadiness } from "@/types";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUseNetInfo = jest.fn<() => { isConnected: boolean | null }>();
const mockPullChatChanges = jest.fn<(uid: string) => Promise<void>>();
const mockRefreshUser = jest.fn<() => Promise<unknown>>();
const mockConsentRepositoryMutation =
  jest.fn<(propertyKey: string | symbol, ...args: unknown[]) => Promise<unknown>>();
const mockUseChatHistory = jest.fn();
let mockKeyboardInset = 0;
const focusEffectCallbacks: Array<() => void | (() => void)> = [];
const readyReadiness: UserReadiness = {
  status: "ready",
  onboardingCompletedAt: "2026-05-01T09:00:00Z",
  readyAt: "2026-05-01T10:00:00Z",
};
const needsAiConsentReadiness: UserReadiness = {
  status: "needs_ai_consent",
  onboardingCompletedAt: "2026-05-01T09:00:00Z",
  readyAt: null,
};
const grantedAiConsent: UserAiConsent = {
  status: "granted",
  grantedAt: readyReadiness.readyAt,
  revokedAt: null,
};
const notGrantedAiConsent: UserAiConsent = {
  status: "not_granted",
  grantedAt: null,
  revokedAt: null,
};
const revokedAiConsent: UserAiConsent = {
  status: "revoked",
  grantedAt: readyReadiness.readyAt,
  revokedAt: "2026-05-02T10:00:00Z",
};
const malformedGrantedMissingGrantedAt: UserAiConsent = {
  status: "granted",
  grantedAt: null,
  revokedAt: null,
};
const malformedGrantedWithRevokedAt: UserAiConsent = {
  status: "granted",
  grantedAt: readyReadiness.readyAt,
  revokedAt: "2026-05-02T10:00:00Z",
};

const buildUserData = (
  readiness: UserReadiness,
  options: { aiConsent?: UserAiConsent } = {},
): UserData =>
  ({
    uid: "user-1",
    email: "user@example.com",
    username: "neo",
    plan: "free",
    createdAt: 1,
    lastLogin: "2026-05-01T10:00:00Z",
    syncState: "synced",
    profile: {
      language: "en",
      nutritionProfile: {
        unitsSystem: "metric",
        age: "30",
        sex: "female",
        height: "170",
        heightInch: "",
        weight: "70",
        preferences: [],
        activityLevel: "moderate",
        goal: "maintain",
        chronicDiseases: [],
        chronicDiseasesOther: "",
        allergies: [],
        allergiesOther: "",
        lifestyle: "",
        calorieTarget: 2200,
      },
      aiPreferences: {
        stylePersona: "calm_guide",
      },
      aiConsent:
        options.aiConsent ??
        (readiness.status === "ready" ? grantedAiConsent : notGrantedAiConsent),
      readiness,
    },
  }) as UserData;

let mockUserData: UserData | null = buildUserData(readyReadiness);
let mockLoadingUser = false;
let mockIsProductReady = true;
let mockCanRenderProductStack = true;
let mockAccessCreditsBalance = 18;

const baseMessages: ChatMessage[] = [
  {
    id: "m-1",
    userUid: "user-1",
    role: "assistant",
    content: "How can I help?",
    createdAt: 100,
    lastSyncedAt: 100,
    syncState: "synced",
    deleted: false,
  },
];

let mockChatHistoryState: {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  typing: boolean;
  sendErrorType:
    | null
    | "offline"
    | "auth"
    | "limit"
    | "unknown"
    | "AI_CHAT_DISABLED"
    | "AI_CREDITS_EXHAUSTED"
    | "AI_CONSENT_REQUIRED"
    | "AI_CHAT_PROVIDER_UNAVAILABLE"
    | "AI_CHAT_TIMEOUT"
    | "AI_CHAT_CONTEXT_UNAVAILABLE"
    | "AI_CHAT_IDEMPOTENCY_CONFLICT"
    | "AI_CHAT_INTERNAL_ERROR";
  canSend: boolean;
  creditAllocation: number;
  send: (value: string) => Promise<string | null>;
  retryLastSend: () => Promise<string | null>;
  cancelInFlightSend: () => void;
  loadMore: () => void;
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    focusEffectCallbacks.push(callback);
  },
}));

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <View>{children}</View>;
  },
}));

jest.mock("@/components", () => ({
  Button: ({
    label,
    onPress,
    testID,
  }: {
    label: string;
    onPress: () => void;
    testID?: string;
  }) => {
    const { Pressable, Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return (
      <Pressable onPress={onPress} testID={testID}>
        <Text>{label}</Text>
      </Pressable>
    );
  },
  Modal: ({
    visible,
    title,
    children,
    primaryAction,
    secondaryAction,
  }: {
    visible: boolean;
    title?: string;
    children?: ReactNode;
    primaryAction?: { label: string; onPress?: () => void; testID?: string };
    secondaryAction?: { label: string; onPress?: () => void; testID?: string };
  }) => {
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    if (!visible) return null;
    return (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
        {primaryAction ? (
          <Pressable onPress={primaryAction.onPress} testID={primaryAction.testID}>
            <Text>{primaryAction.label}</Text>
          </Pressable>
        ) : null}
        {secondaryAction ? (
          <Pressable
            onPress={secondaryAction.onPress}
            testID={secondaryAction.testID}
          >
            <Text>{secondaryAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({ firebaseUser: { uid: "user-1" } }),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => ({
    userData: mockUserData,
    loadingUser: mockLoadingUser,
    refreshUser: mockRefreshUser,
  }),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => ({
    accessState: {
      credits: {
        balance: mockAccessCreditsBalance,
        allocation: 100,
        periodEndAt: "2026-06-01T00:00:00.000Z",
        costs: { chat: 1, textMeal: 1, photo: 1 },
      },
      features: {
        aiChat: {
          enabled: mockAccessCreditsBalance > 0,
          status: mockAccessCreditsBalance > 0 ? "enabled" : "disabled",
          reason:
            mockAccessCreditsBalance > 0 ? null : "insufficient_credits",
          requiredCredits: 1,
          remainingCredits: mockAccessCreditsBalance,
        },
      },
    },
  }),
}));

jest.mock(
  "@/services/user/userProfileRepository",
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (target, propertyKey) => {
          if (propertyKey in target) {
            return target[propertyKey as keyof typeof target];
          }
          return (...args: unknown[]) =>
            mockConsentRepositoryMutation(propertyKey, ...args);
        },
      },
    ),
);

jest.mock("@/hooks/useProductReadiness", () => ({
  useProductReadiness: () => ({
    isProductReady: mockIsProductReady,
    canRenderProductStack: mockCanRenderProductStack,
    status: mockIsProductReady
      ? "ready"
      : (mockUserData?.profile.readiness.status ?? "profileLoading"),
    uid: mockIsProductReady ? "user-1" : null,
    bootstrapState: "profileReady",
  }),
}));

jest.mock("@/hooks/useKeyboardInset", () => ({
  useKeyboardInset: () => mockKeyboardInset,
}));

jest.mock("@/context/AiCreditsContext", () => ({
  useAiCreditsContext: () => ({
    credits: {
      balance: 18,
      allocation: 100,
      periodEndAt: "2026-05-01T00:00:00.000Z",
    },
  }),
}));

jest.mock("@/hooks/useChatHistory", () => ({
  useChatHistory: (uid: string, threadId: string) =>
    mockUseChatHistory(uid, threadId),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  pullChatChanges: (uid: string) => mockPullChatChanges(uid),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("@/feature/AI/components/ChatHistorySheet", () => ({
  ChatHistorySheet: ({
    open,
    userUid,
  }: {
    open: boolean;
    userUid: string;
  }) => {
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return open ? (
      <Text testID="chat-history-sheet-uid">{userUid}</Text>
    ) : null;
  },
}));

jest.mock("../components/ChatMessageList", () => ({
  ChatMessageList: ({
    messages,
    emptyState,
    errorText,
    errorActionLabel,
    onErrorActionPress,
  }: {
    messages: Array<{ id: string; content: string }>;
    emptyState: ReactNode;
    errorText?: string;
    errorActionLabel?: string;
    onErrorActionPress?: () => void;
  }) => {
    const { Pressable, View, Text } =
      jest.requireActual<typeof import("react-native")>("react-native");

    if (messages.length === 0) {
      return <View>{emptyState}</View>;
    }

    return (
      <View>
        {messages.map((message) => (
          <Text key={message.id}>{message.content}</Text>
        ))}
        {errorText ? (
          <View>
            <Text testID="chat-error-state">{errorText}</Text>
            {errorActionLabel && onErrorActionPress ? (
              <Pressable
                testID="chat-retry-button"
                onPress={onErrorActionPress}
              >
                <Text>{errorActionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  },
}));

describe("ChatScreen", () => {
  const runFocusEffects = () => {
    focusEffectCallbacks.forEach((callback) => {
      callback();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    focusEffectCallbacks.length = 0;
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockPullChatChanges.mockResolvedValue(undefined);
    mockRefreshUser.mockResolvedValue(null);
    mockConsentRepositoryMutation.mockResolvedValue(null);
    mockUserData = buildUserData(readyReadiness);
    mockLoadingUser = false;
    mockIsProductReady = true;
    mockCanRenderProductStack = true;
    mockAccessCreditsBalance = 18;
    mockKeyboardInset = 0;
    mockChatHistoryState = {
      messages: [],
      loading: false,
      sending: false,
      typing: false,
      sendErrorType: null,
      canSend: true,
      creditAllocation: 100,
      send: jest.fn(async () => null),
      retryLastSend: jest.fn(async () => null),
      cancelInFlightSend: () => undefined,
      loadMore: () => undefined,
    };
    mockUseChatHistory.mockImplementation(() => mockChatHistoryState);
  });

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("renders empty online state with intro and suggested starters", async () => {
    const screen = renderWithTheme(<ChatScreen />);

    expect(screen.getByText("empty.title")).toBeTruthy();
    expect(screen.getByText("empty.subtitle")).toBeTruthy();
    expect(screen.getByText("empty.suggestedLabel")).toBeTruthy();
    expect(screen.getByText("empty.starters.week")).toBeTruthy();
    expect(await screen.findByPlaceholderText("composer.placeholder")).toBeTruthy();
  });

  it("submits the selected starter prompt value", async () => {
    const screen = renderWithTheme(<ChatScreen />);

    fireEvent.press(screen.getByText("empty.starters.week"));

    await waitFor(() => {
      expect(mockChatHistoryState.send).toHaveBeenCalledWith("empty.values.week");
    });
  });

  it("hides starter prompts while the keyboard is open", async () => {
    mockKeyboardInset = 320;

    const screen = renderWithTheme(<ChatScreen />);

    expect(screen.queryByText("empty.title")).toBeNull();
    expect(screen.queryByText("empty.starters.week")).toBeNull();
    expect(await screen.findByPlaceholderText("composer.placeholder")).toBeTruthy();
  });

  it("does not bind chat history to the auth uid before product readiness", async () => {
    mockIsProductReady = false;
    mockCanRenderProductStack = false;

    const screen = renderWithTheme(<ChatScreen />);

    expect(mockUseChatHistory).toHaveBeenCalledWith("", expect.any(String));
    expect(await screen.findByPlaceholderText("composer.placeholder")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);
  });

  it("shows consent lock hierarchy and blocks the composer until settings changes consent", async () => {
    mockUserData = buildUserData(needsAiConsentReadiness);

    const screen = renderWithTheme(<ChatScreen />);

    expect(await screen.findByText("legal.title")).toBeTruthy();
    expect(screen.getByTestId("chat-legal-info")).toBeTruthy();
    expect(screen.getByTestId("chat-legal-links")).toBeTruthy();
    expect(screen.getByTestId("chat-legal-back")).toBeTruthy();
    expect(screen.getByTestId("chat-legal-accept")).toBeTruthy();
    expect(screen.getByText("legal.informational")).toBeTruthy();
    expect(screen.getByText("legal.medical")).toBeTruthy();
    expect(screen.getByPlaceholderText("legal.composerLocked")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);
  });

  it("keeps product-ready users gated when profile AI consent is not active", async () => {
    mockUserData = buildUserData(readyReadiness, {
      aiConsent: notGrantedAiConsent,
    });

    const notGrantedScreen = renderWithTheme(<ChatScreen />);

    expect(await notGrantedScreen.findByText("legal.title")).toBeTruthy();
    expect(mockUseChatHistory).toHaveBeenLastCalledWith("", expect.any(String));
    expect(
      notGrantedScreen.getByPlaceholderText("legal.composerLocked"),
    ).toBeTruthy();
    expect(notGrantedScreen.getByTestId("chat-input").props.editable).toBe(
      false,
    );

    notGrantedScreen.unmount();
    mockUseChatHistory.mockClear();
    mockUserData = buildUserData(readyReadiness, {
      aiConsent: revokedAiConsent,
    });

    const revokedScreen = renderWithTheme(<ChatScreen />);

    expect(await revokedScreen.findByText("legal.title")).toBeTruthy();
    expect(mockUseChatHistory).toHaveBeenLastCalledWith("", expect.any(String));
    expect(
      revokedScreen.getByPlaceholderText("legal.composerLocked"),
    ).toBeTruthy();
    expect(revokedScreen.getByTestId("chat-input").props.editable).toBe(false);
  });

  it("keeps malformed granted profile AI consent locked", async () => {
    mockUserData = buildUserData(readyReadiness, {
      aiConsent: malformedGrantedMissingGrantedAt,
    });

    const missingGrantedAtScreen = renderWithTheme(<ChatScreen />);

    expect(await missingGrantedAtScreen.findByText("legal.title")).toBeTruthy();
    expect(mockUseChatHistory).toHaveBeenLastCalledWith("", expect.any(String));
    expect(
      missingGrantedAtScreen.getByPlaceholderText("legal.composerLocked"),
    ).toBeTruthy();
    expect(missingGrantedAtScreen.getByTestId("chat-input").props.editable).toBe(
      false,
    );

    missingGrantedAtScreen.unmount();
    mockUseChatHistory.mockClear();
    mockUserData = buildUserData(readyReadiness, {
      aiConsent: malformedGrantedWithRevokedAt,
    });

    const revokedAtScreen = renderWithTheme(<ChatScreen />);

    expect(await revokedAtScreen.findByText("legal.title")).toBeTruthy();
    expect(mockUseChatHistory).toHaveBeenLastCalledWith("", expect.any(String));
    expect(
      revokedAtScreen.getByPlaceholderText("legal.composerLocked"),
    ).toBeTruthy();
    expect(revokedAtScreen.getByTestId("chat-input").props.editable).toBe(
      false,
    );
  });

  it("unlocks chat with active profile AI consent without deriving consent from readiness", async () => {
    mockUserData = buildUserData(needsAiConsentReadiness, {
      aiConsent: grantedAiConsent,
    });

    const screen = renderWithTheme(<ChatScreen />);

    expect(screen.queryByText("legal.title")).toBeNull();
    expect(mockUseChatHistory).toHaveBeenCalledWith("user-1", expect.any(String));
    expect(await screen.findByPlaceholderText("composer.placeholder")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(true);
  });

  it("routes the primary consent lock action to Privacy & AI settings without mutating consent", async () => {
    mockUserData = buildUserData(needsAiConsentReadiness);

    const screen = renderWithTheme(<ChatScreen />);

    expect(await screen.findByText("legal.title")).toBeTruthy();

    fireEvent.press(screen.getByTestId("chat-legal-accept"));

    expect(mockNavigate).toHaveBeenCalledWith("PrivacyAiSettings");
    expect(mockConsentRepositoryMutation).not.toHaveBeenCalled();
    expect(screen.getByText("legal.title")).toBeTruthy();
    expect(screen.getByPlaceholderText("legal.composerLocked")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);
  });

  it("guards history and send paths while profile AI consent is inactive", async () => {
    mockUserData = buildUserData(readyReadiness, {
      aiConsent: notGrantedAiConsent,
    });

    const screen = renderWithTheme(<ChatScreen />);

    expect(await screen.findByText("legal.title")).toBeTruthy();
    fireEvent.press(screen.getByTestId("chat-history-button"));
    expect(screen.queryByTestId("chat-history-sheet-uid")).toBeNull();

    fireEvent.changeText(screen.getByTestId("chat-input"), "locked question");
    fireEvent.press(screen.getByTestId("chat-send-button"));
    expect(mockChatHistoryState.send).not.toHaveBeenCalled();
  });

  it("goes back when legal back action is pressed", async () => {
    mockUserData = buildUserData(needsAiConsentReadiness);

    const screen = renderWithTheme(<ChatScreen />);
    expect(await screen.findByText("legal.title")).toBeTruthy();

    fireEvent.press(screen.getByTestId("chat-legal-back"));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("opens legal privacy hub link from modal", async () => {
    mockUserData = buildUserData(needsAiConsentReadiness);

    const screen = renderWithTheme(<ChatScreen />);
    expect(await screen.findByText("legal.title")).toBeTruthy();

    fireEvent.press(screen.getByTestId("chat-legal-link-privacy"));

    expect(mockNavigate).toHaveBeenCalledWith("LegalPrivacyHub");
    expect(screen.getByText("legal.title")).toBeTruthy();
    expect(screen.getByPlaceholderText("legal.composerLocked")).toBeTruthy();
  });

  it("opens data & ai clarity link from modal", async () => {
    mockUserData = buildUserData(needsAiConsentReadiness);

    const screen = renderWithTheme(<ChatScreen />);

    expect(await screen.findByText("legal.title")).toBeTruthy();

    fireEvent.press(screen.getByTestId("chat-legal-link-data-ai"));

    expect(mockNavigate).toHaveBeenCalledWith("DataAiClarity");
    expect(screen.getByText("legal.title")).toBeTruthy();
    expect(screen.getByPlaceholderText("legal.composerLocked")).toBeTruthy();
  });

  it("keeps legal flow stable after returning from info screens", async () => {
    mockUserData = buildUserData(needsAiConsentReadiness);

    const screen = renderWithTheme(<ChatScreen />);

    expect(await screen.findByText("legal.title")).toBeTruthy();
    fireEvent.press(screen.getByTestId("chat-legal-link-data-ai"));
    expect(mockNavigate).toHaveBeenCalledWith("DataAiClarity");

    await act(async () => {
      runFocusEffects();
    });

    await waitFor(() => {
      expect(screen.getByText("legal.title")).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("legal.composerLocked")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);
  });

  it("renders normal conversation state", () => {
    mockChatHistoryState.messages = baseMessages;

    const screen = renderWithTheme(<ChatScreen />);
    expect(screen.getByText("How can I help?")).toBeTruthy();
    expect(screen.queryByText("lock.creditsTitle")).toBeNull();
    expect(screen.queryByText("lock.offlineTitle")).toBeNull();
  });

  it("renders no-credits lock state for existing conversation and navigates on upgrade", async () => {
    mockChatHistoryState.messages = baseMessages;
    mockChatHistoryState.canSend = false;
    mockAccessCreditsBalance = 0;

    const screen = renderWithTheme(<ChatScreen />);
    expect(screen.getByText("lock.creditsTitle")).toBeTruthy();
    expect(screen.getByText("limit.body")).toBeTruthy();
    expect(await screen.findByPlaceholderText("composer.lockedCredits")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);

    fireEvent.press(screen.getByText("lock.creditsAction"));
    expect(mockNavigate).toHaveBeenCalledWith("ManageSubscription");
  });

  it("keeps credits-exhausted composer helper quiet under the lock banner", async () => {
    mockChatHistoryState.messages = baseMessages;
    mockChatHistoryState.canSend = false;
    mockChatHistoryState.sendErrorType = "AI_CREDITS_EXHAUSTED";
    mockAccessCreditsBalance = 0;

    const screen = renderWithTheme(<ChatScreen />);

    expect(screen.getByTestId("chat-credits-banner")).toBeTruthy();
    expect(screen.queryByTestId("chat-error-state")).toBeNull();
    expect(await screen.findByPlaceholderText("composer.lockedCredits")).toBeTruthy();
  });

  it("renders no-credits lock state before a conversation starts", async () => {
    mockChatHistoryState.canSend = false;
    mockAccessCreditsBalance = 0;

    const screen = renderWithTheme(<ChatScreen />);

    expect(screen.getByTestId("chat-credits-banner")).toBeTruthy();
    expect(screen.getByTestId("chat-credits-banner-action-button")).toBeTruthy();
    expect(screen.getByText("empty.lockedSuggestedLabel")).toBeTruthy();
    expect(screen.queryByText("empty.creditsLeft")).toBeNull();
    expect(await screen.findByPlaceholderText("composer.lockedCredits")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);

    fireEvent.press(screen.getByTestId("chat-credits-banner-action-button"));
    expect(mockNavigate).toHaveBeenCalledWith("ManageSubscription");
  });

  it("routes starter prompts to subscription while credits are locked", () => {
    mockChatHistoryState.canSend = false;
    mockAccessCreditsBalance = 0;

    const screen = renderWithTheme(<ChatScreen />);

    fireEvent.press(screen.getByText("empty.starters.week"));

    expect(mockNavigate).toHaveBeenCalledWith("ManageSubscription");
    expect(mockChatHistoryState.send).not.toHaveBeenCalled();
  });

  it("renders offline lock state for existing conversation", async () => {
    mockUseNetInfo.mockReturnValue({ isConnected: false });
    mockChatHistoryState.messages = baseMessages;

    const screen = renderWithTheme(<ChatScreen />);
    expect(screen.getByTestId("offline-banner")).toBeTruthy();
    expect(screen.getByText("lock.offlineTitle")).toBeTruthy();
    expect(screen.getByText("lock.offlineBody")).toBeTruthy();
    expect(await screen.findByPlaceholderText("composer.lockedOffline")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);
  });

  it("retries the failed assistant reply without reusing composer text flow", async () => {
    mockChatHistoryState.messages = baseMessages;
    mockChatHistoryState.sendErrorType = "AI_CHAT_TIMEOUT";

    const screen = renderWithTheme(<ChatScreen />);

    await screen.findByPlaceholderText("composer.placeholder");
    expect(screen.getByTestId("chat-error-state")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("chat-input"), "new question");
    fireEvent.press(screen.getByText("retryLast"));

    expect(mockChatHistoryState.retryLastSend).toHaveBeenCalledTimes(1);
    expect(mockChatHistoryState.send).not.toHaveBeenCalled();
  });

  it("renders degraded disabled state and blocks retry when backend kill switch is active", async () => {
    mockChatHistoryState.messages = baseMessages;
    mockChatHistoryState.sendErrorType = "AI_CHAT_DISABLED";

    const screen = renderWithTheme(<ChatScreen />);

    expect(screen.getByTestId("chat-disabled-banner")).toBeTruthy();
    expect(screen.getByText("lock.disabledTitle")).toBeTruthy();
    expect(screen.getByText("lock.disabledBody")).toBeTruthy();
    expect(await screen.findByPlaceholderText("composer.lockedDisabled")).toBeTruthy();
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);
    expect(screen.queryByText("retryLast")).toBeNull();
  });

  it("renders context unavailable degraded state instead of generic unknown", async () => {
    mockChatHistoryState.messages = baseMessages;
    mockChatHistoryState.sendErrorType = "AI_CHAT_CONTEXT_UNAVAILABLE";

    const screen = renderWithTheme(<ChatScreen />);

    expect(screen.getByTestId("chat-context-unavailable-banner")).toBeTruthy();
    expect(screen.getByText("lock.contextUnavailableTitle")).toBeTruthy();
    expect(screen.getByText("lock.contextUnavailableBody")).toBeTruthy();
    expect(await screen.findByText("errors.fetchFailed")).toBeTruthy();
    expect(screen.getByText("retryLast")).toBeTruthy();
  });
});
