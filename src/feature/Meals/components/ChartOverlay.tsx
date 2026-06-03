import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ReactElement } from "react";
import type { ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { ChartVariant } from "@/types/share";
import { useTheme } from "@/theme/useTheme";

import MacroPieChart from "./chartLayouts/MacroPieChart";
import DonutMacroChart from "./chartLayouts/DonutMacroChart";
import MacroBarMini from "./chartLayouts/MacroBarMini";
import MacroPolarAreaChart from "./chartLayouts/MacroPolarAreaChart";
import GaugeMacroChart from "./chartLayouts/GaugeMacroChart";
import {
  OverlayShell,
  resolveOverlaySurface,
} from "./overlayPrimitives";

type Palette = {
  macro: {
    protein: string;
    carbs: string;
    fat: string;
  };
  accent: string;
  accentSecondary: string;
  text: string;
};

type Props = {
  variant: ChartVariant;
  protein: number;
  fat: number;
  carbs: number;
  kcal: number;
  palette: Palette;
  showKcalLabel?: boolean;
  showLegend?: boolean;
  barColor?: string | null;
  lineColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  fontWeight?: "300" | "500" | "700" | null;
  macroColors?: {
    protein?: string;
    carbs?: string;
    fat?: string;
  } | null;
  backgroundColor?: string | null;
};

type PieDatum = {
  value: number;
  color: string;
  label: string;
  shortLabel?: string;
};

type ChartRendererProps = {
  data: PieDatum[];
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  showKcalLabel: boolean;
  showLegend: boolean;
  textColor: string;
  fontFamily?: string;
  fontWeight?: "300" | "500" | "700" | "normal" | "bold";
  backgroundColor?: string;
  macroLabels: {
    protein: string;
    carbs: string;
    fat: string;
  };
};

type ChartRenderer = (props: ChartRendererProps) => ReactElement;

const CHART_SHELL_STYLES: Record<ChartVariant, ViewStyle> = {
  macroBarMini: {
    minWidth: 190,
    maxWidth: 228,
  },
  macroDonut: {
    minWidth: 194,
    maxWidth: 232,
  },
  macroPieWithLegend: {
    minWidth: 188,
    maxWidth: 224,
  },
  macroGauge: {
    minWidth: 206,
    maxWidth: 246,
  },
  macroPolarArea: {
    minWidth: 198,
    maxWidth: 234,
  },
};

const CHART_RENDERERS: Record<ChartVariant, ChartRenderer> = {
  macroDonut: (props) => (
    <DonutMacroChart
      data={props.data}
      kcal={props.kcal}
      showKcalLabel={props.showKcalLabel}
      showLegend={props.showLegend}
      textColor={props.textColor}
      fontFamily={props.fontFamily}
      fontWeight={props.fontWeight}
      backgroundColor={props.backgroundColor}
    />
  ),
  macroBarMini: (props) => (
    <MacroBarMini
      protein={props.protein}
      fat={props.fat}
      carbs={props.carbs}
      kcal={props.kcal}
      showKcalLabel={props.showKcalLabel}
      textColor={props.textColor}
      fontFamily={props.fontFamily}
      fontWeight={props.fontWeight}
      chartMacroColors={{
        protein: props.data[0]?.color,
        fat: props.data[1]?.color,
        carbs: props.data[2]?.color,
      }}
      macroLabels={props.macroLabels}
      backgroundColor={props.backgroundColor}
    />
  ),
  macroPolarArea: (props) => (
    <MacroPolarAreaChart
      data={props.data}
      kcal={props.kcal}
      showKcalLabel={props.showKcalLabel}
      showLegend={props.showLegend}
      textColor={props.textColor}
      fontFamily={props.fontFamily}
      fontWeight={props.fontWeight}
      backgroundColor={props.backgroundColor}
    />
  ),
  macroGauge: (props) => (
    <GaugeMacroChart
      data={props.data}
      kcal={props.kcal}
      showLabel={props.showKcalLabel}
      showLegend={props.showLegend}
      textColor={props.textColor}
      fontFamily={props.fontFamily}
      fontWeight={props.fontWeight}
      backgroundColor={props.backgroundColor}
    />
  ),
  macroPieWithLegend: (props) => (
    <MacroPieChart
      data={props.data}
      kcal={props.kcal}
      showKcalLabel={props.showKcalLabel}
      showLegend={props.showLegend}
      textColor={props.textColor}
      fontFamily={props.fontFamily}
      fontWeight={props.fontWeight}
      backgroundColor={props.backgroundColor}
    />
  ),
};

export default function ChartOverlay({
  variant,
  protein,
  fat,
  carbs,
  kcal,
  palette,
  showKcalLabel = true,
  showLegend = true,
  textColor,
  fontFamily,
  fontWeight,
  macroColors,
  backgroundColor,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["meals"]);

  const proteinColor = macroColors?.protein ?? palette.macro.protein;
  const fatColor = macroColors?.fat ?? palette.macro.fat;
  const carbsColor = macroColors?.carbs ?? palette.macro.carbs;

  const pieData: PieDatum[] = useMemo(
    () => [
      {
        value: Math.max(0, protein),
        color: proteinColor,
        label: t("protein"),
        shortLabel: t("protein_short"),
      },
      {
        value: Math.max(0, fat),
        color: fatColor,
        label: t("fat"),
        shortLabel: t("fat_short"),
      },
      {
        value: Math.max(0, carbs),
        color: carbsColor,
        label: t("carbs"),
        shortLabel: t("carbs_short"),
      },
    ],
    [protein, fat, carbs, proteinColor, fatColor, carbsColor, t]
  );

  const sharedTextColor = textColor || palette.text;
  const sharedFontFamily = fontFamily || undefined;
  const sharedFontWeight = (fontWeight || "700") as
    | "300"
    | "500"
    | "700"
    | "normal"
    | "bold";
  const chartBackground = resolveOverlaySurface(
    theme,
    backgroundColor ?? undefined
  ).backgroundColor;

  const renderChart =
    CHART_RENDERERS[variant] ?? CHART_RENDERERS.macroPieWithLegend;
  const shellStyle =
    CHART_SHELL_STYLES[variant] ?? CHART_SHELL_STYLES.macroPieWithLegend;
  const content = renderChart({
    data: pieData,
    kcal,
    protein,
    fat,
    carbs,
    showKcalLabel,
    showLegend,
    textColor: sharedTextColor,
    fontFamily: sharedFontFamily,
    fontWeight: sharedFontWeight,
    backgroundColor: chartBackground,
    macroLabels: {
      protein: t("protein_short"),
      carbs: t("carbs_short"),
      fat: t("fat_short"),
    },
  });

  return (
    <OverlayShell backgroundColor={chartBackground} style={[styles.card, shellStyle]}>
      {content}
    </OverlayShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
  });
