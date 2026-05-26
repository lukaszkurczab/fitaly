import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import DockQuickPanel from "@/feature/Meals/shareComposer/components/DockQuickPanel";
import DockActiveLayerHeader from "@/feature/Meals/shareComposer/components/DockActiveLayerHeader";
import DockEditorOptions from "@/feature/Meals/shareComposer/components/DockEditorOptions";
import DockUtilityRow from "@/feature/Meals/shareComposer/components/DockUtilityRow";
import FlowActionButton from "@/feature/Meals/shareComposer/components/FlowActionButton";
import DockColorPickerModal from "@/feature/Meals/shareComposer/components/DockColorPickerModal";
import type {
  ActiveLayerEditorKind,
  ShareCardVariant,
  ShareChartVariant,
  ShareCompositionState,
  ShareExportState,
  ShareLayerId,
  SharePresetId,
  ShareTextLayerState,
} from "@/feature/Meals/shareComposer/types";
import type {
  CustomColorTarget,
  WidgetEditorMode,
} from "@/feature/Meals/shareComposer/components/dockEditorTypes";

type ShareComposerDockProps = {
  width?: number;
  mode: "quick" | "customize";
  selectedPreset: SharePresetId;
  activeEditorKind: ActiveLayerEditorKind;
  selectedLayerId: ShareLayerId | null;
  composition: ShareCompositionState;
  mealPhotoUri: string;
  exportState: ShareExportState;
  onPresetSelect: (presetId: SharePresetId) => void;
  onSaveToGallery: () => void;
  onShare: () => void;
  onRemoveSelectedLayer: () => void;
  onResetComposition: () => void;
  onTextStyleChange: (
    id: string,
    patch: Partial<Pick<ShareTextLayerState, "bold" | "italic" | "underline" | "color">>,
  ) => void;
  onChartVariantChange: (variant: ShareChartVariant) => void;
  onChartStyleChange: (patch: { textColor?: string; backgroundColor?: string }) => void;
  onCardVariantChange: (variant: ShareCardVariant) => void;
  onCardStyleChange: (patch: { textColor?: string; backgroundColor?: string }) => void;
  onAdditionalPhotoTreatmentChange: (
    treatment: NonNullable<ShareCompositionState["additionalPhoto"]>["treatment"],
  ) => void;
  onAddTextLayer: () => void;
  onEnsureChartLayer: () => void;
  onEnsureCardLayer: () => void;
  onAddOrReplaceAdditionalPhoto: () => void;
};

const DOCK_LAYOUT = {
  fixedHeight: 188,
  contentHeight: 78,
  errorHeight: 18,
  borderRadius: 28,
  grabberWidth: 37,
  grabberHeight: 4,
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

function isLayerRemovable(layerId: ShareLayerId | null) {
  if (!layerId) return false;
  if (layerId === "mealPhoto") return false;
  if (layerId === "text:title") return false;
  return true;
}

export default function ShareComposerDock({
  width,
  mode,
  selectedPreset,
  activeEditorKind,
  selectedLayerId,
  composition,
  mealPhotoUri,
  exportState,
  onPresetSelect,
  onSaveToGallery,
  onShare,
  onRemoveSelectedLayer,
  onResetComposition,
  onTextStyleChange,
  onChartVariantChange,
  onChartStyleChange,
  onCardVariantChange,
  onCardStyleChange,
  onAdditionalPhotoTreatmentChange,
  onAddTextLayer,
  onEnsureChartLayer,
  onEnsureCardLayer,
  onAddOrReplaceAdditionalPhoto,
}: ShareComposerDockProps) {
  const theme = useTheme();
  const { t } = useTranslation("share");
  const stylesWithTheme = useMemo(() => makeStyles(theme), [theme]);
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
      { label: "Cream", value: "#FFFDF8" },
      { label: "Ink", value: "#393128" },
      { label: "Olive", value: theme.primary },
    ],
    [theme.primary],
  );

  const showRemove = isLayerRemovable(selectedLayerId);
  const isSaving = exportState.action === "save_to_gallery";
  const isSharing = exportState.action === "share";
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
      style={[stylesWithTheme.dock, typeof width === "number" ? { width } : null]}
      testID="share-composer-dock"
    >
      <View style={stylesWithTheme.grabber} />
      <View style={stylesWithTheme.contentSlot}>
        {mode === "quick" ? (
          <DockQuickPanel
            selectedPreset={selectedPreset}
            mealPhotoUri={mealPhotoUri}
            presetsLabel={t("dock.presets")}
            onPresetSelect={onPresetSelect}
          />
        ) : (
          <View
            style={[
              stylesWithTheme.customizePanel,
              !hasEditorOptions ? stylesWithTheme.customizePanelCompact : null,
            ]}
          >
            <DockActiveLayerHeader
              metaLabel={t("dock.active_layer")}
              title={editorTitle(activeEditorKind, t)}
              showRemove={showRemove}
              removeLabel={t("dock.remove")}
              onRemove={onRemoveSelectedLayer}
            />

            {hasEditorOptions ? (
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
                onAdditionalPhotoTreatmentChange={onAdditionalPhotoTreatmentChange}
                t={t}
              />
            ) : null}

            {activeEditorKind === "none" ? (
              <DockUtilityRow
                textLabel={t("dock.utility_text")}
                chartLabel={t("dock.utility_chart")}
                cardLabel={t("dock.utility_card")}
                photoLabel={t("dock.utility_photo")}
                resetLabel={t("dock.utility_reset")}
                onAddTextLayer={onAddTextLayer}
                onEnsureChartLayer={onEnsureChartLayer}
                onEnsureCardLayer={onEnsureCardLayer}
                onAddOrReplaceAdditionalPhoto={onAddOrReplaceAdditionalPhoto}
                onResetComposition={onResetComposition}
              />
            ) : null}
          </View>
        )}
      </View>

      <View style={stylesWithTheme.errorSlot}>
        {exportState.error ? (
          <Text
            testID="share-export-error"
            numberOfLines={1}
            style={stylesWithTheme.errorText}
          >
            {exportState.error}
          </Text>
        ) : null}
      </View>

      <View style={stylesWithTheme.flowFooter}>
        <FlowActionButton
          testID="share-save-gallery-button"
          label={t("dock.save_to_gallery")}
          primary={false}
          loading={isSaving}
          onPress={onSaveToGallery}
        />
        <FlowActionButton
          testID="share-system-share-button"
          label={t("share")}
          primary
          loading={isSharing}
          onPress={onShare}
        />
      </View>

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
      backgroundColor: theme.surfaceElevated,
      borderRadius: DOCK_LAYOUT.borderRadius,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      height: DOCK_LAYOUT.fixedHeight,
      overflow: "hidden",
      paddingTop: 10,
      paddingHorizontal: 12,
      paddingBottom: 10,
      ...theme.depth.modal,
      gap: 8,
    },
    contentSlot: {
      minHeight: DOCK_LAYOUT.contentHeight,
      maxHeight: DOCK_LAYOUT.contentHeight,
      justifyContent: "center",
    },
    grabber: {
      alignSelf: "center",
      width: DOCK_LAYOUT.grabberWidth,
      height: DOCK_LAYOUT.grabberHeight,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    customizePanel: {
      gap: 8,
    },
    customizePanelCompact: {
      gap: 0,
    },
    errorText: {
      color: theme.error.main,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      paddingHorizontal: 10,
    },
    errorSlot: {
      minHeight: DOCK_LAYOUT.errorHeight,
      justifyContent: "center",
    },
    flowFooter: {
      flexDirection: "row",
      gap: 9,
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      paddingTop: 0,
    },
  });
