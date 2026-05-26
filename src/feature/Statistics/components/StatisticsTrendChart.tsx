import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Circle, Line, Path, Svg } from "react-native-svg";
import { useTheme } from "@/theme/useTheme";

type Props = {
  data: number[];
  labels: string[];
  color: string;
  softColor: string;
};

type Point = {
  x: number;
  y: number;
};

const CHART_HEIGHT = 88;
const LABEL_ROW_HEIGHT = 14;
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

export function StatisticsTrendChart({ data, labels, color, softColor }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [width, setWidth] = useState(0);

  const safeData = useMemo(() => (data.length > 0 ? data : [0]), [data]);

  const points = useMemo<Point[]>(() => {
    if (width <= 0) return [];

    const innerWidth = Math.max(1, width - theme.spacing.sm * 2);
    const minValue = Math.min(...safeData);
    const maxValue = Math.max(...safeData);
    const range = maxValue === minValue ? Math.max(1, maxValue || 1) : maxValue - minValue;
    const verticalPadding = theme.spacing.xs;

    return safeData.map((value, index) => {
      const normalized = range === 0 ? 0.5 : (value - minValue) / range;
      const x =
        theme.spacing.sm +
        (innerWidth * (safeData.length <= 1 ? 0 : index / (safeData.length - 1)));
      const y =
        verticalPadding + (1 - normalized) * (CHART_HEIGHT - verticalPadding * 2);
      return { x, y };
    });
  }, [safeData, theme.spacing.sm, theme.spacing.xs, width]);

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

  return (
    <View>
      <View style={styles.chartFrame} onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            {Array.from({ length: 3 }).map((_, index) => {
              const y =
                theme.spacing.sm +
                ((CHART_HEIGHT - theme.spacing.sm * 2) / 3) * (index + 0.3);
              return (
                <Line
                  key={`grid-${index}`}
                  x1={theme.spacing.sm}
                  y1={y}
                  x2={width - theme.spacing.sm}
                  y2={y}
                  stroke={theme.borderSoft}
                  strokeWidth={1}
                />
              );
            })}

            {areaPath ? <Path d={areaPath} fill={softColor} /> : null}
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

            {points.map((point, index) => (
              <Circle
                key={`point-${index}`}
                cx={point.x}
                cy={point.y}
                r={index === points.length - 1 ? 4 : 2.5}
                fill={index === points.length - 1 ? theme.surface : color}
                stroke={color}
                strokeWidth={index === points.length - 1 ? 2 : 0}
              />
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={styles.labelsRow}>
        {labelIndexes.map((index) => (
          <Text key={`label-${index}`} style={styles.labelText}>
            {labels[index]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    chartFrame: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surface,
      minHeight: CHART_HEIGHT,
      overflow: "hidden",
    },
    labelsRow: {
      minHeight: LABEL_ROW_HEIGHT,
      marginTop: theme.spacing.xxs,
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
