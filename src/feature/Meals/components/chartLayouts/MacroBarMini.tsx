import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import {
  OverlayKcalBlock,
  withAlpha,
} from "../overlayPrimitives";

type Props = {
  protein: number;
  fat: number;
  carbs: number;
  kcal: number;
  chartMacroColors?: {
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  macroLabels?: {
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  macroColor?: {
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  showKcalLabel?: boolean;
  textColor?: string;
  fontFamily?: string;
  fontWeight?: "300" | "500" | "700" | "normal" | "bold";
  backgroundColor?: string;
};

export default function MacroBarMini({
  protein,
  fat,
  carbs,
  kcal,
  chartMacroColors,
  macroLabels,
  macroColor,
  showKcalLabel = true,
  textColor,
  fontFamily,
  fontWeight,
}: Props) {
  const theme = useTheme();
  const items = useMemo(
    () => [
      { key: "protein", label: macroLabels?.protein ?? "P", value: Math.max(0, protein) },
      { key: "carbs", label: macroLabels?.carbs ?? "C", value: Math.max(0, carbs) },
      { key: "fat", label: macroLabels?.fat ?? "F", value: Math.max(0, fat) },
    ],
    [protein, carbs, fat, macroLabels?.protein, macroLabels?.carbs, macroLabels?.fat]
  );

  const maxVal = Math.max(1, ...items.map((i) => i.value));

  const labelStyle = [
    styles.barLabel,
    {
      color: withAlpha(textColor || theme.text, 0.76),
      fontFamily: fontFamily ?? theme.typography.fontFamily.medium,
      fontWeight: fontWeight ?? "500",
    },
  ];

  const colors = {
    protein: chartMacroColors?.protein || macroColor?.protein || theme.macro.protein,
    carbs: chartMacroColors?.carbs || macroColor?.carbs || theme.macro.carbs,
    fat: chartMacroColors?.fat || macroColor?.fat || theme.macro.fat,
  };

  return (
    <View style={styles.wrap}>
      {showKcalLabel && (
        <OverlayKcalBlock
          kcal={kcal}
          textColor={textColor || theme.text}
          fontFamily={fontFamily}
          fontWeight={fontWeight ?? "700"}
          align="center"
          tone="title"
        />
      )}
      <View style={styles.chartRow}>
        {items.map((item) => (
          <View key={item.key} style={styles.barCol}>
            <View
              style={[
                styles.barTrack,
                {
                  backgroundColor: withAlpha(theme.overlay, theme.isDark ? 0.5 : 0.16),
                  borderColor: withAlpha(theme.borderSoft, theme.isDark ? 0.56 : 0.32),
                },
              ]}
            >
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: colors[item.key as keyof typeof colors],
                    height:
                      item.value <= 0
                        ? 0
                        : `${Math.max((item.value / maxVal) * 100, 16)}%`,
                  },
                ]}
              />
            </View>
            <Text style={labelStyle}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    width: "100%",
    minHeight: 94,
    gap: 8,
    marginTop: 8,
  },
  barCol: {
    alignItems: "center",
    width: 42,
  },
  barTrack: {
    width: 24,
    height: 74,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 14,
  },
});
