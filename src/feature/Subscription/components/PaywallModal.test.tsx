import { Linking, Text as MockText, View as MockView } from "react-native";
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
      children,
    }: {
      title: string;
      footer: ReactNode;
      children: ReactNode;
    }) => (
      <MockView>
        <MockText>{title}</MockText>
        {children}
        {footer}
      </MockView>
    ),
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? `translated:${key}`,
  }),
}));

describe("PaywallModal", () => {
  it("renders price, benefits and handles subscribe/restore", () => {
    const onSubscribe = jest.fn();
    const onRestore = jest.fn();
    const { getByText } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={() => undefined}
        onSubscribe={onSubscribe}
        onRestore={onRestore}
      />,
    );

    expect(getByText("Premium Monthly")).toBeTruthy();
    expect(getByText("$9.99 / month")).toBeTruthy();
    expect(getByText("Included in Premium")).toBeTruthy();

    fireEvent.press(getByText("Subscribe"));
    fireEvent.press(getByText("Restore Purchases"));
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("keeps subscribe and restore telemetry delegated to the caller", () => {
    const onSubscribe = jest.fn();
    const onRestore = jest.fn();
    const onClose = jest.fn();
    const { getByText } = renderWithTheme(
      <PaywallModal
        visible
        priceText="$9.99 / month"
        onClose={onClose}
        onSubscribe={onSubscribe}
        onRestore={onRestore}
      />,
    );

    fireEvent.press(getByText("Subscribe"));
    fireEvent.press(getByText("Restore Purchases"));

    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("opens terms/privacy links when urls are provided", () => {
    const openURLSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const { getByText } = renderWithTheme(
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

    fireEvent.press(getByText("Terms of Service"));
    fireEvent.press(getByText("Privacy Policy"));

    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/terms");
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/privacy");
    openURLSpy.mockRestore();
  });

  it("blocks actions when busy", () => {
    const onSubscribe = jest.fn();
    const onRestore = jest.fn();
    const { getByTestId, getByText, queryByText } = renderWithTheme(
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
    fireEvent.press(getByText("Restore Purchases"));
    expect(onSubscribe).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();
  });
});
