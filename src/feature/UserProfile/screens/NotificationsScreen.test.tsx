import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import NotificationsScreen from "@/feature/UserProfile/screens/NotificationsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import enNotifications from "@/locales/en/notifications.json";
import plNotifications from "@/locales/pl/notifications.json";

const mockSetSettingsCtaVisible = jest.fn<(visible: boolean) => void>();
const mockOpenSettings = jest.fn<() => Promise<void>>();
const mockToggleSmartReminders = jest.fn<(enabled: boolean) => Promise<void>>();
const mockToggleMotivation = jest.fn<(enabled: boolean) => Promise<void>>();
const mockToggleStats = jest.fn<(enabled: boolean) => Promise<void>>();

let mockNotificationsState = {
  loading: false,
  motivationEnabled: false,
  smartRemindersEnabled: true,
  statsEnabled: false,
  systemAllowed: true as boolean | null,
  settingsCtaVisible: false,
  lastSyncError: null as string | null,
  lastPrefsSyncStatus: "idle" as "idle" | "success" | "failed",
  lastPrefsSyncAt: null as string | null,
  setSettingsCtaVisible: mockSetSettingsCtaVisible,
  openSettings: mockOpenSettings,
  onToggleSmartReminders: mockToggleSmartReminders,
  onToggleMotivation: mockToggleMotivation,
  onToggleStats: mockToggleStats,
};

let mockReminderDecision = {
  decision: null,
  loading: false,
  enabled: true,
  source: "remote",
  status: "live_success",
  error: null,
  refresh: jest.fn<() => Promise<null>>(),
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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
    ButtonToggle: ({
      value,
      disabled,
      onToggle,
      testID,
    }: {
      value: boolean;
      disabled?: boolean;
      onToggle: (value: boolean) => void;
      testID?: string;
    }) => (
      <Pressable
        testID={testID}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: !!disabled }}
        onPress={() => {
          if (!disabled) onToggle(!value);
        }}
      />
    ),
    FormScreenShell: ({
      title,
      intro,
      children,
      testID,
    }: {
      title: string;
      intro?: string;
      children: ReactNode;
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        {intro ? <Text>{intro}</Text> : null}
        {children}
      </View>
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
    Modal: ({ visible }: { visible: boolean }) => (visible ? <View /> : null),
    SettingsRow: ({
      title,
      subtitle,
      trailing,
      testID,
    }: {
      title: string;
      subtitle?: string;
      trailing?: ReactNode;
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        {trailing}
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
  };
});

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({ uid: "user-1" }),
}));

jest.mock("@/feature/UserProfile/hooks/useNotificationsScreenState", () => ({
  useNotificationsScreenState: () => mockNotificationsState,
}));

jest.mock("@/hooks/useReminderDecision", () => ({
  useReminderDecision: () => mockReminderDecision,
}));

jest.mock("@/feature/UserProfile/hooks/useNotificationDiagnosticsState", () => ({
  useNotificationDiagnosticsState: () => ({
    loading: false,
    refresh: jest.fn(),
    triage: "ok",
    environment: {
      platform: "ios",
      isPhysicalDevice: false,
      appOwnership: "expo",
      executionEnvironment: "storeClient",
      releaseSmokeSupported: true,
      limitationReason: null,
    },
    permission: {
      status: "granted",
      granted: true,
      canAskAgain: true,
      requested: false,
      requestedAt: null,
    },
    channel: {
      platform: "ios",
      ensured: false,
      exists: false,
      errorMessage: null,
    },
    foregroundPresentation: {
      initialized: true,
      foregroundBehavior: {
        shouldShowBanner: true,
        shouldShowList: true,
      },
    },
    runtime: {
      initialized: true,
      currentUid: "user-1",
      currentAppState: "active",
      inFlight: false,
      lastSnapshot: null,
      lastResult: null,
    },
    scheduled: {
      smartReminderIds: [],
      allIds: [],
    },
    storedSchedules: null,
    refreshedAt: "2026-05-21T20:00:00.000Z",
  }),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => true,
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

describe("NotificationsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationsState = {
      loading: false,
      motivationEnabled: false,
      smartRemindersEnabled: true,
      statsEnabled: false,
      systemAllowed: true,
      settingsCtaVisible: false,
      lastSyncError: null,
      lastPrefsSyncStatus: "idle",
      lastPrefsSyncAt: null,
      setSettingsCtaVisible: mockSetSettingsCtaVisible,
      openSettings: mockOpenSettings,
      onToggleSmartReminders: mockToggleSmartReminders,
      onToggleMotivation: mockToggleMotivation,
      onToggleStats: mockToggleStats,
    };
    mockReminderDecision = {
      decision: null,
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      error: null,
      refresh: jest.fn<() => Promise<null>>(),
    };
  });

  it("surfaces smart reminder unavailability without showing the preference as enabled", () => {
    mockReminderDecision = {
      ...mockReminderDecision,
      enabled: false,
      source: "disabled",
      status: "disabled",
    };

    const screen = renderWithTheme(
      <NotificationsScreen
        navigation={{ canGoBack: () => true, goBack: jest.fn() } as never}
      />,
    );

    expect(
      screen.getByTestId("notifications-smart-reminders-unavailable"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("notifications-smart-reminders-state-off"),
    ).toBeTruthy();
    expect(screen.getByTestId("notifications-prefs-sync-idle")).toBeTruthy();
    expect(
      screen.getByTestId("notifications-smart-reminders-toggle").props
        .accessibilityState,
    ).toMatchObject({ checked: false, disabled: true });
  });

  it("exposes persisted preference state for Maestro without diagnostic rows", () => {
    mockNotificationsState = {
      ...mockNotificationsState,
      lastPrefsSyncStatus: "success",
    };

    const screen = renderWithTheme(
      <NotificationsScreen
        navigation={{ canGoBack: () => true, goBack: jest.fn() } as never}
      />,
    );

    expect(
      screen.getByTestId("notifications-smart-reminders-state-on"),
    ).toBeTruthy();
    expect(screen.getByTestId("notifications-prefs-sync-success")).toBeTruthy();
    expect(
      screen.queryByTestId("notifications-smart-reminders-unavailable"),
    ).toBeNull();
  });

  it("keeps notification preference copy calm and grammatically aligned", () => {
    expect(plNotifications.screen.smartReminders).toBe(
      "Inteligentne przypomnienia",
    );
    expect(plNotifications.screen.smartReminderHint).toBe(
      "Dopasowują porę przypomnienia do Twojego dnia i godzin ciszy.",
    );
    expect(plNotifications.screen.motivation).toBe("Wsparcie");
    expect(plNotifications.screen.motivationSubtitle).toBe(
      "Delikatne wskazówki bez presji.",
    );
    expect(enNotifications.screen.motivation).toBe("Support");
    expect(enNotifications.screen.motivationSubtitle).toBe(
      "Gentle notes without pressure.",
    );
    expect(enNotifications.screen.permissionOnTitle).toBe(
      "Notifications are ready",
    );
  });

  it("keeps denied permission state distinct and actionable", () => {
    mockNotificationsState = {
      ...mockNotificationsState,
      systemAllowed: false,
    };

    const screen = renderWithTheme(
      <NotificationsScreen
        navigation={{ canGoBack: () => true, goBack: jest.fn() } as never}
      />,
    );

    expect(
      screen.getByTestId("notifications-permission-denied-state"),
    ).toBeTruthy();
    expect(screen.getByTestId("notifications-open-settings-button")).toBeTruthy();
    expect(
      screen.queryByTestId("notifications-permission-allowed-state"),
    ).toBeNull();
  });
});
