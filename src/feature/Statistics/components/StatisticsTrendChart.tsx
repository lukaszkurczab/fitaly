import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Line, Path, Svg } from "react-native-svg";
import { useTheme } from "@/theme/useTheme";

type Props = {
  data: number[];
  labels: string[];
  color: string;
  softColor: string;
  targetValue?: number | null;
};

type Point = {
  x: number;
  y: number;
};

const CHART_HEIGHT = 88;
const LABEL_ROW_HEIGHT = 14;
const Y_AXIS_WIDTH = 42;
const TARGET_AXIS_INTERVAL_COUNT = 4;
const CURVE_TENSION = 0.65;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const buildSmoothPath = (
  points: Point[],
  minY: number,
  maxY: number,
): string => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;

  let path = `M${points[0].x},${points[0].y}`;

  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * CURVE_TENSION;
    const cp1y = clamp(p1.y + ((p2.y - p0.y) / 6) * CURVE_TENSION, minY, maxY);
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * CURVE_TENSION;
    const cp2y = clamp(p2.y - ((p3.y - p1.y) / 6) * CURVE_TENSION, minY, maxY);

    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
};

const formatAxisValue = (value: number): string => String(Math.round(value));

const pickNiceAxisInterval = (maxValue: number): number => {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;

  const rawInterval = maxValue / TARGET_AXIS_INTERVAL_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(rawInterval));
  const normalized = rawInterval / magnitude;
  const niceBase =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return Math.max(1, niceBase * magnitude);
};

const buildAxisLabels = (axisMax: number, interval: number): number[] => {
  const tickCount = Math.max(1, Math.round(axisMax / interval));

  return Array.from({ length: tickCount + 1 }, (_, index) =>
    Math.max(0, axisMax - interval * index),
  );
};

export function StatisticsTrendChart({
  data,
  labels,
  color,
  softColor,
  targetValue,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [width, setWidth] = useState(0);

  const safeData = useMemo(() => (data.length > 0 ? data : [0]), [data]);
  const chartScale = useMemo(() => {
    const dataValues = safeData.map((value) =>
      Number.isFinite(value) ? Math.max(0, value) : 0,
    );
    const targetValues =
      targetValue && targetValue > 0 && Number.isFinite(targetValue)
        ? [targetValue]
        : [];
    const maxValue = Math.max(0, ...dataValues, ...targetValues);
    const interval = pickNiceAxisInterval(maxValue);
    const axisMax = Math.max(interval, Math.ceil(maxValue / interval) * interval);

    return {
      interval,
      range: axisMax,
      axisLabels: buildAxisLabels(axisMax, interval),
    };
  }, [safeData, targetValue]);

  const points = useMemo<Point[]>(() => {
    if (width <= 0) return [];

    const innerWidth = Math.max(1, width - theme.spacing.sm * 2);
    const verticalPadding = theme.spacing.xs;

    return safeData.map((value, index) => {
      const normalized = Math.max(0, value) / chartScale.range;
      const x =
        theme.spacing.sm +
        (innerWidth * (safeData.length <= 1 ? 0 : index / (safeData.length - 1)));
      const y =
        verticalPadding + (1 - normalized) * (CHART_HEIGHT - verticalPadding * 2);
      return { x, y };
    });
  }, [chartScale.range, safeData, theme.spacing.sm, theme.spacing.xs, width]);

  const linePath = useMemo(
    () => buildSmoothPath(points, theme.spacing.xs, CHART_HEIGHT - theme.spacing.xs),
    [points, theme.spacing.xs],
  );

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const last = points[points.length - 1];
    const first = points[0];
    const baseline = CHART_HEIGHT - theme.spacing.xs;
    return `${linePath} L${last.x},${baseline} L${first.x},${baseline} Z`;
  }, [linePath, points, theme.spacing.xs]);

  const labelIndexes = useMemo(() => {
    if (labels.length <= 7) {
      return labels.map((_, index) => index);
    }

    const result = new Set<number>();
    const lastIndex = labels.length - 1;

    for (let tick = 0; tick < 7; tick++) {
      result.add(Math.round((tick / 6) * lastIndex));
    }

    return Array.from(result).sort((a, b) => a - b);
  }, [labels]);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const targetLineY = useMemo(() => {
    if (!targetValue || targetValue <= 0 || width <= 0) return null;

    const verticalPadding = theme.spacing.xs;
    const normalized = targetValue / chartScale.range;

    return (
      verticalPadding + (1 - normalized) * (CHART_HEIGHT - verticalPadding * 2)
    );
  }, [chartScale.range, targetValue, theme.spacing.xs, width]);

  return (
    <View>
      <View style={styles.chartFrame}>
        <View style={styles.chartWithAxis}>
          <View style={styles.yAxisLabels}>
            {chartScale.axisLabels.map((value, index) => (
              <Text
                key={`axis-${index}`}
                testID={`statistics-y-axis-label-${index}`}
                style={styles.axisLabelText}
              >
                {formatAxisValue(value)}
              </Text>
            ))}
          </View>

          <View style={styles.plotFrame} onLayout={onLayout}>
            {width > 0 ? (
              <Svg width={width} height={CHART_HEIGHT}>
                {chartScale.axisLabels.map((value) => {
                  if (value === 0) return null;

                  const y =
                    theme.spacing.xs +
                    (1 - value / chartScale.range) *
                      (CHART_HEIGHT - theme.spacing.xs * 2);

                  return (
                    <Line
                      key={`grid-${value}`}
                      x1={theme.spacing.sm}
                      y1={y}
                      x2={width - theme.spacing.sm}
                      y2={y}
                      stroke={theme.borderSoft}
                      strokeWidth={1}
                      opacity={0.55}
                    />
                  );
                })}

                {areaPath ? (
                  <Path d={areaPath} fill={softColor} opacity={0.72} />
                ) : null}
                {targetLineY !== null ? (
                  <Line
                    x1={theme.spacing.sm}
                    y1={targetLineY}
                    x2={width - theme.spacing.sm}
                    y2={targetLineY}
                    stroke={theme.textTertiary}
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    opacity={0.7}
                  />
                ) : null}
                {linePath ? (
                  <Path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </Svg>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.labelsRow}>
        <View style={styles.axisSpacer} />
        <View style={styles.xLabelsRow}>
          {labelIndexes.map((index) => (
            <Text key={`label-${index}`} style={styles.labelText}>
              {labels[index]}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    chartFrame: {
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.025)"
        : "rgba(255, 253, 248, 0.58)",
      minHeight: CHART_HEIGHT,
      overflow: "hidden",
    },
    chartWithAxis: {
      minHeight: CHART_HEIGHT,
      flexDirection: "row",
    },
    yAxisLabels: {
      width: Y_AXIS_WIDTH,
      paddingLeft: theme.spacing.xxs,
      paddingRight: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    axisLabelText: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
    },
    plotFrame: {
      flex: 1,
      minWidth: 0,
      minHeight: CHART_HEIGHT,
    },
    labelsRow: {
      minHeight: LABEL_ROW_HEIGHT,
      marginTop: theme.spacing.xxs,
      flexDirection: "row",
      alignItems: "center",
    },
    axisSpacer: {
      width: Y_AXIS_WIDTH,
    },
    xLabelsRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xxs,
    },
    labelText: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
    },
  });
