import { describe, expect, it, jest } from "@jest/globals";
import { StyleSheet } from "react-native";
import CustomizeToolRail from "@/feature/Meals/shareComposer/components/CustomizeToolRail";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

describe("CustomizeToolRail visual chrome", () => {
  it("uses tint and border instead of rail shadow or elevation", () => {
    const { getByTestId } = renderWithTheme(
      <CustomizeToolRail
        textLabel="Text"
        chartLabel="Chart"
        cardLabel="Card"
        photoLabel="Photo"
        resetLabel="Reset"
        hasChart
        hasCard={false}
        hasPhoto={false}
        selectedLayerId="chartWidget"
        onAddTextLayer={jest.fn()}
        onEnsureChartLayer={jest.fn()}
        onEnsureCardLayer={jest.fn()}
        onAddOrReplaceAdditionalPhoto={jest.fn()}
        onResetComposition={jest.fn()}
      />,
    );

    const railStyle = StyleSheet.flatten(
      getByTestId("share-utility-row").props.style,
    );

    expect(railStyle.backgroundColor).toContain("rgba");
    expect(railStyle.borderColor).toContain("rgba");
    expect(railStyle.shadowOpacity).toBeUndefined();
    expect(railStyle.shadowRadius).toBeUndefined();
    expect(railStyle.elevation).toBeUndefined();
  });
});
