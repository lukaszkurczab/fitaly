import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
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
  ScreenCornerNavButton,
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
  MealAddTextLink,
} from "@/feature/Meals/components/MealAddPhotoScaffold";
import { MealAddBarcodePreview } from "@/feature/Meals/components/MealAddBarcodePreview";
import { buildBarcodeDraft } from "@/feature/Meals/utils/buildBarcodeDraft";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { getE2EFixtureState } from "@/services/e2e/fixtures";

const BARCODE_PREVIEW_HEIGHT = 352;

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
  const keyboardInset = useKeyboardInset();
  const [permission, requestPermission] = useCameraPermissions();
  const { uid } = useAuthContext();
  const { meal, saveDraft, setLastScreen, setMeal } = useMealDraftContext();

  const [detectedCode, setDetectedCode] = useState<string | null>(
    params.code ?? null,
  );
  const [codeSource, setCodeSource] = useState<
    MealAddBarcodeCodeSource | undefined
  >(params.codeSource);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(
    Boolean(params.showManualEntry),
  );
  const [manualCode, setManualCode] = useState(params.code ?? "");
  const [manualError, setManualError] = useState<string | undefined>();
  const [lookupError, setLookupError] = useState<string | undefined>();
  const e2eBarcodeFixture = getE2EFixtureState()?.barcode;
  const e2eBarcodeSimulation = Boolean(e2eBarcodeFixture);
  const compactManualSheet =
    keyboardInset > 0 && Boolean(manualError || lookupError);

  const canStepBack = flow.canGoBack();
  const barcodeTypes = useMemo<BarcodeType[]>(
    () => ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"],
    [],
  );

  const previewTopInset = useMemo(
    () =>
      Math.max(
        theme.spacing.xxl,
        Math.round(insets.top * 0.65) + theme.spacing.xs,
      ),
    [insets.top, theme.spacing.xs, theme.spacing.xxl],
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

  useEffect(() => {
    setDetectedCode(params.showManualEntry ? null : (params.code ?? null));
    setCodeSource(params.codeSource);
    setManualCode(params.code ?? "");
    setShowManualEntry(Boolean(params.showManualEntry));
    setManualError(undefined);
    setLookupError(undefined);
  }, [params.code, params.codeSource, params.showManualEntry]);

  useEffect(() => {
    if (e2eBarcodeFixture !== "known") return;
    setDetectedCode("5901234123457");
    setCodeSource("scan");
    setManualCode("5901234123457");
    setLookupError(undefined);
    setManualError(undefined);
  }, [e2eBarcodeFixture]);

  useEffect(() => {
    if (uid) {
      void setLastScreen(uid, "AddMeal");
    }
  }, [setLastScreen, uid]);

  const dismissManualEntry = useCallback(() => {
    setManualError(undefined);

    setShowManualEntry(false);
  }, []);

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
      codeSourceOverride?: MealAddBarcodeCodeSource,
    ) => {
      const code = codeToSearch ?? detectedCode;
      if (!code || lookupLoading) return;
      const resolvedCodeSource = codeSourceOverride ?? codeSource ?? "scan";

      setLookupLoading(true);
      setLookupError(undefined);

      try {
        const result = await lookupBarcodeProduct(code);

        if (result.kind === "not_found") {
          setDetectedCode(code);
          setCodeSource(resolvedCodeSource);
          setManualCode(code);
          setLookupError(
            tMeals("barcode_scan_not_found_error", {
              defaultValue:
                "We couldn't find a product. Edit the code or choose another method.",
            }),
          );
          return;
        }

        if (result.kind === "error") {
          setLookupError(
            tMeals("barcode_scan_lookup_error", {
              defaultValue:
                "We couldn't search this barcode right now. Try again.",
            }),
          );
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
    setCodeSource("manual");

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

    void handleLookup(parsed, "manual");
  }, [handleLookup, manualCode, tMeals]);

  const handleChangeMethod = useCallback(() => {
    navigation.navigate("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  }, [navigation]);

  const previewLabel = detectedCode
    ? tMeals("barcode_scan_detected_badge", {
        defaultValue: "Detected code",
      })
    : tMeals("barcode_scan_preview_label", {
        defaultValue: "Place the code inside the frame",
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
        defaultValue:
          "We found a barcode. Search for the product or edit the code first.",
      })
    : tMeals("barcode_scan_subtitle", {
        defaultValue:
          "Point the camera at the barcode. We will ask you to confirm the number before searching.",
      });

  if (!permission && !e2eBarcodeSimulation) {
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.flexBackground} testID="barcode-loading-state" />
      </Layout>
    );
  }

  if (!e2eBarcodeSimulation && !permission.granted) {
    const blocked = permission.canAskAgain === false;
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.permissionWrap} testID="barcode-permission-state">
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
        <MealAddPhotoScaffold
          topInset={previewTopInset}
          previewHeight={BARCODE_PREVIEW_HEIGHT}
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
          topAction={
            <ScreenCornerNavButton
              icon={canStepBack ? "back" : "close"}
              onPress={handleExit}
              accessibilityLabel={tCommon(canStepBack ? "back" : "close", {
                defaultValue: canStepBack ? "Back" : "Close",
              })}
              containerStyle={styles.screenCornerNavStyle}
            />
          }
          eyebrow={tMeals("barcode_scan_eyebrow", {
            defaultValue: "Barcode",
          })}
          title={title}
          description={description}
          sheetFitContent={Boolean(detectedCode)}
          contentPlacement="start"
          content={
            <>
              {!detectedCode ? (
                <MealAddStatusBanner
                  label={tMeals("barcode_scan_status", {
                    defaultValue: "Scanning for a code",
                  })}
                  loading
                />
              ) : null}

              {lookupError ? (
                <View testID="barcode-lookup-error">
                  <ErrorBox message={lookupError} />
                </View>
              ) : null}

              {detectedCode ? (
                <>
                  <View
                    testID="barcode-detected-summary"
                    style={styles.detectedSummary}
                  >
                    <Text style={styles.detectedSummaryLabel}>
                      {tMeals("barcode_scan_detected_label", {
                        defaultValue: "Code detected",
                      })}
                    </Text>
                    <Text
                      style={styles.detectedSummaryCode}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      {detectedCode}
                    </Text>
                  </View>
                  <Button
                    testID="barcode-lookup-button"
                    label={tMeals("barcode_scan_search_cta", {
                      defaultValue: "Search product",
                    })}
                    onPress={() => {
                      void handleLookup();
                    }}
                    loading={lookupLoading}
                  />
                </>
              ) : null}

              <Button
                testID="barcode-open-manual-button"
                label={tMeals("barcode_scan_manual_cta", {
                  defaultValue: "Enter code manually",
                })}
                onPress={handleOpenManualEntry}
                variant="secondary"
                disabled={lookupLoading}
              />

              <MealAddTextLink
                testID="barcode-change-method-button"
                label={tMeals("change_method", {
                  defaultValue: "Change add method",
                })}
                onPress={handleChangeMethod}
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
                  marginBottom: keyboardInset,
                  paddingBottom: theme.spacing.xl + insets.bottom,
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
                {!compactManualSheet ? (
                  <Text style={styles.manualSubtitle}>
                    {tMeals("barcode_scan_sheet_subtitle", {
                      defaultValue:
                        "Type the numbers under the bars if scanning is difficult.",
                    })}
                  </Text>
                ) : null}

                <TextInput
                  testID="barcode-manual-input"
                  value={manualCode}
                  onChangeText={(value) => {
                    setManualCode(value);
                    if (manualError) setManualError(undefined);
                    if (lookupError) setLookupError(undefined);
                  }}
                  keyboardType="number-pad"
                  placeholder={tMeals("barcode_scan_sheet_placeholder", {
                    defaultValue: "Enter numbers only",
                  })}
                  helperText={tMeals("barcode_scan_sheet_helper", {
                    defaultValue: "Numeric input only. Usually 8 to 13 digits.",
                  })}
                  error={manualError}
                  fieldStyle={styles.manualInputField}
                  inputStyle={styles.manualInputText}
                />
                {lookupError ? (
                  <View
                    testID="barcode-manual-error"
                    style={styles.manualErrorBox}
                  >
                    <Text style={styles.manualErrorTitle}>
                      {tMeals("barcode_scan_not_found_title", {
                        defaultValue: "Product not found",
                      })}
                    </Text>
                    <Text style={styles.manualErrorText}>{lookupError}</Text>
                  </View>
                ) : null}

                <View style={styles.manualActions}>
                  <Button
                    testID="barcode-manual-submit-button"
                    label={tMeals("barcode_scan_search_cta", {
                      defaultValue: "Search product",
                    })}
                    onPress={handleSubmitManualCode}
                    loading={lookupLoading}
                    style={styles.manualPrimaryButton}
                  />
                  <Button
                    testID="barcode-manual-cancel-button"
                    label={tMeals("barcode_scan_back_to_scan", {
                      defaultValue: "Back to scan",
                    })}
                    onPress={dismissManualEntry}
                    variant="secondary"
                    disabled={lookupLoading}
                    style={styles.manualSecondaryButton}
                  />
                </View>
              </ScrollView>
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
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    },
    fill: {
      flex: 1,
      backgroundColor: theme.background,
    },
    flexBackground: {
      flex: 1,
      backgroundColor: theme.background,
    },
    camera: {
      flex: 1,
    },
    screenCornerNavStyle: {
      top: 0,
      left: 0,
      right: undefined,
    },
    permissionWrap: {
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
    detectedSummary: {
      minHeight: 52,
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.primarySoft,
      backgroundColor: theme.success.surface,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    detectedSummaryLabel: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
      textTransform: "uppercase",
      flexShrink: 0,
    },
    detectedSummaryCode: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "right",
      flexShrink: 1,
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
      gap: theme.spacing.sm,
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
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.bold,
      textAlign: "center",
    },
    manualSubtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
    },
    manualActions: {
      gap: theme.spacing.xs,
    },
    manualInputField: {
      minHeight: 52,
      borderRadius: theme.rounded.md,
    },
    manualInputText: {
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.medium,
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
    manualPrimaryButton: {
      minHeight: 48,
      borderRadius: 14,
    },
    manualSecondaryButton: {
      minHeight: 48,
      borderRadius: 14,
    },
  });
