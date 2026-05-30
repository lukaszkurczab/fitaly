import { describe, expect, it, jest } from "@jest/globals";
import { EmptyState } from "@/feature/History/components/EmptyState";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

describe("History EmptyState", () => {
  it("renders title and description", () => {
    const { getByTestId, getByText } = renderWithTheme(
      <EmptyState title="No meals" description="Add your first meal" />,
    );

    expect(getByText("No meals")).toBeTruthy();
    expect(getByText("Add your first meal")).toBeTruthy();
    expect(getByTestId("history-empty-archive-graphic")).toBeTruthy();
    expect(getByTestId("history-empty-archive-image")).toBeTruthy();
  });

  it("hides description when it is not provided", () => {
    const { getByText, queryByText } = renderWithTheme(
      <EmptyState title="No meals" />,
    );

    expect(getByText("No meals")).toBeTruthy();
    expect(queryByText("Add your first meal")).toBeNull();
  });

  it("uses the compact treatment for no-results states", () => {
    const { getByTestId, getByText, queryByTestId } = renderWithTheme(
      <EmptyState
        variant="compact"
        title="Nothing matches"
        description="Change filters"
      />,
    );

    expect(getByText("Nothing matches")).toBeTruthy();
    expect(getByText("Change filters")).toBeTruthy();
    expect(getByTestId("history-empty-compact-accent")).toBeTruthy();
    expect(queryByTestId("history-empty-archive-graphic")).toBeNull();
  });
});
