export type ShareComposerMode = "quick" | "customize";

export type SharePresetId =
  | "quickClassic"
  | "quickSidebar"
  | "quickFooter";

export type ShareLayerId =
  | "mealPhoto"
  | "additionalPhoto"
  | "chartWidget"
  | "cardWidget"
  | `text:${string}`;

export type ActiveLayerEditorKind =
  | "quickPresets"
  | "mealPhoto"
  | "additionalPhoto"
  | "text"
  | "chart"
  | "card"
  | "none";

export type TransformState = {
  xRatio: number;
  yRatio: number;
  scale: number;
  rotation: number;
};

export type ShareChartVariant =
  | "macroPie"
  | "macroDonut"
  | "macroBarMini"
  | "macroPolarArea"
  | "macroGauge";

export type ShareCardVariant =
  | "macroSummaryCard"
  | "macroVerticalStackCard"
  | "macroSplitCard"
  | "macroTagStripCard";

export type PhotoOverlayPreset = "none" | "softWarm" | "warm";
export type AdditionalPhotoTreatment =
  | "plain"
  | "shadow"
  | "frame"
  | "pill";

export type ShareTextLayerState = {
  id: `text:${string}`;
  text: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  transform: TransformState;
  removable: boolean;
};

export type ShareChartLayerState = {
  id: "chartWidget";
  variant: ShareChartVariant;
  textColor?: string;
  backgroundColor?: string;
  transform: TransformState;
};

export type ShareCardLayerState = {
  id: "cardWidget";
  variant: ShareCardVariant;
  textColor?: string;
  backgroundColor?: string;
  transform: TransformState;
};

export type ShareMealPhotoLayerState = {
  id: "mealPhoto";
  transform: TransformState;
  overlayPreset: PhotoOverlayPreset;
  blur: boolean;
};

export type ShareAdditionalPhotoLayerState = {
  id: "additionalPhoto";
  uri: string;
  transform: TransformState;
  treatment: AdditionalPhotoTreatment;
};

export type ShareCompositionState = {
  presetId: SharePresetId;
  mealPhoto: ShareMealPhotoLayerState;
  additionalPhoto: ShareAdditionalPhotoLayerState | null;
  textLayers: ShareTextLayerState[];
  widgets: {
    chart: ShareChartLayerState | null;
    card: ShareCardLayerState | null;
  };
};

export type ShareNutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type ShareMealContext = "meal_details" | "review_meal" | "unknown";

export type ShareExportAction = "save_to_gallery" | "share";

export type ShareExportState = {
  action: ShareExportAction | null;
  error: string | null;
  failedAction?: ShareExportAction | null;
};
