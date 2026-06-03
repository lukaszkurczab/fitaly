import { fireEvent } from "@testing-library/react-native";
import { View } from "react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { StatisticsTrendChart } from "@/feature/Statistics/components/StatisticsTrendChart";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-native-svg", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: MockView } =
    jest.requireActual<typeof import("react-native")>("react-native");

  const makeSvgMock = (displayName: string, testID: string) => {
    const SvgMock = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement(MockView, { ...props, testID }, children);
    SvgMock.displayName = displayName;
    return SvgMock;
  };

  return {
    __esModule: true,
    Svg: makeSvgMock("Svg", "svg-root"),
    Path: makeSvgMock("Path", "svg-path"),
    Line: makeSvgMock("Line", "svg-line"),
    Circle: makeSvgMock("Circle", "svg-circle"),
  };
});

describe("StatisticsTrendChart", () => {
  it("renders the calm line and area without point markers", () => {
    const { UNSAFE_root, getByTestId, queryAllByTestId } = renderWithTheme(
      <StatisticsTrendChart
        data={[0, 0, 0, 0, 0, 0, 380]}
        labels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
        color="#5E7350"
        softColor="#E7ECE2"
      />,
    );

    const layoutTarget = UNSAFE_root.findAllByType(View).find(
      (node) => typeof node.props.onLayout === "function",
    );

    if (!layoutTarget) {
      throw new Error("Expected chart frame with an onLayout handler");
    }

    fireEvent(layoutTarget, "layout", {
      nativeEvent: {
        layout: { width: 320, height: 88, x: 0, y: 0 },
      },
    });

    expect(queryAllByTestId("svg-path")).toHaveLength(2);
    expect(queryAllByTestId("svg-line")).toHaveLength(4);
    expect(queryAllByTestId("svg-circle")).toHaveLength(0);
    expect(getByTestId("statistics-y-axis-label-0").props.children).toBe("400");
    expect(getByTestId("statistics-y-axis-label-1").props.children).toBe("300");
    expect(getByTestId("statistics-y-axis-label-2").props.children).toBe("200");
    expect(getByTestId("statistics-y-axis-label-3").props.children).toBe("100");
    expect(getByTestId("statistics-y-axis-label-4").props.children).toBe("0");
  });

  it("adds a calorie target guide line when a target value is provided", () => {
    const { UNSAFE_root, getByTestId, queryAllByTestId } = renderWithTheme(
      <StatisticsTrendChart
        data={[1200, 1500, 1700]}
        labels={["Mon", "Tue", "Wed"]}
        color="#5E7350"
        softColor="#E7ECE2"
        targetValue={2000}
      />,
    );

    const layoutTarget = UNSAFE_root.findAllByType(View).find(
      (node) => typeof node.props.onLayout === "function",
    );

    if (!layoutTarget) {
      throw new Error("Expected chart frame with an onLayout handler");
    }

    fireEvent(layoutTarget, "layout", {
      nativeEvent: {
        layout: { width: 320, height: 88, x: 0, y: 0 },
      },
    });

    expect(queryAllByTestId("svg-line")).toHaveLength(5);
    expect(getByTestId("statistics-y-axis-label-0").props.children).toBe("2000");
    expect(getByTestId("statistics-y-axis-label-1").props.children).toBe("1500");
    expect(getByTestId("statistics-y-axis-label-2").props.children).toBe("1000");
    expect(getByTestId("statistics-y-axis-label-3").props.children).toBe("500");
    expect(getByTestId("statistics-y-axis-label-4").props.children).toBe("0");
  });
});
