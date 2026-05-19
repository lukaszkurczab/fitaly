import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import type { RootStackParamList } from "@/navigation/navigate";
import { Layout } from "@/components/Layout";
import AppIcon from "@/components/AppIcon";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { emit } from "@/services/core/events";
import ShareComposerCanvas from "@/feature/Meals/shareComposer/ShareComposerCanvas";
import ShareComposerDock from "@/feature/Meals/shareComposer/ShareComposerDock";
import {
  createAdditionalTextLayer,
  createCompositionForPreset,
  createDefaultAdditionalPhotoLayer,
  createDefaultChartLayer,
  getPresetTemplate,
} from "@/feature/Meals/shareComposer/presets";
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
  TransformState,
} from "@/feature/Meals/shareComposer/types";
import {
  CANVAS_MAX_WIDTH,
  CANVAS_MIN_WIDTH,
  CANVAS_RATIO,
  clamp,
  resolveMealTitle,
  resolveShareNutrition,
} from "@/feature/Meals/screens/MealShareScreen.helpers";

type ScreenRoute = RouteProp<RootStackParamList, "MealShare">;
type MealShareNavigation = StackNavigationProp<RootStackParamList, "MealShare">;

const DEFAULT_PRESET: SharePresetId = "quickClassic";

export default function MealShareScreen() {
  const theme = useTheme();
  const navigation = useNavigation<MealShareNavigation>();
  const route = useRoute<ScreenRoute>();
  const { t } = useTranslation(["share", "common", "meals"]);
  const { meal } = route.params;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const shotRef = useRef<View>(null);

  const mealPhotoUri =
    meal.localPhotoUrl || meal.photoLocalPath || meal.photoUrl || "";
  const hasSavedMealIdentity = Boolean(meal.cloudId || meal.mealId);
  const isEntryValid = hasSavedMealIdentity && mealPhotoUri.trim().length > 0;

  const mealTitle = useMemo(
    () =>
      resolveMealTitle({
        meal,
        fallback: t("meal", { ns: "meals", defaultValue: "Meal" }),
      }),
    [meal, t],
  );

  const nutrition: ShareNutrition = useMemo(
    () => resolveShareNutrition(meal),
    [meal],
  );

  const [mode, setMode] = useState<"quick" | "customize">("quick");
  const [selectedPreset, setSelectedPreset] =
    useState<SharePresetId>(DEFAULT_PRESET);
  const [composition, setComposition] = useState<ShareCompositionState>(() =>
    createCompositionForPreset({
      presetId: DEFAULT_PRESET,
      titleText: mealTitle,
    }),
  );
  const [selectedLayerId, setSelectedLayerId] = useState<ShareLayerId | null>(
    null,
  );
  const [activeEditorKind, setActiveEditorKind] =
    useState<ActiveLayerEditorKind>("quickPresets");
  const [exportState, setExportState] = useState<ShareExportState>({
    action: null,
    error: null,
  });
  const [completed, setCompleted] = useState(false);

  const canvasWidth = useMemo(() => {
    const available = screenWidth - theme.spacing.md * 2;
    return clamp(available, CANVAS_MIN_WIDTH, CANVAS_MAX_WIDTH);
  }, [screenWidth, theme.spacing.md]);

  const canvasHeight = useMemo(
    () => Math.round(canvasWidth * CANVAS_RATIO),
    [canvasWidth],
  );

  const trackShareEvent = useCallback(
    (_name: string, _params: Record<string, unknown> = {}) => {
      return Promise.resolve();
    },
    [],
  );

  useEffect(() => {
    if (!isEntryValid) return;
    void trackShareEvent("screen_viewed.share");
  }, [isEntryValid, trackShareEvent]);

  useEffect(() => {
    if (mode === "quick") {
      setActiveEditorKind("quickPresets");
      return;
    }

    if (!selectedLayerId) {
      setActiveEditorKind("none");
      return;
    }

    if (selectedLayerId === "additionalPhoto") {
      setActiveEditorKind("additionalPhoto");
      return;
    }

    if (selectedLayerId === "chartWidget") {
      setActiveEditorKind("chart");
      return;
    }

    if (selectedLayerId === "cardWidget") {
      setActiveEditorKind("card");
      return;
    }

    if (selectedLayerId.startsWith("text:")) {
      setActiveEditorKind("text");
      return;
    }

    setActiveEditorKind("none");
  }, [mode, selectedLayerId]);

  const handleClose = useCallback(() => {
    if (isEntryValid && !completed) {
      void trackShareEvent("interaction.share.abandoned");
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home");
  }, [completed, isEntryValid, navigation, trackShareEvent]);

  const handleSwitchMode = useCallback(
    (nextMode: "quick" | "customize") => {
      if (nextMode === mode) return;
      setMode(nextMode);
      setExportState((prev) => ({ ...prev, error: null }));
      void trackShareEvent("interaction.share.mode_changed", {
        mode: nextMode,
      });

      if (nextMode === "quick") {
        setSelectedLayerId(null);
        return;
      }

      if (selectedLayerId) return;
      setSelectedLayerId(composition.widgets.card ? "cardWidget" : null);
    },
    [composition.widgets.card, mode, selectedLayerId, trackShareEvent],
  );

  const handlePresetSelect = useCallback(
    (presetId: SharePresetId) => {
      setSelectedPreset(presetId);
      setComposition(
        createCompositionForPreset({
          presetId,
          titleText: mealTitle,
        }),
      );
      setSelectedLayerId(mode === "customize" ? "cardWidget" : null);
      setExportState((prev) => ({ ...prev, error: null }));

      void trackShareEvent("interaction.share.template_selected", {
        template_id: presetId,
      });
    },
    [mealTitle, mode, trackShareEvent],
  );

  const handleTransformChange = useCallback(
    (layerId: ShareLayerId, next: TransformState) => {
      setComposition((prev) => {
        const normalized: TransformState =
          layerId === "mealPhoto"
            ? {
                xRatio: clamp(next.xRatio, 0.38, 0.62),
                yRatio: clamp(next.yRatio, 0.38, 0.62),
                scale: clamp(next.scale, 1, 2.4),
                rotation: clamp(next.rotation, -Math.PI, Math.PI),
              }
            : {
                xRatio: clamp(next.xRatio, 0.02, 0.98),
                yRatio: clamp(next.yRatio, 0.02, 0.98),
                scale: clamp(next.scale, 0.36, 3.2),
                rotation: clamp(next.rotation, -Math.PI, Math.PI),
              };

        if (layerId === "mealPhoto") {
          return {
            ...prev,
            mealPhoto: {
              ...prev.mealPhoto,
              transform: normalized,
            },
          };
        }

        if (layerId === "additionalPhoto" && prev.additionalPhoto) {
          return {
            ...prev,
            additionalPhoto: {
              ...prev.additionalPhoto,
              transform: normalized,
            },
          };
        }

        if (layerId === "chartWidget" && prev.widgets.chart) {
          return {
            ...prev,
            widgets: {
              ...prev.widgets,
              chart: {
                ...prev.widgets.chart,
                transform: normalized,
              },
            },
          };
        }

        if (layerId === "cardWidget" && prev.widgets.card) {
          return {
            ...prev,
            widgets: {
              ...prev.widgets,
              card: {
                ...prev.widgets.card,
                transform: normalized,
              },
            },
          };
        }

        if (layerId.startsWith("text:")) {
          return {
            ...prev,
            textLayers: prev.textLayers.map((layer) =>
              layer.id === layerId
                ? {
                    ...layer,
                    transform: normalized,
                  }
                : layer,
            ),
          };
        }

        return prev;
      });
    },
    [],
  );

  const handleCanvasBackgroundPress = useCallback(() => {
    if (mode !== "customize") return;
    setSelectedLayerId(null);
  }, [mode]);

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      setComposition((prev) => ({
        ...prev,
        textLayers: prev.textLayers.map((layer) =>
          layer.id === id ? { ...layer, text } : layer,
        ),
      }));
      void trackShareEvent("interaction.share.text_edited");
    },
    [trackShareEvent],
  );

  const handleTextStyleChange = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<ShareTextLayerState, "bold" | "italic" | "underline" | "color">
      >,
    ) => {
      setComposition((prev) => ({
        ...prev,
        textLayers: prev.textLayers.map((layer) =>
          layer.id === id ? { ...layer, ...patch } : layer,
        ),
      }));
    },
    [],
  );

  const handleAddTextLayer = useCallback(() => {
    const next = createAdditionalTextLayer();
    setComposition((prev) => ({
      ...prev,
      textLayers: [...prev.textLayers, next],
    }));
    setSelectedLayerId(next.id);
    void trackShareEvent("interaction.share.text_added");
  }, [trackShareEvent]);

  const handleEnsureChartLayer = useCallback(() => {
    setComposition((prev) => {
      if (prev.widgets.chart) {
        return prev;
      }
      return {
        ...prev,
        widgets: {
          ...prev.widgets,
          chart: createDefaultChartLayer(),
        },
      };
    });
    setSelectedLayerId("chartWidget");
    void trackShareEvent("interaction.share.widget_added", {
      widget_type: "chart",
    });
  }, [trackShareEvent]);

  const handleEnsureCardLayer = useCallback(() => {
    setComposition((prev) => {
      if (prev.widgets.card) {
        return prev;
      }
      const preset = getPresetTemplate(selectedPreset);
      return {
        ...prev,
        widgets: {
          ...prev.widgets,
          card: {
            id: "cardWidget",
            variant: preset.cardVariant,
            transform: { ...preset.cardTransform },
          },
        },
      };
    });
    setSelectedLayerId("cardWidget");
    void trackShareEvent("interaction.share.widget_added", {
      widget_type: "card",
    });
  }, [selectedPreset, trackShareEvent]);

  const handleChartVariantChange = useCallback(
    (variant: ShareChartVariant) => {
      setComposition((prev) => {
        const current = prev.widgets.chart || createDefaultChartLayer();
        return {
          ...prev,
          widgets: {
            ...prev.widgets,
            chart: {
              ...current,
              variant,
            },
          },
        };
      });
      setSelectedLayerId("chartWidget");
      void trackShareEvent("interaction.share.widget_changed", {
        widget_type: "chart",
      });
    },
    [trackShareEvent],
  );

  const handleChartStyleChange = useCallback(
    (
      patch: Partial<
        Pick<
          NonNullable<ShareCompositionState["widgets"]["chart"]>,
          "textColor" | "backgroundColor"
        >
      >,
    ) => {
      setComposition((prev) => {
        const current = prev.widgets.chart || createDefaultChartLayer();
        return {
          ...prev,
          widgets: {
            ...prev.widgets,
            chart: {
              ...current,
              ...patch,
            },
          },
        };
      });
      setSelectedLayerId("chartWidget");
      void trackShareEvent("interaction.share.widget_changed", {
        widget_type: "chart",
      });
    },
    [trackShareEvent],
  );

  const handleCardVariantChange = useCallback(
    (variant: ShareCardVariant) => {
      setComposition((prev) => {
        if (!prev.widgets.card) {
          const preset = getPresetTemplate(selectedPreset);
          return {
            ...prev,
            widgets: {
              ...prev.widgets,
              card: {
                id: "cardWidget",
                variant,
                transform: { ...preset.cardTransform },
              },
            },
          };
        }
        return {
          ...prev,
          widgets: {
            ...prev.widgets,
            card: {
              ...prev.widgets.card,
              variant,
            },
          },
        };
      });
      setSelectedLayerId("cardWidget");
      void trackShareEvent("interaction.share.widget_changed", {
        widget_type: "card",
      });
    },
    [selectedPreset, trackShareEvent],
  );

  const handleCardStyleChange = useCallback(
    (
      patch: Partial<
        Pick<
          NonNullable<ShareCompositionState["widgets"]["card"]>,
          "textColor" | "backgroundColor"
        >
      >,
    ) => {
      setComposition((prev) => {
        if (!prev.widgets.card) {
          const preset = getPresetTemplate(selectedPreset);
          return {
            ...prev,
            widgets: {
              ...prev.widgets,
              card: {
                id: "cardWidget",
                variant: preset.cardVariant,
                transform: { ...preset.cardTransform },
                ...patch,
              },
            },
          };
        }
        return {
          ...prev,
          widgets: {
            ...prev.widgets,
            card: {
              ...prev.widgets.card,
              ...patch,
            },
          },
        };
      });
      setSelectedLayerId("cardWidget");
      void trackShareEvent("interaction.share.widget_changed", {
        widget_type: "card",
      });
    },
    [selectedPreset, trackShareEvent],
  );

  const handleAdditionalPhotoTreatmentChange = useCallback(
    (
      treatment: NonNullable<
        ShareCompositionState["additionalPhoto"]
      >["treatment"],
    ) => {
      setComposition((prev) => {
        if (!prev.additionalPhoto) return prev;
        return {
          ...prev,
          additionalPhoto: {
            ...prev.additionalPhoto,
            treatment,
          },
        };
      });
    },
    [],
  );

  const handleAddOrReplaceAdditionalPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const nextLayer = createDefaultAdditionalPhotoLayer(result.assets[0].uri);
      setComposition((prev) => ({ ...prev, additionalPhoto: nextLayer }));
      setSelectedLayerId("additionalPhoto");
      setExportState((prev) => ({ ...prev, error: null }));
      void trackShareEvent("interaction.share.additional_photo_added");
    } catch {
      setExportState({
        action: null,
        error: t("share_photo_picker_failed", {
          ns: "share",
          defaultValue: "Could not open photo library. Try again.",
        }),
      });
    }
  }, [t, trackShareEvent]);

  const handleRemoveSelectedLayer = useCallback(() => {
    if (
      !selectedLayerId ||
      selectedLayerId === "mealPhoto" ||
      selectedLayerId === "text:title"
    ) {
      return;
    }

    setComposition((prev) => {
      if (selectedLayerId === "additionalPhoto") {
        return {
          ...prev,
          additionalPhoto: null,
        };
      }
      if (selectedLayerId === "chartWidget") {
        return {
          ...prev,
          widgets: {
            ...prev.widgets,
            chart: null,
          },
        };
      }
      if (selectedLayerId === "cardWidget") {
        return {
          ...prev,
          widgets: {
            ...prev.widgets,
            card: null,
          },
        };
      }
      if (selectedLayerId.startsWith("text:")) {
        return {
          ...prev,
          textLayers: prev.textLayers.filter(
            (layer) => layer.id !== selectedLayerId,
          ),
        };
      }
      return prev;
    });

    if (selectedLayerId === "additionalPhoto") {
      void trackShareEvent("interaction.share.additional_photo_removed");
    }
    if (selectedLayerId === "chartWidget" || selectedLayerId === "cardWidget") {
      void trackShareEvent("interaction.share.widget_removed", {
        widget_type: selectedLayerId === "chartWidget" ? "chart" : "card",
      });
    }
    setSelectedLayerId(null);
  }, [selectedLayerId, trackShareEvent]);

  const handleResetComposition = useCallback(() => {
    setComposition(
      createCompositionForPreset({
        presetId: selectedPreset,
        titleText: mealTitle,
      }),
    );
    setSelectedLayerId(mode === "customize" ? "cardWidget" : null);
    void trackShareEvent("interaction.share.reset_used");
  }, [mealTitle, mode, selectedPreset, trackShareEvent]);

  const captureCanvasUri = useCallback(async () => {
    if (!shotRef.current) {
      throw new Error("capture_ref_missing");
    }
    return captureRef(shotRef, {
      format: "png",
      quality: 1,
      width: Math.round(canvasWidth),
      height: Math.round(canvasHeight),
      result: "tmpfile",
    });
  }, [canvasHeight, canvasWidth]);

  const performExport = useCallback(
    async (destination: "gallery" | "share_sheet") => {
      const action = destination === "gallery" ? "save_to_gallery" : "share";
      setExportState({ action, error: null });
      try {
        const assetUri = await captureCanvasUri();

        if (destination === "gallery") {
          const permission = await MediaLibrary.requestPermissionsAsync();
          if (!permission.granted) {
            throw new Error("gallery_permission_denied");
          }
          await MediaLibrary.createAssetAsync(assetUri);
          emit("ui:toast", {
            text: t("share_saved_to_gallery", {
              ns: "share",
              defaultValue: "Saved to gallery.",
            }),
          });
          void trackShareEvent("interaction.share.saved_to_gallery", {
            destination_type: destination,
          });
        } else {
          const canShare = await Sharing.isAvailableAsync();
          if (!canShare) {
            throw new Error("share_unavailable");
          }
          await Sharing.shareAsync(assetUri);
        }

        setCompleted(true);
        setExportState({ action: null, error: null });
        void trackShareEvent("interaction.share.exported", {
          destination_type: destination,
          export_result: "success",
        });
        void trackShareEvent("interaction.share.completed", {
          destination_type: destination,
        });
      } catch (error) {
        const message =
          destination === "gallery"
            ? t("share_save_failed", {
                ns: "share",
                defaultValue: "Could not save to gallery. Please try again.",
              })
            : t("share_export_failed", {
                ns: "share",
                defaultValue: "Could not share this image. Please try again.",
              });

        setExportState({ action: null, error: message });
        void trackShareEvent("interaction.share.exported", {
          destination_type: destination,
          export_result: "failed",
        });

        if (String(error).includes("permission")) {
          emit("ui:toast", {
            text: t("share_permission_required", {
              ns: "share",
              defaultValue: "Gallery permission is required.",
            }),
          });
        }
      }
    },
    [captureCanvasUri, t, trackShareEvent],
  );

  const handleSaveToGallery = useCallback(() => {
    void performExport("gallery");
  }, [performExport]);

  const handleShare = useCallback(() => {
    void performExport("share_sheet");
  }, [performExport]);

  if (!isEntryValid) {
    return (
      <Layout
        showNavigation={false}
        disableScroll
        style={{
          paddingTop: insets.top + theme.spacing.xs,
          paddingBottom: theme.spacing.md,
          paddingLeft: theme.spacing.md,
          paddingRight: theme.spacing.md,
        }}
      >
        <View style={styles.invalidContainer} testID="share-unavailable-state">
          <Pressable
            testID="share-unavailable-close-button"
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t("common:close", { defaultValue: "Close" })}
            style={styles.invalidClose}
          >
            <AppIcon name="close" size={14} color={theme.primaryStrong} />
          </Pressable>
          <Text style={[styles.invalidTitle, { color: theme.text }]}>
            {t("share_unavailable_title", {
              ns: "share",
              defaultValue: "Share unavailable",
            })}
          </Text>
          <Text
            style={[styles.invalidDescription, { color: theme.textSecondary }]}
          >
            {t("share_unavailable_description", {
              ns: "share",
              defaultValue:
                "This meal needs to be saved and include a source photo before sharing.",
            })}
          </Text>
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t("common:close", { defaultValue: "Close" })}
            style={[
              styles.invalidButton,
              {
                backgroundColor: theme.primary,
              },
            ]}
          >
            <Text style={styles.invalidButtonText}>
              {t("common:close", { defaultValue: "Close" })}
            </Text>
          </Pressable>
        </View>
      </Layout>
    );
  }

  return (
    <Layout
      showNavigation={false}
      disableScroll
      style={{
        paddingTop: insets.top + theme.spacing.xs,
        paddingBottom: theme.spacing.md,
        paddingLeft: theme.spacing.md,
        paddingRight: theme.spacing.md,
      }}
    >
      <View style={styles.screen}>
        <Pressable
          testID="share-close-button"
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t("common:close", { defaultValue: "Close" })}
          style={[styles.closeButtonFloating, { borderColor: theme.border }]}
        >
          <AppIcon name="close" size={14} color={theme.primaryStrong} />
        </Pressable>

        <View style={[styles.modeSwitch, { borderColor: theme.border }]}>
          <Pressable
            testID="share-mode-quick-button"
            onPress={() => handleSwitchMode("quick")}
            accessibilityRole="button"
            accessibilityLabel={t("share_mode_quick", {
              ns: "share",
              defaultValue: "Quick mode",
            })}
            style={[
              styles.modeSwitchChip,
              mode === "quick"
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { backgroundColor: "#FBF8F2", borderColor: theme.border },
            ]}
          >
            <Text
              style={[
                styles.modeSwitchLabel,
                {
                  color: mode === "quick" ? "#FBF8F2" : "#7A6D5E",
                },
              ]}
            >
              Quick
            </Text>
          </Pressable>
          <Pressable
            testID="share-mode-customize-button"
            onPress={() => handleSwitchMode("customize")}
            accessibilityRole="button"
            accessibilityLabel={t("share_mode_customize", {
              ns: "share",
              defaultValue: "Customize mode",
            })}
            style={[
              styles.modeSwitchChip,
              mode === "customize"
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { backgroundColor: "#FBF8F2", borderColor: theme.border },
            ]}
          >
            <Text
              style={[
                styles.modeSwitchLabel,
                {
                  color: mode === "customize" ? "#FBF8F2" : "#7A6D5E",
                },
              ]}
            >
              Customize
            </Text>
          </Pressable>
        </View>

        <View
          testID="share-composer-canvas-frame"
          style={[
            styles.canvasFrame,
            {
              width: canvasWidth,
              height: canvasHeight,
              borderColor: theme.borderSoft,
            },
          ]}
        >
          <ViewShot ref={shotRef} style={styles.canvasWrap}>
            <ShareComposerCanvas
              width={canvasWidth}
              height={canvasHeight}
              mealPhotoUri={mealPhotoUri}
              nutrition={nutrition}
              composition={composition}
              mode={mode}
              selectedLayerId={selectedLayerId}
              onSelectLayer={(layerId) => {
                if (mode !== "customize") return;
                if (layerId === "mealPhoto") {
                  setSelectedLayerId(null);
                  return;
                }
                setSelectedLayerId(layerId);
              }}
              onTextChange={handleTextChange}
              onTransformChange={handleTransformChange}
              onBackgroundPress={handleCanvasBackgroundPress}
            />
          </ViewShot>
        </View>

        <ShareComposerDock
          width={canvasWidth}
          mode={mode}
          selectedPreset={selectedPreset}
          activeEditorKind={activeEditorKind}
          selectedLayerId={selectedLayerId}
          composition={composition}
          mealPhotoUri={mealPhotoUri}
          exportState={exportState}
          onPresetSelect={handlePresetSelect}
          onSaveToGallery={handleSaveToGallery}
          onShare={handleShare}
          onRemoveSelectedLayer={handleRemoveSelectedLayer}
          onResetComposition={handleResetComposition}
          onTextStyleChange={handleTextStyleChange}
          onChartVariantChange={handleChartVariantChange}
          onChartStyleChange={handleChartStyleChange}
          onCardVariantChange={handleCardVariantChange}
          onCardStyleChange={handleCardStyleChange}
          onAdditionalPhotoTreatmentChange={
            handleAdditionalPhotoTreatmentChange
          }
          onAddTextLayer={handleAddTextLayer}
          onEnsureChartLayer={handleEnsureChartLayer}
          onEnsureCardLayer={handleEnsureCardLayer}
          onAddOrReplaceAdditionalPhoto={handleAddOrReplaceAdditionalPhoto}
        />
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  closeButtonFloating: {
    position: "absolute",
    top: 0,
    left: 4,
    zIndex: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF8F2",
  },
  modeSwitch: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 2,
    flexDirection: "row",
    gap: 3,
    backgroundColor: "#FBF8F2",
  },
  modeSwitchChip: {
    minHeight: 24,
    minWidth: 67,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modeSwitchLabel: {
    fontSize: 11,
    lineHeight: 12,
    fontFamily: "Inter-Medium",
  },
  canvasFrame: {
    borderRadius: 31,
    borderWidth: 1,
    overflow: "hidden",
  },
  canvasWrap: {
    flex: 1,
    borderRadius: 30,
    overflow: "hidden",
  },
  invalidContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  invalidClose: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0D7C7",
    backgroundColor: "#FBF8F2",
  },
  invalidTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Inter-Bold",
    textAlign: "center",
  },
  invalidDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter-Medium",
    textAlign: "center",
    maxWidth: 290,
  },
  invalidButton: {
    minHeight: 40,
    borderRadius: 20,
    minWidth: 144,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 8,
  },
  invalidButtonText: {
    color: "#FBF8F2",
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
    lineHeight: 14,
  },
});
