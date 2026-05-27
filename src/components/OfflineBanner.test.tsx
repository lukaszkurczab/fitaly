import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent } from "@testing-library/react-native";
import { act } from "react-test-renderer";
import { Animated, PanResponder } from "react-native";
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it("dismisses with a horizontal swipe gesture fallback", () => {
    const onDismiss = jest.fn();
    jest.spyOn(Animated, "timing").mockReturnValue({
      start: (callback?: (result: { finished: boolean }) => void) =>
        callback?.({ finished: true }),
    } as never);
    const { getByTestId } = renderWithTheme(
      <OfflineBanner compact dismissible onDismiss={onDismiss} />,
    );
    const banner = getByTestId("offline-banner");

    act(() => {
      banner.props.onTouchStart({ nativeEvent: { pageX: 160 } });
      banner.props.onTouchEnd({ nativeEvent: { pageX: 80 } });
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the banner visible for short swipe gestures", () => {
    const onDismiss = jest.fn();
    const { getByTestId } = renderWithTheme(
      <OfflineBanner compact dismissible onDismiss={onDismiss} />,
    );
    const banner = getByTestId("offline-banner");

    act(() => {
      banner.props.onTouchStart({ nativeEvent: { pageX: 160 } });
      banner.props.onTouchEnd({ nativeEvent: { pageX: 135 } });
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("handles pan responder dismissal and spring-back branches", () => {
    const onDismiss = jest.fn();
    jest.spyOn(PanResponder, "create").mockImplementation(
      (config) =>
        ({
          panHandlers: {
            onMoveShouldSetResponder: config.onMoveShouldSetPanResponder,
            onResponderMove: config.onPanResponderMove,
            onResponderRelease: config.onPanResponderRelease,
            onResponderTerminate: config.onPanResponderTerminate,
          },
        }) as never,
    );
    const timingSpy = jest.spyOn(Animated, "timing").mockReturnValue({
      start: (callback?: (result: { finished: boolean }) => void) =>
        callback?.({ finished: true }),
    } as never);
    const springSpy = jest.spyOn(Animated, "spring").mockReturnValue({
      start: jest.fn(),
    } as never);
    const { getByTestId } = renderWithTheme(
      <OfflineBanner compact dismissible onDismiss={onDismiss} />,
    );
    const banner = getByTestId("offline-banner");

    expect(
      banner.props.onMoveShouldSetResponder({}, { dx: 20, dy: 4 }),
    ).toBe(true);
    expect(
      banner.props.onMoveShouldSetResponder({}, { dx: 5, dy: 1 }),
    ).toBe(false);
    expect(
      banner.props.onMoveShouldSetResponder({}, { dx: 20, dy: 30 }),
    ).toBe(false);

    act(() => {
      banner.props.onResponderMove({}, { dx: 22 });
      banner.props.onResponderRelease({}, { dx: -60 });
    });

    expect(timingSpy).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      banner.props.onResponderRelease({}, { dx: 20 });
      banner.props.onResponderTerminate();
    });

    expect(springSpy).toHaveBeenCalledTimes(2);
  });

  it("ignores touch end without a matching touch start", () => {
    const onDismiss = jest.fn();
    const { getByTestId } = renderWithTheme(
      <OfflineBanner compact dismissible onDismiss={onDismiss} />,
    );

    act(() => {
      getByTestId("offline-banner").props.onTouchEnd({
        nativeEvent: { pageX: 80 },
      });
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
