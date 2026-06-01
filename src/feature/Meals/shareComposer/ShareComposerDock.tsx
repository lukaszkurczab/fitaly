import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomActionBar } from "@/components/BottomActionBar";
import { useTheme } from "@/theme/useTheme";
import DockQuickPanel from "@/feature/Meals/shareComposer/components/DockQuickPanel";
import DockActiveLayerHeader from "@/feature/Meals/shareComposer/components/DockActiveLayerHeader";
import DockEditorOptions from "@/feature/Meals/shareComposer/components/DockEditorOptions";
import DockColorPickerModal from "@/feature/Meals/shareComposer/components/DockColorPickerModal";
import type {
  ActiveLayerEditorKind,
  ShareCardVariant,
  ShareChartVariant,
  ShareCompositionState,
  ShareExportState,
  ShareLayerId,
  ShareNutrition,
  SharePresetId,
  ShareTextLayerState,
} from "@/feature/Meals/shareComposer/types";
import type {
  CustomColorTarget,
  WidgetEditorMode,
} from "@/feature/Meals/shareComposer/components/dockEditorTypes";

type ShareComposerDockProps = {
  width?: number;
  contentWidth?: number;
  mode: "quick" | "customize";
  selectedPreset: SharePresetId;
  activeEditorKind: ActiveLayerEditorKind;
  selectedLayerId: ShareLayerId | null;
  composition: ShareCompositionState;
  mealPhotoUri: string;
  nutrition: ShareNutrition;
  exportState: ShareExportState;
  onPresetSelect: (presetId: SharePresetId) => void;
  onSaveToGallery: () => void;
  onShare: () => void;
  onRemoveSelectedLayer: () => void;
  onTextStyleChange: (
    id: string,
    patch: Partial<Pick<ShareTextLayerState, "bold" | "italic" | "underline" | "color">>,
  ) => void;
  onChartVariantChange: (variant: ShareChartVariant) => void;
  onChartStyleChange: (patch: { textColor?: string; backgroundColor?: string }) => void;
  onCardVariantChange: (variant: ShareCardVariant) => void;
  onCardStyleChange: (patch: { textColor?: string; backgroundColor?: string }) => void;
  onAdditionalPhotoReplace: () => void;
};

const DOCK_LAYOUT = {
  paddingTop: 8,
  itemGap: 4,
  footerHeight: 132,
  contentHeight: 76,
  quickContentHeight: 84,
  quickPhotoOverlap: 12,
  selectedContentHeight: 76,
  compactContentHeight: 66,
  idleContentHeight: 0,
  errorHeight: 32,
  emptyErrorHeight: 6,
  basePaddingBottom: 12,
  borderRadius: 24,
  grabberWidth: 34,
  grabberHeight: 3,
};

const FALLBACK_TEXT_COLOR = "#393128";
const FALLBACK_BACKGROUND_COLOR = "#FBF8F2";

function normalizeHexColor(input: string) {
  if (!input) return FALLBACK_TEXT_COLOR;
  const trimmed = input.trim();

  if (/^rgba?\(/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, "").toLowerCase();
  }

  if (trimmed.startsWith("#")) {
    return trimmed.toUpperCase();
  }

  return `#${trimmed.toUpperCase()}`;
}

function editorTitle(kind: ActiveLayerEditorKind, t: (key: string) => string) {
  switch (kind) {
    case "text":
      return t("dock.editing_text");
    case "chart":
      return t("dock.editing_chart");
    case "card":
      return t("dock.editing_card");
    case "additionalPhoto":
      return t("dock.editing_photo");
    case "mealPhoto":
      return t("dock.editing_meal_photo");
    default:
      return t("dock.add_element");
  }
}

function editorMetaLabel(kind: ActiveLayerEditorKind, t: (key: string) => string) {
  return kind === "none" ? t("dock.add_mode") : null;
}

function isLayerRemovable(layerId: ShareLayerId | null) {
  if (!layerId) return false;
  if (layerId === "mealPhoto") return false;
  if (layerId === "text:title") return false;
  return true;
}

export default function ShareComposerDock({
  width,
  contentWidth,
  mode,
  selectedPreset,
  activeEditorKind,
  selectedLayerId,
  composition,
  mealPhotoUri,
  nutrition,
  exportState,
  onPresetSelect,
  onSaveToGallery,
  onShare,
  onRemoveSelectedLayer,
  onTextStyleChange,
  onChartVariantChange,
  onChartStyleChange,
  onCardVariantChange,
  onCardStyleChange,
  onAdditionalPhotoReplace,
}: ShareComposerDockProps) {
  const theme = useTheme();
  const { t } = useTranslation("share");
  const insets = useSafeAreaInsets();
  const stylesWithTheme = useMemo(() => makeStyles(theme), [theme]);
  const bottomSafeAreaPadding = Math.max(
    DOCK_LAYOUT.basePaddingBottom,
    insets.bottom + theme.spacing.xs,
  );
  const hasEditorOptions = activeEditorKind !== "none";
  const [isTextColorPanelOpen, setIsTextColorPanelOpen] = useState(false);
  const [chartEditorMode, setChartEditorMode] = useState<WidgetEditorMode | null>(null);
  const [cardEditorMode, setCardEditorMode] = useState<WidgetEditorMode | null>(null);
  const [customColorTarget, setCustomColorTarget] = useState<CustomColorTarget | null>(null);

  const selectedTextLayer =
    selectedLayerId && selectedLayerId.startsWith("text:")
      ? composition.textLayers.find((layer) => layer.id === selectedLayerId) ?? null
      : null;
  const selectedChartLayer = composition.widgets.chart;
  const selectedCardLayer = composition.widgets.card;
  const textColorOptions = useMemo(
    () => [
      { label: t("dock.color_light"), value: "#FFFDF8" },
      { label: t("dock.color_dark"), value: "#393128" },
      { label: t("dock.color_olive"), value: theme.primary },
    ],
    [t, theme.primary],
  );

  const showRemove = isLayerRemovable(selectedLayerId);
  const isSaving = exportState.action === "save_to_gallery";
  const isSharing = exportState.action === "share";
  const hasExportError = Boolean(exportState.error);
  const failedExportAction = exportState.failedAction ?? null;
  const isQuickMode = mode === "quick";
  const contentSlotHeight =
    isQuickMode
      ? DOCK_LAYOUT.quickContentHeight
      : hasEditorOptions
        ? DOCK_LAYOUT.selectedContentHeight
        : DOCK_LAYOUT.idleContentHeight;
  const errorSlotHeight = hasExportError
    ? DOCK_LAYOUT.errorHeight
    : DOCK_LAYOUT.emptyErrorHeight;
  const dockHeight =
    DOCK_LAYOUT.paddingTop +
    DOCK_LAYOUT.grabberHeight +
    DOCK_LAYOUT.itemGap +
    contentSlotHeight +
    DOCK_LAYOUT.itemGap +
    errorSlotHeight +
    DOCK_LAYOUT.itemGap +
    DOCK_LAYOUT.footerHeight +
    bottomSafeAreaPadding +
    (isQuickMode ? DOCK_LAYOUT.quickPhotoOverlap : 0);
  const selectedTextColor = selectedTextLayer?.color ?? FALLBACK_TEXT_COLOR;
  const selectedChartTextColor = selectedChartLayer?.textColor ?? FALLBACK_TEXT_COLOR;
  const selectedChartBackgroundColor =
    selectedChartLayer?.backgroundColor ?? FALLBACK_BACKGROUND_COLOR;
  const selectedCardTextColor = selectedCardLayer?.textColor ?? FALLBACK_TEXT_COLOR;
  const selectedCardBackgroundColor =
    selectedCardLayer?.backgroundColor ?? FALLBACK_BACKGROUND_COLOR;
  const normalizedSelectedTextColor = normalizeHexColor(selectedTextColor);
  const normalizedSelectedChartTextColor = normalizeHexColor(selectedChartTextColor);
  const normalizedSelectedChartBackgroundColor = normalizeHexColor(
    selectedChartBackgroundColor,
  );
  const normalizedSelectedCardTextColor = normalizeHexColor(selectedCardTextColor);
  const normalizedSelectedCardBackgroundColor = normalizeHexColor(
    selectedCardBackgroundColor,
  );
  const usesPresetTextColor = textColorOptions.some(
    (option) => normalizeHexColor(option.value) === normalizedSelectedTextColor,
  );
  const usesPresetChartTextColor = textColorOptions.some(
    (option) => normalizeHexColor(option.value) === normalizedSelectedChartTextColor,
  );
  const usesPresetChartBackgroundColor = textColorOptions.some(
    (option) => normalizeHexColor(option.value) === normalizedSelectedChartBackgroundColor,
  );
  const usesPresetCardTextColor = textColorOptions.some(
    (option) => normalizeHexColor(option.value) === normalizedSelectedCardTextColor,
  );
  const usesPresetCardBackgroundColor = textColorOptions.some(
    (option) => normalizeHexColor(option.value) === normalizedSelectedCardBackgroundColor,
  );

  useEffect(() => {
    if (activeEditorKind !== "text" || !selectedTextLayer) {
      setIsTextColorPanelOpen(false);
    }
    if (activeEditorKind !== "chart") {
      setChartEditorMode(null);
    }
    if (activeEditorKind !== "card") {
      setCardEditorMode(null);
    }
    if (
      (customColorTarget === "text" && activeEditorKind !== "text") ||
      ((customColorTarget === "chartText" || customColorTarget === "chartBackground") &&
        activeEditorKind !== "chart") ||
      ((customColorTarget === "cardText" || customColorTarget === "cardBackground") &&
        activeEditorKind !== "card") ||
      (activeEditorKind !== "text" &&
        activeEditorKind !== "chart" &&
        activeEditorKind !== "card")
    ) {
      setCustomColorTarget(null);
    }
  }, [activeEditorKind, customColorTarget, selectedTextLayer]);

  const applyTextColor = (color: string) => {
    if (!selectedTextLayer) return;
    onTextStyleChange(selectedTextLayer.id, {
      color: normalizeHexColor(color),
    });
  };

  const applyChartTextColor = (color: string) => {
    onChartStyleChange({ textColor: normalizeHexColor(color) });
  };

  const applyChartBackgroundColor = (color: string) => {
    onChartStyleChange({ backgroundColor: normalizeHexColor(color) });
  };

  const applyCardTextColor = (color: string) => {
    onCardStyleChange({ textColor: normalizeHexColor(color) });
  };

  const applyCardBackgroundColor = (color: string) => {
    onCardStyleChange({ backgroundColor: normalizeHexColor(color) });
  };

  const customColorValue =
    customColorTarget === "text"
      ? selectedTextColor
      : customColorTarget === "chartText"
        ? selectedChartTextColor
        : customColorTarget === "chartBackground"
          ? selectedChartBackgroundColor
          : customColorTarget === "cardText"
            ? selectedCardTextColor
            : customColorTarget === "cardBackground"
              ? selectedCardBackgroundColor
              : FALLBACK_TEXT_COLOR;

  const normalizedCustomColorValue = normalizeHexColor(customColorValue);
  const isBackgroundCustomTarget =
    customColorTarget === "chartBackground" ||
    customColorTarget === "cardBackground";

  const applyCustomColor = (color: string) => {
    if (!customColorTarget) return;
    if (customColorTarget === "text") {
      applyTextColor(color);
      return;
    }
    if (customColorTarget === "chartText") {
      applyChartTextColor(color);
      return;
    }
    if (customColorTarget === "chartBackground") {
      applyChartBackgroundColor(color);
      return;
    }
    if (customColorTarget === "cardText") {
      applyCardTextColor(color);
      return;
    }
    applyCardBackgroundColor(color);
  };

  return (
    <View
      style={[
        stylesWithTheme.dock,
        isQuickMode ? stylesWithTheme.quickDock : null,
        { height: dockHeight, paddingBottom: 0 },
        typeof width === "number" ? { width } : null,
      ]}
      testID="share-composer-dock"
    >
      <View
        style={isQuickMode ? stylesWithTheme.quickGrabber : stylesWithTheme.grabber}
      />
      <View
        style={[
          stylesWithTheme.contentSlot,
          isQuickMode ? stylesWithTheme.quickContentSlot : null,
          {
            minHeight: contentSlotHeight,
            maxHeight: contentSlotHeight,
          },
          typeof contentWidth === "number" ? { width: contentWidth } : null,
        ]}
      >
        {mode === "quick" ? (
          <DockQuickPanel
            selectedPreset={selectedPreset}
            mealPhotoUri={mealPhotoUri}
            nutrition={nutrition}
            presetAccessibilityLabels={{
              quickClassic: t("dock.preset_photo_first"),
              quickSidebar: t("dock.preset_balanced_glass"),
              quickFooter: t("dock.preset_clean_summary"),
            }}
            onPresetSelect={onPresetSelect}
          />
        ) : (
          <View
            style={[
              stylesWithTheme.customizePanel,
              !hasEditorOptions ? stylesWithTheme.customizePanelCompact : null,
            ]}
            testID={hasEditorOptions ? "share-selected-layer-tray" : "share-customize-idle-tray"}
          >
            {hasEditorOptions ? (
              <>
                <DockActiveLayerHeader
                  metaLabel={editorMetaLabel(activeEditorKind, t)}
                  title={editorTitle(activeEditorKind, t)}
                  showRemove={showRemove}
                  removeLabel={t("dock.remove")}
                  onRemove={onRemoveSelectedLayer}
                />
                <DockEditorOptions
                  activeEditorKind={activeEditorKind}
                  selectedTextLayer={selectedTextLayer}
                  composition={composition}
                  textColorOptions={textColorOptions}
                  normalizedSelectedTextColor={normalizedSelectedTextColor}
                  normalizedSelectedChartTextColor={normalizedSelectedChartTextColor}
                  normalizedSelectedChartBackgroundColor={normalizedSelectedChartBackgroundColor}
                  normalizedSelectedCardTextColor={normalizedSelectedCardTextColor}
                  normalizedSelectedCardBackgroundColor={normalizedSelectedCardBackgroundColor}
                  usesPresetTextColor={usesPresetTextColor}
                  usesPresetChartTextColor={usesPresetChartTextColor}
                  usesPresetChartBackgroundColor={usesPresetChartBackgroundColor}
                  usesPresetCardTextColor={usesPresetCardTextColor}
                  usesPresetCardBackgroundColor={usesPresetCardBackgroundColor}
                  isTextColorPanelOpen={isTextColorPanelOpen}
                  chartEditorMode={chartEditorMode}
                  cardEditorMode={cardEditorMode}
                  setIsTextColorPanelOpen={setIsTextColorPanelOpen}
                  setChartEditorMode={setChartEditorMode}
                  setCardEditorMode={setCardEditorMode}
                  setCustomColorTarget={setCustomColorTarget}
                  applyTextColor={applyTextColor}
                  applyChartTextColor={applyChartTextColor}
                  applyChartBackgroundColor={applyChartBackgroundColor}
                  applyCardTextColor={applyCardTextColor}
                  applyCardBackgroundColor={applyCardBackgroundColor}
                  normalizeHexColor={normalizeHexColor}
                  onTextStyleChange={onTextStyleChange}
                  onChartVariantChange={onChartVariantChange}
                  onCardVariantChange={onCardVariantChange}
                  onAdditionalPhotoReplace={onAdditionalPhotoReplace}
                  t={t}
                />
              </>
            ) : null}
          </View>
        )}
      </View>

      <View
        style={[
          stylesWithTheme.errorSlot,
          hasExportError ? stylesWithTheme.errorSlotVisible : null,
          typeof contentWidth === "number" ? { width: contentWidth } : null,
        ]}
      >
        {exportState.error ? (
          <View
            style={[
              stylesWithTheme.errorCard,
              failedExportAction === "share" ? stylesWithTheme.errorCardShare : null,
            ]}
          >
            <View style={stylesWithTheme.errorAccent} />
            <Text testID="share-export-error" style={stylesWithTheme.errorText}>
              {exportState.error}
            </Text>
          </View>
        ) : null}
      </View>

      <BottomActionBar
        testID="share-composer-actions"
        bottomInset={bottomSafeAreaPadding}
        primaryAction={{
          testID: "share-system-share-button",
          label: t("share"),
          onPress: onShare,
          loading: isSharing,
        }}
        secondaryAction={{
          testID: "share-save-gallery-button",
          label: t("dock.save_to_gallery"),
          onPress: onSaveToGallery,
          loading: isSaving,
        }}
      />

      <DockColorPickerModal
        visible={customColorTarget !== null}
        onClose={() => setCustomColorTarget(null)}
        closeLabel={t("dock.close_color_picker", {
          defaultValue: "Close color picker",
        })}
        doneLabel={t("dock.done")}
        title={isBackgroundCustomTarget ? t("dock.background_color") : t("dock.text_color")}
        colorValue={customColorValue}
        normalizedColorValue={normalizedCustomColorValue}
        showOpacity={isBackgroundCustomTarget}
        onApplyColor={applyCustomColor}
      />
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    dock: {
      position: "absolute",
      bottom: 0,
      alignSelf: "center",
      zIndex: 10,
      backgroundColor: theme.surfaceElevated,
      borderRadius: DOCK_LAYOUT.borderRadius,
      borderWidth: 1,
      borderColor: theme.isDark
        ? "rgba(166,189,160,0.22)"
        : "rgba(79,104,75,0.14)",
      overflow: "hidden",
      paddingTop: DOCK_LAYOUT.paddingTop,
      paddingHorizontal: 10,
      paddingBottom: DOCK_LAYOUT.basePaddingBottom,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.5 : 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      gap: DOCK_LAYOUT.itemGap,
    },
    quickDock: {
      backgroundColor: "transparent",
      borderWidth: 0,
      borderColor: "transparent",
      borderRadius: 0,
      overflow: "visible",
      paddingHorizontal: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    contentSlot: {
      alignSelf: "center",
      justifyContent: "space-between",
      overflow: "hidden",
    },
    quickContentSlot: {
      justifyContent: "flex-end",
      overflow: "visible",
      zIndex: 20,
    },
    grabber: {
      alignSelf: "center",
      width: DOCK_LAYOUT.grabberWidth,
      height: DOCK_LAYOUT.grabberHeight,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    quickGrabber: {
      alignSelf: "center",
      width: DOCK_LAYOUT.grabberWidth,
      height: DOCK_LAYOUT.grabberHeight,
      opacity: 0,
    },
    customizePanel: {
      gap: 4,
    },
    customizePanelCompact: {
      gap: 0,
    },
    errorCard: {
      minHeight: DOCK_LAYOUT.errorHeight,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.isDark
        ? "rgba(200,93,76,0.28)"
        : "rgba(194,78,61,0.18)",
      backgroundColor: theme.isDark
        ? "rgba(200,93,76,0.06)"
        : "rgba(194,78,61,0.045)",
      paddingVertical: 3,
      paddingLeft: 11,
      paddingRight: 8,
      justifyContent: "center",
      position: "relative",
    },
    errorCardShare: {
      borderRightColor: theme.error.main,
    },
    errorAccent: {
      position: "absolute",
      left: 0,
      top: 10,
      bottom: 10,
      width: 2,
      borderTopRightRadius: 2,
      borderBottomRightRadius: 2,
      backgroundColor: theme.error.main,
    },
    errorText: {
      color: theme.error.text,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 10.5,
      lineHeight: 13,
    },
    errorSlot: {
      alignSelf: "center",
      minHeight: DOCK_LAYOUT.emptyErrorHeight,
      justifyContent: "center",
    },
    errorSlotVisible: {
      minHeight: DOCK_LAYOUT.errorHeight,
    },
  });
