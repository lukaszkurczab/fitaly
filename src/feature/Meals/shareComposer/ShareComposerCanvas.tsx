import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AppIcon, { type AppIconName } from "@/components/AppIcon";
import CardOverlay from "@/feature/Meals/components/CardOverlay";
import ChartOverlay from "@/feature/Meals/components/ChartOverlay";
import DraggableItem from "@/feature/Meals/share/DraggableItem";
import { useTheme } from "@/theme/useTheme";
import type {
  ShareChartLayerState,
  ShareCompositionState,
  ShareLayerId,
  ShareNutrition,
  ShareTextLayerState,
  TransformState,
} from "@/feature/Meals/shareComposer/types";

type ShareComposerCanvasProps = {
  width: number;
  height: number;
  mealPhotoUri: string;
  photoUnavailableLabel: string;
  deselectLayerLabel: string;
  nutrition: ShareNutrition;
  macroLabels: {
    protein: string;
    carbs: string;
    fat: string;
  };
  composition: ShareCompositionState;
  mode: "quick" | "customize";
  selectedLayerId: ShareLayerId | null;
  onSelectLayer: (layerId: ShareLayerId) => void;
  onTextChange: (id: string, text: string) => void;
  onTransformChange: (layerId: ShareLayerId, next: TransformState) => void;
  onBackgroundPress: () => void;
  editorChromeVisible: boolean;
};

const ADDITIONAL_PHOTO_SIZE = { width: 52, height: 76 };
const DESIGN_CANVAS_WIDTH = 333;
const QUICK_CARD_SURFACE_STRONG = "rgba(251,248,242,0.94)";
const QUICK_DARK_SURFACE_STRONG = "rgba(63,52,42,0.68)";
const QUICK_TEXT_COLOR = "#393128";
const QUICK_TEXT_INVERSE = "#FFFDF8";
const QUICK_TEXT_MUTED = "rgba(57,49,40,0.82)";
const QUICK_TEXT_INVERSE_MUTED = "rgba(255,253,248,0.86)";
const SHARE_OVERLAY_SURFACE = "rgba(251,248,242,0.94)";
const SHARE_OVERLAY_TEXT = "#393128";

type QuickMacroMetric = {
  key: "protein" | "carbs" | "fat";
  value: string;
  label: string;
  color: string;
  grams: number;
  icon: AppIconName;
};

function resolveMacroIconSize(
  key: QuickMacroMetric["key"],
  baseSize: number,
) {
  return key === "protein" ? baseSize : baseSize * 1.14;
}

function mapChartVariantForOverlay(variant: ShareChartLayerState["variant"]) {
  if (variant === "macroPie") {
    return "macroPieWithLegend" as const;
  }
  return variant;
}

function buildTextStyle(textLayer: ShareTextLayerState, theme: ReturnType<typeof useTheme>) {
  return {
    color: textLayer.color,
    fontFamily: textLayer.italic
      ? undefined
      : textLayer.bold
        ? theme.typography.fontFamily.bold
        : theme.typography.fontFamily.medium,
    fontWeight: textLayer.bold ? ("700" as const) : ("500" as const),
    fontStyle: textLayer.italic ? ("italic" as const) : ("normal" as const),
    textDecorationLine: textLayer.underline
      ? ("underline" as const)
      : ("none" as const),
    transform: textLayer.italic ? [{ skewX: "-9deg" as const }] : undefined,
  };
}

function parseHexTextColor(input: string): { r: number; g: number; b: number } | null {
  const normalized = input.trim();

  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return {
      r: Number.parseInt(`${normalized[1]}${normalized[1]}`, 16),
      g: Number.parseInt(`${normalized[2]}${normalized[2]}`, 16),
      b: Number.parseInt(`${normalized[3]}${normalized[3]}`, 16),
    };
  }

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16),
    };
  }

  return null;
}

function resolveTextReadabilityBackplate(color: string): ViewStyle | null {
  const rgb = parseHexTextColor(color);
  if (!rgb) return null;

  const luminance =
    (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;

  if (luminance > 0.58) return null;

  return {
    backgroundColor: "rgba(251,248,242,0.78)",
    borderColor: "rgba(57,49,40,0.14)",
    borderWidth: 1,
  };
}

function resolveQuickTitle(composition: ShareCompositionState) {
  const titleLayer = composition.textLayers.find((layer) => layer.id === "text:title");
  if (titleLayer?.text.trim()) {
    return titleLayer.text.trim();
  }
  const firstLayer = composition.textLayers[0];
  if (firstLayer?.text.trim()) {
    return firstLayer.text.trim();
  }
  return "Meal";
}

function normalizeMetric(value: number) {
  return Math.max(0, Math.round(value));
}

function buildMacroMetrics({
  protein,
  carbs,
  fat,
  macroLabels,
  theme,
}: {
  protein: number;
  carbs: number;
  fat: number;
  macroLabels: {
    protein: string;
    carbs: string;
    fat: string;
  };
  theme: ReturnType<typeof useTheme>;
}): QuickMacroMetric[] {
  return [
    {
      key: "protein",
      value: `${protein}g`,
      label: macroLabels.protein,
      color: theme.macro.protein,
      grams: protein,
      icon: "macro-protein-drumstick",
    },
    {
      key: "carbs",
      value: `${carbs}g`,
      label: macroLabels.carbs,
      color: theme.macro.carbs,
      grams: carbs,
      icon: "macro-carbs-grain",
    },
    {
      key: "fat",
      value: `${fat}g`,
      label: macroLabels.fat,
      color: theme.macro.fat,
      grams: fat,
      icon: "macro-fat-drop",
    },
  ];
}

function QuickMacroTile({
  metricKey,
  value,
  label,
  color,
  icon,
  width,
  dark = false,
  scale,
  stylesWithTheme,
}: {
  metricKey: QuickMacroMetric["key"];
  value: string;
  label: string;
  color: string;
  icon: AppIconName;
  width: number;
  dark?: boolean;
  scale: (value: number) => number;
  stylesWithTheme: ReturnType<typeof makeStyles>;
}) {
  return (
    <View
      style={[
        stylesWithTheme.quickMacroTile,
        {
          width,
          paddingVertical: scale(7),
          paddingHorizontal: scale(7),
          backgroundColor: dark
            ? "rgba(255,253,248,0.16)"
            : "rgba(255,253,248,0.82)",
          borderColor: dark
            ? "rgba(255,253,248,0.26)"
            : "rgba(57,49,40,0.12)",
        },
      ]}
    >
      <View style={[stylesWithTheme.quickMacroValueRow, { gap: scale(4) }]}>
        <AppIcon
          name={icon}
          size={scale(resolveMacroIconSize(metricKey, 14))}
          color={color}
          style={stylesWithTheme.quickMacroIcon}
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={[
            stylesWithTheme.quickMacroValue,
            {
              color: dark ? QUICK_TEXT_INVERSE : QUICK_TEXT_COLOR,
              fontSize: scale(13),
              lineHeight: scale(15),
            },
          ]}
        >
          {value}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={[
          stylesWithTheme.quickMacroName,
          {
            color: dark ? QUICK_TEXT_INVERSE_MUTED : QUICK_TEXT_MUTED,
            fontSize: scale(9.4),
            lineHeight: scale(11),
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function QuickBrandMark({
  dark,
  scale,
  stylesWithTheme,
}: {
  dark: boolean;
  scale: (value: number) => number;
  stylesWithTheme: ReturnType<typeof makeStyles>;
}) {
  return (
    <View
      style={[
        stylesWithTheme.quickBrandMark,
        {
          right: scale(20),
          top: scale(26),
          borderRadius: scale(14),
          paddingHorizontal: scale(9),
          paddingVertical: scale(4),
          backgroundColor: dark
            ? "rgba(45,37,30,0.54)"
            : "rgba(251,248,242,0.84)",
          borderColor: dark
            ? "rgba(255,253,248,0.24)"
            : "rgba(57,49,40,0.12)",
        },
      ]}
    >
      <Text
        style={[
          stylesWithTheme.quickBrandText,
          {
            color: dark ? QUICK_TEXT_INVERSE : QUICK_TEXT_COLOR,
            fontSize: scale(9.4),
            lineHeight: scale(11),
          },
        ]}
      >
        Fitaly
      </Text>
    </View>
  );
}

function QuickPresetOverlay({
  width,
  presetId,
  titleText,
  nutrition,
  macroLabels,
  theme,
  stylesWithTheme,
}: {
  width: number;
  presetId: ShareCompositionState["presetId"];
  titleText: string;
  nutrition: ShareNutrition;
  macroLabels: {
    protein: string;
    carbs: string;
    fat: string;
  };
  theme: ReturnType<typeof useTheme>;
  stylesWithTheme: ReturnType<typeof makeStyles>;
}) {
  const scale = width / DESIGN_CANVAS_WIDTH;
  const s = (value: number) => value * scale;

  const kcal = normalizeMetric(nutrition.kcal);
  const protein = normalizeMetric(nutrition.protein);
  const carbs = normalizeMetric(nutrition.carbs);
  const fat = normalizeMetric(nutrition.fat);

  const macroMetrics = buildMacroMetrics({
    protein,
    carbs,
    fat,
    macroLabels,
    theme,
  });
  const totalMacroGrams = macroMetrics.reduce(
    (sum, metric) => sum + metric.grams,
    0,
  );

  if (presetId === "quickClassic") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(45,37,30,0.68)",
            "rgba(45,37,30,0.32)",
            "rgba(46,38,30,0)",
          ]}
          locations={[0, 0.58, 1]}
          style={[
            stylesWithTheme.quickPhotoTopScrim,
            {
              height: s(164),
            },
          ]}
        />
        <Text
          numberOfLines={2}
          style={[
            stylesWithTheme.quickPhotoTitle,
            {
              left: s(20),
              top: s(26),
              width: s(218),
              color: QUICK_TEXT_INVERSE,
              fontSize: s(25.5),
              lineHeight: s(31),
              textAlign: "left",
            },
          ]}
        >
          {titleText}
        </Text>
        <View
          style={[
            stylesWithTheme.quickFloatingKcal,
            {
              left: s(20),
              top: s(96),
              borderRadius: s(18),
              paddingHorizontal: s(12),
              paddingVertical: s(5),
            },
          ]}
        >
          <Text
            style={[
              stylesWithTheme.quickKcal,
              {
                color: QUICK_TEXT_INVERSE,
                fontSize: s(15),
                lineHeight: s(18),
              },
            ]}
          >
            {kcal} kcal
          </Text>
        </View>
        <View
          style={[
              stylesWithTheme.quickPhotoDataBar,
              {
                left: s(20),
                right: s(20),
                bottom: s(100),
                borderRadius: 0,
                paddingHorizontal: 0,
                paddingVertical: 0,
                gap: s(8),
                backgroundColor: "transparent",
                borderWidth: 0,
                justifyContent: "center",
                shadowOpacity: 0,
                shadowRadius: 0,
                elevation: 0,
              },
            ]}
          >
            {macroMetrics.map((metric) => (
              <QuickMacroTile
                key={metric.key}
                metricKey={metric.key}
                value={metric.value}
                label={metric.label}
                color={metric.color}
                icon={metric.icon}
                width={s(metric.key === "carbs" ? 90 : 76)}
                dark
                scale={s}
                stylesWithTheme={stylesWithTheme}
              />
          ))}
        </View>
        <QuickBrandMark dark scale={s} stylesWithTheme={stylesWithTheme} />
      </View>
    );
  }

  if (presetId === "quickSidebar") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            stylesWithTheme.quickGlassPanel,
            {
              left: s(18),
              right: s(18),
              top: s(246),
              borderRadius: s(24),
              paddingTop: s(17),
              paddingHorizontal: s(17),
              paddingBottom: s(16),
            },
          ]}
        >
          <View style={[stylesWithTheme.quickGlassHeader, { gap: s(10) }]}>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={[
                  stylesWithTheme.quickTitle,
                  {
                    color: QUICK_TEXT_INVERSE,
                    fontSize: s(20),
                    lineHeight: s(24),
                    textAlign: "left",
                  },
                ]}
              >
                {titleText}
              </Text>
            </View>
            <Text
              style={[
                stylesWithTheme.quickKcal,
                {
                  color: QUICK_TEXT_INVERSE,
                  fontSize: s(18),
                  lineHeight: s(21),
                },
              ]}
            >
              {kcal} kcal
            </Text>
          </View>
          <View style={[stylesWithTheme.quickGlassMacroGrid, { gap: s(8), marginTop: s(14) }]}>
            {macroMetrics.map((metric) => (
              <QuickMacroTile
                key={metric.key}
                metricKey={metric.key}
                value={metric.value}
                label={metric.label}
                color={metric.color}
                icon={metric.icon}
                width={s(metric.key === "carbs" ? 88 : 72)}
                dark
                scale={s}
                stylesWithTheme={stylesWithTheme}
              />
            ))}
          </View>
        </View>
        <QuickBrandMark dark scale={s} stylesWithTheme={stylesWithTheme} />
      </View>
    );
  }

  const summaryCardTop = s(28);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          stylesWithTheme.quickClassicCard,
          {
            left: s(20),
            top: summaryCardTop,
            width: s(216),
            borderRadius: s(22),
            paddingTop: s(14),
            paddingHorizontal: s(14),
            paddingBottom: s(12),
          },
        ]}
      >
        <Text
          numberOfLines={2}
          style={[
            stylesWithTheme.quickTitle,
            {
              color: QUICK_TEXT_COLOR,
              fontSize: s(19),
              lineHeight: s(23),
              textAlign: "left",
            },
          ]}
        >
          {titleText}
        </Text>
        <View style={[stylesWithTheme.quickClassicSummaryRow, { marginTop: s(8) }]}>
          <Text
            style={[
              stylesWithTheme.quickKcal,
              {
                color: QUICK_TEXT_COLOR,
                fontSize: s(17),
                lineHeight: s(20),
              },
            ]}
          >
            {kcal} kcal
          </Text>
          <View
            style={[
              stylesWithTheme.quickClassicAccentLine,
              {
                height: s(3),
                borderRadius: s(2),
                marginLeft: s(8),
              },
            ]}
          >
            {macroMetrics.map((metric) => (
              <View
                key={metric.key}
                style={[
                  stylesWithTheme.quickClassicAccentSegment,
                  {
                    flex:
                      totalMacroGrams > 0
                        ? Math.max(metric.grams, 0)
                        : 1,
                    backgroundColor: metric.color,
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <View
          style={[
            stylesWithTheme.quickClassicMacroRow,
            {
              marginTop: s(10),
              gap: s(5),
            },
          ]}
        >
          {macroMetrics.map((metric) => (
            <QuickMacroTile
              key={metric.key}
              metricKey={metric.key}
              value={metric.value}
              label={metric.label}
              color={metric.color}
              icon={metric.icon}
              width={s(metric.key === "carbs" ? 75 : 61)}
              scale={s}
              stylesWithTheme={stylesWithTheme}
            />
          ))}
        </View>
      </View>
      <QuickBrandMark dark scale={s} stylesWithTheme={stylesWithTheme} />
    </View>
  );
}

function SelectedOutline() {
  return (
    <View pointerEvents="none" style={styles.selectedOutline}>
      <View style={[styles.handle, styles.handleTopLeft]} />
      <View style={[styles.handle, styles.handleTopRight]} />
      <View style={[styles.handle, styles.handleBottomLeft]} />
      <View style={[styles.handle, styles.handleBottomRight]} />
    </View>
  );
}

export default function ShareComposerCanvas({
  width,
  height,
  mealPhotoUri,
  photoUnavailableLabel,
  deselectLayerLabel,
  nutrition,
  macroLabels,
  composition,
  mode,
  selectedLayerId,
  onSelectLayer,
  onTextChange,
  onTransformChange,
  onBackgroundPress,
  editorChromeVisible,
}: ShareComposerCanvasProps) {
  const theme = useTheme();
  const [photoError, setPhotoError] = useState(false);
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
  const interactive = mode === "customize";
  const showEditorChrome = interactive && editorChromeVisible;
  const stylesWithTheme = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    setPhotoError(false);
  }, [mealPhotoUri]);

  useEffect(() => {
    if (mode !== "customize") {
      setEditingTextLayerId(null);
      return;
    }
    if (!selectedLayerId || !selectedLayerId.startsWith("text:")) {
      setEditingTextLayerId(null);
    }
  }, [mode, selectedLayerId]);

  const chartLayer = composition.widgets.chart;
  const cardLayer = composition.widgets.card;
  const textLayers = composition.textLayers;
  const additionalPhotoLayer = composition.additionalPhoto;
  const quickTitle = resolveQuickTitle(composition);

  const chartVariant = chartLayer
    ? mapChartVariantForOverlay(chartLayer.variant)
    : null;

  return (
    <View
      testID="share-composer-canvas"
      style={[
        stylesWithTheme.canvasRoot,
        {
          width,
          height,
          borderRadius: 30,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={deselectLayerLabel}
        onPress={onBackgroundPress}
        style={StyleSheet.absoluteFill}
      />

      {!photoError ? (
        <DraggableItem
          id="mealPhoto"
          areaX={0}
          areaY={0}
          areaW={width}
          areaH={height}
          initialXRatio={composition.mealPhoto.transform.xRatio}
          initialYRatio={composition.mealPhoto.transform.yRatio}
          initialScale={composition.mealPhoto.transform.scale}
          initialRotation={composition.mealPhoto.transform.rotation}
          selected={false}
          layerZIndex={0}
          onTap={onBackgroundPress}
          enablePan={false}
          enablePinch={false}
          enableRotate={false}
          onUpdate={(xRatio, yRatio, scale, rotation) =>
            onTransformChange("mealPhoto", {
              xRatio,
              yRatio,
              scale,
              rotation,
            })
          }
        >
          <View
            style={[
              stylesWithTheme.mealPhotoWrap,
              {
                width,
                height,
              },
            ]}
          >
            <Image
              source={{ uri: mealPhotoUri }}
              style={stylesWithTheme.mealPhoto}
              resizeMode="cover"
              onError={() => setPhotoError(true)}
              blurRadius={0}
            />
            {selectedLayerId === "mealPhoto" && showEditorChrome ? (
              <View
                pointerEvents="none"
                style={stylesWithTheme.mealPhotoSelectedBorder}
              />
            ) : null}
          </View>
        </DraggableItem>
      ) : (
        <View style={[stylesWithTheme.photoFallback, { width, height }]}>
          <Text style={stylesWithTheme.photoFallbackText}>
            {photoUnavailableLabel}
          </Text>
        </View>
      )}

      {mode === "quick" ? (
        <QuickPresetOverlay
          width={width}
          presetId={composition.presetId}
          titleText={quickTitle}
          nutrition={nutrition}
          macroLabels={macroLabels}
          theme={theme}
          stylesWithTheme={stylesWithTheme}
        />
      ) : (
        <>
          {chartLayer && chartVariant ? (
            <DraggableItem
              id="chartWidget"
              areaX={0}
              areaY={0}
              areaW={width}
              areaH={height}
              initialXRatio={chartLayer.transform.xRatio}
              initialYRatio={chartLayer.transform.yRatio}
              initialScale={chartLayer.transform.scale}
              initialRotation={chartLayer.transform.rotation}
              selected={selectedLayerId === "chartWidget"}
              layerZIndex={20}
              onSelect={() => onSelectLayer("chartWidget")}
              onTap={() => onSelectLayer("chartWidget")}
              enablePan={interactive}
              enablePinch={interactive}
              enableRotate={interactive}
              onUpdate={(xRatio, yRatio, scale, rotation) =>
                onTransformChange("chartWidget", {
                  xRatio,
                  yRatio,
                  scale,
                  rotation,
                })
              }
            >
              <View
                style={[
                  stylesWithTheme.widgetWrap,
                  stylesWithTheme.chartWidgetWrap,
                ]}
              >
                <ChartOverlay
                  variant={chartVariant}
                  protein={nutrition.protein}
                  carbs={nutrition.carbs}
                  fat={nutrition.fat}
                  kcal={nutrition.kcal}
                  palette={{
                    text: theme.text,
                    macro: {
                      protein: theme.macro.protein,
                      carbs: theme.macro.carbs,
                      fat: theme.macro.fat,
                    },
                    accent: theme.primary,
                    accentSecondary: theme.primarySoft,
                  }}
                  showKcalLabel
                  showLegend
                  textColor={chartLayer.textColor ?? SHARE_OVERLAY_TEXT}
                  backgroundColor={chartLayer.backgroundColor ?? SHARE_OVERLAY_SURFACE}
                  fontFamily={theme.typography.fontFamily.semiBold}
                />
                {selectedLayerId === "chartWidget" && showEditorChrome ? (
                  <SelectedOutline />
                ) : null}
              </View>
            </DraggableItem>
          ) : null}

          {additionalPhotoLayer ? (
            <DraggableItem
              id="additionalPhoto"
              areaX={0}
              areaY={0}
              areaW={width}
              areaH={height}
              initialXRatio={additionalPhotoLayer.transform.xRatio}
              initialYRatio={additionalPhotoLayer.transform.yRatio}
              initialScale={additionalPhotoLayer.transform.scale}
              initialRotation={additionalPhotoLayer.transform.rotation}
              selected={selectedLayerId === "additionalPhoto"}
              layerZIndex={24}
              onSelect={() => onSelectLayer("additionalPhoto")}
              onTap={() => onSelectLayer("additionalPhoto")}
              enablePan={interactive}
              enablePinch={interactive}
              enableRotate={interactive}
              onUpdate={(xRatio, yRatio, scale, rotation) =>
                onTransformChange("additionalPhoto", {
                  xRatio,
                  yRatio,
                  scale,
                  rotation,
                })
              }
            >
              <View
                style={[
                  stylesWithTheme.additionalPhotoWrap,
                  additionalPhotoLayer.treatment === "frame"
                    ? stylesWithTheme.additionalPhotoFrame
                    : null,
                  additionalPhotoLayer.treatment === "shadow"
                    ? stylesWithTheme.additionalPhotoShadow
                    : null,
                  {
                    width: ADDITIONAL_PHOTO_SIZE.width,
                    height: ADDITIONAL_PHOTO_SIZE.height,
                    borderRadius:
                      additionalPhotoLayer.treatment === "pill" ? 18 : 14,
                  },
                ]}
              >
                <Image
                  source={{ uri: additionalPhotoLayer.uri }}
                  style={stylesWithTheme.additionalPhoto}
                  resizeMode="cover"
                  blurRadius={additionalPhotoLayer.treatment === "plain" ? 0 : 0.3}
                />
                {selectedLayerId === "additionalPhoto" && showEditorChrome ? (
                  <SelectedOutline />
                ) : null}
              </View>
            </DraggableItem>
          ) : null}

          {textLayers.map((textLayer) => {
            const isEditing = editingTextLayerId === textLayer.id && showEditorChrome;
            return (
              <DraggableItem
                key={textLayer.id}
                id={textLayer.id}
                areaX={0}
                areaY={0}
                areaW={width}
                areaH={height}
                initialXRatio={textLayer.transform.xRatio}
                initialYRatio={textLayer.transform.yRatio}
                initialScale={textLayer.transform.scale}
                initialRotation={textLayer.transform.rotation}
                selected={selectedLayerId === textLayer.id}
                layerZIndex={28}
                onSelect={() => onSelectLayer(textLayer.id)}
                onTap={() => onSelectLayer(textLayer.id)}
                onDoubleTap={() => {
                  if (!interactive) return;
                  onSelectLayer(textLayer.id);
                  setEditingTextLayerId(textLayer.id);
                }}
                enablePan={interactive && !isEditing}
                enablePinch={interactive && !isEditing}
                enableRotate={interactive && !isEditing}
                enableTap={!isEditing}
                onUpdate={(xRatio, yRatio, scale, rotation) =>
                  onTransformChange(textLayer.id, {
                    xRatio,
                    yRatio,
                    scale,
                    rotation,
                  })
                }
              >
                <View
                  style={[
                    stylesWithTheme.textWrap,
                    resolveTextReadabilityBackplate(textLayer.color),
                  ]}
                >
                  {isEditing ? (
                    <TextInput
                      autoFocus
                      value={textLayer.text}
                      onChangeText={(value) => onTextChange(textLayer.id, value)}
                      onBlur={() => setEditingTextLayerId(null)}
                      onSubmitEditing={() => setEditingTextLayerId(null)}
                      blurOnSubmit
                      returnKeyType="done"
                      multiline={false}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[
                        stylesWithTheme.textLayer,
                        stylesWithTheme.textLayerInput,
                        buildTextStyle(textLayer, theme),
                      ]}
                    />
                  ) : (
                    <Text style={[stylesWithTheme.textLayer, buildTextStyle(textLayer, theme)]}>
                      {textLayer.text}
                    </Text>
                  )}
                  {selectedLayerId === textLayer.id && showEditorChrome ? (
                    <SelectedOutline />
                  ) : null}
                </View>
              </DraggableItem>
            );
          })}

          {cardLayer ? (
            <DraggableItem
              id="cardWidget"
              areaX={0}
              areaY={0}
              areaW={width}
              areaH={height}
              initialXRatio={cardLayer.transform.xRatio}
              initialYRatio={cardLayer.transform.yRatio}
              initialScale={cardLayer.transform.scale}
              initialRotation={cardLayer.transform.rotation}
              selected={selectedLayerId === "cardWidget"}
              layerZIndex={32}
              onSelect={() => onSelectLayer("cardWidget")}
              onTap={() => onSelectLayer("cardWidget")}
              enablePan={interactive}
              enablePinch={interactive}
              enableRotate={interactive}
              onUpdate={(xRatio, yRatio, scale, rotation) =>
                onTransformChange("cardWidget", {
                  xRatio,
                  yRatio,
                  scale,
                  rotation,
                })
              }
            >
              <View
                style={[
                  stylesWithTheme.widgetWrap,
                  stylesWithTheme.cardWidgetWrap,
                ]}
              >
                <CardOverlay
                  protein={nutrition.protein}
                  carbs={nutrition.carbs}
                  fat={nutrition.fat}
                  kcal={nutrition.kcal}
                  variant={cardLayer.variant}
                  color={cardLayer.textColor ?? SHARE_OVERLAY_TEXT}
                  backgroundColor={cardLayer.backgroundColor ?? SHARE_OVERLAY_SURFACE}
                  fontFamily={theme.typography.fontFamily.semiBold}
                  fontWeight="500"
                  macroColorsOverride={{
                    protein: theme.macro.protein,
                    carbs: theme.macro.carbs,
                    fat: theme.macro.fat,
                  }}
                />
                {selectedLayerId === "cardWidget" && showEditorChrome ? (
                  <SelectedOutline />
                ) : null}
              </View>
            </DraggableItem>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  selectedOutline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(58,72,52,0.9)",
  },
  handle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FBF8F2",
    borderWidth: 1,
    borderColor: "rgba(58,72,52,0.9)",
  },
  handleTopLeft: {
    left: -3,
    top: -3,
  },
  handleTopRight: {
    right: -3,
    top: -3,
  },
  handleBottomLeft: {
    left: -3,
    bottom: -3,
  },
  handleBottomRight: {
    right: -3,
    bottom: -3,
  },
});

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    canvasRoot: {
      overflow: "hidden",
      backgroundColor: "#F8F3EB",
    },
    mealPhotoWrap: {
      borderRadius: 26,
      overflow: "hidden",
    },
    mealPhoto: {
      width: "100%",
      height: "100%",
    },
    mealPhotoSelectedBorder: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 26,
      borderWidth: 1.2,
      borderColor: "rgba(58,72,52,0.8)",
    },
    photoFallback: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 26,
    },
    photoFallbackText: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
    },
    widgetWrap: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
      overflow: "visible",
    },
    chartWidgetWrap: {
      alignSelf: "flex-start",
    },
    cardWidgetWrap: {
      alignItems: "stretch",
      minWidth: 180,
    },
    additionalPhotoWrap: {
      overflow: "hidden",
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: theme.surface,
    },
    additionalPhotoFrame: {
      borderWidth: 2,
      borderColor: "rgba(251,248,242,0.95)",
    },
    additionalPhotoShadow: {
      shadowColor: "#393128",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    additionalPhoto: {
      width: "100%",
      height: "100%",
    },
    textWrap: {
      position: "relative",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      maxWidth: 230,
    },
    textLayer: {
      fontSize: 32,
      lineHeight: 34,
      textShadowColor: "rgba(18,21,18,0.32)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
    },
    textLayerInput: {
      minWidth: 56,
      padding: 0,
      margin: 0,
      includeFontPadding: false,
    },
    quickClassicCard: {
      position: "absolute",
      backgroundColor: QUICK_CARD_SURFACE_STRONG,
      alignItems: "stretch",
      shadowColor: QUICK_TEXT_COLOR,
      shadowOpacity: 0.1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    quickPhotoTitle: {
      position: "absolute",
      fontFamily: theme.typography.fontFamily.bold,
      textShadowColor: "rgba(18,21,18,0.38)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
    },
    quickPhotoTopScrim: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    quickFloatingKcal: {
      position: "absolute",
      backgroundColor: "rgba(45,37,30,0.56)",
      borderWidth: 1,
      borderColor: "rgba(255,253,248,0.26)",
    },
    quickPhotoDataBar: {
      position: "absolute",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "rgba(35,30,25,0.78)",
      borderWidth: 1,
      borderColor: "rgba(255,253,248,0.28)",
      shadowColor: QUICK_TEXT_COLOR,
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    quickGlassPanel: {
      position: "absolute",
      backgroundColor: QUICK_DARK_SURFACE_STRONG,
      borderWidth: 1,
      borderColor: "rgba(255,253,248,0.26)",
      shadowColor: QUICK_TEXT_COLOR,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    quickGlassHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    quickTitle: {
      color: QUICK_TEXT_COLOR,
      fontFamily: theme.typography.fontFamily.bold,
      textAlign: "center",
    },
    quickKcal: {
      color: QUICK_TEXT_COLOR,
      fontFamily: theme.typography.fontFamily.medium,
    },
    quickClassicSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    quickClassicAccentLine: {
      flex: 1,
      flexDirection: "row",
      overflow: "hidden",
      backgroundColor: "rgba(57,49,40,0.12)",
    },
    quickClassicAccentSegment: {
      height: "100%",
    },
    quickMacroTile: {
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    quickMacroValueRow: {
      flexDirection: "row",
      alignItems: "center",
      minWidth: 0,
    },
    quickMacroIcon: {
      flexShrink: 0,
    },
    quickMacroValue: {
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    quickMacroName: {
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "left",
    },
    quickGlassMacroGrid: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    quickClassicMacroRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    quickBrandMark: {
      position: "absolute",
      borderWidth: 1,
    },
    quickBrandText: {
      fontFamily: theme.typography.fontFamily.semiBold,
      letterSpacing: 0,
    },
  });
