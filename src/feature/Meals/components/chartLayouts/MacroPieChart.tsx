import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/theme/useTheme";
import {
  OverlayKcalBlock,
  OverlayMacroLegendItem,
  withAlpha,
} from "../overlayPrimitives";

type PieDatum = {
  value: number;
  color: string;
  label: string;
  shortLabel?: string;
};

type Props = {
  data: PieDatum[];
  kcal: number;
  showKcalLabel?: boolean;
  showLegend?: boolean;
  textColor?: string;
  fontFamily?: string;
  fontWeight?: "300" | "500" | "700" | "normal" | "bold";
  backgroundColor?: string;
};

const SIZE = 112;
const RADIUS = SIZE / 2;

const degToRad = (deg: number) => (deg * Math.PI) / 180;

function buildSlicePath(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const start = degToRad(startAngleDeg);
  const end = degToRad(endAngleDeg);

  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    "Z",
  ].join(" ");
}

export default function MacroPieChart({
  data,
  kcal,
  showKcalLabel = true,
  showLegend = true,
  textColor,
  fontFamily,
  fontWeight = "700",
}: Props) {
  const theme = useTheme();
  const safeData = (data || []).map((d) => ({
    ...d,
    value: Math.max(0, d.value),
  }));

  const total = safeData.reduce((sum, item) => sum + item.value, 0);
  const hasPositive = total > 0;
  const slices = hasPositive
    ? (() => {
        let startAngle = -90;
        return safeData.map((item, index) => {
          if (item.value <= 0) {
            return null;
          }

          const sweep = (item.value / total) * 360;
          const endAngle = startAngle + sweep;
          const path = buildSlicePath(RADIUS, RADIUS, RADIUS, startAngle, endAngle);
          startAngle = endAngle;
          return <Path key={`${item.label}-${index}`} d={path} fill={item.color} />;
        });
      })()
    : [];

  return (
    <View style={styles.wrap}>
      {showKcalLabel ? (
        <OverlayKcalBlock
          kcal={kcal}
          textColor={textColor || theme.text}
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          align="center"
          tone="compact"
        />
      ) : null}

      {hasPositive ? (
        <View style={styles.chartWrap}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {slices}
          </Svg>
          <View
            style={[
              styles.chartStroke,
              {
                borderColor: withAlpha(theme.borderSoft, theme.isDark ? 0.44 : 0.24),
              },
            ]}
          />
        </View>
      ) : (
        <Text
          style={[
            styles.emptyLabel,
            {
              color: withAlpha(textColor || theme.text, 0.72),
              fontFamily: fontFamily ?? theme.typography.fontFamily.medium,
            },
          ]}
        >
          No macro data
        </Text>
      )}

      {showLegend && hasPositive ? (
        <View style={styles.legendRow}>
          {safeData.map((item) => (
            <OverlayMacroLegendItem
              key={item.label}
              label={item.shortLabel ?? String(item.label).charAt(0).toUpperCase()}
              value={total > 0 ? (item.value / total) * 100 : 0}
              valueSuffix="%"
              color={item.color}
              textColor={textColor || theme.text}
              fontFamily={fontFamily}
              fontWeight={fontWeight}
              compact
              align="center"
              markerMode="none"
              labelColor={withAlpha(item.color, 0.9)}
              valueColor={withAlpha(textColor || theme.text, 0.7)}
              style={styles.legendItem}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
  },
  chartWrap: {
    width: SIZE,
    height: SIZE,
    marginTop: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  chartStroke: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    borderWidth: 1,
  },
  legendRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: "100%",
  },
  legendItem: {
    minWidth: 48,
  },
  emptyLabel: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
  },
});
