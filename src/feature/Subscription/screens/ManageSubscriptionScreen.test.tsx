import type { ReactNode } from "react";
import { fireEvent } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import ManageSubscriptionScreen from "@/feature/Subscription/screens/ManageSubscriptionScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

type PaywallModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  onRestore: () => void;
  busy: boolean;
  priceText?: string | null;
  restoreFeedback?: { title: string } | null;
};

const mockUsePremiumContext = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUseAccessContext = jest.fn();
const mockUseManageSubscriptionState = jest.fn();
const mockUseNetInfo = jest.fn<() => { isConnected: boolean | null }>();

jest.mock("@/context/PremiumContext", () => ({
  usePremiumContext: () => mockUsePremiumContext(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => mockUseAccessContext(),
}));

jest.mock("@/feature/Subscription/hooks/useManageSubscriptionState", () => ({
  useManageSubscriptionState: (params: unknown) =>
    mockUseManageSubscriptionState(params),
}));

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@/utils/formatLocalDateTime", () => ({
  formatLocalDateTime: (value?: string | null) =>
    value ? "14.05.2026, 12:00" : null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { defaultValue?: string; ns?: string },
    ) => {
      if (options?.defaultValue) return options.defaultValue;
      return options?.ns ? `${options.ns}:${key}` : `profile:${key}`;
    },
  }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: ReactNode }) =>
      createElement(View, null, children),
    FullScreenLoader: () => createElement(Text, null, "full-screen-loader"),
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      createElement(
        Pressable,
        { onPress, disabled, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
    FormScreenShell: ({
      title,
      intro,
      onBack,
      children,
    }: {
      title: string;
      intro?: string;
      onBack: () => void;
      children?: ReactNode;
    }) =>
      createElement(
        View,
        null,
        createElement(Text, null, `header:${title}`),
        intro ? createElement(Text, null, intro) : null,
        createElement(
          Pressable,
          { onPress: onBack, accessibilityRole: "button" },
          createElement(Text, null, "Back"),
        ),
        children,
      ),
    InfoBlock: ({
      title,
      body,
      testID,
    }: {
      title: string;
      body: string;
      tone?: string;
      icon?: ReactNode;
      testID?: string;
    }) =>
      createElement(
        View,
        testID ? { testID } : null,
        createElement(Text, null, title),
        createElement(Text, null, body),
      ),
    SettingsSection: ({
      title,
      footer,
      children,
    }: {
      title?: string;
      footer?: string;
      children?: ReactNode;
    }) =>
      createElement(
        View,
        null,
        title ? createElement(Text, null, title) : null,
        children,
        footer ? createElement(Text, null, footer) : null,
      ),
    SettingsRow: ({
      title,
      subtitle,
      value,
      onPress,
    }: {
      title: string;
      subtitle?: string;
      value?: string;
      onPress?: () => void;
    }) =>
      onPress
        ? createElement(
            Pressable,
            { onPress, accessibilityRole: "button" },
            createElement(Text, null, title),
            subtitle ? createElement(Text, null, subtitle) : null,
            value ? createElement(Text, null, value) : null,
          )
        : createElement(
            View,
            null,
            createElement(Text, null, title),
            subtitle ? createElement(Text, null, subtitle) : null,
            value ? createElement(Text, null, value) : null,
          ),
  };
});

jest.mock("@/feature/Subscription/components/PaywallModal", () => ({
  PaywallModal: ({
    visible,
    onClose,
    onSubscribe,
    onRestore,
    priceText,
    restoreFeedback,
  }: PaywallModalProps) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return visible
      ? createElement(
          View,
          null,
          createElement(Text, null, `paywall:${priceText ?? ""}`),
          restoreFeedback
            ? createElement(Text, null, `paywall-feedback:${restoreFeedback.title}`)
            : null,
          createElement(
            Pressable,
            { onPress: onSubscribe, accessibilityRole: "button" },
            createElement(Text, null, "subscribe-paywall"),
          ),
          createElement(
            Pressable,
            { onPress: onRestore, accessibilityRole: "button" },
            createElement(Text, null, "restore-paywall"),
          ),
          createElement(
            Pressable,
            { onPress: onClose, accessibilityRole: "button" },
            createElement(Text, null, "close-paywall"),
          ),
        )
      : null;
  },
}));

function makeManageState(overrides: Record<string, unknown> = {}) {
  return {
    busy: false,
    busyAction: null,
    paywallVisible: false,
    termsUrl: "https://example.com/terms",
    privacyUrl: "https://example.com/privacy",
    refundUrl: "https://example.com/refund",
    priceText: "$9.99",
    state: "free_active",
    showRenew: false,
    showStart: true,
    showConfirmationRetry: false,
    showManageInStore: true,
    headerStatus: "Free",
    isPremiumComputed: false,
    billingAvailability: "ready",
    actionFeedback: null,
    tryOpenManage: jest.fn(),
    tryRefreshPremium: jest.fn(),
    tryRestore: jest.fn(),
    trySubscribe: jest.fn(),
    tryOpenRefundPolicy: jest.fn(),
    openPaywall: jest.fn(),
    closePaywall: jest.fn(),
    openTerms: jest.fn(),
    openPrivacy: jest.fn(),
    clearActionFeedback: jest.fn(),
    ...overrides,
  };
}

describe("ManageSubscriptionScreen", () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUseAccessContext.mockReturnValue({
      accessState: {
        credits: {
          balance: 76,
          allocation: 800,
          tier: "premium",
          periodEndAt: "2026-05-14T10:00:00.000Z",
        },
      },
      loading: false,
    });
    mockUsePremiumContext.mockReturnValue({
      subscription: { state: "inactive" },
      refreshPremium: jest.fn(),
      confirmPremiumEntitlement: jest.fn(),
    });
  });

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it("shows the loader while subscription data is missing", () => {
    mockUsePremiumContext.mockReturnValue({
      subscription: null,
      refreshPremium: jest.fn(),
      confirmPremiumEntitlement: jest.fn(),
    });
    mockUseManageSubscriptionState.mockReturnValue(makeManageState());

    const { getByText } = renderWithTheme(
      <ManageSubscriptionScreen navigation={{ setOptions: jest.fn() } as never} />,
    );

    expect(getByText("full-screen-loader")).toBeTruthy();
  });

  it("shows offline fallback when subscription data is missing and device is offline", () => {
    const refreshPremium = jest.fn(async () => false);
    const navigation = {
      canGoBack: jest.fn(() => false),
      goBack: jest.fn(),
      navigate: jest.fn<(screen: string) => void>(),
      setOptions: jest.fn(),
    };
    mockUseNetInfo.mockReturnValue({ isConnected: false });
    mockUsePremiumContext.mockReturnValue({
      subscription: null,
      refreshPremium,
      confirmPremiumEntitlement: jest.fn(),
    });
    mockUseManageSubscriptionState.mockReturnValue(makeManageState());

    const { getByText } = renderWithTheme(
      <ManageSubscriptionScreen navigation={navigation as never} />,
    );

    expect(getByText("Subscription details unavailable")).toBeTruthy();
    expect(
      getByText(
        "You're offline and subscription details are not available locally yet.",
      ),
    ).toBeTruthy();

    fireEvent.press(getByText("common:retry"));
    fireEvent.press(getByText("Back"));

    expect(refreshPremium).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("Profile");
  });

  it("renders the launch-ready subscription sections and actions", () => {
    const navigation = {
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      navigate: jest.fn<(screen: string) => void>(),
    };
    const tryOpenManage = jest.fn();
    const tryRestore = jest.fn();
    const trySubscribe = jest.fn();
    const tryOpenRefundPolicy = jest.fn();
    const openPaywall = jest.fn();
    const closePaywall = jest.fn();
    const clearActionFeedback = jest.fn();

    mockUseManageSubscriptionState.mockReturnValue(
      makeManageState({
        paywallVisible: true,
        showManageInStore: true,
        headerStatus: "Inactive",
        tryOpenManage,
        tryRestore,
        trySubscribe,
        tryOpenRefundPolicy,
        openPaywall,
        closePaywall,
        clearActionFeedback,
      }),
    );

    const { getAllByText, getByText } = renderWithTheme(
      <ManageSubscriptionScreen navigation={navigation as never} />,
    );

    expect(getByText("header:profile:manageSubscription.title")).toBeTruthy();
    expect(
      getByText("Your plan, AI Credits, and store actions in one place."),
    ).toBeTruthy();
    expect(getByText("Free plan")).toBeTruthy();
    expect(getByText("Current plan")).toBeTruthy();
    expect(getAllByText("AI Credits").length).toBeGreaterThan(0);
    expect(getByText("Available now")).toBeTruthy();
    expect(getByText("Subscription actions")).toBeTruthy();
    expect(getByText("profile:manageSubscription.startSubscription")).toBeTruthy();
    expect(getByText("76")).toBeTruthy();
    expect(getByText("800")).toBeTruthy();
    expect(getAllByText("14.05.2026, 12:00").length).toBeGreaterThan(0);
    expect(getByText("paywall:$9.99")).toBeTruthy();

    fireEvent.press(getByText("profile:manageSubscription.startSubscription"));
    fireEvent.press(getByText("Manage subscription in store"));
    fireEvent.press(getByText("Restore purchases"));
    fireEvent.press(getByText("Legal & privacy"));
    fireEvent.press(getByText("profile:manageSubscription.refundPolicy"));
    fireEvent.press(getByText("subscribe-paywall"));
    fireEvent.press(getByText("restore-paywall"));
    fireEvent.press(getByText("close-paywall"));

    expect(clearActionFeedback).toHaveBeenCalledTimes(1);
    expect(openPaywall).toHaveBeenCalledTimes(1);
    expect(tryOpenManage).toHaveBeenCalledTimes(1);
    expect(tryRestore).toHaveBeenCalledTimes(2);
    expect(navigation.navigate).toHaveBeenCalledWith("LegalPrivacyHub");
    expect(tryOpenRefundPolicy).toHaveBeenCalledTimes(1);
    expect(trySubscribe).toHaveBeenCalledTimes(1);
    expect(closePaywall).toHaveBeenCalledTimes(1);
  });

  it("collapses repeated confirmation warnings into the summary block", () => {
    mockUseAccessContext.mockReturnValue({
      accessState: { credits: null },
      loading: false,
    });
    mockUseManageSubscriptionState.mockReturnValue(
      makeManageState({
        state: "unknown",
        showConfirmationRetry: true,
        showStart: false,
        actionFeedback: {
          tone: "warning",
          title: "Cannot confirm premium right now",
          message:
            "Backend access state is unavailable or degraded, so Premium cannot be confirmed yet.",
          source: "manage",
        },
      }),
    );

    const { getAllByText, queryByText } = renderWithTheme(
      <ManageSubscriptionScreen navigation={{ setOptions: jest.fn() } as never} />,
    );

    expect(getAllByText("Cannot confirm premium right now")).toHaveLength(1);
    expect(
      queryByText("AI Credits unavailable"),
    ).toBeNull();
  });

  it("keeps billing unavailable state content for free users", () => {
    mockUseManageSubscriptionState.mockReturnValue(
      makeManageState({
        billingAvailability: "disabled",
      }),
    );

    const { getAllByText, getByText } = renderWithTheme(
      <ManageSubscriptionScreen navigation={{ setOptions: jest.fn() } as never} />,
    );

    expect(getByText("Free plan")).toBeTruthy();
    expect(getByText("Billing unavailable")).toBeTruthy();
    expect(getByText("Billing is unavailable on this device.")).toBeTruthy();
    expect(getByText("profile:manageSubscription.startSubscription")).toBeTruthy();
    expect(getByText("Current plan")).toBeTruthy();
    expect(getAllByText("AI Credits").length).toBeGreaterThan(0);
  });

  it("does not render success action feedback as a duplicate premium status card", () => {
    mockUsePremiumContext.mockReturnValue({
      subscription: { state: "premium_active" },
      refreshPremium: jest.fn(),
      confirmPremiumEntitlement: jest.fn(),
    });
    mockUseManageSubscriptionState.mockReturnValue(
      makeManageState({
        state: "premium_active",
        showStart: false,
        showManageInStore: true,
        headerStatus: "Premium",
        isPremiumComputed: true,
        actionFeedback: {
          tone: "success",
          title: "Premium active",
          message: "Purchases restored and premium is active.",
          source: "restore",
        },
      }),
    );

    const { getAllByText, queryByText } = renderWithTheme(
      <ManageSubscriptionScreen navigation={{ setOptions: jest.fn() } as never} />,
    );

    expect(getAllByText("Premium active")).toHaveLength(1);
    expect(queryByText("Purchases restored and premium is active.")).toBeNull();
  });

  it("passes purchase activation pending feedback into the paywall recovery surface", () => {
    mockUseManageSubscriptionState.mockReturnValue(
      makeManageState({
        paywallVisible: true,
        actionFeedback: {
          tone: "info",
          title: "Subscription activation in progress",
          message:
            "The purchase was confirmed. We will refresh access shortly, or you can try restoring purchases.",
          source: "purchase",
          feedbackState: "activation-pending",
          restoreState: "confirmation-pending",
        },
      }),
    );

    const { getByText } = renderWithTheme(
      <ManageSubscriptionScreen navigation={{ setOptions: jest.fn() } as never} />,
    );

    expect(
      getByText("paywall-feedback:Subscription activation in progress"),
    ).toBeTruthy();
  });

  it("renders no-purchase restore feedback as neutral recovery on the screen", () => {
    mockUseManageSubscriptionState.mockReturnValue(
      makeManageState({
        actionFeedback: {
          tone: "neutral",
          title: "No active subscription found",
          message:
            "Make sure you are using the same store account. You can try again or return to the Premium offer.",
          source: "restore",
          feedbackState: "no-purchase",
          restoreState: "no-purchase",
        },
      }),
    );

    const { getByText, getByTestId } = renderWithTheme(
      <ManageSubscriptionScreen navigation={{ setOptions: jest.fn() } as never} />,
    );

    expect(getByTestId("manage-subscription-action-feedback-no-purchase")).toBeTruthy();
    expect(getByText("No active subscription found")).toBeTruthy();
    expect(
      getByText(
        "Make sure you are using the same store account. You can try again or return to the Premium offer.",
      ),
    ).toBeTruthy();
  });
});
