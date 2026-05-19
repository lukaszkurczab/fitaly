import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Device from "expo-device";
import { v4 as uuidv4 } from "uuid";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { getSampleMealUri } from "@/utils/devSamples";
import { normalizeImageOrientation } from "@/utils/normalizeImageOrientation";
import { debugScope } from "@/utils/debug";
import { useAuthContext } from "@/context/AuthContext";
import { useAccessContext } from "@/context/AccessContext";
import { getErrorStatus } from "@/services/contracts/serviceError";
import { getE2EFixtureState } from "@/services/e2e/fixtures";
import type { Meal } from "@/types";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";

const log = debugScope("Hook:useMealCameraState");

export function useMealCameraState({
  navigation,
  flow,
  params,
}: Pick<MealAddScreenProps<"CameraDefault">, "navigation" | "flow" | "params">) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [premiumModal, setPremiumModal] = useState(
    Boolean(params?.showPremiumModal),
  );

  const { meal, setMeal, updateMeal, setLastScreen, saveDraft } =
    useMealDraftContext();
  const { uid } = useAuthContext();
  const { accessState, canUseFeature } = useAccessContext();
  const credits = accessState?.credits ?? null;
  const canUsePhotoAnalysis = canUseFeature("photoAnalysis");

  const routeId = params?.id as string | undefined;
  const skipDetection = !!params?.skipDetection;
  const attempt = params?.attempt || 1;
  const simulatorCreditsState = params?.simulatorCreditsState ?? "ok";
  const simulatorReviewState = params?.simulatorReviewState ?? "success";
  const isSimulatorPreview =
    typeof __DEV__ !== "undefined" && __DEV__ && !Device.isDevice;

  const fallbackMealIdRef = useRef<string>(uuidv4());
  const mealId = meal?.mealId || routeId || fallbackMealIdRef.current;

  useEffect(() => {
    setPremiumModal(Boolean(params?.showPremiumModal));
  }, [params?.showPremiumModal]);

  useEffect(() => {
    if (uid && setLastScreen) {
      void setLastScreen(uid, "CameraDefault");
    }
  }, [setLastScreen, uid]);

  useEffect(() => {
    const onBackPress = () => {
      if (photoUri) {
        setPhotoUri(null);
        return true;
      }
      if (flow.canGoBack()) {
        flow.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [photoUri, flow]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e) => {
      const actionType = e.data.action.type;
      const isBackAction =
        actionType === "GO_BACK" ||
        actionType === "POP" ||
        actionType === "POP_TO_TOP";

      if (!isBackAction) return;

      if (photoUri) {
        e.preventDefault();
        setPhotoUri(null);
        return;
      }

      if (flow.canGoBack()) {
        e.preventDefault();
        flow.goBack();
      }
    });

    return sub;
  }, [flow, navigation, photoUri]);

  const handleAccept = useCallback(
    async (optimizedUri?: string) => {
      const finalUri = optimizedUri || photoUri;
      if (!finalUri) return;

      try {
        let draftAfterPhoto: Meal;
        if (!meal) {
          draftAfterPhoto = {
            mealId,
            userUid: uid || "",
            name: null,
            photoUrl: finalUri,
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
          };
          setMeal(draftAfterPhoto);
        } else {
          draftAfterPhoto = {
            ...meal,
            mealId,
            photoUrl: finalUri,
            inputMethod: meal.inputMethod ?? "photo",
            updatedAt: new Date().toISOString(),
          };
          updateMeal({
            photoUrl: finalUri,
            mealId,
            inputMethod: meal.inputMethod ?? "photo",
          });
        }
        if (uid) {
          await saveDraft(uid, draftAfterPhoto);
        }
      } catch (error: unknown) {
        if (getErrorStatus(error) === 402) {
          setPremiumModal(true);
        }
        return;
      }

      setPhotoUri(null);

      if (skipDetection || !uid) {
        flow.replace("ReviewMeal", {});
        return;
      }

      flow.goTo("PreparingReviewPhoto", {
        image: finalUri,
        id: mealId,
        attempt,
        ...(isSimulatorPreview
          ? {
              simulatorCreditsState,
              simulatorReviewState,
            }
          : {}),
      });
    },
    [
      attempt,
      flow,
      isSimulatorPreview,
      meal,
      mealId,
      photoUri,
      saveDraft,
      setMeal,
      skipDetection,
      simulatorCreditsState,
      simulatorReviewState,
      uid,
      updateMeal,
    ],
  );

  const handleTakePicture = useCallback(async () => {
    const canUsePhotoAi = canUsePhotoAnalysis;
    const e2eFixture = getE2EFixtureState();
    log.log("takePicture start", {
      skipDetection,
      canUsePhotoAi,
      isCameraReady,
      isSimulatorPreview,
      simulatorCreditsState,
      simulatorReviewState,
    });

    if (isSimulatorPreview) {
      const canUseSimulatorPreviewAi = accessState
        ? canUsePhotoAi
        : simulatorCreditsState !== "none";

      if (!skipDetection && !canUseSimulatorPreviewAi) {
        setPremiumModal(true);
        return;
      }

      try {
        const uri = await getSampleMealUri();
        await handleAccept(uri);
      } catch {
        // Ignore missing local sample image on simulator preview.
      }
      return;
    }

    if (e2eFixture?.ai === "photoSuccess") {
      try {
        const uri = await getSampleMealUri();
        await handleAccept(uri);
      } catch {
        // Ignore missing local sample image in E2E; the flow can still use seeded photo meals.
      }
      return;
    }

    if (!skipDetection && !canUsePhotoAi) {
      setPremiumModal(true);
      return;
    }

    if (isTakingPhoto || !isCameraReady || !cameraRef.current) return;
    setIsTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        const normalizedUri = await normalizeImageOrientation(photo.uri);
        setPhotoUri(normalizedUri);
      }
    } finally {
      setIsTakingPhoto(false);
    }
  }, [
    accessState,
    canUsePhotoAnalysis,
    handleAccept,
    isCameraReady,
    isSimulatorPreview,
    isTakingPhoto,
    simulatorCreditsState,
    simulatorReviewState,
    skipDetection,
  ]);

  const handleRetake = useCallback(() => {
    setPhotoUri(null);
  }, []);

  const closePremiumModal = useCallback(() => {
    setPremiumModal(false);
  }, []);

  const goManagePremium = useCallback(() => {
    setPremiumModal(false);
    navigation.navigate("ManageSubscription");
  }, [navigation]);

  return {
    permission,
    requestPermission,
    cameraRef,
    isCameraReady,
    isTakingPhoto,
    photoUri,
    premiumModal,
    canUsePhotoAi: canUsePhotoAnalysis,
    credits,
    skipDetection,
    setIsCameraReady,
    handleTakePicture,
    handleAccept,
    handleRetake,
    closePremiumModal,
    goManagePremium,
  };
}
