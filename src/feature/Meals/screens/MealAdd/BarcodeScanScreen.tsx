import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeType,
} from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  Button,
  ErrorBox,
  Layout,
  TextInput,
} from "@/components";
import { useTheme } from "@/theme/useTheme";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useAuthContext } from "@/context/AuthContext";
import type { Ingredient } from "@/types";
import {
  extractBarcodeFromPayload,
  lookupBarcodeProduct,
} from "@/services/barcode/barcodeService";
import type {
  MealAddBarcodeCodeSource,
  MealAddScreenProps,
} from "@/feature/Meals/feature/MapMealAddScreens";
import {
  MealAddPhotoScaffold,
  MealAddStatusBanner,
} from "@/feature/Meals/components/MealAddPhotoScaffold";
import { MealAddBarcodePreview } from "@/feature/Meals/components/MealAddBarcodePreview";
import { buildBarcodeDraft } from "@/feature/Meals/utils/buildBarcodeDraft";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { getE2EFixtureState } from "@/services/e2e/fixtures";
import AddMealFlowHeader from "@/feature/Meals/screens/MealAdd/components/AddMealFlowHeader";
import AddMealBottomActionBar from "@/feature/Meals/screens/MealAdd/components/AddMealBottomActionBar";

const BARCODE_PREVIEW_COMPACT_HEIGHT = 240;
const BARCODE_PREVIEW_MAX_HEIGHT = 356;

type BarcodeDisplayCodeSource = MealAddBarcodeCodeSource | "edited";

export default function BarcodeScanScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"BarcodeScan">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { t: tMeals } = useTranslation("meals");
  const { t: tCommon } = useTranslation("common");
  const keyboardInset = useKeyboardInset({ includeSafeArea: true });
  const [permission, requestPermission] = useCameraPermissions();
  const { uid } = useAuthContext();
  const { clearMeal, meal, saveDraft, setLastScreen, setMeal } =
    useMealDraftContext();

  const [detectedCode, setDetectedCode] = useState<string | null>(
    params.code ?? null,
  );
  const [codeSource, setCodeSource] = useState<
    BarcodeDisplayCodeSource | undefined
  >(params.codeSource);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(
    Boolean(params.showManualEntry),
  );
  const [manualCode, setManualCode] = useState(params.code ?? "");
  const [manualError, setManualError] = useState<string | undefined>();
  const [lookupError, setLookupError] = useState<string | undefined>();
  const [notFoundRecovery, setNotFoundRecovery] = useState(false);
  const e2eBarcodeFixture = getE2EFixtureState()?.barcode;
  const e2eBarcodeSimulation = Boolean(e2eBarcodeFixture);
  const isKeyboardVisible = keyboardInset > 0;
  const compactManualSheet =
    isKeyboardVisible && Boolean(manualError || lookupError);
  const compactScannerLayout = windowHeight < 720;
  const barcodePreviewHeight = useMemo(() => {
    if (compactScannerLayout) {
      return BARCODE_PREVIEW_COMPACT_HEIGHT;
    }

    const scaledHeight = Math.round(windowHeight * (detectedCode ? 0.38 : 0.4));
    return Math.min(BARCODE_PREVIEW_MAX_HEIGHT, Math.max(320, scaledHeight));
  }, [compactScannerLayout, detectedCode, windowHeight]);

  const canStepBack = flow.canGoBack();
  const barcodeTypes = useMemo<BarcodeType[]>(
    () => ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"],
    [],
  );

  const manualSheetMaxHeight = useMemo(() => {
    const defaultMaxHeight = windowHeight * 0.76;
    const compactMaxHeight = windowHeight * 0.5;
    const availableHeight =
      windowHeight - insets.top - theme.spacing.md - keyboardInset;

    return Math.max(
      0,
      Math.min(
        compactManualSheet ? compactMaxHeight : defaultMaxHeight,
        availableHeight,
      ),
    );
  }, [
    compactManualSheet,
    insets.top,
    keyboardInset,
    theme.spacing.md,
    windowHeight,
  ]);
  const manualKeyboardOverlap = theme.spacing.lg;
  const manualKeyboardPadding = theme.spacing.xl;

  useEffect(() => {
    setDetectedCode(params.showManualEntry ? null : (params.code ?? null));
    setCodeSource(params.codeSource);
    setManualCode(params.code ?? "");
    setShowManualEntry(Boolean(params.showManualEntry));
    setManualError(undefined);
    setLookupError(undefined);
    setNotFoundRecovery(false);
  }, [params.code, params.codeSource, params.showManualEntry]);

  useEffect(() => {
    if (e2eBarcodeFixture !== "known") return;
    setDetectedCode("5901234123457");
    setCodeSource("scan");
    setManualCode("5901234123457");
    setLookupError(undefined);
    setManualError(undefined);
    setNotFoundRecovery(false);
  }, [e2eBarcodeFixture]);

  useEffect(() => {
    if (uid) {
      void setLastScreen(uid, "AddMeal");
    }
  }, [setLastScreen, uid]);

  const dismissManualEntry = useCallback(() => {
    setManualError(undefined);
    setLookupError(undefined);
    setNotFoundRecovery(false);

    if (codeSource === "manual" || codeSource === "edited") {
      setDetectedCode(null);
      setCodeSource(undefined);
      setManualCode("");
    }

    setShowManualEntry(false);
  }, [codeSource]);

  const handleExit = useCallback(() => {
    if (showManualEntry) {
      dismissManualEntry();
      return;
    }

    if (canStepBack) {
      flow.goBack();
      return;
    }

    navigation.goBack();
  }, [canStepBack, dismissManualEntry, flow, navigation, showManualEntry]);
  const handleCloseFlow = useCallback(() => {
    if (uid) {
      clearMeal(uid);
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home");
  }, [clearMeal, navigation, uid]);

  useEffect(() => {
    const onBackPress = () => {
      handleExit();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [handleExit]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e) => {
      const actionType = e.data.action.type;
      const isBackAction =
        actionType === "GO_BACK" ||
        actionType === "POP" ||
        actionType === "POP_TO_TOP";

      if (!isBackAction) return;

      if (showManualEntry || canStepBack) {
        e.preventDefault();
        handleExit();
      }
    });

    return sub;
  }, [canStepBack, handleExit, navigation, showManualEntry]);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (lookupLoading) return;

      const code = extractBarcodeFromPayload(data);
      if (!code) return;

      setDetectedCode(code);
      setCodeSource("scan");
      setManualCode(code);
      setLookupError(undefined);
      setManualError(undefined);
      setNotFoundRecovery(false);
    },
    [lookupLoading],
  );

  const persistBarcodeMeal = useCallback(
    async (code: string, ingredient: Ingredient, productName: string) => {
      const nextMeal = buildBarcodeDraft({
        uid,
        existingMeal: meal,
        mealId: meal?.mealId,
        code,
        ingredient,
        productName,
      });

      setMeal(nextMeal);
      if (uid) {
        await saveDraft(uid, nextMeal);
      }
    },
    [meal, saveDraft, setMeal, uid],
  );

  const handleLookup = useCallback(
    async (
      codeToSearch?: string,
      codeSourceOverride?: BarcodeDisplayCodeSource,
    ) => {
      const code = codeToSearch ?? detectedCode;
      if (!code || lookupLoading) return;
      const resolvedCodeSource = codeSourceOverride ?? codeSource ?? "scan";

      setLookupLoading(true);
      setLookupError(undefined);
      setNotFoundRecovery(false);

      try {
        const result = await lookupBarcodeProduct(code);

        if (result.kind === "not_found") {
          setDetectedCode(code);
          setCodeSource(resolvedCodeSource);
          setManualCode(code);
          setNotFoundRecovery(true);
          Keyboard.dismiss();
          return;
        }

        if (result.kind === "error") {
          setLookupError(
            tMeals("barcode_scan_lookup_error", {
              defaultValue:
                "We couldn't search this barcode right now. Try again.",
            }),
          );
          Keyboard.dismiss();
          return;
        }

        await persistBarcodeMeal(code, result.ingredient, result.name);
        flow.replace("ReviewMeal", {});
      } finally {
        setLookupLoading(false);
      }
    },
    [detectedCode, flow, lookupLoading, persistBarcodeMeal, codeSource, tMeals],
  );

  const handleOpenManualEntry = useCallback(() => {
    setManualCode(detectedCode ?? "");
    setManualError(undefined);
    setLookupError(undefined);
    setNotFoundRecovery(false);

    setShowManualEntry(true);
  }, [detectedCode]);

  const handleSubmitManualCode = useCallback(() => {
    const parsed = extractBarcodeFromPayload(manualCode);
    if (!parsed) {
      setManualError(
        tMeals("barcode_scan_invalid_code", {
          defaultValue: "Enter a valid barcode to continue.",
        }),
      );
      return;
    }

    setManualCode(parsed);
    setManualError(undefined);
    setNotFoundRecovery(false);

    const submittedSource: BarcodeDisplayCodeSource =
      detectedCode && detectedCode !== parsed ? "edited" : "manual";
    setCodeSource(submittedSource);
    Keyboard.dismiss();

    void handleLookup(parsed, submittedSource);
  }, [detectedCode, handleLookup, manualCode, tMeals]);

  const handleChangeMethod = useCallback(() => {
    navigation.navigate("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  }, [navigation]);

  const renderNotFoundRecovery = (
    recovery: boolean,
    testID: string,
  ) => {
    if (!recovery) return null;

    return (
      <View testID={testID} style={styles.lookupRecoveryBox}>
        <Text style={styles.lookupRecoveryTitle}>
          {tMeals("barcode_scan_not_found_title", {
            defaultValue: "We don't have this product in the database yet.",
          })}
        </Text>
        <Text style={styles.lookupRecoveryText}>
          {tMeals("barcode_scan_not_found_body", {
            defaultValue: "Check the code or add this meal another way.",
          })}
        </Text>
      </View>
    );
  };

  const previewLabel = detectedCode
    ? tMeals("barcode_scan_detected_badge", {
        defaultValue: "Detected code",
      })
    : tMeals("barcode_scan_preview_label", {
        defaultValue: "Place the code in the frame",
      });
  const title = detectedCode
    ? tMeals("barcode_scan_detected_title", {
        defaultValue: "Barcode detected",
      })
    : tMeals("barcode_scan_title", {
        defaultValue: "Scan barcode",
      });
  const description = detectedCode
    ? tMeals("barcode_scan_detected_subtitle", {
        defaultValue: "Check the number, then search the product.",
      })
    : tMeals("barcode_scan_subtitle", {
        defaultValue:
          "Place the code in the frame. After scanning, confirm the number before searching.",
      });
  const flowHeader = (
    <AddMealFlowHeader
      progress={flow.progress}
      onBack={handleExit}
      onClose={handleCloseFlow}
      containerStyle={styles.flowHeader}
      testID="barcode-flow-header"
      backTestID="barcode-back"
      closeTestID="barcode-close"
    />
  );

  if (!permission && !e2eBarcodeSimulation) {
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.fill} testID="barcode-loading-state">
          {flowHeader}
        </View>
      </Layout>
    );
  }

  if (!e2eBarcodeSimulation && !permission.granted) {
    const blocked = permission.canAskAgain === false;
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.fill} testID="barcode-permission-state">
          {flowHeader}
          <View style={styles.permissionContent}>
            <Text style={styles.permissionTitle}>
              {tCommon("camera_permission_title")}
            </Text>
            <Text style={styles.permissionSubtitle}>
              {blocked
                ? tMeals(
                    "barcode_camera_permission_blocked_message",
                    "Enable camera access in settings to scan barcodes.",
                  )
                : tCommon("camera_permission_message")}
            </Text>
            <Button
              testID="barcode-permission-button"
              label={tCommon("continue")}
              onPress={blocked ? () => Linking.openSettings() : requestPermission}
              style={styles.permissionButton}
            />
          </View>
        </View>
      </Layout>
    );
  }

  return (
    <Layout
      showNavigation={false}
      disableScroll
      style={styles.layout}
      keyboardAvoiding={false}
    >
      <View style={styles.fill} testID="barcode-scan-screen">
        {flowHeader}
        <MealAddPhotoScaffold
          previewHeight={barcodePreviewHeight}
          preview={
            <MealAddBarcodePreview
              label={previewLabel}
              detectedCode={detectedCode}
            >
              {e2eBarcodeSimulation ? (
                <View testID="barcode-e2e-preview" style={styles.camera} />
              ) : (
                <CameraView
                  testID="barcode-camera-preview"
                  style={styles.camera}
                  onBarcodeScanned={
                    lookupLoading ? undefined : handleBarcodeScanned
                  }
                  barcodeScannerSettings={{ barcodeTypes }}
                />
              )}
            </MealAddBarcodePreview>
          }
          eyebrow={tMeals("barcode_scan_eyebrow", {
            defaultValue: "Barcode",
          })}
          title={title}
          description={description}
          sheetFitContent={!compactScannerLayout}
          contentPlacement="start"
          content={
            <>
              {!detectedCode ? (
                <View testID="barcode-live-status" style={styles.liveStatus}>
                  <MealAddStatusBanner
                    label={tMeals("barcode_scan_status", {
                      defaultValue: "Scanning for a code",
                    })}
                    loading
                  />
                </View>
              ) : null}

              {lookupError ? (
                <View testID="barcode-lookup-error">
                  <ErrorBox message={lookupError} />
                </View>
              ) : null}

              {!showManualEntry
                ? renderNotFoundRecovery(
                    notFoundRecovery,
                    "barcode-lookup-not-found",
                  )
                : null}

              <AddMealBottomActionBar
                placement="inline"
                horizontalPadding={0}
                primaryAction={
                  detectedCode
                    ? {
                        testID: "barcode-lookup-button",
                        label: tMeals("barcode_scan_search_cta", {
                          defaultValue: "Search product",
                        }),
                        onPress: () => {
                          void handleLookup();
                        },
                        loading: lookupLoading,
                      }
                    : undefined
                }
                secondaryAction={{
                  testID: "barcode-open-manual-button",
                  variant: "secondary",
                  label: tMeals("barcode_scan_manual_cta", {
                    defaultValue: "Enter code manually",
                  }),
                  onPress: handleOpenManualEntry,
                  disabled: lookupLoading,
                }}
                linkAction={{
                  testID: "barcode-change-method-button",
                  label: tMeals("change_method", {
                    defaultValue: "Change add method",
                  }),
                  onPress: handleChangeMethod,
                }}
              />
            </>
          }
        />

        {showManualEntry ? (
          <View style={styles.manualOverlay}>
            <Pressable
              style={styles.manualBackdrop}
              onPress={dismissManualEntry}
              accessibilityRole="button"
              accessibilityLabel={tMeals("barcode_scan_close_sheet", {
                defaultValue: "Close manual code entry",
              })}
            />

            <View
              testID="barcode-manual-sheet"
              style={[
                styles.manualSheet,
                {
                  marginBottom: isKeyboardVisible
                    ? Math.max(0, keyboardInset - manualKeyboardOverlap)
                    : 0,
                  paddingBottom:
                    isKeyboardVisible
                      ? manualKeyboardPadding
                      : theme.spacing.xl + insets.bottom,
                  maxHeight: manualSheetMaxHeight,
                },
              ]}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.manualSheetContent,
                  compactManualSheet ? styles.manualSheetContentCompact : null,
                ]}
              >
                <View style={styles.sheetHandle} />

                <Text style={styles.manualTitle}>
                  {tMeals("barcode_scan_sheet_title", {
                    defaultValue: "Enter code",
                  })}
                </Text>

                <TextInput
                  testID="barcode-manual-input"
                  value={manualCode}
                  onChangeText={(value) => {
                    setManualCode(value);
                    if (manualError) setManualError(undefined);
                    if (lookupError) setLookupError(undefined);
                    if (notFoundRecovery) setNotFoundRecovery(false);
                  }}
                  keyboardType="number-pad"
                  placeholder={tMeals("barcode_scan_sheet_placeholder", {
                    defaultValue: "Enter code",
                  })}
                  helperText={
                    isKeyboardVisible
                      ? undefined
                      : tMeals("barcode_scan_sheet_helper", {
                          defaultValue:
                            "Barcodes are usually 8 to 13 digits.",
                        })
                  }
                  error={manualError}
                  errorTestID="barcode-manual-validation-error"
                  fieldStyle={styles.manualInputField}
                  inputStyle={styles.manualInputText}
                />

                {renderNotFoundRecovery(
                  showManualEntry && notFoundRecovery,
                  "barcode-manual-not-found",
                )}

                {lookupError ? (
                  <View
                    testID="barcode-manual-error"
                    style={styles.manualErrorBox}
                  >
                    <Text style={styles.manualErrorTitle}>
                      {tMeals("barcode_scan_lookup_error_title", {
                        defaultValue: "Search failed",
                      })}
                    </Text>
                    <Text style={styles.manualErrorText}>{lookupError}</Text>
                  </View>
                ) : null}

              </ScrollView>
                <AddMealBottomActionBar
                  placement="inline"
                  horizontalPadding={0}
                primaryAction={{
                  testID: "barcode-manual-submit-button",
                  label: tMeals("barcode_scan_search_cta", {
                    defaultValue: "Search product",
                  }),
                  compactLabel: tMeals("barcode_scan_search_cta_compact", {
                    defaultValue: "Search",
                  }),
                  onPress: handleSubmitManualCode,
                  loading: lookupLoading,
                }}
                secondaryAction={{
                  testID: "barcode-manual-cancel-button",
                  label: tMeals("barcode_scan_back_to_scan", {
                    defaultValue: "Back to scan",
                  }),
                  compactLabel: tMeals("barcode_scan_back_to_scan_compact", {
                    defaultValue: "Scan",
                  }),
                  onPress: dismissManualEntry,
                  variant: "secondary",
                  disabled: lookupLoading,
                }}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    },
    fill: {
      flex: 1,
      backgroundColor: theme.background,
    },
    camera: {
      flex: 1,
    },
    flowHeader: {
      marginHorizontal: theme.spacing.lg,
    },
    permissionContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg,
      backgroundColor: theme.background,
      gap: theme.spacing.sm,
    },
    permissionTitle: {
      fontSize: theme.typography.size.bodyM,
      textAlign: "center",
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
    },
    permissionSubtitle: {
      fontSize: theme.typography.size.bodyL,
      textAlign: "center",
      color: theme.textSecondary,
      maxWidth: 320,
    },
    permissionButton: {
      alignSelf: "stretch",
    },
    liveStatus: {
      alignSelf: "stretch",
    },
    manualOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      zIndex: 20,
    },
    manualBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.isDark
        ? "rgba(0, 0, 0, 0.56)"
        : "rgba(47, 49, 43, 0.34)",
    },
    manualSheet: {
      borderTopLeftRadius: theme.rounded.xxl,
      borderTopRightRadius: theme.rounded.xxl,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      ...theme.depth.modal,
    },
    manualSheetContent: {
      gap: theme.spacing.xs,
    },
    manualSheetContentCompact: {
      gap: theme.spacing.xs,
    },
    sheetHandle: {
      width: 44,
      height: 5,
      borderRadius: 999,
      alignSelf: "center",
      backgroundColor: theme.border,
    },
    manualTitle: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      fontFamily: theme.typography.fontFamily.bold,
      textAlign: "center",
    },
    manualInputField: {
      height: 56,
      borderRadius: theme.rounded.md,
    },
    manualInputText: {
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.medium,
      fontVariant: ["tabular-nums"],
      paddingVertical: 0,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    lookupRecoveryBox: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      backgroundColor: theme.isDark
        ? "rgba(137, 162, 132, 0.1)"
        : "rgba(239, 231, 218, 0.72)",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    lookupRecoveryTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    lookupRecoveryText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    manualErrorBox: {
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.error.border,
      backgroundColor: theme.error.surface,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      gap: 2,
    },
    manualErrorTitle: {
      color: theme.error.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    manualErrorText: {
      color: theme.error.text,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
