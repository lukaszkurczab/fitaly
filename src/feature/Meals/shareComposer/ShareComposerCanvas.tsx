import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  nutrition: ShareNutrition;
  composition: ShareCompositionState;
  mode: "quick" | "customize";
  selectedLayerId: ShareLayerId | null;
  onSelectLayer: (layerId: ShareLayerId) => void;
  onTextChange: (id: string, text: string) => void;
  onTransformChange: (layerId: ShareLayerId, next: TransformState) => void;
  onBackgroundPress: () => void;
};

const ADDITIONAL_PHOTO_SIZE = { width: 52, height: 76 };
const DESIGN_CANVAS_WIDTH = 333;
const QUICK_CARD_SURFACE = "rgba(251,248,242,0.9)";
const QUICK_TEXT_COLOR = "#393128";

function mapChartVariantForOverlay(variant: ShareChartLayerState["variant"]) {
  if (variant === "macroPie") {
    return "macroPieWithLegend" as const;
  }
  return variant;
}

function buildTextStyle(textLayer: ShareTextLayerState, theme: ReturnType<typeof useTheme>) {
  return {
    color: textLayer.color,
    fontFamily: textLayer.bold
      ? theme.typography.fontFamily.bold
      : theme.typography.fontFamily.medium,
    fontStyle: textLayer.italic ? ("italic" as const) : ("normal" as const),
    textDecorationLine: textLayer.underline
      ? ("underline" as const)
      : ("none" as const),
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

function QuickPresetOverlay({
  width,
  height,
  presetId,
  titleText,
  nutrition,
  theme,
  stylesWithTheme,
}: {
  width: number;
  height: number;
  presetId: ShareCompositionState["presetId"];
  titleText: string;
  nutrition: ShareNutrition;
  theme: ReturnType<typeof useTheme>;
  stylesWithTheme: ReturnType<typeof makeStyles>;
}) {
  const scale = width / DESIGN_CANVAS_WIDTH;
  const s = (value: number) => value * scale;

  const kcal = normalizeMetric(nutrition.kcal);
  const protein = normalizeMetric(nutrition.protein);
  const carbs = normalizeMetric(nutrition.carbs);
  const fat = normalizeMetric(nutrition.fat);

  const proteinLabel = `${protein}g protein`;
  const carbsLabel = `${carbs}g carbs`;
  const fatLabel = `${fat}g fat`;

  if (presetId === "quickSidebar") {
    return (
      <View
        pointerEvents="none"
        style={[
          stylesWithTheme.quickSidebarCard,
          {
            width: s(130),
            height,
            borderTopRightRadius: s(28),
            borderBottomRightRadius: s(28),
            paddingTop: s(49),
            paddingHorizontal: s(8),
          },
        ]}
      >
        <Text
          numberOfLines={4}
          style={[
            stylesWithTheme.quickTitle,
            {
              color: QUICK_TEXT_COLOR,
              fontSize: s(22),
              lineHeight: s(30),
              width: s(114),
              textAlign: "left",
            },
          ]}
        >
          {titleText}
        </Text>
        <Text
          style={[
            stylesWithTheme.quickKcal,
            {
              color: QUICK_TEXT_COLOR,
              fontSize: s(16),
              lineHeight: s(20),
              marginTop: s(6),
            },
          ]}
        >
          {kcal} kcal
        </Text>
        <View style={{ marginTop: s(28), gap: s(12), width: s(114) }}>
          <Text
            style={[
              stylesWithTheme.quickMacroLabel,
              {
                color: theme.macro.protein,
                fontSize: s(12),
                lineHeight: s(12),
              },
            ]}
          >
            {proteinLabel}
          </Text>
          <Text
            style={[
              stylesWithTheme.quickMacroLabel,
              {
                color: theme.macro.carbs,
                fontSize: s(12),
                lineHeight: s(12),
              },
            ]}
          >
            {carbsLabel}
          </Text>
          <Text
            style={[
              stylesWithTheme.quickMacroLabel,
              {
                color: theme.macro.fat,
                fontSize: s(12),
                lineHeight: s(12),
              },
            ]}
          >
            {fatLabel}
          </Text>
        </View>
      </View>
    );
  }

  if (presetId === "quickFooter") {
    const footerTop = s(381);

    return (
      <View
        pointerEvents="none"
        style={[
          stylesWithTheme.quickFooterCard,
          {
            left: 0,
            right: 0,
            top: footerTop,
            minHeight: Math.max(0, height - footerTop),
            borderBottomLeftRadius: s(6),
            borderBottomRightRadius: s(6),
            paddingTop: s(20),
            paddingHorizontal: s(24),
            paddingBottom: s(20),
          },
        ]}
      >
        <View style={stylesWithTheme.quickFooterRow}>
          <View style={{ width: s(152), gap: s(6) }}>
            <Text
              numberOfLines={2}
              style={[
                stylesWithTheme.quickTitle,
                {
                  color: QUICK_TEXT_COLOR,
                  fontSize: s(22),
                  lineHeight: s(30),
                  textAlign: "left",
                },
              ]}
            >
              {titleText}
            </Text>
            <Text
              style={[
                stylesWithTheme.quickKcal,
                {
                  color: QUICK_TEXT_COLOR,
                  fontSize: s(16),
                  lineHeight: s(20),
                },
              ]}
            >
              {kcal} kcal
            </Text>
          </View>
          <View style={{ width: s(70), gap: s(12), marginTop: s(13) }}>
            <Text
              style={[
                stylesWithTheme.quickMacroLabel,
                {
                  color: theme.macro.protein,
                  fontSize: s(12),
                  lineHeight: s(12),
                },
              ]}
            >
              {proteinLabel}
            </Text>
            <Text
              style={[
                stylesWithTheme.quickMacroLabel,
                {
                  color: theme.macro.carbs,
                  fontSize: s(12),
                  lineHeight: s(12),
                },
              ]}
            >
              {carbsLabel}
            </Text>
            <Text
              style={[
                stylesWithTheme.quickMacroLabel,
                {
                  color: theme.macro.fat,
                  fontSize: s(12),
                  lineHeight: s(12),
                },
              ]}
            >
              {fatLabel}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        stylesWithTheme.quickClassicCard,
        {
          left: s(20),
          top: s(10),
          width: s(293),
          minHeight: s(125),
          borderRadius: s(28),
          paddingTop: s(20),
          paddingHorizontal: s(18),
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
            fontSize: s(22),
            lineHeight: s(30),
            width: s(257),
          },
        ]}
      >
        {titleText}
      </Text>
      <Text
        style={[
          stylesWithTheme.quickKcal,
          {
            color: QUICK_TEXT_COLOR,
            fontSize: s(16),
            lineHeight: s(20),
            marginTop: s(6),
          },
        ]}
      >
        {kcal} kcal
      </Text>

      <View
        style={[
          stylesWithTheme.quickClassicTrack,
          {
            marginTop: s(12),
            width: s(257),
            height: s(4),
            borderRadius: s(2),
          },
        ]}
      >
        <View style={[stylesWithTheme.quickClassicFillRow, { gap: s(3) }]}>
          <View
            style={[
              stylesWithTheme.quickClassicFill,
              {
                width: s(132),
                borderRadius: s(2),
                backgroundColor: theme.macro.protein,
              },
            ]}
          />
          <View
            style={[
              stylesWithTheme.quickClassicFill,
              {
                width: s(81),
                borderRadius: s(2),
                backgroundColor: theme.macro.carbs,
              },
            ]}
          />
          <View
            style={[
              stylesWithTheme.quickClassicFill,
              {
                width: s(38),
                borderRadius: s(2),
                backgroundColor: theme.macro.fat,
              },
            ]}
          />
        </View>
      </View>

      <View
        style={[
          stylesWithTheme.quickClassicMacroRow,
          {
            marginTop: s(10),
            width: s(257),
          },
        ]}
      >
        <Text
          style={[
            stylesWithTheme.quickMacroLabel,
            {
              color: theme.macro.protein,
              fontSize: s(12),
              lineHeight: s(12),
            },
          ]}
        >
          {proteinLabel}
        </Text>
        <Text
          style={[
            stylesWithTheme.quickMacroLabel,
            {
              color: theme.macro.carbs,
              fontSize: s(12),
              lineHeight: s(12),
            },
          ]}
        >
          {carbsLabel}
        </Text>
        <Text
          style={[
            stylesWithTheme.quickMacroLabel,
            {
              color: theme.macro.fat,
              fontSize: s(12),
              lineHeight: s(12),
            },
          ]}
        >
          {fatLabel}
        </Text>
      </View>
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
  nutrition,
  composition,
  mode,
  selectedLayerId,
  onSelectLayer,
  onTextChange,
  onTransformChange,
  onBackgroundPress,
}: ShareComposerCanvasProps) {
  const theme = useTheme();
  const [photoError, setPhotoError] = useState(false);
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
  const interactive = mode === "customize";
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
        accessibilityLabel="Deselect layer"
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
          enablePan={interactive}
          enablePinch={interactive}
          enableRotate={interactive}
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
            {selectedLayerId === "mealPhoto" && interactive ? (
              <View
                pointerEvents="none"
                style={stylesWithTheme.mealPhotoSelectedBorder}
              />
            ) : null}
          </View>
        </DraggableItem>
      ) : (
        <View style={[stylesWithTheme.photoFallback, { width, height }]}>
          <Text style={stylesWithTheme.photoFallbackText}>Photo unavailable</Text>
        </View>
      )}

      {mode === "quick" ? (
        <QuickPresetOverlay
          width={width}
          height={height}
          presetId={composition.presetId}
          titleText={quickTitle}
          nutrition={nutrition}
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
                  textColor={chartLayer.textColor ?? theme.text}
                  backgroundColor={chartLayer.backgroundColor}
                  fontFamily={theme.typography.fontFamily.semiBold}
                />
                {selectedLayerId === "chartWidget" && interactive ? (
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
                {selectedLayerId === "additionalPhoto" && interactive ? (
                  <SelectedOutline />
                ) : null}
              </View>
            </DraggableItem>
          ) : null}

          {textLayers.map((textLayer) => {
            const isEditing = editingTextLayerId === textLayer.id && interactive;
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
                <View style={stylesWithTheme.textWrap}>
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
                  {selectedLayerId === textLayer.id && interactive ? (
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
                  color={cardLayer.textColor ?? theme.text}
                  backgroundColor={cardLayer.backgroundColor}
                  fontFamily={theme.typography.fontFamily.semiBold}
                  fontWeight="500"
                  macroColorsOverride={{
                    protein: theme.macro.protein,
                    carbs: theme.macro.carbs,
                    fat: theme.macro.fat,
                  }}
                />
                {selectedLayerId === "cardWidget" && interactive ? (
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
    },
    textLayerInput: {
      minWidth: 56,
      padding: 0,
      margin: 0,
      includeFontPadding: false,
    },
    quickClassicCard: {
      position: "absolute",
      backgroundColor: QUICK_CARD_SURFACE,
      alignItems: "center",
      shadowColor: QUICK_TEXT_COLOR,
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 6,
    },
    quickSidebarCard: {
      position: "absolute",
      left: 0,
      top: 0,
      backgroundColor: QUICK_CARD_SURFACE,
      borderTopLeftRadius: 30,
      borderBottomLeftRadius: 30,
      shadowColor: QUICK_TEXT_COLOR,
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 6,
    },
    quickFooterCard: {
      position: "absolute",
      backgroundColor: QUICK_CARD_SURFACE,
      shadowColor: QUICK_TEXT_COLOR,
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 6,
    },
    quickFooterRow: {
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
    quickMacroLabel: {
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "left",
    },
    quickClassicTrack: {
      backgroundColor: theme.border,
      overflow: "hidden",
      justifyContent: "center",
    },
    quickClassicFillRow: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
    },
    quickClassicFill: {
      height: "100%",
    },
    quickClassicMacroRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
  });
