import { Text, Keyboard, Platform, View, StyleSheet } from "react-native";
import { act } from "@testing-library/react-native";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Layout } from "@/components/Layout";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockUseE2ENetInfo = jest.fn<
  () => { isConnected: boolean | null; isInternetReachable?: boolean | null }
>();
const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock("react-native-gesture-handler", () => {
  const { ScrollView } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, ScrollView };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock("@/services/e2e/connectivity", () => ({
  useE2ENetInfo: () => mockUseE2ENetInfo(),
}));

jest.mock("@/components/BottomTabBar", () => ({
  __esModule: true,
  BOTTOM_TAB_BAR_BASE_HEIGHT: 44,
  BOTTOM_TAB_BAR_BOTTOM_OFFSET: 0,
  BottomTabBar: () => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text: RNText } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(RNText, null, "bottom-tab-bar");
  },
}));

jest.mock("@/components/OfflineBanner", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const OfflineBanner = () => createElement(RNText, null, "offline-banner");
  return { __esModule: true, OfflineBanner, default: OfflineBanner };
});

describe("Layout", () => {
  type SurfaceStyleShape = {
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    backgroundColor?: unknown;
  };

  const isSurfaceView = (style: unknown): boolean => {
    const flattened = StyleSheet.flatten(style) as SurfaceStyleShape;
    return (
      typeof flattened?.paddingTop === "number" &&
      typeof flattened?.paddingBottom === "number" &&
      typeof flattened?.paddingLeft === "number" &&
      typeof flattened?.paddingRight === "number"
    );
  };

  afterEach(() => {
    jest.restoreAllMocks();
    mockUseE2ENetInfo.mockReset();
    mockInsets.top = 0;
    mockInsets.bottom = 0;
    mockInsets.left = 0;
    mockInsets.right = 0;
  });

  it("renders content and bottom tab when navigation is enabled", () => {
    mockUseE2ENetInfo.mockReturnValue({ isConnected: true });
    const { getByText, queryByText } = renderWithTheme(
      <Layout>
        <Text>screen-content</Text>
      </Layout>,
    );

    expect(getByText("screen-content")).toBeTruthy();
    expect(getByText("bottom-tab-bar")).toBeTruthy();
    expect(queryByText("offline-banner")).toBeNull();
  });

  it("hides bottom tab when navigation is disabled", () => {
    mockUseE2ENetInfo.mockReturnValue({ isConnected: true });
    const { queryByText } = renderWithTheme(
      <Layout showNavigation={false}>
        <Text>screen-content</Text>
      </Layout>,
    );

    expect(queryByText("bottom-tab-bar")).toBeNull();
  });

  it("shows offline banner when disconnected", () => {
    mockUseE2ENetInfo.mockReturnValue({ isConnected: false });
    const { getByText } = renderWithTheme(
      <Layout>
        <Text>screen-content</Text>
      </Layout>,
    );

    expect(getByText("offline-banner")).toBeTruthy();
  });

  it("shows offline banner when connected network has no internet reachability", () => {
    mockUseE2ENetInfo.mockReturnValue({
      isConnected: true,
      isInternetReachable: false,
    });
    const { getByText } = renderWithTheme(
      <Layout>
        <Text>screen-content</Text>
      </Layout>,
    );

    expect(getByText("offline-banner")).toBeTruthy();
  });

  it("registers keyboard listeners matching the current platform", () => {
    mockUseE2ENetInfo.mockReturnValue({ isConnected: true });
    const removeShow = jest.fn();
    const removeHide = jest.fn();
    const addListenerSpy = jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation(((eventName: string) => {
        if (eventName.includes("Show")) {
          return { remove: removeShow } as never;
        }
        return { remove: removeHide } as never;
      }) as typeof Keyboard.addListener);

    const { unmount } = renderWithTheme(
      <Layout>
        <Text>screen-content</Text>
      </Layout>,
    );

    const expectedEvents =
      Platform.OS === "ios"
        ? ["keyboardWillShow", "keyboardWillHide"]
        : ["keyboardDidShow", "keyboardDidHide"];
    const observedEvents = addListenerSpy.mock.calls.map(([eventName]) =>
      String(eventName),
    );

    expectedEvents.forEach((eventName) => {
      expect(observedEvents).toContain(eventName);
    });
    unmount();
    expect(removeShow).toHaveBeenCalled();
    expect(removeHide).toHaveBeenCalled();
  });

  it("removes bottom padding when keyboard is visible", () => {
    mockUseE2ENetInfo.mockReturnValue({ isConnected: true });
    const listeners = new Map<string, () => void>();
    jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation(((eventName: string, callback: unknown) => {
        listeners.set(eventName, callback as () => void);
        return { remove: jest.fn() } as never;
      }) as typeof Keyboard.addListener);

    const { UNSAFE_getAllByType } = renderWithTheme(
      <Layout>
        <Text>screen-content</Text>
      </Layout>,
    );

    const getRootPaddingBottom = () => {
      const rootView = UNSAFE_getAllByType(View).find((node) => {
        return isSurfaceView(node.props.style);
      });

      expect(rootView).toBeTruthy();
      return StyleSheet.flatten(rootView?.props.style).paddingBottom;
    };

    const showEventName =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEventName =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    expect(getRootPaddingBottom()).toBe(44);

    act(() => {
      listeners.get(showEventName)?.();
    });
    expect(getRootPaddingBottom()).toBe(0);

    act(() => {
      listeners.get(hideEventName)?.();
    });
    expect(getRootPaddingBottom()).toBe(44);
  });

  it("does not double-count safe-area inset when bottom navigation is visible", () => {
    mockUseE2ENetInfo.mockReturnValue({ isConnected: true });
    mockInsets.bottom = 34;

    const { UNSAFE_getAllByType } = renderWithTheme(
      <Layout>
        <Text>screen-content</Text>
      </Layout>,
    );

    const rootView = UNSAFE_getAllByType(View).find((node) => {
      return isSurfaceView(node.props.style);
    });

    expect(rootView).toBeTruthy();
    expect(StyleSheet.flatten(rootView?.props.style).paddingBottom).toBe(44);
  });

  it("keeps the padded layout surface stretched to full height", () => {
    mockUseE2ENetInfo.mockReturnValue({ isConnected: true });
    const { UNSAFE_getAllByType } = renderWithTheme(
      <Layout showNavigation={false}>
        <Text>screen-content</Text>
      </Layout>,
    );

    const paddedSurface = UNSAFE_getAllByType(View).find((node) => {
      if (!isSurfaceView(node.props.style)) {
        return false;
      }
      return Boolean(StyleSheet.flatten(node.props.style)?.backgroundColor);
    });

    expect(paddedSurface).toBeTruthy();
    expect(StyleSheet.flatten(paddedSurface?.props.style).flex).toBe(1);
  });
});
