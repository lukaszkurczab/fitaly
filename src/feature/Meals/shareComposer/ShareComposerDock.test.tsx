import { describe, expect, it, jest } from "@jest/globals";
import { StyleSheet } from "react-native";
import ShareComposerDock from "@/feature/Meals/shareComposer/ShareComposerDock";
import { createCompositionForPreset } from "@/feature/Meals/shareComposer/presets";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

jest.mock(
  "@/feature/Meals/shareComposer/components/DockColorPickerModal",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

const composition = createCompositionForPreset({
  presetId: "quickClassic",
  titleText: "Dinner",
});

const baseProps = {
  width: 390,
  contentWidth: 333,
  mode: "customize" as const,
  selectedPreset: "quickClassic" as const,
  activeEditorKind: "text" as const,
  selectedLayerId: "text:title" as const,
  composition,
  mealPhotoUri: "https://example.com/meal.jpg",
  nutrition: { kcal: 420, protein: 32, carbs: 44, fat: 12 },
  exportState: { action: null, error: null },
  onPresetSelect: jest.fn(),
  onSaveToGallery: jest.fn(),
  onShare: jest.fn(),
  onRemoveSelectedLayer: jest.fn(),
  onTextStyleChange: jest.fn(),
  onChartVariantChange: jest.fn(),
  onChartStyleChange: jest.fn(),
  onCardVariantChange: jest.fn(),
  onCardStyleChange: jest.fn(),
  onAdditionalPhotoReplace: jest.fn(),
};

describe("ShareComposerDock visual chrome", () => {
  it("uses translucent selected-layer dock material without local depth", () => {
    const { getByTestId } = renderWithTheme(
      <ShareComposerDock {...baseProps} />,
    );

    const dockStyle = StyleSheet.flatten(
      getByTestId("share-composer-dock").props.style,
    );

    expect(dockStyle.backgroundColor).toContain("rgba");
    expect(dockStyle.shadowOpacity).toBeUndefined();
    expect(dockStyle.shadowRadius).toBeUndefined();
    expect(dockStyle.elevation).toBeUndefined();
  });

  it("keeps Share bottom actions inline instead of adding a raised panel", () => {
    const { getByTestId } = renderWithTheme(
      <ShareComposerDock
        {...baseProps}
        activeEditorKind="none"
        selectedLayerId={null}
      />,
    );

    const actionsStyle = StyleSheet.flatten(
      getByTestId("share-composer-actions").props.style,
    );

    expect(actionsStyle.backgroundColor).toBe("transparent");
    expect(actionsStyle.shadowOpacity).toBe(0);
    expect(actionsStyle.elevation).toBe(0);
    expect(actionsStyle.position).toBeUndefined();
  });

  it("keeps export errors readable over the canvas without adding depth", () => {
    const { getByTestId } = renderWithTheme(
      <ShareComposerDock
        {...baseProps}
        activeEditorKind="none"
        selectedLayerId={null}
        exportState={{
          action: null,
          error: "Gallery access is off. Check permissions and try again.",
          failedAction: "save_to_gallery",
        }}
      />,
    );

    const errorCardStyle = StyleSheet.flatten(
      getByTestId("share-export-error-card").props.style,
    );

    expect(errorCardStyle.backgroundColor).toBe("rgba(249,233,229,0.94)");
    expect(errorCardStyle.borderColor).toBe("rgba(194,78,61,0.42)");
    expect(errorCardStyle.shadowOpacity).toBeUndefined();
    expect(errorCardStyle.shadowRadius).toBeUndefined();
    expect(errorCardStyle.elevation).toBeUndefined();
  });
});
