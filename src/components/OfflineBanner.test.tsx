import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent } from "@testing-library/react-native";
import { OfflineBanner } from "@/components/OfflineBanner";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `translated:${key}`,
  }),
}));

describe("OfflineBanner", () => {
  it("renders translated defaults", () => {
    const { getByText } = renderWithTheme(<OfflineBanner />);

    expect(getByText("translated:offline.title")).toBeTruthy();
    expect(getByText("translated:offline.subtitle")).toBeTruthy();
  });

  it("renders custom title and subtitle", () => {
    const { getByText, queryByText } = renderWithTheme(
      <OfflineBanner title="Offline" subtitle="Local data only" />,
    );

    expect(getByText("Offline")).toBeTruthy();
    expect(getByText("Local data only")).toBeTruthy();
    expect(queryByText("translated:offline.title")).toBeNull();
  });

  it("hides subtitle in compact mode", () => {
    const { getByText, queryByText } = renderWithTheme(
      <OfflineBanner compact title="Offline" subtitle="Local data only" />,
    );

    expect(getByText("Offline")).toBeTruthy();
    expect(queryByText("Local data only")).toBeNull();
  });

  it("exposes a dismiss control when dismissible", () => {
    const onDismiss = jest.fn();
    const { getByTestId } = renderWithTheme(
      <OfflineBanner compact dismissible onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId("offline-banner-dismiss-button"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
