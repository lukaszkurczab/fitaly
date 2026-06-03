import type { ReactNode } from "react";
import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { FilterPanel } from "@/feature/History/components/FilterPanel";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

type Filters = {
  calories?: [number, number];
  protein?: [number, number];
  carbs?: [number, number];
  fat?: [number, number];
  dateRange?: { start: Date; end: Date };
};

type RangeSliderProps = {
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  children?: ReactNode;
};

type DateRangePickerProps = {
  onOpen: () => void;
};

type CalendarProps = {
  onChangeRange: (range: { start: Date; end: Date }) => void;
};

const mockUseFilters = jest.fn();
const mockRangeSlider = jest.fn<(props: RangeSliderProps) => null>(() => null);

jest.mock("@/context/HistoryContext", () => ({
  useFilters: () => mockUseFilters(),
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    RangeSlider: (props: RangeSliderProps) => {
      mockRangeSlider(props);
      return createElement(Text, null, `range:${props.label}`);
    },
    Button: ({ label, onPress, disabled, testID }: ButtonProps) =>
      createElement(
        Pressable,
        { onPress, disabled, testID, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
  };
});

jest.mock("@/components/DateRangePicker", () => ({
  DateRangePicker: ({ onOpen }: DateRangePickerProps) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      Pressable,
      { onPress: onOpen, accessibilityRole: "button" },
      createElement(Text, null, "date-range-picker"),
    );
  },
}));

jest.mock("@/components/Calendar", () => ({
  Calendar: ({ onChangeRange }: CalendarProps) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      Pressable,
      {
        onPress: () =>
          onChangeRange({
            start: new Date(2026, 0, 20),
            end: new Date(2026, 0, 19),
          }),
      },
      createElement(Text, null, "calendar-pick"),
    );
  },
}));

jest.mock("@/components/Modal", () => ({
  Modal: ({
    visible,
    children,
    primaryAction,
    secondaryAction,
    title,
  }: {
    visible: boolean;
    children?: ReactNode;
    title?: string;
    primaryAction?: { label: string; onPress?: () => void };
    secondaryAction?: { label: string; onPress?: () => void };
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    if (!visible) return null;

    return createElement(
      View,
      null,
      title ? createElement(Text, null, title) : null,
      children,
      primaryAction
        ? createElement(
            Pressable,
            { onPress: primaryAction.onPress },
            createElement(Text, null, primaryAction.label),
          )
        : null,
      secondaryAction
        ? createElement(
            Pressable,
            { onPress: secondaryAction.onPress },
            createElement(Text, null, secondaryAction.label),
          )
        : null,
    );
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) =>
      options?.ns ? `${options.ns}:${key}` : key,
    i18n: { language: "en" },
  }),
}));

describe("FilterPanel", () => {
  let mockApplyFilters: ReturnType<typeof jest.fn<(f: Filters) => void>>;
  let mockClearFilters: ReturnType<typeof jest.fn<() => void>>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-10T09:00:00.000Z"));
    mockRangeSlider.mockClear();
    mockApplyFilters = jest.fn<(f: Filters) => void>();
    mockClearFilters = jest.fn<() => void>();
    mockUseFilters.mockReturnValue({
      query: "",
      filters: null,
      applyFilters: mockApplyFilters,
      clearFilters: mockClearFilters,
      setShowFilters: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows empty state and clears filters from cancel action", () => {
    const { getByText } = renderWithTheme(<FilterPanel scope="history" />);

    expect(getByText("history:sheetTitle")).toBeTruthy();
    fireEvent.press(getByText("history:actions.reset"));
    expect(mockClearFilters).toHaveBeenCalledTimes(1);
  });

  it("applies calorie preset payload", () => {
    const { getByText } = renderWithTheme(<FilterPanel scope="history" />);

    fireEvent.press(getByText("history:presets.under300"));
    fireEvent.press(getByText("history:actions.showResults"));
    expect(mockApplyFilters).toHaveBeenCalledWith({
      calories: [0, 300],
    });
  });

  it("keeps macro filters directly available without the old more-filters modal", () => {
    const { getByText, queryByText } = renderWithTheme(
      <FilterPanel scope="history" />,
    );

    expect(getByText("history:nutritionRangesTitle")).toBeTruthy();
    expect(getByText("history:filters.protein")).toBeTruthy();
    expect(getByText("history:filters.carbs")).toBeTruthy();
    expect(getByText("history:filters.fat")).toBeTruthy();
    expect(queryByText("history:actions.moreFilters")).toBeNull();

    fireEvent.press(getByText("history:filters.protein"));

    expect(getByText("range:history:filters.protein")).toBeTruthy();
    fireEvent.press(getByText("history:actions.showResults"));
    expect(mockApplyFilters).toHaveBeenCalledWith({
      protein: [0, 100],
    });
  });

  it("normalizes date range when end date is earlier than start date", () => {
    const { getAllByText, getByText } = renderWithTheme(
      <FilterPanel scope="history" />,
    );

    fireEvent.press(getAllByText("history:presets.custom")[0]);
    fireEvent.press(getByText("calendar-pick"));
    fireEvent.press(getByText("history:actions.save"));
    fireEvent.press(getByText("history:actions.showResults"));

    const payload = mockApplyFilters.mock.calls[0][0];
    const start = payload.dateRange?.start;
    const end = payload.dateRange?.end;

    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    expect(start!.getDate()).toBe(19);
    expect(end!.getDate()).toBe(20);
  });

  it("clamps custom date range to the free 30-day window", () => {
    const { getAllByText, getByText } = renderWithTheme(
      <FilterPanel scope="history" isPremium={false} windowDays={30} />,
    );

    fireEvent.press(getAllByText("history:presets.custom")[0]);
    fireEvent.press(getByText("calendar-pick"));
    fireEvent.press(getByText("history:actions.save"));
    fireEvent.press(getByText("history:actions.showResults"));

    const payload = mockApplyFilters.mock.calls[0][0];
    const start = payload.dateRange?.start;
    const end = payload.dateRange?.end;

    expect(start?.getFullYear()).toBe(2026);
    expect(start?.getMonth()).toBe(1);
    expect(start?.getDate()).toBe(9);
    expect(start?.getHours()).toBe(0);
    expect(start?.getMinutes()).toBe(0);
    expect(end?.getFullYear()).toBe(2026);
    expect(end?.getMonth()).toBe(1);
    expect(end?.getDate()).toBe(9);
    expect(end?.getHours()).toBe(23);
    expect(end?.getMinutes()).toBe(59);
  });

  it("keeps premium custom date range unchanged", () => {
    const { getAllByText, getByText } = renderWithTheme(
      <FilterPanel scope="history" isPremium windowDays={30} />,
    );

    fireEvent.press(getAllByText("history:presets.custom")[0]);
    fireEvent.press(getByText("calendar-pick"));
    fireEvent.press(getByText("history:actions.save"));
    fireEvent.press(getByText("history:actions.showResults"));

    const payload = mockApplyFilters.mock.calls[0][0];
    const start = payload.dateRange?.start;
    const end = payload.dateRange?.end;

    expect(start?.getDate()).toBe(19);
    expect(end?.getDate()).toBe(20);
  });
});
