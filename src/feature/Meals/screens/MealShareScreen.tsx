import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
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
import { isE2EModeEnabled } from "@/services/e2e/config";
import { resolveE2EShareExport } from "@/services/e2e/fixtures";
import ShareComposerCanvas from "@/feature/Meals/shareComposer/ShareComposerCanvas";
import ShareComposerDock from "@/feature/Meals/shareComposer/ShareComposerDock";
import CustomizeToolRail from "@/feature/Meals/shareComposer/components/CustomizeToolRail";
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

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export default function MealShareScreen() {
  const theme = useTheme();
  const stylesWithTheme = useMemo(() => makeStyles(theme), [theme]);
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

  const quickModeLabel = t("share_mode_quick_label", {
    ns: "share",
    defaultValue: "Quick",
  });
  const customizeModeLabel = t("share_mode_customize_label", {
    ns: "share",
    defaultValue: "Customize",
  });

  const shareMacroLabels = useMemo(
    () => ({
      protein: t("share_macro_protein", {
        ns: "share",
        defaultValue: "Protein",
      }),
      carbs: t("share_macro_carbs", {
        ns: "share",
        defaultValue: "Carbs",
      }),
      fat: t("share_macro_fat", {
        ns: "share",
        defaultValue: "Fat",
      }),
    }),
    [t],
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
  const [isCapturingExport, setIsCapturingExport] = useState(false);
  const [e2eCapturedExportPreviewUri, setE2ECapturedExportPreviewUri] =
    useState<string | null>(null);
  const activeModeSurface = theme.isDark ? theme.primaryStrong : theme.primary;
  const activeModeTextColor = theme.isDark
    ? theme.textInverse
    : theme.cta.primaryText;
  const inactiveModeTextColor = theme.textSecondary;

  const canvasWidth = useMemo(() => {
    const available = screenWidth - theme.spacing.md * 2;
    return clamp(available, CANVAS_MIN_WIDTH, CANVAS_MAX_WIDTH);
  }, [screenWidth, theme.spacing.md]);

  const canvasHeight = useMemo(
    () => Math.round(canvasWidth * CANVAS_RATIO),
    [canvasWidth],
  );
  const showE2EExportPreview =
    isE2EModeEnabled() && Boolean(e2eCapturedExportPreviewUri);

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
      setE2ECapturedExportPreviewUri(null);
      setExportState((prev) => ({ ...prev, error: null, failedAction: null }));
      void trackShareEvent("interaction.share.mode_changed", {
        mode: nextMode,
      });

      if (nextMode === "quick") {
        setSelectedLayerId(null);
        return;
      }

      if (selectedLayerId) return;
      setSelectedLayerId(null);
    },
    [mode, selectedLayerId, trackShareEvent],
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
      setE2ECapturedExportPreviewUri(null);
      setSelectedLayerId(mode === "customize" ? "cardWidget" : null);
      setExportState((prev) => ({ ...prev, error: null, failedAction: null }));

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
    const next = createAdditionalTextLayer(
      t("share_note_placeholder", {
        ns: "share",
        defaultValue: "Add note",
      }),
    );
    setComposition((prev) => ({
      ...prev,
      textLayers: [...prev.textLayers, next],
    }));
    setSelectedLayerId(next.id);
    void trackShareEvent("interaction.share.text_added");
  }, [t, trackShareEvent]);

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

  const handleAddOrReplaceAdditionalPhoto = useCallback(async () => {
    try {
      if (isE2EModeEnabled() && mealPhotoUri.trim().length > 0) {
        const nextLayer = createDefaultAdditionalPhotoLayer(mealPhotoUri);
        setComposition((prev) => ({ ...prev, additionalPhoto: nextLayer }));
        setSelectedLayerId("additionalPhoto");
        setExportState((prev) => ({ ...prev, error: null, failedAction: null }));
        void trackShareEvent("interaction.share.additional_photo_added");
        return;
      }

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
      setExportState((prev) => ({ ...prev, error: null, failedAction: null }));
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
  }, [mealPhotoUri, t, trackShareEvent]);

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
    setE2ECapturedExportPreviewUri(null);
    setSelectedLayerId(null);
    void trackShareEvent("interaction.share.reset_used");
  }, [mealTitle, selectedPreset, trackShareEvent]);

  const captureCanvasUri = useCallback(async () => {
    if (!shotRef.current) {
      throw new Error("capture_ref_missing");
    }
    setIsCapturingExport(true);
    await waitForNextFrame();
    await waitForNextFrame();
    try {
      return await captureRef(shotRef, {
        format: "png",
        quality: 1,
        width: Math.round(canvasWidth),
        height: Math.round(canvasHeight),
        result: "tmpfile",
      });
    } finally {
      setIsCapturingExport(false);
    }
  }, [canvasHeight, canvasWidth]);

  const performExport = useCallback(
    async (destination: "gallery" | "share_sheet") => {
      const action = destination === "gallery" ? "save_to_gallery" : "share";
      setExportState({ action, error: null, failedAction: null });
      setE2ECapturedExportPreviewUri(null);
      try {
        const e2eExport = resolveE2EShareExport(destination);
        if (e2eExport?.status === "error") {
          throw new Error(e2eExport.code);
        }
        const shouldCaptureForE2ECustomize =
          e2eExport?.status === "success" && mode === "customize";
        const assetUri =
          e2eExport?.status === "success" && !shouldCaptureForE2ECustomize
            ? e2eExport.assetUri
            : await captureCanvasUri();

        if (shouldCaptureForE2ECustomize) {
          setE2ECapturedExportPreviewUri(assetUri);
        } else {
          setE2ECapturedExportPreviewUri(null);
        }

        if (destination === "gallery") {
          if (!e2eExport) {
            const permission = await MediaLibrary.requestPermissionsAsync();
            if (!permission.granted) {
              throw new Error("gallery_permission_denied");
            }
            await MediaLibrary.createAssetAsync(assetUri);
          }
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
          if (!e2eExport) {
            const canShare = await Sharing.isAvailableAsync();
            if (!canShare) {
              throw new Error("share_unavailable");
            }
            await Sharing.shareAsync(assetUri);
          }
        }

        setCompleted(true);
        setExportState({ action: null, error: null, failedAction: null });
        void trackShareEvent("interaction.share.exported", {
          destination_type: destination,
          export_result: "success",
        });
        void trackShareEvent("interaction.share.completed", {
          destination_type: destination,
        });
      } catch (error) {
        const isGalleryPermissionDenied =
          destination === "gallery" &&
          String(error).toLowerCase().includes("permission");
        let message = t("share_export_failed", {
          ns: "share",
          defaultValue: "Could not share this image. Please try again.",
        });
        if (isGalleryPermissionDenied) {
          message = t("share_permission_required", {
            ns: "share",
            defaultValue: "Gallery access is off. Check permissions and try again.",
          });
        } else if (destination === "gallery") {
          message = t("share_save_failed", {
            ns: "share",
            defaultValue: "Could not save to gallery. Please try again.",
          });
        }

        setExportState({ action: null, error: message, failedAction: action });
        void trackShareEvent("interaction.share.exported", {
          destination_type: destination,
          export_result: "failed",
        });
      }
    },
    [captureCanvasUri, mode, t, trackShareEvent],
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
        <View
          style={[styles.invalidContainer, stylesWithTheme.invalidContainer]}
          testID="share-unavailable-state"
        >
          <Pressable
            testID="share-unavailable-close-button"
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t("common:close", { defaultValue: "Close" })}
            style={stylesWithTheme.invalidClose}
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
              stylesWithTheme.invalidButton,
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
      keyboardAvoiding={false}
      style={{
        paddingTop: insets.top + theme.spacing.xs,
        paddingBottom: theme.spacing.md,
        paddingLeft: theme.spacing.md,
        paddingRight: theme.spacing.md,
      }}
    >
      <View style={styles.screen} testID="share-screen">
        <View
          style={[
            styles.topControls,
            {
              width: screenWidth,
              marginHorizontal: -theme.spacing.md,
              paddingLeft: Math.max(
                insets.left,
                insets.right,
                theme.spacing.lg,
              ),
              paddingRight: Math.max(
                insets.left,
                insets.right,
                theme.spacing.lg,
              ),
            },
          ]}
        >
          <View style={styles.topControlsSide}>
            <Pressable
              testID="share-back-button"
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t("common:back", { defaultValue: "Back" })}
              hitSlop={8}
              style={({ pressed }) => [
                stylesWithTheme.navIconButton,
                pressed ? styles.navIconButtonPressed : null,
              ]}
            >
              <AppIcon name="arrow" size={20} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.topControlsCenter}>
            <View style={stylesWithTheme.modeSwitch}>
              <Pressable
                testID="share-mode-quick-button"
                onPress={() => handleSwitchMode("quick")}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === "quick" }}
                accessibilityLabel={t("share_mode_quick", {
                  ns: "share",
                  defaultValue: "Quick mode",
                })}
                style={[
                  styles.modeSwitchChip,
                  mode === "quick"
                    ? [
                        stylesWithTheme.modeSwitchChipActive,
                        { backgroundColor: activeModeSurface },
                      ]
                    : stylesWithTheme.modeSwitchChipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.modeSwitchLabel,
                    {
                      color:
                        mode === "quick"
                          ? activeModeTextColor
                          : inactiveModeTextColor,
                      fontFamily:
                        mode === "quick"
                          ? theme.typography.fontFamily.semiBold
                          : theme.typography.fontFamily.medium,
                    },
                  ]}
                >
                  {quickModeLabel}
                </Text>
              </Pressable>
              <Pressable
                testID="share-mode-customize-button"
                onPress={() => handleSwitchMode("customize")}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === "customize" }}
                accessibilityLabel={t("share_mode_customize", {
                  ns: "share",
                  defaultValue: "Customize mode",
                })}
                style={[
                  styles.modeSwitchChip,
                  mode === "customize"
                    ? [
                        stylesWithTheme.modeSwitchChipActive,
                        { backgroundColor: activeModeSurface },
                      ]
                    : stylesWithTheme.modeSwitchChipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.modeSwitchLabel,
                    {
                      color:
                        mode === "customize"
                          ? activeModeTextColor
                          : inactiveModeTextColor,
                      fontFamily:
                        mode === "customize"
                          ? theme.typography.fontFamily.semiBold
                          : theme.typography.fontFamily.medium,
                    },
                  ]}
                >
                  {customizeModeLabel}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.topControlsSide, styles.topControlsRight]}>
            <Pressable
              testID="share-close-button"
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t("common:close", { defaultValue: "Close" })}
              hitSlop={8}
              style={({ pressed }) => [
                stylesWithTheme.navIconButton,
                pressed ? styles.navIconButtonPressed : null,
              ]}
            >
              <AppIcon name="close" size={18} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <View
          testID="share-canvas"
          style={[
            styles.canvasFrame,
            {
              width: canvasWidth,
              height: canvasHeight,
            },
            stylesWithTheme.canvasFrame,
          ]}
        >
          <ViewShot ref={shotRef} style={styles.canvasWrap}>
            <ShareComposerCanvas
              width={canvasWidth}
              height={canvasHeight}
              mealPhotoUri={mealPhotoUri}
              photoUnavailableLabel={t("share_photo_unavailable", {
                ns: "share",
                defaultValue: "Photo unavailable",
              })}
              deselectLayerLabel={t("share_deselect_layer", {
                ns: "share",
                defaultValue: "Deselect layer",
              })}
              nutrition={nutrition}
              macroLabels={shareMacroLabels}
              composition={composition}
              mode={mode}
              selectedLayerId={selectedLayerId}
              editorChromeVisible={!isCapturingExport}
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
          {e2eCapturedExportPreviewUri ? (
            <View
              pointerEvents="none"
              testID="share-e2e-export-preview"
              style={styles.e2eExportPreview}
            >
              <Image
                source={{ uri: e2eCapturedExportPreviewUri }}
                resizeMode="cover"
                style={styles.e2eExportPreviewImage}
              />
            </View>
          ) : null}
          {mode === "customize" && !showE2EExportPreview ? (
            <CustomizeToolRail
              textLabel={t("dock.utility_text", { ns: "share" })}
              chartLabel={t("dock.utility_chart", { ns: "share" })}
              cardLabel={t("dock.utility_card", { ns: "share" })}
              photoLabel={t("dock.utility_photo", { ns: "share" })}
              resetLabel={t("dock.utility_reset", { ns: "share" })}
              hasChart={Boolean(composition.widgets.chart)}
              hasCard={Boolean(composition.widgets.card)}
              hasPhoto={Boolean(composition.additionalPhoto)}
              selectedLayerId={selectedLayerId}
              onAddTextLayer={handleAddTextLayer}
              onEnsureChartLayer={handleEnsureChartLayer}
              onEnsureCardLayer={handleEnsureCardLayer}
              onAddOrReplaceAdditionalPhoto={handleAddOrReplaceAdditionalPhoto}
              onResetComposition={handleResetComposition}
            />
          ) : null}
        </View>

        {!showE2EExportPreview ? (
          <ShareComposerDock
            width={screenWidth}
            contentWidth={canvasWidth}
            mode={mode}
            selectedPreset={selectedPreset}
            activeEditorKind={activeEditorKind}
            selectedLayerId={selectedLayerId}
            composition={composition}
            mealPhotoUri={mealPhotoUri}
            nutrition={nutrition}
            exportState={exportState}
            onPresetSelect={handlePresetSelect}
            onSaveToGallery={handleSaveToGallery}
            onShare={handleShare}
            onRemoveSelectedLayer={handleRemoveSelectedLayer}
            onTextStyleChange={handleTextStyleChange}
            onChartVariantChange={handleChartVariantChange}
            onChartStyleChange={handleChartStyleChange}
            onCardVariantChange={handleCardVariantChange}
            onCardStyleChange={handleCardStyleChange}
            onAdditionalPhotoReplace={handleAddOrReplaceAdditionalPhoto}
          />
        ) : null}
        {completed ? (
          <Text
            testID="share-export-success"
            style={stylesWithTheme.exportSuccess}
          >
            {t("share_saved_to_gallery", {
              ns: "share",
              defaultValue: "Saved to gallery.",
            })}
          </Text>
        ) : null}
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
  topControls: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topControlsSide: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  topControlsRight: {
    alignItems: "flex-end",
  },
  topControlsCenter: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconButtonPressed: {
    opacity: 0.72,
  },
  modeSwitch: {
    borderRadius: 18,
    padding: 3,
    flexDirection: "row",
    gap: 4,
    minHeight: 38,
  },
  modeSwitchChip: {
    minHeight: 30,
    minWidth: 82,
    borderRadius: 15,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  modeSwitchLabel: {
    fontSize: 12,
    lineHeight: 14,
  },
  canvasFrame: {
    borderRadius: 31,
    overflow: "hidden",
  },
  canvasWrap: {
    flex: 1,
    borderRadius: 30,
    overflow: "hidden",
  },
  e2eExportPreview: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    overflow: "hidden",
    zIndex: 40,
  },
  e2eExportPreviewImage: {
    width: "100%",
    height: "100%",
  },
  invalidContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
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

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    navIconButton: {
      ...styles.navIconButton,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
    },
    modeSwitch: {
      ...styles.modeSwitch,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.isDark
        ? "rgba(30,34,30,0.96)"
        : "rgba(255,253,248,0.88)",
    },
    modeSwitchChipActive: {
      borderColor: theme.isDark ? theme.primaryStrong : theme.primary,
      borderWidth: 1,
    },
    modeSwitchChipInactive: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 1,
    },
    canvasFrame: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceAlt,
      ...theme.depth.floating,
    },
    exportSuccess: {
      color: theme.success.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: 11,
      lineHeight: 13,
    },
    invalidContainer: {
      borderRadius: theme.rounded.xxl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      ...theme.depth.raised,
    },
    invalidClose: {
      position: "absolute",
      top: 12,
      left: 12,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceAlt,
    },
    invalidButton: {
      backgroundColor: theme.primary,
      ...theme.depth.cta,
    },
  });
