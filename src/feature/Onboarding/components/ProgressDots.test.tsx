import { describe, expect, it } from "@jest/globals";
import ProgressDots from "@/feature/Onboarding/components/ProgressDots";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

describe("Onboarding ProgressDots", () => {
  it("renders exactly total number of progress segments with progress semantics", () => {
    const { getAllByTestId, getByTestId, getByText } = renderWithTheme(
      <ProgressDots step={2} total={5} label="Step 2 of 5" />,
    );

    const track = getByTestId("onboarding-progress-track");

    expect(getByText("Step 2 of 5")).toBeTruthy();
    expect(getAllByTestId("onboarding-progress-segment")).toHaveLength(5);
    expect(track.props.accessibilityRole).toBe("progressbar");
    expect(track.props.accessibilityValue).toEqual({
      min: 1,
      max: 5,
      now: 2,
    });
  });

  it("renders no segments when total is zero", () => {
    const { getByTestId, queryAllByTestId } = renderWithTheme(
      <ProgressDots step={1} total={0} />,
    );

    expect(queryAllByTestId("onboarding-progress-segment")).toHaveLength(0);
    expect(getByTestId("onboarding-progress-track").props.accessibilityValue).toEqual({
      min: 0,
      max: 0,
      now: 0,
    });
  });
});
