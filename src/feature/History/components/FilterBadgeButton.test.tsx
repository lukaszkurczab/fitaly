import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { FilterBadgeButton } from "@/feature/History/components/FilterBadgeButton";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("FilterBadgeButton", () => {
  it("renders active badge for positive count and supports 2-digit values", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId, getByLabelText } = renderWithTheme(
      <FilterBadgeButton activeCount={12} onPress={onPress} />,
    );

    expect(getByText("12")).toBeTruthy();
    expect(getByTestId("history-filter-button")).toBeTruthy();
    expect(getByTestId("history-filter-badge")).toHaveStyle({ minWidth: 20 });
    fireEvent.press(getByLabelText("filters"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses a non-clipping badge container and hides badge for zero", () => {
    const { getByTestId, queryByTestId } = renderWithTheme(
      <FilterBadgeButton activeCount={0} onPress={jest.fn()} />,
    );

    expect(getByTestId("history-filter-button-root")).toHaveStyle({
      overflow: "visible",
    });
    expect(queryByTestId("history-filter-badge")).toBeNull();
  });
});
