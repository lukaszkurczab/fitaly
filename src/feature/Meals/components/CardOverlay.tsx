import type { ViewStyle } from "react-native";
import type { ReactElement } from "react";
import { useTheme } from "@/theme/useTheme";
import type { CardVariant } from "@/types/share";

import MacroSummaryCard from "./cardLayouts/MacroSummaryCard";
import MacroVerticalStackCard from "./cardLayouts/MacroVerticalStackCard";
import MacroSplitCard from "./cardLayouts/MacroSplitCard";
import MacroTagStripCard from "./cardLayouts/MacroTagStripCard";
import {
  OverlayShell,
  resolveOverlaySurface,
} from "./overlayPrimitives";

type MacroColors = {
  protein: string;
  carbs: string;
  fat: string;
};

type Props = {
  protein: number;
  fat: number;
  carbs: number;
  kcal: number;
  color?: string;
  backgroundColor?: string;
  variant?: CardVariant;
  showKcal?: boolean;
  showMacros?: boolean;
  macroColorsOverride?: Partial<MacroColors>;
  fontFamily?: string | null;
  fontWeight?: "300" | "500" | "700" | "normal" | "bold";
};

export type MacroCardProps = {
  protein: number;
  fat: number;
  carbs: number;
  kcal: number;
  textColor: string;
  bgColor: string;
  macroColors: {
    protein: string;
    carbs: string;
    fat: string;
  };
  macroSoftColors?: {
    protein: string;
    carbs: string;
    fat: string;
  };
  showKcal: boolean;
  showMacros: boolean;
  fontFamily?: string;
  fontWeight?: "300" | "500" | "700" | "normal" | "bold";
};

const CARD_RENDERERS: Record<CardVariant, (props: MacroCardProps) => ReactElement> =
  {
    macroSummaryCard: (props) => <MacroSummaryCard {...props} />,
    macroVerticalStackCard: (props) => <MacroVerticalStackCard {...props} />,
    macroSplitCard: (props) => <MacroSplitCard {...props} />,
    macroTagStripCard: (props) => <MacroTagStripCard {...props} />,
  };

const CARD_SHELL_STYLES: Record<CardVariant, ViewStyle> = {
  macroSummaryCard: {
    minWidth: 198,
    maxWidth: 236,
  },
  macroSplitCard: {
    minWidth: 224,
    maxWidth: 276,
  },
  macroTagStripCard: {
    minWidth: 276,
    maxWidth: 332,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
  },
  macroVerticalStackCard: {
    minWidth: 190,
    maxWidth: 232,
  },
};

export default function CardOverlay({
  protein,
  fat,
  carbs,
  kcal,
  color,
  backgroundColor,
  variant = "macroSummaryCard",
  showKcal = true,
  showMacros = true,
  macroColorsOverride,
  fontFamily,
  fontWeight,
}: Props) {
  const theme = useTheme();

  const textColor = color || theme.text;
  const surface = resolveOverlaySurface(theme, backgroundColor);
  const bg = surface.backgroundColor;

  const macroColors: MacroColors = {
    protein: macroColorsOverride?.protein || String(theme.macro.protein),
    carbs: macroColorsOverride?.carbs || String(theme.macro.carbs),
    fat: macroColorsOverride?.fat || String(theme.macro.fat),
  };

  const resolvedFontFamily = fontFamily ?? undefined;

  const baseProps: MacroCardProps = {
    protein,
    fat,
    carbs,
    kcal,
    textColor,
    bgColor: bg,
    macroColors,
    macroSoftColors: {
      protein: theme.macro.proteinSoft,
      carbs: theme.macro.carbsSoft,
      fat: theme.macro.fatSoft,
    },
    showKcal,
    showMacros,
    fontFamily: resolvedFontFamily,
    fontWeight,
  };

  const render = CARD_RENDERERS[variant] ?? CARD_RENDERERS.macroSummaryCard;
  const shellStyle = CARD_SHELL_STYLES[variant] ?? CARD_SHELL_STYLES.macroSummaryCard;

  return (
    <OverlayShell backgroundColor={backgroundColor} style={shellStyle}>
      {render(baseProps)}
    </OverlayShell>
  );
}
