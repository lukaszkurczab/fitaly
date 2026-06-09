import {
  act,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import PrivacyAiSettingsScreen, {
  PRIVACY_AI_REVOKE_RETRY_DELAY_MS,
} from "@/feature/UserProfile/screens/PrivacyAiSettingsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import mockEnProfile from "@/locales/en/profile.json";
import type { UserAiConsent, UserData } from "@/types";

const mockRefreshUser = jest.fn<() => Promise<UserData | null>>();
const mockUpdateUser = jest.fn<() => Promise<void>>();
const mockGrantAiConsentRemote =
  jest.fn<(uid: string) => Promise<{ aiConsent: UserAiConsent }>>();
const mockGetAiConsentLocalRevokeGuard =
  jest.fn<(uid: string) => UserAiConsent | null>();
const mockPublishAiConsentRevokeLocalInactive =
  jest.fn<(uid: string, currentProfile?: UserData | null) => UserAiConsent | null>();
const mockRevokeAiConsentRemote =
  jest.fn<(uid: string) => Promise<{ aiConsent: UserAiConsent }>>();
let mockAiConsent: UserAiConsent = {
  status: "not_granted",
  grantedAt: null,
  revokedAt: null,
};
let mockUserData: UserData | null | undefined;

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

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => ({
    userData:
      mockUserData === undefined
        ? mockBuildUserData(mockAiConsent)
        : mockUserData,
    refreshUser: mockRefreshUser,
    updateUser: mockUpdateUser,
  }),
}));

jest.mock("@/services/user/userProfileRepository", () => ({
  getAiConsentLocalRevokeGuard: (uid: string) =>
    mockGetAiConsentLocalRevokeGuard(uid),
  grantAiConsentRemote: (uid: string) => mockGrantAiConsentRemote(uid),
  publishAiConsentRevokeLocalInactive: (
    uid: string,
    currentProfile?: UserData | null,
  ) => mockPublishAiConsentRevokeLocalInactive(uid, currentProfile),
  revokeAiConsentRemote: (uid: string) => mockRevokeAiConsentRemote(uid),
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
    ButtonToggle: ({
      value,
      onToggle,
      disabled,
      testID,
      accessibilityLabel,
    }: {
      value: boolean;
      onToggle: (value: boolean) => void;
      disabled?: boolean;
      testID?: string;
      accessibilityLabel?: string;
    }) => (
      <View
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
        onTouchEnd={disabled ? undefined : () => onToggle(!value)}
      >
        <Text>{value ? "on" : "off"}</Text>
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
      value,
      onPress,
      testID,
      valueTestID,
      leading,
      trailing,
    }: {
      title: string;
      subtitle?: string;
      value?: string;
      onPress?: () => void;
      testID?: string;
      valueTestID?: string;
      leading?: ReactNode;
      trailing?: ReactNode;
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
        {value ? <Text testID={valueTestID}>{value}</Text> : null}
        {trailing}
      </Pressable>
    ),
  };
});

function mockBuildUserData(aiConsent: UserAiConsent): UserData {
  return {
    uid: "user-1",
    email: "user@example.com",
    username: "User",
    plan: "free",
    createdAt: 1710000000000,
    lastLogin: "2026-06-01T10:00:00Z",
    syncState: "synced",
    profile: {
      language: "en",
      aiPreferences: {
        stylePersona: "calm_guide",
      },
      aiConsent,
      readiness: {
        status: "ready",
        onboardingCompletedAt: "2026-06-01T10:00:00Z",
        readyAt: "2026-06-01T10:00:00Z",
      },
      nutritionProfile: {
        unitsSystem: "metric",
        age: "30",
        sex: "male",
        height: "180",
        heightInch: "",
        weight: "80",
        preferences: [],
        activityLevel: "moderate",
        goal: "maintain",
        chronicDiseases: [],
        chronicDiseasesOther: "",
        allergies: [],
        allergiesOther: "",
        lifestyle: "",
        calorieTarget: null,
      },
    },
  };
}

function renderScreen(overrides?: Partial<{ canGoBack: boolean }>) {
  const navigation = {
    canGoBack: jest.fn(() => overrides?.canGoBack ?? true),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const screen = renderWithTheme(
    <PrivacyAiSettingsScreen navigation={navigation as never} />,
  );

  return { navigation, screen };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function resolveDeferred<T>(
  deferred: ReturnType<typeof createDeferred<T>>,
  value: T,
) {
  await act(async () => {
    deferred.resolve(value);
    await deferred.promise;
  });
}

async function rejectDeferred<T>(
  deferred: ReturnType<typeof createDeferred<T>>,
  reason: unknown,
) {
  await act(async () => {
    deferred.reject(reason);
    await deferred.promise.catch(() => undefined);
  });
}

async function advanceRetryTimer(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe("PrivacyAiSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAiConsent = {
      status: "not_granted",
      grantedAt: null,
      revokedAt: null,
    };
    mockUserData = undefined;
    mockGetAiConsentLocalRevokeGuard.mockReturnValue(null);
    mockPublishAiConsentRevokeLocalInactive.mockImplementation(
      (_uid, currentProfile) => ({
        status: "revoked",
        grantedAt: currentProfile?.profile.aiConsent.grantedAt ?? null,
        revokedAt: "2026-06-05T10:00:00Z",
      }),
    );
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renders not_granted from profile.aiConsent without calling consent mutations or refresh", () => {
    const { screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-settings-screen")).toBeTruthy();
    expect(screen.getByText("Privacy & AI")).toBeTruthy();
    expect(screen.getByText("One global AI consent")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Not granted",
    );
    expect(screen.getByText("AI consent is not granted")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-consent-toggle-row-off")).toBeTruthy();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: false });
    expect(screen.getByTestId("privacy-ai-surface-photo-analysis")).toBeTruthy();
    expect(screen.getByText("Add Meal photo analysis")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-surface-text-analysis")).toBeTruthy();
    expect(screen.getByText("Add Meal text analysis")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-surface-chat")).toBeTruthy();
    expect(screen.getByText("AI Chat")).toBeTruthy();
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("renders unavailable state for a null profile without calling consent mutations or profile actions", () => {
    mockUserData = null;

    const { screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-settings-screen")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Profile unavailable",
    );
    expect(screen.getByText("AI consent state unavailable")).toBeTruthy();
    expect(
      screen.getByText(
        "Fitaly could not read the current profile consent object right now.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-surface-photo-analysis")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-surface-text-analysis")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-surface-chat")).toBeTruthy();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("renders granted from profile.aiConsent", () => {
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };

    const { screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Granted",
    );
    expect(screen.getByText("AI consent is granted")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-consent-toggle-row-on")).toBeTruthy();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: true, disabled: false });
  });

  it("renders revoked from profile.aiConsent", () => {
    mockAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-02T10:00:00Z",
    };

    const { screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoked",
    );
    expect(screen.getByText("AI consent is revoked")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-consent-toggle-row-off")).toBeTruthy();
  });

  it("renders failed revoke recovery on remount when the uid has an active local revoke guard", async () => {
    jest.useFakeTimers();
    const guardedAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-05T10:00:00Z",
    } satisfies UserAiConsent;
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };

    const { navigation, screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Granted",
    );
    mockGetAiConsentLocalRevokeGuard.mockReturnValue(guardedAiConsent);

    screen.rerender(
      <PrivacyAiSettingsScreen
        key="guarded-recovery-remount"
        navigation={navigation as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoke needs retry",
      );
    });
    expect(screen.getByText("Backend revoke failed")).toBeTruthy();
    expect(screen.getByTestId("privacy-ai-consent-retry-button")).toBeTruthy();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });
    expect(mockPublishAiConsentRevokeLocalInactive).not.toHaveBeenCalled();
    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
  });

  it("keeps a backend-revoked profile idle and grantable when there is no local revoke guard", async () => {
    const grantedAiConsent = {
      status: "granted",
      grantedAt: "2026-06-05T10:30:00Z",
      revokedAt: null,
    } satisfies UserAiConsent;
    const grantRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-05T10:00:00Z",
    };
    mockGetAiConsentLocalRevokeGuard.mockReturnValue(null);
    mockGrantAiConsentRemote.mockReturnValueOnce(grantRequest.promise);

    const { screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoked",
    );
    expect(screen.queryByTestId("privacy-ai-consent-retry-button")).toBeNull();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: false });

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockGrantAiConsentRemote).toHaveBeenCalledWith("user-1");
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Granting...",
      );
    });
    expect(mockPublishAiConsentRevokeLocalInactive).not.toHaveBeenCalled();

    await resolveDeferred(grantRequest, {
      aiConsent: grantedAiConsent,
    });

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Granted",
    );
    expect(screen.queryByTestId("privacy-ai-consent-retry-button")).toBeNull();
  });

  it("keeps granted status inactive when the profile consent object is not active", () => {
    mockAiConsent = {
      status: "granted",
      grantedAt: null,
      revokedAt: null,
    };

    const { screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Not granted",
    );
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: false });
  });

  it("grants AI consent only after the backend response confirms it", async () => {
    const grantedAiConsent = {
      status: "granted",
      grantedAt: "2026-06-03T10:00:00Z",
      revokedAt: null,
    } satisfies UserAiConsent;
    const grantRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockGrantAiConsentRemote.mockReturnValueOnce(grantRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockGrantAiConsentRemote).toHaveBeenCalledWith("user-1");
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Granting...",
      );
    });
    expect(mockPublishAiConsentRevokeLocalInactive).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });

    grantRequest.resolve({ aiConsent: grantedAiConsent });

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Granted",
      );
    });
    expect(screen.getByTestId("privacy-ai-consent-toggle-row-on")).toBeTruthy();
    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("leaves the toggle off when grant fails", async () => {
    const grantRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockGrantAiConsentRemote.mockReturnValueOnce(grantRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockGrantAiConsentRemote).toHaveBeenCalledWith("user-1");
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Granting...",
      );
    });
    expect(mockPublishAiConsentRevokeLocalInactive).not.toHaveBeenCalled();

    grantRequest.reject(new Error("grant failed"));

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Grant failed",
      );
    });
    expect(screen.getByText("AI consent was not granted")).toBeTruthy();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: false });
    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("ignores stale grant success after uid changes and keeps the new profile state", async () => {
    const grantRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const staleGrantedAiConsent = {
      status: "granted",
      grantedAt: "2026-06-03T10:00:00Z",
      revokedAt: null,
    } satisfies UserAiConsent;
    mockGrantAiConsentRemote.mockReturnValueOnce(grantRequest.promise);

    const { navigation, screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockGrantAiConsentRemote).toHaveBeenCalledWith("user-1");
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Granting...",
      );
    });

    mockUserData = {
      ...mockBuildUserData({
        status: "not_granted",
        grantedAt: null,
        revokedAt: null,
      }),
      uid: "user-2",
      email: "second@example.com",
    };

    screen.rerender(
      <PrivacyAiSettingsScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Not granted",
      );
      expect(
        screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
      ).toEqual({ checked: false, disabled: false });
    });

    await resolveDeferred(grantRequest, {
      aiConsent: staleGrantedAiConsent,
    });

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Not granted",
    );
    expect(screen.getByTestId("privacy-ai-consent-toggle-row-off")).toBeTruthy();
    expect(mockGrantAiConsentRemote).toHaveBeenCalledTimes(1);
    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
  });

  it("ignores stale grant failure after uid changes", async () => {
    const grantRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockGrantAiConsentRemote.mockReturnValueOnce(grantRequest.promise);

    const { navigation, screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockGrantAiConsentRemote).toHaveBeenCalledWith("user-1");
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Granting...",
      );
    });

    mockUserData = {
      ...mockBuildUserData({
        status: "revoked",
        grantedAt: "2026-06-01T10:00:00Z",
        revokedAt: "2026-06-05T10:00:00Z",
      }),
      uid: "user-2",
      email: "second@example.com",
    };

    screen.rerender(
      <PrivacyAiSettingsScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoked",
      );
    });

    await rejectDeferred(grantRequest, new Error("stale grant failed"));

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoked",
    );
    expect(screen.queryByText("AI consent was not granted")).toBeNull();
    expect(mockGrantAiConsentRemote).toHaveBeenCalledTimes(1);
    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
  });

  it("ignores stale grant completion after unmount", async () => {
    const grantRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockGrantAiConsentRemote.mockReturnValueOnce(grantRequest.promise);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const { screen } = renderScreen();

      act(() => {
        screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
      });

      await waitFor(() => {
        expect(mockGrantAiConsentRemote).toHaveBeenCalledWith("user-1");
      });

      screen.unmount();

      await rejectDeferred(grantRequest, new Error("stale grant failed"));

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(mockGrantAiConsentRemote).toHaveBeenCalledTimes(1);
      expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
      expect(mockRefreshUser).not.toHaveBeenCalled();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("revokes AI consent immediately with no pre-confirmation", async () => {
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-04T10:00:00Z",
    } satisfies UserAiConsent;
    const revokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockRevokeAiConsentRemote.mockReturnValueOnce(revokeRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ uid: "user-1" }),
      );
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledWith("user-1");
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoking...",
      );
    });
    expect(
      mockPublishAiConsentRevokeLocalInactive.mock.invocationCallOrder[0],
    ).toBeLessThan(mockRevokeAiConsentRemote.mock.invocationCallOrder[0]);
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });

    revokeRequest.resolve({ aiConsent: revokedAiConsent });

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoked",
      );
    });
    expect(screen.getByTestId("privacy-ai-consent-toggle-row-off")).toBeTruthy();
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("keeps AI locally inactive and visible when revoke fails", async () => {
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };
    const revokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockRevokeAiConsentRemote.mockReturnValueOnce(revokeRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ uid: "user-1" }),
      );
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledWith("user-1");
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoking...",
      );
    });
    expect(
      mockPublishAiConsentRevokeLocalInactive.mock.invocationCallOrder[0],
    ).toBeLessThan(mockRevokeAiConsentRemote.mock.invocationCallOrder[0]);
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });

    revokeRequest.reject(new Error("revoke failed"));

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoke needs retry",
      );
    });
    expect(screen.getByText("Backend revoke failed")).toBeTruthy();
    expect(
      screen.getByText(
        "AI features are off locally. Fitaly will retry automatically, and you can retry now.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });
    expect(screen.getByTestId("privacy-ai-consent-retry-button")).toBeTruthy();
    expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledTimes(1);
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("automatically retries failed revoke after a fixed delay and reschedules only one retry after repeated failure", async () => {
    jest.useFakeTimers();
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };
    const firstRevokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const automaticRetryRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockRevokeAiConsentRemote
      .mockReturnValueOnce(firstRevokeRequest.promise)
      .mockReturnValueOnce(automaticRetryRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledTimes(1);
    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);

    await rejectDeferred(firstRevokeRequest, new Error("revoke failed"));

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoke needs retry",
    );
    expect(screen.getByTestId("privacy-ai-consent-retry-button")).toBeTruthy();

    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS - 1);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);

    await advanceRetryTimer(1);

    expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledTimes(2);
    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoking...",
    );

    await rejectDeferred(automaticRetryRequest, new Error("retry failed"));

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoke needs retry",
    );
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });
    expect(screen.getByTestId("privacy-ai-consent-retry-button")).toBeTruthy();

    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS - 1);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(2);

    await advanceRetryTimer(1);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(3);
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
  });

  it("clears retry UI when the automatic revoke retry succeeds", async () => {
    jest.useFakeTimers();
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };
    const firstRevokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const automaticRetryRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-05T10:00:00Z",
    } satisfies UserAiConsent;
    mockRevokeAiConsentRemote
      .mockReturnValueOnce(firstRevokeRequest.promise)
      .mockReturnValueOnce(automaticRetryRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await rejectDeferred(firstRevokeRequest, new Error("revoke failed"));

    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(2);

    await resolveDeferred(automaticRetryRequest, {
      aiConsent: revokedAiConsent,
    });

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoked",
    );
    expect(screen.queryByTestId("privacy-ai-consent-retry-button")).toBeNull();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: false });
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
  });

  it("resumes one delayed automatic retry after remount when a local revoke guard is active", async () => {
    jest.useFakeTimers();
    const guardedAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-05T10:00:00Z",
    } satisfies UserAiConsent;
    const automaticRetryRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };

    const { navigation, screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Granted",
    );
    mockGetAiConsentLocalRevokeGuard.mockReturnValue(guardedAiConsent);
    mockRevokeAiConsentRemote.mockReturnValueOnce(automaticRetryRequest.promise);

    screen.rerender(
      <PrivacyAiSettingsScreen
        key="guarded-automatic-remount"
        navigation={navigation as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoke needs retry",
      );
    });

    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS - 1);

    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();

    await advanceRetryTimer(1);

    expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledTimes(1);
    expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ uid: "user-1" }),
    );
    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);
    expect(mockRevokeAiConsentRemote).toHaveBeenCalledWith("user-1");
    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoking...",
    );

    fireEvent.press(screen.getByTestId("privacy-ai-consent-toggle"));
    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);

    await rejectDeferred(automaticRetryRequest, new Error("retry failed"));

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoke needs retry",
    );
  });

  it("retries failed revoke manually without routing the off toggle into grant", async () => {
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };
    const firstRevokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const retryRevokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-05T10:00:00Z",
    } satisfies UserAiConsent;
    mockRevokeAiConsentRemote
      .mockReturnValueOnce(firstRevokeRequest.promise)
      .mockReturnValueOnce(retryRevokeRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoking...",
      );
    });

    await rejectDeferred(firstRevokeRequest, new Error("revoke failed"));

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoke needs retry",
      );
    });
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });
    expect(screen.getByTestId("privacy-ai-consent-retry-button")).toBeTruthy();

    fireEvent.press(screen.getByTestId("privacy-ai-consent-toggle"));
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("privacy-ai-consent-retry-button"));

    await waitFor(() => {
      expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledTimes(2);
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoking...",
      );
    });
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });

    await resolveDeferred(retryRevokeRequest, {
      aiConsent: revokedAiConsent,
    });

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoked",
    );
    expect(screen.queryByTestId("privacy-ai-consent-retry-button")).toBeNull();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: false });
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("manual retry before the automatic timer prevents duplicate retry calls", async () => {
    jest.useFakeTimers();
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };
    const firstRevokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const manualRetryRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-05T10:00:00Z",
    } satisfies UserAiConsent;
    mockRevokeAiConsentRemote
      .mockReturnValueOnce(firstRevokeRequest.promise)
      .mockReturnValueOnce(manualRetryRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await rejectDeferred(firstRevokeRequest, new Error("revoke failed"));

    fireEvent.press(screen.getByTestId("privacy-ai-consent-retry-button"));

    expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledTimes(2);
    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(2);

    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(2);

    await resolveDeferred(manualRetryRequest, {
      aiConsent: revokedAiConsent,
    });

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoked",
    );
    expect(screen.queryByTestId("privacy-ai-consent-retry-button")).toBeNull();
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
  });

  it("manual retry after remount supersedes automatic retry and clears recovery UI on success", async () => {
    jest.useFakeTimers();
    const guardedAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-05T10:00:00Z",
    } satisfies UserAiConsent;
    const manualRetryRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: "2026-06-05T10:30:00Z",
    } satisfies UserAiConsent;
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };

    const { navigation, screen } = renderScreen();

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Granted",
    );
    mockGetAiConsentLocalRevokeGuard.mockReturnValue(guardedAiConsent);
    mockRevokeAiConsentRemote.mockReturnValueOnce(manualRetryRequest.promise);

    screen.rerender(
      <PrivacyAiSettingsScreen
        key="guarded-manual-remount"
        navigation={navigation as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoke needs retry",
      );
    });

    fireEvent.press(screen.getByTestId("privacy-ai-consent-retry-button"));

    await waitFor(() => {
      expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledTimes(1);
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoking...",
      );
    });
    expect(
      mockPublishAiConsentRevokeLocalInactive.mock.invocationCallOrder[0],
    ).toBeLessThan(mockRevokeAiConsentRemote.mock.invocationCallOrder[0]);

    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);

    await resolveDeferred(manualRetryRequest, {
      aiConsent: revokedAiConsent,
    });

    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Revoked",
    );
    expect(screen.queryByTestId("privacy-ai-consent-retry-button")).toBeNull();
    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: false });
  });

  it("does not let stale old revoke completion clear the current uid revoke in-flight guard", async () => {
    const grantedAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    } satisfies UserAiConsent;
    mockUserData = mockBuildUserData(grantedAiConsent);
    const firstUserRevokeRequest =
      createDeferred<{ aiConsent: UserAiConsent }>();
    const secondUserRevokeRequest =
      createDeferred<{ aiConsent: UserAiConsent }>();
    const secondUserManualRetryRequest =
      createDeferred<{ aiConsent: UserAiConsent }>();
    mockRevokeAiConsentRemote
      .mockReturnValueOnce(firstUserRevokeRequest.promise)
      .mockReturnValueOnce(secondUserRevokeRequest.promise)
      .mockReturnValueOnce(secondUserManualRetryRequest.promise);

    const { navigation, screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledWith("user-1");
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoking...",
      );
    });

    mockUserData = {
      ...mockBuildUserData(grantedAiConsent),
      uid: "user-2",
      email: "second@example.com",
    };

    screen.rerender(
      <PrivacyAiSettingsScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Granted",
      );
    });

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await waitFor(() => {
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledWith("user-2");
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(2);
    });

    await rejectDeferred(secondUserRevokeRequest, new Error("revoke failed"));

    const staleRetryButton = screen.getByTestId(
      "privacy-ai-consent-retry-button",
    );

    fireEvent.press(staleRetryButton);

    await waitFor(() => {
      expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
        "Revoking...",
      );
    });

    await resolveDeferred(firstUserRevokeRequest, {
      aiConsent: {
        status: "revoked",
        grantedAt: "2026-06-01T10:00:00Z",
        revokedAt: "2026-06-05T10:00:00Z",
      },
    });

    fireEvent.press(staleRetryButton);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(3);
    expect(mockPublishAiConsentRevokeLocalInactive).toHaveBeenCalledTimes(3);
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
  });

  it("clears a pending automatic revoke retry on unmount", async () => {
    jest.useFakeTimers();
    mockAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    };
    const firstRevokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockRevokeAiConsentRemote.mockReturnValueOnce(firstRevokeRequest.promise);

    const { screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await rejectDeferred(firstRevokeRequest, new Error("revoke failed"));

    screen.unmount();

    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);
  });

  it("clears a pending automatic revoke retry when uid changes", async () => {
    jest.useFakeTimers();
    const grantedAiConsent = {
      status: "granted",
      grantedAt: "2026-06-01T10:00:00Z",
      revokedAt: null,
    } satisfies UserAiConsent;
    mockUserData = mockBuildUserData(grantedAiConsent);
    const firstRevokeRequest = createDeferred<{ aiConsent: UserAiConsent }>();
    mockRevokeAiConsentRemote.mockReturnValueOnce(firstRevokeRequest.promise);

    const { navigation, screen } = renderScreen();

    act(() => {
      screen.getByTestId("privacy-ai-consent-toggle").props.onTouchEnd();
    });

    await rejectDeferred(firstRevokeRequest, new Error("revoke failed"));

    mockUserData = {
      ...mockBuildUserData({
        status: "not_granted",
        grantedAt: null,
        revokedAt: null,
      }),
      uid: "user-2",
      email: "second@example.com",
    };

    screen.rerender(
      <PrivacyAiSettingsScreen navigation={navigation as never} />,
    );

    await advanceRetryTimer(PRIVACY_AI_REVOKE_RETRY_DELAY_MS);

    expect(mockRevokeAiConsentRemote).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("privacy-ai-consent-state-value").props.children).toBe(
      "Not granted",
    );
  });

  it("does not call consent actions when uid is unavailable", () => {
    mockUserData = null;

    const { screen } = renderScreen();

    fireEvent.press(screen.getByTestId("privacy-ai-consent-toggle"));

    expect(
      screen.getByTestId("privacy-ai-consent-toggle").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });
    expect(mockGrantAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRevokeAiConsentRemote).not.toHaveBeenCalled();
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("uses the Legal & privacy fallback when there is no back stack", () => {
    const { navigation, screen } = renderScreen({ canGoBack: false });

    fireEvent.press(screen.getByTestId("screen-back"));

    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith("LegalPrivacyHub");
  });
});
