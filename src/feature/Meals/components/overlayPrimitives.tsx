import { useMemo, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";

export type OverlayFontWeight = "300" | "500" | "700" | "normal" | "bold";
export type OverlayTextAlign = "left" | "center";
export type OverlayKcalTone = "hero" | "title" | "compact";
export type OverlayLegendMarkerMode = "dot" | "none" | "bar";

type OverlayShellProps = {
  children: ReactNode;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

type OverlayKcalBlockProps = {
  kcal: number;
  textColor: string;
  fontFamily?: string;
  fontWeight?: OverlayFontWeight;
  align?: OverlayTextAlign;
  tone?: OverlayKcalTone;
  subtitle?: string;
  showUnit?: boolean;
};

type OverlayMacroLegendItemProps = {
  label: string;
  value: number;
  color: string;
  textColor: string;
  fontFamily?: string;
  fontWeight?: OverlayFontWeight;
  compact?: boolean;
  align?: OverlayTextAlign;
  valueSuffix?: string;
  markerMode?: OverlayLegendMarkerMode;
  labelColor?: string;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
};

type OverlayMacroChipProps = {
  label: string;
  value: number;
  color: string;
  textColor: string;
  fontFamily?: string;
  fontWeight?: OverlayFontWeight;
  backgroundColor?: string;
  borderColor?: string;
  compact?: boolean;
  markerMode?: OverlayLegendMarkerMode;
  style?: StyleProp<ViewStyle>;
};

type ResolvedOverlaySurface = {
  backgroundColor: string;
  borderColor: string;
};

function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const normalized = input.trim();

  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const r = Number.parseInt(`${normalized[1]}${normalized[1]}`, 16);
    const g = Number.parseInt(`${normalized[2]}${normalized[2]}`, 16);
    const b = Number.parseInt(`${normalized[3]}${normalized[3]}`, 16);
    return { r, g, b };
  }

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    const r = Number.parseInt(normalized.slice(1, 3), 16);
    const g = Number.parseInt(normalized.slice(3, 5), 16);
    const b = Number.parseInt(normalized.slice(5, 7), 16);
    return { r, g, b };
  }

  return null;
}

function parseRgbColor(input: string): { r: number; g: number; b: number } | null {
  const normalized = input.trim();
  const rgbaMatch = normalized.match(
    /^rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*[0-9.]+\s*)?\)$/
  );

  if (!rgbaMatch) {
    return null;
  }

  return {
    r: Number.parseInt(rgbaMatch[1], 10),
    g: Number.parseInt(rgbaMatch[2], 10),
    b: Number.parseInt(rgbaMatch[3], 10),
  };
}

export function withAlpha(inputColor: string, alpha: number): string {
  const resolvedAlpha = Math.min(Math.max(alpha, 0), 1);
  const fromHex = parseHexColor(inputColor);

  if (fromHex) {
    return `rgba(${fromHex.r}, ${fromHex.g}, ${fromHex.b}, ${resolvedAlpha})`;
  }

  const fromRgb = parseRgbColor(inputColor);
  if (fromRgb) {
    return `rgba(${fromRgb.r}, ${fromRgb.g}, ${fromRgb.b}, ${resolvedAlpha})`;
  }

  return inputColor;
}

export function resolveOverlaySurface(
  theme: ReturnType<typeof useTheme>,
  backgroundColor?: string
): ResolvedOverlaySurface {
  return {
    backgroundColor:
      backgroundColor ??
      withAlpha(theme.surfaceElevated, theme.isDark ? 0.78 : 0.92),
    borderColor: withAlpha(theme.borderSoft, theme.isDark ? 0.9 : 0.74),
  };
}

const KCAL_TONE_STYLE_KEY: Record<OverlayKcalTone, "hero" | "title" | "compact"> = {
  hero: "hero",
  title: "title",
  compact: "compact",
};

export function OverlayShell({ children, backgroundColor, style }: OverlayShellProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const surface = resolveOverlaySurface(theme, backgroundColor);

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: surface.backgroundColor,
          borderColor: surface.borderColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function OverlayKcalBlock({
  kcal,
  textColor,
  fontFamily,
  fontWeight = "700",
  align = "center",
  tone = "hero",
  subtitle,
  showUnit = true,
}: OverlayKcalBlockProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const toneKey = KCAL_TONE_STYLE_KEY[tone];

  const numberStyle = [
    styles.kcalNumber,
    styles[`${toneKey}Number`],
    {
      color: textColor,
      fontFamily,
      fontWeight,
      textAlign: align,
    },
  ];

  const unitStyle = [
    styles.kcalUnit,
    styles[`${toneKey}Unit`],
    {
      color: withAlpha(textColor, 0.76),
      fontFamily: fontFamily ?? theme.typography.fontFamily.medium,
      textAlign: align,
    },
  ];

  const subtitleStyle = [
    styles.kcalSubtitle,
    {
      color: withAlpha(textColor, 0.72),
      fontFamily: fontFamily ?? theme.typography.fontFamily.medium,
      textAlign: align,
    },
  ];

  return (
    <View
      style={[
        styles.kcalBlock,
        align === "center" ? styles.kcalBlockCenter : styles.kcalBlockStart,
      ]}
    >
      <Text style={numberStyle}>
        {Math.round(kcal)}
        {showUnit ? <Text style={unitStyle}> kcal</Text> : null}
      </Text>
      {subtitle ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.76}
          style={subtitleStyle}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function OverlayMacroLegendItem({
  label,
  value,
  color,
  textColor,
  fontFamily,
  fontWeight = "500",
  compact = false,
  align = "left",
  valueSuffix = "g",
  markerMode = "dot",
  labelColor,
  valueColor,
  style,
}: OverlayMacroLegendItemProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const labelStyle = [
    styles.legendLabel,
    compact ? styles.legendLabelCompact : null,
    {
      color: labelColor ?? withAlpha(textColor, 0.76),
      fontFamily: fontFamily ?? theme.typography.fontFamily.medium,
      textAlign: align,
      fontWeight,
    },
  ];

  const valueStyle = [
    styles.legendValue,
    compact ? styles.legendValueCompact : null,
    {
      color: valueColor ?? textColor,
      fontFamily,
      textAlign: align,
      fontWeight,
    },
  ];

  return (
    <View
      style={[
        styles.legendItem,
        compact ? styles.legendItemCompact : null,
        align === "center" ? styles.legendItemCenter : styles.legendItemStart,
        style,
      ]}
    >
      {markerMode === "dot" ? (
        <View
          style={[
            styles.legendDot,
            compact ? styles.legendDotCompact : null,
            { backgroundColor: color },
          ]}
        />
      ) : null}
      {markerMode === "bar" ? (
        <View
          style={[
            styles.legendBar,
            compact ? styles.legendBarCompact : null,
            { backgroundColor: color },
          ]}
        />
      ) : null}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.68}
        style={labelStyle}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.76}
        style={valueStyle}
      >
        {Math.round(value)}
        {valueSuffix}
      </Text>
    </View>
  );
}

export function OverlayMacroChip({
  label,
  value,
  color,
  textColor,
  fontFamily,
  fontWeight = "500",
  backgroundColor,
  borderColor,
  compact = false,
  markerMode = "none",
  style,
}: OverlayMacroChipProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View
      style={[
        styles.macroChip,
        compact ? styles.macroChipCompact : null,
        {
          backgroundColor: backgroundColor ?? withAlpha(color, theme.isDark ? 0.34 : 0.2),
          borderColor: borderColor ?? withAlpha(color, theme.isDark ? 0.64 : 0.5),
        },
        style,
      ]}
    >
      <OverlayMacroLegendItem
        label={label}
        value={value}
        color={color}
        textColor={textColor}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        compact
        align="center"
        markerMode={markerMode}
      />
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    shell: {
      borderWidth: 1,
      borderRadius: theme.rounded.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
      overflow: "hidden",
    },
    kcalBlock: {
      gap: theme.spacing.xxs,
    },
    kcalBlockCenter: {
      alignItems: "center",
    },
    kcalBlockStart: {
      alignItems: "flex-start",
    },
    kcalNumber: {
      includeFontPadding: false,
    },
    heroNumber: {
      fontSize: theme.typography.size.numericXL,
      lineHeight: theme.typography.lineHeight.numericXL,
    },
    titleNumber: {
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
    },
    compactNumber: {
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
    },
    kcalUnit: {
      includeFontPadding: false,
    },
    heroUnit: {
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    titleUnit: {
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    compactUnit: {
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
    },
    kcalSubtitle: {
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      includeFontPadding: false,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs + 1,
    },
    legendItemCompact: {
      gap: theme.spacing.xxs,
    },
    legendItemStart: {
      justifyContent: "flex-start",
    },
    legendItemCenter: {
      justifyContent: "center",
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: theme.rounded.full,
    },
    legendDotCompact: {
      width: 6,
      height: 6,
    },
    legendBar: {
      width: 3,
      height: 14,
      borderRadius: theme.rounded.full,
    },
    legendBarCompact: {
      height: 10,
    },
    legendLabel: {
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      includeFontPadding: false,
      minWidth: 0,
      flexShrink: 1,
    },
    legendLabelCompact: {
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
    },
    legendValue: {
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      includeFontPadding: false,
      flexShrink: 0,
    },
    legendValueCompact: {
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    macroChip: {
      minHeight: 30,
      borderRadius: theme.rounded.full,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.sm,
      justifyContent: "center",
      alignItems: "center",
    },
    macroChipCompact: {
      minHeight: 28,
      paddingHorizontal: 4,
    },
  });
