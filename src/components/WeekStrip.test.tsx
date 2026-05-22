import { fireEvent } from "@testing-library/react-native";
import { TouchableOpacity } from "react-native";
import { describe, expect, it, jest } from "@jest/globals";
import WeekStrip from "@/components/WeekStrip";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

let mockLanguage: string | undefined = "en-US";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `translated:${key}`,
    i18n: { language: mockLanguage },
  }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

describe("WeekStrip", () => {
  it("selects day", () => {
    const onSelect = jest.fn();
    const days = [
      { date: new Date(2026, 0, 1), label: "M", isToday: false },
      { date: new Date(2026, 0, 2), label: "T", isToday: false },
      { date: new Date(2026, 0, 3), label: "W", isToday: true },
    ];

    const { getByText } = renderWithTheme(
      <WeekStrip
        days={days}
        selectedDate={days[0].date}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(getByText("W"));
    expect(onSelect).toHaveBeenCalledWith(days[2].date);
  });

  it("falls back to formatted weekday labels", () => {
    mockLanguage = undefined;
    const onSelect = jest.fn();
    const days = [
      { date: new Date(2026, 0, 4), label: "04", isToday: false },
      { date: new Date(2026, 0, 5), isToday: false },
    ];
    const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
    });
    const expectedLabel = weekdayFormatter
      .format(days[1].date)
      .replace(".", "");

    const { getByLabelText } = renderWithTheme(
      <WeekStrip
        days={days}
        selectedDate={days[0].date}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(getByLabelText(`${expectedLabel} 05`));

    expect(onSelect).toHaveBeenCalledWith(days[1].date);

    mockLanguage = "en-US";
  });

  it("uses a calm touch opacity for day cells", () => {
    const days = [{ date: new Date(2026, 0, 1), label: "M", isToday: false }];
    const { UNSAFE_getByType } = renderWithTheme(
      <WeekStrip
        days={days}
        selectedDate={days[0].date}
        onSelect={() => undefined}
      />,
    );

    expect(UNSAFE_getByType(TouchableOpacity).props.activeOpacity).toBe(0.92);
  });

  it("does not request native non-touch focus for day cells", () => {
    const days = [{ date: new Date(2026, 0, 1), label: "M", isToday: false }];
    const { getByLabelText } = renderWithTheme(
      <WeekStrip
        days={days}
        selectedDate={days[0].date}
        onSelect={() => undefined}
      />,
    );

    expect(getByLabelText("M 01").props.focusable).toBe(false);
  });
});
