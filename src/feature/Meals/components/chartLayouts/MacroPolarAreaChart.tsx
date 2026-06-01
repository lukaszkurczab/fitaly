import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useTheme } from "@/theme/useTheme";
import {
  OverlayKcalBlock,
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

const SIZE = 140;
const CENTER = SIZE / 2;
const CHART_PADDING = 16;
const LEVELS = 3;
const MIN_RADIUS_RATIO = 0.34;
const MAX_RADIUS = CENTER - CHART_PADDING;

const degToRad = (deg: number) => (deg * Math.PI) / 180;

function buildPolarSlicePath(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const startAngle = degToRad(startAngleDeg);
  const endAngle = degToRad(endAngleDeg);

  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

  return [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`, "Z"].join(" ");
}

export default function MacroPolarAreaChart({
  data,
  kcal,
  showKcalLabel = true,
  showLegend = true,
  textColor,
  fontFamily,
  fontWeight = "700",
}: Props) {
  const theme = useTheme();
  const safeData = (data || []).map((item) => ({
    ...item,
    value: Math.max(0, item.value),
  }));

  const hasData = safeData.length > 0;
  const hasPositive = safeData.some((item) => item.value > 0);
  const normalized = hasData
    ? hasPositive
      ? safeData
      : safeData.map((item) => ({ ...item, value: 1 }))
    : [];
  const maxValue = Math.max(1, ...normalized.map((item) => item.value));
  const angleStep = normalized.length > 0 ? 360 / normalized.length : 120;
  const startAngle = -90;
  const guideRadii = Array.from(
    { length: LEVELS },
    (_, index) => (MAX_RADIUS / LEVELS) * (index + 1)
  );

  return (
    <View style={styles.wrap}>
      {hasData ? (
        <View style={styles.chartContainer}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {guideRadii.map((radius, index) => (
              <Circle
                key={`grid-${index}`}
                cx={CENTER}
                cy={CENTER}
                r={radius}
                stroke={withAlpha(theme.borderSoft, theme.isDark ? 0.3 : 0.2)}
                strokeWidth={1}
                fill="none"
              />
            ))}

            {normalized.map((item, index) => {
              const ratio = item.value / maxValue;
              const radius =
                MAX_RADIUS *
                (MIN_RADIUS_RATIO + (1 - MIN_RADIUS_RATIO) * ratio);
              const sliceStart = startAngle + index * angleStep;
              const sliceEnd = sliceStart + angleStep;
              const path = buildPolarSlicePath(
                CENTER,
                CENTER,
                radius,
                sliceStart,
                sliceEnd
              );

              return (
                <Path
                  key={`${item.label}-${index}`}
                  d={path}
                  fill={withAlpha(item.color, theme.isDark ? 0.38 : 0.26)}
                  stroke={withAlpha(item.color, 0.84)}
                  strokeWidth={1.2}
                />
              );
            })}

            {normalized.map((_, index) => {
              const angleRad = degToRad(startAngle + index * angleStep);
              const axisX = CENTER + MAX_RADIUS * Math.cos(angleRad);
              const axisY = CENTER + MAX_RADIUS * Math.sin(angleRad);

              return (
                <Line
                  key={`axis-${index}`}
                  x1={CENTER}
                  y1={CENTER}
                  x2={axisX}
                  y2={axisY}
                  stroke={withAlpha(theme.borderSoft, theme.isDark ? 0.36 : 0.22)}
                  strokeWidth={1}
                />
              );
            })}

            <Circle
              cx={CENTER}
              cy={CENTER}
              r={8}
              fill={withAlpha(theme.surfaceElevated, theme.isDark ? 0.82 : 0.92)}
              stroke={withAlpha(theme.borderSoft, theme.isDark ? 0.54 : 0.36)}
              strokeWidth={1}
            />
          </Svg>
        </View>
      ) : null}

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

      {showLegend && hasData ? (
        <View style={styles.legendRow}>
          {safeData.map((item, index) => (
            <View key={item.label} style={styles.legendItem}>
              <Text
                style={[
                  styles.legendLabel,
                  {
                    color: item.color,
                    fontFamily: fontFamily ?? theme.typography.fontFamily.medium,
                    fontWeight: fontWeight ?? "500",
                  },
                ]}
              >
                {item.shortLabel ?? String(item.label).charAt(0).toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.legendValue,
                  {
                    color: withAlpha(textColor || theme.text, 0.74),
                    fontFamily: fontFamily ?? theme.typography.fontFamily.medium,
                    fontWeight: fontWeight ?? "500",
                  },
                ]}
              >
                {Math.round(item.value)}g
              </Text>
              {index < safeData.length - 1 ? (
                <Text
                  style={[
                    styles.legendSeparator,
                    { color: withAlpha(textColor || theme.text, 0.38) },
                  ]}
                >
                  •
                </Text>
              ) : null}
            </View>
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
  chartContainer: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  legendRow: {
    marginTop: 6,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 1,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  legendLabel: {
    fontSize: 11,
    lineHeight: 13,
    includeFontPadding: false,
  },
  legendValue: {
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
  },
  legendSeparator: {
    marginLeft: 4,
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
  },
});
