import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Image, StyleSheet, View } from "react-native";
import * as Device from "expo-device";
import { Layout } from "@/components";
import { useTranslation } from "react-i18next";
import { useAiCreditsContext } from "@/context/AiCreditsContext";
import { useAccessContext } from "@/context/AccessContext";
import { useAuthContext } from "@/context/AuthContext";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useAppSettingsContext } from "@/context/AppSettingsContext";
import { detectIngredientsWithVision } from "@/services/ai/visionService";
import { getAiUxErrorType } from "@/services/ai/uxError";
import { getErrorStatus } from "@/services/contracts/serviceError";
import { getMealAiMetaFromAiResponse } from "@/services/meals/mealMetadata";
import type { Meal } from "@/types";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { useTheme } from "@/theme/useTheme";
import {
  MealAddPhotoScaffold,
  MealAddStatusBanner,
} from "@/feature/Meals/components/MealAddPhotoScaffold";
import AddMealFlowHeader from "@/feature/Meals/screens/MealAdd/components/AddMealFlowHeader";
import AddMealBottomActionBar from "@/feature/Meals/screens/MealAdd/components/AddMealBottomActionBar";

type PreparingReviewUiState =
  | "preparing"
  | "slow"
  | "failed"
  | "offline";

const SLOW_ANALYSIS_DELAY_MS = 8000;
const SIMULATOR_PREVIEW_DELAY_MS = 900;

const getRecognitionFailureReason = (
  error: unknown,
): "offline" | "timeout" | "ai_unavailable" | "not_recognized" => {
  const errorType = getAiUxErrorType(error);
  if (errorType === "offline") return "offline";
  if (errorType === "AI_CHAT_TIMEOUT") return "timeout";
  if (errorType === "AI_CHAT_PROVIDER_UNAVAILABLE") return "ai_unavailable";
  return "not_recognized";
};

const buildFallbackPhotoDraft = (uid: string, image: string, id?: string): Meal => ({
  mealId: id || uuidv4(),
  userUid: uid,
  name: null,
  photoUrl: image,
  ingredients: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  syncState: "pending",
  tags: [],
  deleted: false,
  notes: null,
  type: "other",
  timestamp: "",
  source: null,
  inputMethod: "photo",
  aiMeta: null,
});

export default function PreparingReviewPhotoScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"PreparingReviewPhoto">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["common", "meals"]);
  const { uid } = useAuthContext();
  const { language } = useAppSettingsContext();
  const { clearMeal, meal, saveDraft, setMeal, updateMeal } =
    useMealDraftContext();
  const { applyCreditsFromResponse } = useAiCreditsContext();
  const { applyAccessFromResponse, refreshAccess } = useAccessContext();
  const [uiState, setUiState] = useState<PreparingReviewUiState>("preparing");
  const [imageError, setImageError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const inFlightRef = useRef(false);
  const ignoreResultRef = useRef(false);
  const isSimulatorPreview =
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    !Device.isDevice &&
    Boolean(params.simulatorReviewState);
  const ensureDraftWithPhoto = useCallback(async () => {
    if (!uid || !params.image || meal) return meal;

    const fallbackDraft = buildFallbackPhotoDraft(uid, params.image, params.id);
    setMeal(fallbackDraft);
    await saveDraft(uid, fallbackDraft);
    return fallbackDraft;
  }, [meal, params.id, params.image, saveDraft, setMeal, uid]);

  useEffect(() => {
    let cancelled = false;
    let slowTimer: ReturnType<typeof setTimeout> | undefined;

    const analyze = async () => {
      if (!params.image || !uid) {
        if (!cancelled) {
          flow.replace("ReviewMeal", {});
        }
        return;
      }

      await ensureDraftWithPhoto();

      if (isSimulatorPreview) {
        inFlightRef.current = true;
        ignoreResultRef.current = false;
        if (!cancelled) {
          setUiState("preparing");
        }

        slowTimer = setTimeout(() => {
          if (cancelled) return;

          inFlightRef.current = false;

          switch (params.simulatorReviewState) {
            case "slow":
              setUiState("slow");
              break;
            case "failed":
              setUiState("failed");
              break;
            case "offline":
              setUiState("offline");
              break;
            case "success":
            default:
              flow.replace("ReviewMeal", {});
              break;
          }
        }, SIMULATOR_PREVIEW_DELAY_MS);

        return;
      }

      inFlightRef.current = true;
      ignoreResultRef.current = false;
      if (!cancelled) {
        setUiState("preparing");
      }

      slowTimer = setTimeout(() => {
        if (!cancelled && inFlightRef.current) {
          setUiState("slow");
        }
      }, SLOW_ANALYSIS_DELAY_MS);

      try {
        const analyzeResult = await detectIngredientsWithVision(uid, params.image, {
          lang: language,
        });
        const ingredients = analyzeResult?.ingredients ?? null;

        if (analyzeResult?.credits) {
          applyCreditsFromResponse(analyzeResult.credits);
          applyAccessFromResponse(analyzeResult.credits);
        }

        if (cancelled || ignoreResultRef.current) {
          return;
        }

        if (!ingredients || ingredients.length === 0) {
          if (!cancelled) {
            setUiState("failed");
          }
          return;
        }

        const aiMeta = analyzeResult
          ? getMealAiMetaFromAiResponse(analyzeResult.credits)
          : null;
        const draftBase =
          meal ?? buildFallbackPhotoDraft(uid, params.image, params.id);
        const analyzedMeal: Meal = {
          ...draftBase,
          mealId: draftBase.mealId || params.id || uuidv4(),
          photoUrl: params.image,
          ingredients,
          source: "ai",
          inputMethod: "photo",
          aiMeta,
          updatedAt: new Date().toISOString(),
        };

        if (!meal) {
          setMeal(analyzedMeal);
        } else {
          updateMeal({
            mealId: analyzedMeal.mealId,
            photoUrl: params.image,
            ingredients,
            source: "ai",
            inputMethod: "photo",
            aiMeta,
          });
        }

        await saveDraft(uid, analyzedMeal);

        if (!cancelled) {
          flow.replace("ReviewMeal", {});
        }
      } catch (error) {
        if (cancelled || ignoreResultRef.current) {
          return;
        }

        if (getErrorStatus(error) === 402) {
          await refreshAccess();
          if (!cancelled) {
            flow.replace("CameraDefault", {
              id: params.id,
              attempt: params.attempt,
              showPremiumModal: true,
              simulatorCreditsState: params.simulatorCreditsState,
              simulatorReviewState: params.simulatorReviewState,
            });
          }
          return;
        }

        if (!cancelled) {
          const reason = getRecognitionFailureReason(error);
          setUiState(
            reason === "offline"
              ? "offline"
              : reason === "timeout"
                ? "slow"
                : "failed",
          );
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    void analyze();

    return () => {
      cancelled = true;
      inFlightRef.current = false;
      if (slowTimer) {
        clearTimeout(slowTimer);
      }
    };
  }, [
    applyCreditsFromResponse,
    applyAccessFromResponse,
    ensureDraftWithPhoto,
    flow,
    isSimulatorPreview,
    language,
    meal,
    params.attempt,
    params.id,
    params.image,
    params.simulatorCreditsState,
    params.simulatorReviewState,
    refreshAccess,
    retryKey,
    saveDraft,
    setMeal,
    uid,
    updateMeal,
  ]);

  useEffect(() => {
    setImageError(false);
  }, [params.image]);

  const handleManualEntry = useCallback(() => {
    ignoreResultRef.current = true;
    flow.replace("EditMealDetails", { submitIntent: "replaceReview" });
  }, [flow]);

  const handleKeepWaiting = useCallback(() => {
    if (inFlightRef.current) {
      setUiState("preparing");
      return;
    }

    setRetryKey((current) => current + 1);
  }, []);

  const handleTryAgain = useCallback(() => {
    ignoreResultRef.current = true;
    flow.replace("CameraDefault", {
      id: params.id,
      attempt: (params.attempt ?? 1) + 1,
      simulatorCreditsState: params.simulatorCreditsState,
      simulatorReviewState: params.simulatorReviewState,
    });
  }, [
    flow,
    params.attempt,
    params.id,
    params.simulatorCreditsState,
    params.simulatorReviewState,
  ]);

  const handleSaveDraft = useCallback(() => {
    ignoreResultRef.current = true;
    navigation.navigate("Home");
  }, [navigation]);
  const handleBack = useCallback(() => {
    ignoreResultRef.current = true;
    if (flow.canGoBack()) {
      flow.goBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home");
  }, [flow, navigation]);
  const handleCloseFlow = useCallback(() => {
    ignoreResultRef.current = true;
    if (uid) {
      clearMeal(uid);
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home");
  }, [clearMeal, navigation, uid]);

  const screenCopy = useMemo(() => {
    switch (uiState) {
      case "slow":
        return {
          eyebrow: t("preparing_review_slow_label", {
            ns: "meals",
            defaultValue: "Still preparing",
          }),
          title: t("preparing_review_slow_title", {
            ns: "meals",
            defaultValue: "This is taking a bit longer",
          }),
          description: t("preparing_review_slow_subtitle", {
            ns: "meals",
            defaultValue:
              "We're still working on the photo. You can keep waiting or switch to manual entry.",
          }),
        };
      case "failed":
        return {
          eyebrow: t("preparing_review_failed_label", {
            ns: "meals",
            defaultValue: "Couldn't prepare review",
          }),
          title: t("preparing_review_failed_title", {
            ns: "meals",
            defaultValue: "We couldn't prepare review",
          }),
          description: t("preparing_review_failed_subtitle", {
            ns: "meals",
            defaultValue:
              "This photo didn't give us a reliable meal summary this time.",
          }),
        };
      case "offline":
        return {
          eyebrow: t("preparing_review_offline_label", {
            ns: "meals",
            defaultValue: "Connection lost",
          }),
          title: t("preparing_review_offline_title", {
            ns: "meals",
            defaultValue: "Your meal is safe",
          }),
          description: t("preparing_review_offline_subtitle", {
            ns: "meals",
            defaultValue:
              "Finish later when you're back online, or add it manually now.",
          }),
        };
      case "preparing":
      default:
        return {
          eyebrow: t("preparing_review_label", {
            ns: "meals",
            defaultValue: "Preparing review",
          }),
          title: t("camera_loader_title", {
            ns: "common",
            defaultValue: "Preparing your review",
          }),
          description: t("preparing_review_subtitle", {
            ns: "meals",
            defaultValue:
              "Photo analysis has started. Review Meal opens automatically when the first result is ready.",
          }),
        };
    }
  }, [t, uiState]);

  return (
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <View testID="add-meal-photo-preparing-screen" style={styles.screen}>
        <AddMealFlowHeader
          progress={flow.progress}
          onBack={handleBack}
          onClose={handleCloseFlow}
          containerStyle={styles.flowHeader}
          testID="add-meal-photo-preparing-flow-header"
          backTestID="add-meal-photo-preparing-back"
          closeTestID="add-meal-photo-preparing-close"
        />
        <MealAddPhotoScaffold
        preview={
          params.image && !imageError ? (
            <Image
              source={{ uri: params.image }}
              style={styles.previewImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.previewFallback} />
          )
        }
        previewOverlay={<View pointerEvents="none" style={styles.previewOverlay} />}
        eyebrow={screenCopy.eyebrow}
        title={screenCopy.title}
        description={screenCopy.description}
        footerNote={
          uiState === "preparing"
            ? t("preparing_review_footer", {
                ns: "meals",
                defaultValue: "Review Meal opens automatically. No action needed.",
              })
            : undefined
        }
        content={
          uiState === "preparing" ? (
            <View testID="add-meal-photo-preparing-state">
              <MealAddStatusBanner
                label={t("preparing_review_status", {
                  ns: "meals",
                  defaultValue: "Photo analysis started",
                })}
                loading
              />
            </View>
          ) : (
            <AddMealBottomActionBar
              placement="inline"
              horizontalPadding={0}
              secondaryAction={{
                variant: "secondary",
                label:
                  uiState === "slow"
                    ? t("preparing_review_slow_secondary", {
                        ns: "meals",
                        defaultValue: "Use manual entry",
                      })
                    : t("preparing_review_failed_secondary", {
                        ns: "meals",
                        defaultValue: "Add manually",
                      }),
                onPress: handleManualEntry,
              }}
              primaryAction={{
                label:
                  uiState === "slow"
                    ? t("preparing_review_slow_primary", {
                        ns: "meals",
                        defaultValue: "Keep waiting",
                      })
                    : uiState === "offline"
                      ? t("preparing_review_offline_primary", {
                          ns: "meals",
                          defaultValue: "Save draft",
                        })
                      : t("preparing_review_failed_primary", {
                          ns: "meals",
                          defaultValue: "Try again",
                        }),
                onPress:
                  uiState === "slow"
                    ? handleKeepWaiting
                    : uiState === "offline"
                      ? handleSaveDraft
                      : handleTryAgain,
              }}
            />
          )
        }
        />
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
    screen: {
      flex: 1,
    },
    previewImage: {
      width: "100%",
      height: "100%",
    },
    previewFallback: {
      flex: 1,
      backgroundColor: "#121512",
    },
    previewOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(18, 21, 18, 0.22)",
    },
    flowHeader: {
      marginHorizontal: theme.spacing.lg,
    },
  });
