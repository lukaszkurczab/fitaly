import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/theme/useTheme";
import {
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
  innerRadiusRatio?: number;
  textColor?: string;
  fontFamily?: string;
  fontWeight?: "300" | "500" | "700" | "normal" | "bold";
  backgroundColor?: string;
};

const SIZE = 134;
const OUTER_RADIUS = SIZE / 2;
const MIN_SHARE = 0.08;

const degToRad = (deg: number) => (deg * Math.PI) / 180;

function buildDonutSlicePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const start = degToRad(startAngleDeg);
  const end = degToRad(endAngleDeg);

  const x1 = cx + outerR * Math.cos(start);
  const y1 = cy + outerR * Math.sin(start);
  const x2 = cx + outerR * Math.cos(end);
  const y2 = cy + outerR * Math.sin(end);

  const x3 = cx + innerR * Math.cos(end);
  const y3 = cy + innerR * Math.sin(end);
  const x4 = cx + innerR * Math.cos(start);
  const y4 = cy + innerR * Math.sin(start);

  const angleDelta = endAngleDeg - startAngleDeg;
  const largeArcFlag = angleDelta > 180 ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

function normalizeShares(values: number[]): number[] {
  const safe = values.map((v) => Math.max(0, v));
  const positives = safe.filter((v) => v > 0);

  if (positives.length === 0) {
    const equalShare = 1 / (safe.length || 1);
    return safe.map(() => equalShare);
  }

  const sum = positives.reduce((s, v) => s + v, 0);
  if (sum <= 0) {
    const equalShare = 1 / positives.length;
    return safe.map((v) => (v > 0 ? equalShare : 0));
  }

  const rawShares = safe.map((v) => (v > 0 ? v / sum : 0));
  const baseShares = rawShares.map((s) => (s > 0 ? Math.max(s, MIN_SHARE) : 0));
  const baseSum = baseShares.reduce((s, v) => s + v, 0);

  if (baseSum <= 0) {
    const equalShare = 1 / positives.length;
    return safe.map((v) => (v > 0 ? equalShare : 0));
  }

  return baseShares.map((s) => (s > 0 ? s / baseSum : 0));
}

export default function DonutMacroChart({
  data,
  kcal,
  showKcalLabel = true,
  showLegend = false,
  innerRadiusRatio,
  textColor,
  fontFamily,
  fontWeight = "700",
}: Props) {
  const theme = useTheme();
  const safeData: PieDatum[] = (data || []).map((d) => ({
    ...d,
    value: Math.max(0, d.value),
  }));

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  if (!safeData.length) {
    return (
      <View style={styles.wrap}>
        {showKcalLabel && (
          <Text style={[styles.kcalText, { color: textColor || theme.text, fontFamily }]}>
            {Math.round(kcal)} kcal
          </Text>
        )}
      </View>
    );
  }

  const values = safeData.map((d) => d.value);
  const shares = normalizeShares(values);

  const ratioRaw =
    typeof innerRadiusRatio === "number" ? innerRadiusRatio : 0.7;
  const ratio = Math.min(Math.max(ratioRaw, 0.62), 0.84);
  const innerR = OUTER_RADIUS * ratio;

  let currentAngle = -90;
  const slices = safeData.map((d, index) => {
    const share = shares[index];
    if (share <= 0) {
      return null;
    }

    let angle = 360 * share;
    if (angle >= 360) {
      angle = 359.999;
    }

    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const path = buildDonutSlicePath(
      cx,
      cy,
      innerR,
      OUTER_RADIUS,
      startAngle,
      endAngle
    );

    return <Path key={`${d.label}-${index}`} d={path} fill={d.color} />;
  });

  const textStyleBig = [
    styles.kcalBig,
    { color: textColor || theme.text, fontFamily, fontWeight },
  ];
  const textStyleSmall = [
    styles.kcalSmall,
    {
      color: withAlpha(textColor || theme.text, 0.72),
      fontFamily: fontFamily ?? theme.typography.fontFamily.medium,
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.chartContainer}>
        <View
          style={[
            styles.ringTrack,
            {
              borderColor: withAlpha(theme.borderSoft, theme.isDark ? 0.58 : 0.4),
            },
          ]}
        />
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {slices}
        </Svg>
        {showKcalLabel && (
          <View style={styles.centerLabel}>
            <Text style={textStyleBig}>{kcal}</Text>
            <Text style={textStyleSmall}>kcal</Text>
          </View>
        )}
      </View>

      {showLegend && (
        <View style={styles.legendRow}>
          {safeData.map((d, index) => (
            <View key={d.label} style={styles.legendItem}>
              <OverlayMacroLegendItem
                label={d.shortLabel ?? String(d.label).charAt(0).toUpperCase()}
                value={d.value}
                color={d.color}
                textColor={textColor || theme.text}
                fontFamily={fontFamily}
                fontWeight={fontWeight}
                compact
                align="center"
                markerMode="none"
                labelColor={d.color}
                valueColor={withAlpha(textColor || theme.text, 0.72)}
                style={index > 0 ? styles.legendItemShift : undefined}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
  },
  chartContainer: {
    width: SIZE,
    height: SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  ringTrack: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: OUTER_RADIUS,
    borderWidth: 1,
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  kcalBig: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  kcalSmall: {
    fontSize: 11,
    lineHeight: 14,
  },
  kcalText: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  legendRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  legendItem: {
    minWidth: 50,
    alignItems: "center",
  },
  legendItemShift: {
    marginLeft: 3,
  },
});
