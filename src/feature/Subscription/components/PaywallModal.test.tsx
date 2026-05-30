import {
  Linking,
  StyleSheet as MockStyleSheet,
  Text as MockText,
  View as MockView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import { PaywallModal } from "@/feature/Subscription/components/PaywallModal";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/Modal", () => {
  return {
    Modal: ({
      title,
      footer,
      footerStyle,
      children,
      closeButtonTestID,
    }: {
      title: string;
      footer: ReactNode;
      footerStyle?: StyleProp<ViewStyle>;
      children: ReactNode;
      closeButtonTestID?: string;
    }) => (
      <MockView>
        <MockText>{title}</MockText>
        {closeButtonTestID ? (
          <MockView testID={closeButtonTestID}>
            <MockText>close</MockText>
          </MockView>
        ) : null}
        {children}
        <MockView
          testID="paywall-modal-footer-slot"
          style={MockStyleSheet.flatten(footerStyle)}
        >
          {footer}
        </MockView>
      </MockView>
    ),
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; storeName?: string }) => {
      const translations: Record<string, string> = {
        "paywall.heroEyebrow": "Premium in practice",
        "paywall.hero_title": "More AI, fewer limits",
        "paywall.hero_subtitle":
          "Use chat, photos, and history with more confidence.",
        "paywall.benefitSupport_aiCredits800":
          "More questions and balance for the period.",
        "paywall.benefitSupport_photoAnalysisIncluded":
          "Analyze photos without retyping.",
        "paywall.benefitSupport_fullHistoryAccess":
          "Return to history, filters, and patterns.",
        "paywall.benefitSupport_fullCloudBackup":
          "Meals and settings protected in cloud.",
        "paywall.benefitSupport_earlyAccess": "Try improvements earlier.",
        "paywall.benefitTitle_aiCredits800": "800 AI Credits each period",
        "paywall.footerDisclosure":
          "Payment at confirmation. Subscription renews automatically; manage or cancel in {{storeName}} settings.",
        "paywall.restoreEntry": "Already subscribed? Restore purchases",
        "manageSubscription.benefit_aiCredits800":
          "800 AI Credits per period",
        "manageSubscription.benefit_flexibleAiUsage": "Flexible AI usage",
        "manageSubscription.benefit_photoAnalysisIncluded":
          "Photo analysis included",
        "manageSubscription.benefit_fullHistoryAccess":
          "Full history & filters",
        "manageSubscription.benefit_fullCloudBackup": "Full cloud backup",
        "manageSubscription.benefit_earlyAccess": "Early access",
        "manageSubscription.restoreModalTitle": "Restore purchases",
        "manageSubscription.restoreModalBody":
          "Use this if you already purchased Premium.",
        "manageSubscription.restorePurchases": "Restore purchases",
        "manageSubscription.restoreBackToOffer": "Back to Premium offer",
        "manageSubscription.restoreRetryCta": "Try again",
        "manageSubscription.restoreDoneCta": "Done",
        "manageSubscription.restoreCheckingTitle": "Checking purchases...",
        "manageSubscription.restoreCheckingBody": "Checking the store account.",
        "manageSubscription.restoreNoPurchaseFoundTitle":
          "No active subscription found",
        "manageSubscription.restoreNoPurchaseFound":
          "We could not find an active Premium subscription.",
        "manageSubscription.confirmationPendingTitle": "Confirmation pending",
        "manageSubscription.confirmationPending":
          "Your purchase is recorded, but Premium is still waiting for confirmation.",
        "manageSubscription.activationPendingSheetTitle": "Premium activation",
        "manageSubscription.activationPendingTitle":
          "Subscription activation in progress",
        "manageSubscription.activationPendingBody":
          "The purchase was confirmed. We will refresh access shortly, or you can try restoring purchases.",
        "manageSubscription.restoreCheckStore": "Checks previous purchases.",
        "manageSubscription.restoreCheckConfirmation":
          "Premium appears only after confirmation.",
        "manageSubscription.store.appStore": "App Store",
      };
      const text = translations[key] ?? options?.defaultValue ?? `translated:${key}`;
      return text.replace("{{storeName}}", options?.storeName ?? "");
    },
  }),
}));

describe("PaywallModal", () => {
  it("renders price, benefits and handles subscribe/restore", () => {
    const onSubscribe = jest.fn();
    const onRestore = jest.fn();
    const { getByTestId, getByText } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={onSubscribe}
        onRestore={onRestore}
      />,
    );

    expect(getByText("Premium Monthly")).toBeTruthy();
    expect(getByTestId("paywall-close-button")).toBeTruthy();
    expect(getByText("$9.99 / month")).toBeTruthy();
    expect(getByText("Included in Premium")).toBeTruthy();
    expect(getByText("800 AI Credits for chat, photos, and text")).toBeTruthy();

    fireEvent.press(getByText("Subscribe"));
    fireEvent.press(getByTestId("paywall-open-restore-button"));
    fireEvent.press(getByTestId("paywall-restore-button"));
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("keeps subscribe and restore telemetry delegated to the caller", () => {
    const onSubscribe = jest.fn();
    const onRestore = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={onClose}
        onSubscribe={onSubscribe}
        onRestore={onRestore}
      />,
    );

    fireEvent.press(getByText("Subscribe"));
    fireEvent.press(getByTestId("paywall-open-restore-button"));

    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("separates restore into a focused account recovery state", () => {
    const onRestore = jest.fn();
    const { getByTestId, getByText, queryByText } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={onRestore}
      />,
    );

    fireEvent.press(getByTestId("paywall-open-restore-button"));

    expect(getByTestId("paywall-restore-state-initial")).toBeTruthy();
    expect(getByText("Use this if you already purchased Premium.")).toBeTruthy();
    expect(queryByText("$9.99 / month")).toBeNull();

    fireEvent.press(getByTestId("paywall-restore-button"));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("keeps purchase closable and makes restore use a bottom action band without a close button", () => {
    const { getByTestId, queryByTestId } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
      />,
    );

    expect(getByTestId("paywall-close-button")).toBeTruthy();
    expect(getByTestId("paywall-modal-footer-slot").props.style).toEqual(
      expect.objectContaining({ marginTop: "auto" }),
    );

    fireEvent.press(getByTestId("paywall-open-restore-button"));

    expect(queryByTestId("paywall-close-button")).toBeNull();
    expect(getByTestId("paywall-restore-footer")).toBeTruthy();
    expect(getByTestId("paywall-modal-footer-slot").props.style).toEqual(
      expect.objectContaining({
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        marginTop: 0,
      }),
    );
    expect(
      MockStyleSheet.flatten(getByTestId("paywall-restore-footer").props.style),
    ).toEqual(
      expect.objectContaining({
        paddingHorizontal: 24,
        paddingBottom: 20,
      }),
    );
  });

  it("renders restore loading, no-purchase, confirmation-pending, error, and success states", () => {
    const { getByTestId, getByText, queryByTestId, rerender } = renderWithTheme(
      <PaywallModal
        visible
        busy
        busyAction="restore"
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
      />,
    );

    expect(getByTestId("paywall-restore-state-loading")).toBeTruthy();
    expect(getByText("Checking purchases...")).toBeTruthy();

    rerender(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
        restoreFeedback={{
          tone: "neutral",
          title: "No active subscription found",
          message: "We could not find an active Premium subscription.",
          restoreState: "no-purchase",
        }}
      />,
    );
    expect(getByTestId("paywall-restore-state-no-purchase")).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();

    rerender(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
        restoreFeedback={{
          tone: "info",
          title: "Subscription activation in progress",
          message:
            "The purchase was confirmed. We will refresh access shortly, or you can try restoring purchases.",
          restoreState: "confirmation-pending",
        }}
      />,
    );
    expect(getByTestId("paywall-restore-state-confirmation-pending")).toBeTruthy();
    expect(queryByTestId("paywall-restore-state-no-purchase")).toBeNull();
    expect(
      getByText(
        "The purchase was confirmed. We will refresh access shortly, or you can try restoring purchases.",
      ),
    ).toBeTruthy();
    expect(getByText("Premium activation")).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();

    rerender(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
        restoreFeedback={{
          tone: "error",
          title: "Restore failed",
          message: "Store unavailable.",
        }}
      />,
    );
    expect(getByTestId("paywall-restore-state-error")).toBeTruthy();
    expect(getByText("Store unavailable.")).toBeTruthy();

    rerender(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
        restoreFeedback={{
          tone: "success",
          title: "Purchases restored",
          message: "Purchases restored and premium is active.",
        }}
      />,
    );
    expect(getByTestId("paywall-restore-state-success")).toBeTruthy();
    expect(getByText("Done")).toBeTruthy();
  });

  it("does not classify unspecified restore warnings as no-purchase", () => {
    const { getByTestId, queryByTestId } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
        restoreFeedback={{
          tone: "warning",
          title: "Confirmation pending",
          message: "Backend confirmation is still pending.",
        }}
      />,
    );

    expect(getByTestId("paywall-restore-state-confirmation-pending")).toBeTruthy();
    expect(queryByTestId("paywall-restore-state-no-purchase")).toBeNull();
  });

  it("renders a value-led single-column benefit hierarchy", () => {
    const { getByText, getByTestId, queryByText } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
      />,
    );

    expect(getByText("More AI, fewer limits")).toBeTruthy();
    expect(getByTestId("paywall-plan-status-mark")).toBeTruthy();
    expect(queryByText("Selected")).toBeNull();
    expect(getByText("800 AI Credits each period")).toBeTruthy();
    expect(getByText("More questions and balance for the period.")).toBeTruthy();
    expect(getByText("Photo analysis included")).toBeTruthy();
    expect(getByText("Full history & filters")).toBeTruthy();
    expect(queryByText("Flexible AI usage")).toBeNull();
  });

  it("opens terms/privacy links when urls are provided", () => {
    const openURLSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(true);
    const { getByTestId, getByText } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={() => undefined}
        onRestore={() => undefined}
        termsUrl="https://example.com/terms"
        privacyUrl="https://example.com/privacy"
      />,
    );

    expect(getByTestId("paywall-legal-block")).toBeTruthy();
    expect(getByTestId("paywall-cta-footer")).toBeTruthy();
    expect(getByTestId("paywall-footer-disclosure")).toBeTruthy();
    expect(
      getByText(
        "Payment at confirmation. Subscription renews automatically; manage or cancel in App Store settings.",
      ),
    ).toBeTruthy();

    fireEvent.press(getByTestId("paywall-footer-terms-button"));
    fireEvent.press(getByTestId("paywall-footer-privacy-button"));
    fireEvent.press(getByTestId("paywall-terms-button"));
    fireEvent.press(getByTestId("paywall-privacy-button"));

    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/terms");
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/privacy");
    expect(openURLSpy).toHaveBeenCalledTimes(4);
    openURLSpy.mockRestore();
  });

  it("blocks actions when busy", () => {
    const onSubscribe = jest.fn();
    const onRestore = jest.fn();
    const { getByTestId, queryByText } = renderWithTheme(
      <PaywallModal
        visible
        busy
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={onSubscribe}
        onRestore={onRestore}
      />,
    );

    expect(getByTestId("paywall-subscribe-button")).toBeTruthy();
    expect(queryByText("Subscribe")).toBeNull();
    fireEvent.press(getByTestId("paywall-subscribe-button"));
    fireEvent.press(getByTestId("paywall-open-restore-button"));
    expect(onSubscribe).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();
  });
});
