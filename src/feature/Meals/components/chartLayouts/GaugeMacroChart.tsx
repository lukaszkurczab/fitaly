import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "@/theme/useTheme";
import {
  OverlayKcalBlock,
  withAlpha,
} from "../overlayPrimitives";

type Datum = {
  value: number;
  color: string;
  label: string;
  shortLabel?: string;
};

type Props = {
  data: Datum[];
  kcal: number;
  showLabel?: boolean;
  showLegend?: boolean;
  textColor?: string;
  fontFamily?: string;
  fontWeight?: "300" | "500" | "700" | "normal" | "bold";
  backgroundColor?: string;
};

const ARC_WIDTH = 186;
const ARC_HEIGHT = 88;
const ARC_CENTER_X = ARC_WIDTH / 2;
const ARC_CENTER_Y = 96;
const ARC_RADIUS = 74;
const ARC_STROKE = 13;
const ARC_START_ANGLE = 204;
const ARC_END_ANGLE = 336;
const SEGMENT_GAP = 3;

const degToRad = (deg: number) => (deg * Math.PI) / 180;

function buildArcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
) {
  const start = degToRad(startAngleDeg);
  const end = degToRad(endAngleDeg);

  const startX = cx + radius * Math.cos(start);
  const startY = cy + radius * Math.sin(start);
  const endX = cx + radius * Math.cos(end);
  const endY = cy + radius * Math.sin(end);
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
}

export default function GaugeMacroChart({
  data,
  kcal,
  showLabel = true,
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

  const hasPositive = safeData.some((item) => item.value > 0);
  const segmentData = hasPositive
    ? safeData.filter((item) => item.value > 0)
    : safeData.map((item) => ({ ...item, value: 1 }));

  const total = segmentData.reduce((sum, item) => sum + item.value, 0) || 1;
  const availableAngle =
    ARC_END_ANGLE - ARC_START_ANGLE - SEGMENT_GAP * Math.max(segmentData.length - 1, 0);
  const safeAvailableAngle = Math.max(0, availableAngle);

  const segmentDefs: Array<{
    start: number;
    end: number;
    color: string;
    label: string;
    shortLabel?: string;
  }> = [];

  let angleCursor = ARC_START_ANGLE;
  segmentData.forEach((item) => {
    const segmentAngle = total > 0 ? (item.value / total) * safeAvailableAngle : 0;
    if (segmentAngle <= 0) {
      return;
    }

    const start = angleCursor;
    const end = start + segmentAngle;
    segmentDefs.push({
      start,
      end,
      color: item.color,
      label: item.label,
      shortLabel: item.shortLabel,
    });
    angleCursor = end + SEGMENT_GAP;
  });

  const segmentStart =
    segmentDefs.length > 0
      ? {
          x:
            ARC_CENTER_X +
            ARC_RADIUS * Math.cos(degToRad(segmentDefs[0].start)),
          y:
            ARC_CENTER_Y +
            ARC_RADIUS * Math.sin(degToRad(segmentDefs[0].start)),
          color: segmentDefs[0].color,
        }
      : null;
  const segmentEnd =
    segmentDefs.length > 0
      ? {
          x:
            ARC_CENTER_X +
            ARC_RADIUS * Math.cos(degToRad(segmentDefs[segmentDefs.length - 1].end)),
          y:
            ARC_CENTER_Y +
            ARC_RADIUS * Math.sin(degToRad(segmentDefs[segmentDefs.length - 1].end)),
          color: segmentDefs[segmentDefs.length - 1].color,
        }
      : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.gaugeWrap}>
        <Svg width={ARC_WIDTH} height={ARC_HEIGHT} viewBox={`0 0 ${ARC_WIDTH} ${ARC_HEIGHT}`}>
          <Path
            d={buildArcPath(
              ARC_CENTER_X,
              ARC_CENTER_Y,
              ARC_RADIUS,
              ARC_START_ANGLE,
              ARC_END_ANGLE
            )}
            stroke={withAlpha(theme.borderSoft, theme.isDark ? 0.46 : 0.3)}
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
            fill="none"
          />
          {segmentDefs.map((segment, index) => (
            <Path
              key={`${segment.label}-${index}`}
              d={buildArcPath(
                ARC_CENTER_X,
                ARC_CENTER_Y,
                ARC_RADIUS,
                segment.start,
                segment.end
              )}
              stroke={segment.color}
              strokeWidth={ARC_STROKE}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
          {segmentStart ? (
            <Circle
              cx={segmentStart.x}
              cy={segmentStart.y}
              r={ARC_STROKE / 2}
              fill={segmentStart.color}
            />
          ) : null}
          {segmentEnd ? (
            <Circle
              cx={segmentEnd.x}
              cy={segmentEnd.y}
              r={ARC_STROKE / 2}
              fill={segmentEnd.color}
            />
          ) : null}
        </Svg>
      </View>

      {showLabel ? (
        <OverlayKcalBlock
          kcal={kcal}
          textColor={textColor || theme.text}
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          align="center"
          tone="compact"
        />
      ) : null}

      {showLegend ? (
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
                    color: withAlpha(textColor || theme.text, 0.76),
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
                    {
                      color: withAlpha(textColor || theme.text, 0.4),
                    },
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
  gaugeWrap: {
    width: ARC_WIDTH,
    height: ARC_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
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
