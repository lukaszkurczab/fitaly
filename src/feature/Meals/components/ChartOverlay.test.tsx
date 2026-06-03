import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import ChartOverlay from "@/feature/Meals/components/ChartOverlay";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockPieChart = jest.fn<(props: unknown) => null>(() => null);
const mockDonutChart = jest.fn<(props: unknown) => null>(() => null);
const mockBarMini = jest.fn<(props: unknown) => null>(() => null);
const mockPolarAreaChart = jest.fn<(props: unknown) => null>(() => null);
const mockGaugeChart = jest.fn<(props: unknown) => null>(() => null);

jest.mock("./chartLayouts/MacroPieChart", () => ({
  __esModule: true,
  default: (props: unknown) => mockPieChart(props),
}));
jest.mock("./chartLayouts/DonutMacroChart", () => ({
  __esModule: true,
  default: (props: unknown) => mockDonutChart(props),
}));
jest.mock("./chartLayouts/MacroBarMini", () => ({
  __esModule: true,
  default: (props: unknown) => mockBarMini(props),
}));
jest.mock("./chartLayouts/MacroPolarAreaChart", () => ({
  __esModule: true,
  default: (props: unknown) => mockPolarAreaChart(props),
}));
jest.mock("./chartLayouts/GaugeMacroChart", () => ({
  __esModule: true,
  default: (props: unknown) => mockGaugeChart(props),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const palette = {
  macro: { protein: "#11f", carbs: "#1f1", fat: "#f11" },
  accent: "#fa0",
  accentSecondary: "#0af",
  text: "#111",
};

describe("ChartOverlay", () => {
  beforeEach(() => {
    mockPieChart.mockClear();
    mockDonutChart.mockClear();
    mockBarMini.mockClear();
    mockPolarAreaChart.mockClear();
    mockGaugeChart.mockClear();
  });

  it("renders pie variant and normalizes negative values to zero", () => {
    renderWithTheme(
      <ChartOverlay
        variant="macroPieWithLegend"
        protein={-2}
        fat={12}
        carbs={40}
        kcal={430}
        palette={palette}
      />,
    );

    expect(mockPieChart).toHaveBeenCalledWith(
      expect.objectContaining({
        kcal: 430,
        showKcalLabel: true,
        showLegend: true,
        textColor: "#111",
        fontWeight: "700",
        data: [
          { value: 0, color: "#11f", label: "protein", shortLabel: "protein_short" },
          { value: 12, color: "#f11", label: "fat", shortLabel: "fat_short" },
          { value: 40, color: "#1f1", label: "carbs", shortLabel: "carbs_short" },
        ],
      }),
    );
    expect(mockGaugeChart).not.toHaveBeenCalled();
  });

  it("routes to gauge variant and passes visual overrides", () => {
    renderWithTheme(
      <ChartOverlay
        variant="macroGauge"
        protein={22}
        fat={9}
        carbs={31}
        kcal={280}
        palette={palette}
        showKcalLabel={false}
        textColor="#fff"
        fontFamily="MockFont"
        fontWeight="500"
        macroColors={{ protein: "#0f0", carbs: "#00f", fat: "#f00" }}
        backgroundColor="#222"
      />,
    );

    expect(mockGaugeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        kcal: 280,
        showLabel: false,
        textColor: "#fff",
        fontFamily: "MockFont",
        fontWeight: "500",
        backgroundColor: "#222",
        data: [
          { value: 22, color: "#0f0", label: "protein", shortLabel: "protein_short" },
          { value: 9, color: "#f00", label: "fat", shortLabel: "fat_short" },
          { value: 31, color: "#00f", label: "carbs", shortLabel: "carbs_short" },
        ],
      }),
    );
    expect(mockPieChart).not.toHaveBeenCalled();
  });
});
