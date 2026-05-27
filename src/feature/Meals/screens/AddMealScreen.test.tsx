import { BackHandler } from "react-native";
import { act, fireEvent } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import AddMealScreen from "@/feature/Meals/screens/AddMealScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockUseNavigation = jest.fn();
const mockUseRoute = jest.fn();
const mockMapMealAddScreens = jest.fn();
const mockBackHandlerAddEventListener = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockUseNavigation(),
  useRoute: () => mockUseRoute(),
}));

jest.mock("../feature/MapMealAddScreens", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    default: (screenName: string) => {
      mockMapMealAddScreens(screenName);
      return function MockStepScreen(props: {
        flow: {
          goTo: (name: string, params?: unknown) => void;
          replace: (name: string, params?: unknown) => void;
          goBack: () => void;
          canGoBack: () => boolean;
        };
        params: Record<string, unknown>;
      }) {
        return createElement(
          View,
          null,
          createElement(Text, null, `screen:${screenName}`),
          createElement(
            Pressable,
            {
              onPress: () =>
                props.flow.goTo("IngredientsNotRecognized", {
                  image: "file:///meal.jpg",
                }),
            },
            createElement(Text, null, "flow-go-to"),
          ),
          createElement(
            Pressable,
            {
              onPress: () => props.flow.goTo("ReviewMeal"),
            },
            createElement(Text, null, "flow-go-to-no-params"),
          ),
          createElement(
            Pressable,
            {
              onPress: () => props.flow.replace("ReviewMeal", { replaced: true }),
            },
            createElement(Text, null, "flow-replace"),
          ),
          createElement(
            Pressable,
            {
              onPress: props.flow.goBack,
            },
            createElement(Text, null, "flow-go-back"),
          ),
          createElement(
            Text,
            null,
            `can-go-back:${String(props.flow.canGoBack())}`,
          ),
          createElement(Text, null, `params:${JSON.stringify(props.params)}`),
        );
      };
    },
  };
});

describe("AddMealScreen", () => {
  let backHandlerListener: (() => boolean) | undefined;
  let beforeRemoveListener:
    | ((event: { data: { action: { type: string } }; preventDefault: () => void }) => void)
    | undefined;

  beforeEach(() => {
    backHandlerListener = undefined;
    beforeRemoveListener = undefined;
    mockMapMealAddScreens.mockClear();

    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation(
        ((_eventName: string, listener: () => boolean) => {
          backHandlerListener = listener;
          mockBackHandlerAddEventListener();
          return { remove: jest.fn() };
        }) as typeof BackHandler.addEventListener,
      );

    mockUseNavigation.mockReturnValue({
      goBack: jest.fn(),
      addListener: jest.fn(
        (_eventName: string, listener: typeof beforeRemoveListener) => {
          beforeRemoveListener = listener ?? undefined;
          return jest.fn();
        },
      ),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps the CameraDefault start to the photo entry screen", () => {
    mockUseRoute.mockReturnValue({
      params: {
        start: "CameraDefault",
        id: "meal-1",
        skipDetection: true,
        attempt: 2,
        fullscreenPreferred: true,
      },
    });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    expect(getByText("screen:CameraDefault")).toBeTruthy();
    expect(
      getByText(
        'params:{"id":"meal-1","skipDetection":true,"attempt":2,"fullscreenPreferred":true}',
      ),
    ).toBeTruthy();
  });

  it("maps the BarcodeScan start to the new barcode flow", () => {
    mockUseRoute.mockReturnValue({
      params: {
        start: "BarcodeScan",
        code: "5901234123457",
        showManualEntry: true,
      },
    });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    expect(getByText("screen:BarcodeScan")).toBeTruthy();
    expect(
      getByText('params:{"code":"5901234123457","showManualEntry":true}'),
    ).toBeTruthy();
  });

  it("maps the ReviewMeal start to the new review screen", () => {
    mockUseRoute.mockReturnValue({
      params: {
        start: "ReviewMeal",
      },
    });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    expect(getByText("screen:ReviewMeal")).toBeTruthy();
    expect(getByText("params:{}")).toBeTruthy();
  });

  it("maps the DescribeMeal start to the text entry screen", () => {
    mockUseRoute.mockReturnValue({
      params: {
        start: "DescribeMeal",
      },
    });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    expect(getByText("screen:DescribeMeal")).toBeTruthy();
    expect(getByText("params:{}")).toBeTruthy();
  });

  it("falls back to CameraDefault for unknown start values", () => {
    mockUseRoute.mockReturnValue({
      params: {
        start: "UnexpectedStep",
        id: "meal-fallback",
      },
    });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    expect(getByText("screen:CameraDefault")).toBeTruthy();
    expect(
      getByText('params:{"id":"meal-fallback","skipDetection":false,"attempt":1}'),
    ).toBeTruthy();
  });

  it("preserves a numeric attempt on unknown fallback starts", () => {
    mockUseRoute.mockReturnValue({
      params: {
        start: "UnexpectedStep",
        id: "meal-fallback",
        attempt: 4,
      },
    });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    expect(
      getByText('params:{"id":"meal-fallback","skipDetection":false,"attempt":4}'),
    ).toBeTruthy();
  });

  it("defaults to CameraDefault when no route params are provided", () => {
    mockUseRoute.mockReturnValue({ params: undefined });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    expect(getByText("screen:CameraDefault")).toBeTruthy();
    expect(
      getByText('params:{"skipDetection":false,"attempt":1}'),
    ).toBeTruthy();
  });

  it("maps the EditMealDetails start to the new editor screen", () => {
    const navigation = {
      goBack: jest.fn(),
      addListener: jest.fn(
        (_eventName: string, listener: typeof beforeRemoveListener) => {
          beforeRemoveListener = listener ?? undefined;
          return jest.fn();
        },
      ),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseRoute.mockReturnValue({ params: { start: "EditMealDetails" } });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    expect(getByText("screen:EditMealDetails")).toBeTruthy();
    fireEvent.press(getByText("flow-go-to"));
    expect(getByText("screen:IngredientsNotRecognized")).toBeTruthy();
    expect(getByText("can-go-back:true")).toBeTruthy();

    const preventDefault = jest.fn();
    act(() => {
      beforeRemoveListener?.({
        data: { action: { type: "GO_BACK" } },
        preventDefault,
      });
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText("flow-replace"));
    expect(getByText("screen:ReviewMeal")).toBeTruthy();
    expect(getByText('params:{"replaced":true}')).toBeTruthy();

    expect(mockBackHandlerAddEventListener).toHaveBeenCalled();
    let handled = false;
    act(() => {
      handled = backHandlerListener?.() ?? false;
    });
    expect(handled).toBe(true);
    expect(getByText("screen:ReviewMeal")).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("does not install parent hardware handling for review step", () => {
    const navigation = {
      goBack: jest.fn(),
      addListener: jest.fn(
        (_eventName: string, listener: typeof beforeRemoveListener) => {
          beforeRemoveListener = listener ?? undefined;
          return jest.fn();
        },
      ),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseRoute.mockReturnValue({ params: { start: "ReviewMeal" } });

    renderWithTheme(<AddMealScreen />);

    let handled = false;
    act(() => {
      handled = backHandlerListener?.() ?? false;
    });
    expect(handled).toBe(false);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("keeps review hardware handling delegated to the child screen", () => {
    const navigation = {
      goBack: jest.fn(),
      addListener: jest.fn(
        (_eventName: string, listener: typeof beforeRemoveListener) => {
          beforeRemoveListener = listener ?? undefined;
          return jest.fn();
        },
      ),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseRoute.mockReturnValue({ params: { start: "EditMealDetails" } });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    fireEvent.press(getByText("flow-replace"));
    expect(getByText("screen:ReviewMeal")).toBeTruthy();

    let handled = false;
    act(() => {
      handled = backHandlerListener?.() ?? false;
    });

    expect(handled).toBe(false);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(getByText("screen:ReviewMeal")).toBeTruthy();
  });

  it("pops stacked non-review steps on hardware back", () => {
    const navigation = {
      goBack: jest.fn(),
      addListener: jest.fn(
        (_eventName: string, listener: typeof beforeRemoveListener) => {
          beforeRemoveListener = listener ?? undefined;
          return jest.fn();
        },
      ),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseRoute.mockReturnValue({ params: { start: "EditMealDetails" } });

    const { getByText, queryByText } = renderWithTheme(<AddMealScreen />);

    fireEvent.press(getByText("flow-go-to"));
    expect(getByText("screen:IngredientsNotRecognized")).toBeTruthy();

    let handled = false;
    act(() => {
      handled = backHandlerListener?.() ?? false;
    });

    expect(handled).toBe(true);
    expect(queryByText("screen:IngredientsNotRecognized")).toBeNull();
    expect(getByText("screen:EditMealDetails")).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("does not install parent hardware handling for describe step", () => {
    const navigation = {
      goBack: jest.fn(),
      addListener: jest.fn(
        (_eventName: string, listener: typeof beforeRemoveListener) => {
          beforeRemoveListener = listener ?? undefined;
          return jest.fn();
        },
      ),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseRoute.mockReturnValue({ params: { start: "DescribeMeal" } });

    renderWithTheme(<AddMealScreen />);

    let handled = false;
    act(() => {
      handled = backHandlerListener?.() ?? false;
    });

    expect(handled).toBe(false);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("keeps the current step when flow.goBack is called on a single-screen stack", () => {
    mockUseRoute.mockReturnValue({ params: { start: "DescribeMeal" } });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    fireEvent.press(getByText("flow-go-back"));

    expect(getByText("screen:DescribeMeal")).toBeTruthy();
    expect(getByText("can-go-back:false")).toBeTruthy();
  });

  it("creates empty params when flow.goTo is called without params", () => {
    mockUseRoute.mockReturnValue({ params: { start: "DescribeMeal" } });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    fireEvent.press(getByText("flow-go-to-no-params"));

    expect(getByText("screen:ReviewMeal")).toBeTruthy();
    expect(getByText("params:{}")).toBeTruthy();
  });

  it("ignores non-back beforeRemove actions for stacked non-review steps", () => {
    const navigation = {
      goBack: jest.fn(),
      addListener: jest.fn(
        (_eventName: string, listener: typeof beforeRemoveListener) => {
          beforeRemoveListener = listener ?? undefined;
          return jest.fn();
        },
      ),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseRoute.mockReturnValue({ params: { start: "EditMealDetails" } });

    const { getByText } = renderWithTheme(<AddMealScreen />);

    fireEvent.press(getByText("flow-go-to"));

    const preventDefault = jest.fn();
    act(() => {
      beforeRemoveListener?.({
        data: { action: { type: "NAVIGATE" } },
        preventDefault,
      });
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(getByText("screen:IngredientsNotRecognized")).toBeTruthy();
  });

  it("ignores beforeRemove when a non-review step is alone on the stack", () => {
    const navigation = {
      goBack: jest.fn(),
      addListener: jest.fn(
        (_eventName: string, listener: typeof beforeRemoveListener) => {
          beforeRemoveListener = listener ?? undefined;
          return jest.fn();
        },
      ),
    };
    mockUseNavigation.mockReturnValue(navigation);
    mockUseRoute.mockReturnValue({ params: { start: "DescribeMeal" } });

    renderWithTheme(<AddMealScreen />);

    const preventDefault = jest.fn();
    act(() => {
      beforeRemoveListener?.({
        data: { action: { type: "GO_BACK" } },
        preventDefault,
      });
    });

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
