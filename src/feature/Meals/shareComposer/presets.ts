import type {
  ShareCardLayerState,
  ShareCardVariant,
  ShareChartLayerState,
  ShareCompositionState,
  ShareLayerId,
  SharePresetId,
  ShareTextLayerState,
  TransformState,
} from "@/feature/Meals/shareComposer/types";

type PresetTemplate = {
  id: SharePresetId;
  textTransform: TransformState;
  textColor: string;
  cardVariant: ShareCardVariant;
  cardTransform: TransformState;
  overlayPreset: ShareCompositionState["mealPhoto"]["overlayPreset"];
};

const PRESET_TEMPLATES: Record<SharePresetId, PresetTemplate> = {
  quickClassic: {
    id: "quickClassic",
    textTransform: { xRatio: 0.34, yRatio: 0.18, scale: 0.62, rotation: 0 },
    textColor: "#FFFDF8",
    cardVariant: "macroTagStripCard",
    cardTransform: { xRatio: 0.5, yRatio: 0.38, scale: 0.72, rotation: 0 },
    overlayPreset: "none",
  },
  quickSidebar: {
    id: "quickSidebar",
    textTransform: { xRatio: 0.37, yRatio: 0.2, scale: 0.72, rotation: 0 },
    textColor: "#FFFDF8",
    cardVariant: "macroTagStripCard",
    cardTransform: { xRatio: 0.5, yRatio: 0.68, scale: 0.7, rotation: 0 },
    overlayPreset: "none",
  },
  quickFooter: {
    id: "quickFooter",
    textTransform: { xRatio: 0.32, yRatio: 0.78, scale: 0.66, rotation: 0 },
    textColor: "#FFFDF8",
    cardVariant: "macroSplitCard",
    cardTransform: { xRatio: 0.5, yRatio: 0.66, scale: 0.78, rotation: 0 },
    overlayPreset: "none",
  },
};

export const QUICK_PRESET_OPTIONS: Array<{ id: SharePresetId; label: string }> =
  [
    { id: "quickClassic", label: "Classic" },
    { id: "quickSidebar", label: "Sidebar" },
    { id: "quickFooter", label: "Footer" },
  ];

const DEFAULT_MEAL_PHOTO_TRANSFORM: TransformState = {
  xRatio: 0.5,
  yRatio: 0.5,
  scale: 1.02,
  rotation: 0,
};

const DEFAULT_CHART_TRANSFORM: TransformState = {
  xRatio: 0.32,
  yRatio: 0.38,
  scale: 0.56,
  rotation: 0,
};

const DEFAULT_ADDITIONAL_PHOTO_TRANSFORM: TransformState = {
  xRatio: 0.68,
  yRatio: 0.22,
  scale: 1,
  rotation: 0.06,
};

function buildTitleTextLayer(params: {
  presetId: SharePresetId;
  titleText: string;
}): ShareTextLayerState {
  const template = PRESET_TEMPLATES[params.presetId];
  return {
    id: "text:title",
    text: params.titleText.trim() || "Meal",
    color: template.textColor,
    bold: true,
    italic: false,
    underline: false,
    transform: { ...template.textTransform },
    removable: false,
  };
}

function buildCardWidgetLayer(presetId: SharePresetId): ShareCardLayerState {
  const template = PRESET_TEMPLATES[presetId];
  return {
    id: "cardWidget",
    variant: template.cardVariant,
    transform: { ...template.cardTransform },
  };
}

export function createCompositionForPreset(params: {
  presetId: SharePresetId;
  titleText: string;
}): ShareCompositionState {
  const template = PRESET_TEMPLATES[params.presetId];
  return {
    presetId: params.presetId,
    mealPhoto: {
      id: "mealPhoto",
      transform: { ...DEFAULT_MEAL_PHOTO_TRANSFORM },
      overlayPreset: template.overlayPreset,
      blur: false,
    },
    additionalPhoto: null,
    textLayers: [buildTitleTextLayer(params)],
    widgets: {
      chart: null,
      card: buildCardWidgetLayer(params.presetId),
    },
  };
}

export function createDefaultChartLayer(): ShareChartLayerState {
  return {
    id: "chartWidget",
    variant: "macroBarMini",
    transform: { ...DEFAULT_CHART_TRANSFORM },
  };
}

export function createDefaultAdditionalPhotoLayer(uri: string) {
  return {
    id: "additionalPhoto" as const,
    uri,
    transform: { ...DEFAULT_ADDITIONAL_PHOTO_TRANSFORM },
    treatment: "plain" as const,
  };
}

let textLayerCounter = 0;

export function createAdditionalTextLayer(text = "Add note"): ShareTextLayerState {
  textLayerCounter += 1;
  return {
    id: `text:${Date.now()}:${textLayerCounter}`,
    text,
    color: "#FFFDF8",
    bold: true,
    italic: false,
    underline: false,
    transform: {
      xRatio: 0.46,
      yRatio: 0.46,
      scale: 0.68,
      rotation: 0,
    },
    removable: true,
  };
}

export function getPresetTemplate(presetId: SharePresetId): PresetTemplate {
  return PRESET_TEMPLATES[presetId];
}

export function resetLayerToPresetBaseline(params: {
  presetId: SharePresetId;
  layerId: ShareLayerId;
  titleText: string;
}): Partial<ShareCompositionState> | null {
  const base = createCompositionForPreset({
    presetId: params.presetId,
    titleText: params.titleText,
  });

  if (params.layerId === "mealPhoto") {
    return { mealPhoto: base.mealPhoto };
  }

  if (params.layerId === "cardWidget") {
    return { widgets: { chart: null, card: base.widgets.card } };
  }

  if (params.layerId === "chartWidget") {
    return { widgets: { chart: null, card: null } };
  }

  if (params.layerId === "additionalPhoto") {
    return { additionalPhoto: null };
  }

  if (params.layerId.startsWith("text:")) {
    if (params.layerId === "text:title") {
      return { textLayers: base.textLayers };
    }
    return null;
  }

  return null;
}
