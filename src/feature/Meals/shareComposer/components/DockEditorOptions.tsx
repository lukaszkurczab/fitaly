import { ScrollView, StyleSheet } from "react-native";
import DockChip from "@/feature/Meals/shareComposer/components/DockChip";
import type {
  ActiveLayerEditorKind,
  ShareCardVariant,
  ShareChartVariant,
  ShareCompositionState,
  ShareTextLayerState,
} from "@/feature/Meals/shareComposer/types";
import type {
  CustomColorTarget,
  WidgetEditorMode,
} from "@/feature/Meals/shareComposer/components/dockEditorTypes";

type DockEditorOptionsProps = {
  activeEditorKind: ActiveLayerEditorKind;
  selectedTextLayer: ShareTextLayerState | null;
  composition: ShareCompositionState;
  textColorOptions: Array<{ label: string; value: string }>;
  normalizedSelectedTextColor: string;
  normalizedSelectedChartTextColor: string;
  normalizedSelectedChartBackgroundColor: string;
  normalizedSelectedCardTextColor: string;
  normalizedSelectedCardBackgroundColor: string;
  usesPresetTextColor: boolean;
  usesPresetChartTextColor: boolean;
  usesPresetChartBackgroundColor: boolean;
  usesPresetCardTextColor: boolean;
  usesPresetCardBackgroundColor: boolean;
  isTextColorPanelOpen: boolean;
  chartEditorMode: WidgetEditorMode | null;
  cardEditorMode: WidgetEditorMode | null;
  setIsTextColorPanelOpen: (open: boolean) => void;
  setChartEditorMode: (mode: WidgetEditorMode | null) => void;
  setCardEditorMode: (mode: WidgetEditorMode | null) => void;
  setCustomColorTarget: (target: CustomColorTarget | null) => void;
  applyTextColor: (color: string) => void;
  applyChartTextColor: (color: string) => void;
  applyChartBackgroundColor: (color: string) => void;
  applyCardTextColor: (color: string) => void;
  applyCardBackgroundColor: (color: string) => void;
  normalizeHexColor: (input: string) => string;
  onTextStyleChange: (
    id: string,
    patch: Partial<Pick<ShareTextLayerState, "bold" | "italic" | "underline" | "color">>,
  ) => void;
  onChartVariantChange: (variant: ShareChartVariant) => void;
  onCardVariantChange: (variant: ShareCardVariant) => void;
  onAdditionalPhotoReplace: () => void;
  t: (key: string) => string;
};

function resolveTrayTestID(
  activeEditorKind: ActiveLayerEditorKind,
  isTextColorPanelOpen: boolean,
  chartEditorMode: WidgetEditorMode | null,
  cardEditorMode: WidgetEditorMode | null,
) {
  if (activeEditorKind === "text") {
    return isTextColorPanelOpen
      ? "share-text-color-tray"
      : "share-text-style-tray";
  }
  if (activeEditorKind === "chart") {
    if (chartEditorMode === "type") return "share-chart-type-tray";
    if (chartEditorMode === "text") return "share-chart-text-color-tray";
    if (chartEditorMode === "background") return "share-chart-background-tray";
    return "share-chart-tray";
  }
  if (activeEditorKind === "card") {
    if (cardEditorMode === "type") return "share-card-type-tray";
    if (cardEditorMode === "text") return "share-card-text-color-tray";
    if (cardEditorMode === "background") return "share-card-background-tray";
    return "share-card-tray";
  }
  if (activeEditorKind === "additionalPhoto") {
    return "share-photo-treatment-tray";
  }
  return "share-selected-layer-options-tray";
}

export default function DockEditorOptions({
  activeEditorKind,
  selectedTextLayer,
  composition,
  textColorOptions,
  normalizedSelectedTextColor,
  normalizedSelectedChartTextColor,
  normalizedSelectedChartBackgroundColor,
  normalizedSelectedCardTextColor,
  normalizedSelectedCardBackgroundColor,
  usesPresetTextColor,
  usesPresetChartTextColor,
  usesPresetChartBackgroundColor,
  usesPresetCardTextColor,
  usesPresetCardBackgroundColor,
  isTextColorPanelOpen,
  chartEditorMode,
  cardEditorMode,
  setIsTextColorPanelOpen,
  setChartEditorMode,
  setCardEditorMode,
  setCustomColorTarget,
  applyTextColor,
  applyChartTextColor,
  applyChartBackgroundColor,
  applyCardTextColor,
  applyCardBackgroundColor,
  normalizeHexColor,
  onTextStyleChange,
  onChartVariantChange,
  onCardVariantChange,
  onAdditionalPhotoReplace,
  t,
}: DockEditorOptionsProps) {
  return (
    <ScrollView
      testID={resolveTrayTestID(
        activeEditorKind,
        isTextColorPanelOpen,
        chartEditorMode,
        cardEditorMode,
      )}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.optionScroller}
      contentContainerStyle={styles.optionRow}
    >
      {activeEditorKind === "text" && selectedTextLayer ? (
        <>
          {!isTextColorPanelOpen ? (
            <>
              <DockChip
                testID="share-text-bold-chip"
                label="B"
                accessibilityLabel={t("dock.bold")}
                active={selectedTextLayer.bold}
                labelVariant="bold"
                onPress={() =>
                  onTextStyleChange(selectedTextLayer.id, {
                    bold: !selectedTextLayer.bold,
                  })
                }
              />
              <DockChip
                testID="share-text-italic-chip"
                label="I"
                accessibilityLabel={t("dock.italic")}
                active={selectedTextLayer.italic}
                labelVariant="italic"
                onPress={() =>
                  onTextStyleChange(selectedTextLayer.id, {
                    italic: !selectedTextLayer.italic,
                  })
                }
              />
              <DockChip
                testID="share-text-underline-chip"
                label="U"
                accessibilityLabel={t("dock.underline")}
                active={selectedTextLayer.underline}
                labelVariant="underline"
                onPress={() =>
                  onTextStyleChange(selectedTextLayer.id, {
                    underline: !selectedTextLayer.underline,
                  })
                }
              />
            </>
          ) : null}
          {!isTextColorPanelOpen ? (
            <DockChip
              testID="share-text-color-button"
              label={t("dock.text_color_short")}
              accessibilityLabel={t("dock.text_color")}
              active={false}
              onPress={() => {
                setIsTextColorPanelOpen(true);
                setCustomColorTarget(null);
              }}
            />
          ) : (
            <>
              {textColorOptions.map((option) => (
                <DockChip
                  key={option.label}
                  testID={`share-text-color-${normalizeHexColor(option.value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`}
                  label={option.label}
                  active={normalizeHexColor(option.value) === normalizedSelectedTextColor}
                  onPress={() => applyTextColor(option.value)}
                />
              ))}
              <DockChip
                testID="share-text-color-custom-button"
                label={t("dock.custom")}
                active={!usesPresetTextColor}
                onPress={() => setCustomColorTarget("text")}
              />
              <DockChip
                testID="share-text-color-done-button"
                label={t("dock.done")}
                active={false}
                tone="primary"
                onPress={() => {
                  setIsTextColorPanelOpen(false);
                  setCustomColorTarget(null);
                }}
              />
            </>
          )}
        </>
      ) : null}

      {activeEditorKind === "chart" ? (
        <>
          {!chartEditorMode ? (
            <>
              <DockChip
                testID="share-chart-type-button"
                label={t("dock.type")}
                active={false}
                onPress={() => {
                  setChartEditorMode("type");
                  setCustomColorTarget(null);
                }}
              />
              <DockChip
                testID="share-chart-text-button"
                label={t("dock.text")}
                active={false}
                onPress={() => {
                  setChartEditorMode("text");
                  setCustomColorTarget(null);
                }}
              />
              <DockChip
                testID="share-chart-background-button"
                label={t("dock.background")}
                active={false}
                onPress={() => {
                  setChartEditorMode("background");
                  setCustomColorTarget(null);
                }}
              />
            </>
          ) : null}

          {chartEditorMode === "type" ? (
            <>
              <DockChip
                testID="share-chart-type-polar"
                label={t("dock.chart_polar_short")}
                accessibilityLabel={t("dock.chart_polar")}
                active={composition.widgets.chart?.variant === "macroPolarArea"}
                compact
                onPress={() => onChartVariantChange("macroPolarArea")}
              />
              <DockChip
                testID="share-chart-type-pie"
                label={t("dock.chart_pie_short")}
                accessibilityLabel={t("dock.chart_pie")}
                active={composition.widgets.chart?.variant === "macroPie"}
                compact
                onPress={() => onChartVariantChange("macroPie")}
              />
              <DockChip
                testID="share-chart-type-donut"
                label={t("dock.chart_donut_short")}
                accessibilityLabel={t("dock.chart_donut")}
                active={composition.widgets.chart?.variant === "macroDonut"}
                compact
                onPress={() => onChartVariantChange("macroDonut")}
              />
              <DockChip
                testID="share-chart-type-gauge"
                label={t("dock.chart_gauge_short")}
                accessibilityLabel={t("dock.chart_gauge")}
                active={composition.widgets.chart?.variant === "macroGauge"}
                compact
                onPress={() => onChartVariantChange("macroGauge")}
              />
              <DockChip
                testID="share-chart-type-bar"
                label={t("dock.chart_bar_short")}
                accessibilityLabel={t("dock.chart_bar")}
                active={composition.widgets.chart?.variant === "macroBarMini"}
                compact
                onPress={() => onChartVariantChange("macroBarMini")}
              />
            </>
          ) : null}

          {chartEditorMode === "text" ? (
            <>
              {textColorOptions.map((option) => (
                <DockChip
                  key={`chart-text-${option.label}`}
                  testID={`share-chart-text-color-${normalizeHexColor(option.value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`}
                  label={option.label}
                  active={normalizeHexColor(option.value) === normalizedSelectedChartTextColor}
                  onPress={() => applyChartTextColor(option.value)}
                />
              ))}
              <DockChip
                testID="share-chart-text-color-custom-button"
                label={t("dock.custom")}
                active={!usesPresetChartTextColor}
                onPress={() => setCustomColorTarget("chartText")}
              />
            </>
          ) : null}

          {chartEditorMode === "background" ? (
            <>
              {textColorOptions.map((option) => (
                <DockChip
                  key={`chart-bg-${option.label}`}
                  testID={`share-chart-background-${normalizeHexColor(option.value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`}
                  label={option.label}
                  active={
                    normalizeHexColor(option.value) === normalizedSelectedChartBackgroundColor
                  }
                  onPress={() => applyChartBackgroundColor(option.value)}
                />
              ))}
              <DockChip
                testID="share-chart-background-custom-button"
                label={t("dock.custom")}
                active={!usesPresetChartBackgroundColor}
                onPress={() => setCustomColorTarget("chartBackground")}
              />
            </>
          ) : null}

          {chartEditorMode ? (
            <DockChip
              testID="share-chart-done-button"
              label={t("dock.done")}
              active={false}
              tone="primary"
              compact
              onPress={() => {
                setChartEditorMode(null);
                setCustomColorTarget(null);
              }}
            />
          ) : null}
        </>
      ) : null}

      {activeEditorKind === "card" ? (
        <>
          {!cardEditorMode ? (
            <>
              <DockChip
                testID="share-card-type-button"
                label={t("dock.type")}
                active={false}
                onPress={() => {
                  setCardEditorMode("type");
                  setCustomColorTarget(null);
                }}
              />
              <DockChip
                testID="share-card-text-button"
                label={t("dock.text")}
                active={false}
                onPress={() => {
                  setCardEditorMode("text");
                  setCustomColorTarget(null);
                }}
              />
              <DockChip
                testID="share-card-background-button"
                label={t("dock.background")}
                active={false}
                onPress={() => {
                  setCardEditorMode("background");
                  setCustomColorTarget(null);
                }}
              />
            </>
          ) : null}

          {cardEditorMode === "type" ? (
            <>
              <DockChip
                testID="share-card-type-split"
                label={t("dock.card_split_short")}
                accessibilityLabel={t("dock.card_split")}
                active={composition.widgets.card?.variant === "macroSplitCard"}
                compact
                onPress={() => onCardVariantChange("macroSplitCard")}
              />
              <DockChip
                testID="share-card-type-summary"
                label={t("dock.card_summary_short")}
                accessibilityLabel={t("dock.card_summary")}
                active={composition.widgets.card?.variant === "macroSummaryCard"}
                compact
                onPress={() => onCardVariantChange("macroSummaryCard")}
              />
              <DockChip
                testID="share-card-type-strip"
                label={t("dock.card_strip_short")}
                accessibilityLabel={t("dock.card_strip")}
                active={composition.widgets.card?.variant === "macroTagStripCard"}
                compact
                onPress={() => onCardVariantChange("macroTagStripCard")}
              />
              <DockChip
                testID="share-card-type-vertical"
                label={t("dock.card_vertical_short")}
                accessibilityLabel={t("dock.card_vertical")}
                active={composition.widgets.card?.variant === "macroVerticalStackCard"}
                compact
                onPress={() => onCardVariantChange("macroVerticalStackCard")}
              />
            </>
          ) : null}

          {cardEditorMode === "text" ? (
            <>
              {textColorOptions.map((option) => (
                <DockChip
                  key={`card-text-${option.label}`}
                  testID={`share-card-text-color-${normalizeHexColor(option.value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`}
                  label={option.label}
                  active={normalizeHexColor(option.value) === normalizedSelectedCardTextColor}
                  onPress={() => applyCardTextColor(option.value)}
                />
              ))}
              <DockChip
                testID="share-card-text-color-custom-button"
                label={t("dock.custom")}
                active={!usesPresetCardTextColor}
                onPress={() => setCustomColorTarget("cardText")}
              />
            </>
          ) : null}

          {cardEditorMode === "background" ? (
            <>
              {textColorOptions.map((option) => (
                <DockChip
                  key={`card-bg-${option.label}`}
                  testID={`share-card-background-${normalizeHexColor(option.value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`}
                  label={option.label}
                  active={
                    normalizeHexColor(option.value) === normalizedSelectedCardBackgroundColor
                  }
                  onPress={() => applyCardBackgroundColor(option.value)}
                />
              ))}
              <DockChip
                testID="share-card-background-custom-button"
                label={t("dock.custom")}
                active={!usesPresetCardBackgroundColor}
                onPress={() => setCustomColorTarget("cardBackground")}
              />
            </>
          ) : null}

          {cardEditorMode ? (
            <DockChip
              testID="share-card-done-button"
              label={t("dock.done")}
              active={false}
              tone="primary"
              compact
              onPress={() => {
                setCardEditorMode(null);
                setCustomColorTarget(null);
              }}
            />
          ) : null}
        </>
      ) : null}

      {activeEditorKind === "additionalPhoto" ? (
        <>
          <DockChip
            testID="share-photo-replace-button"
            label={t("dock.photo_replace")}
            active={false}
            tone="primary"
            onPress={onAdditionalPhotoReplace}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  optionRow: {
    gap: 5,
    paddingHorizontal: 7,
    paddingBottom: 1,
    alignItems: "center",
  },
  optionScroller: {
    maxHeight: 34,
  },
});
