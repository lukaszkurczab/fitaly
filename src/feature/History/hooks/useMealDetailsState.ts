import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler } from "react-native";
import * as FileSystem from "@/services/core/fileSystem";
import { calculateTotalNutrients } from "@/utils/calculateTotalNutrients";
import type { Meal } from "@/types/meal";
import type { RootStackParamList } from "@/navigation/navigate";
import type { StackNavigationProp } from "@react-navigation/stack";
import { emit } from "@/services/core/events";
import { isE2EModeEnabled } from "@/services/e2e/config";
import {
  selectLocalMealByCloudId,
  subscribeLocalMeals,
} from "@/services/meals/localMealsStore";

export function useMealDetailsState(params: {
  routeParams?: RootStackParamList["MealDetails"];
  navigation: StackNavigationProp<RootStackParamList>;
  uid: string;
  deleteMeal: (mealCloudId: string) => Promise<unknown>;
}) {
  const { routeParams, navigation, uid, deleteMeal } = params;
  const routeCloudId =
    typeof routeParams?.cloudId === "string" && routeParams.cloudId.trim()
      ? routeParams.cloudId
      : null;

  const [draft, setDraft] = useState<Meal | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [checkingImage, setCheckingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const allowNextBackRef = useRef(false);
  const deletedRef = useRef(false);
  const routeCloudIdRef = useRef(routeCloudId);
  const isE2EPhotoFixture = useCallback((meal: Meal | null | undefined) => {
    return (
      isE2EModeEnabled() &&
      Boolean(meal) &&
      (meal?.inputMethod === "photo" || meal?.name === "E2E Photo Meal")
    );
  }, []);

  useEffect(() => {
    if (routeCloudIdRef.current === routeCloudId) return;
    routeCloudIdRef.current = routeCloudId;
    deletedRef.current = false;
    setDraft(null);
  }, [routeCloudId]);

  const reloadFromLocal = useCallback(async () => {
    if (deletedRef.current) return false;
    if (!routeCloudId || !uid) {
      setDraft(null);
      return false;
    }

    const localMeal = selectLocalMealByCloudId(uid, routeCloudId);
    if (!localMeal) {
      setDraft(null);
      return false;
    }

    setDraft(localMeal);
    return true;
  }, [routeCloudId, uid]);

  useEffect(() => {
    if (!routeCloudId || !uid) {
      setDraft(null);
      return;
    }

    void reloadFromLocal();

    let cancelled = false;
    const unsubscribe = subscribeLocalMeals(uid, () => {
      if (!cancelled) void reloadFromLocal();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [reloadFromLocal, routeCloudId, uid]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (navigation.canGoBack()) {
        allowNextBackRef.current = true;
        navigation.goBack();
      } else {
        navigation.navigate("HistoryList");
      }
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", () => {
      if (allowNextBackRef.current) {
        allowNextBackRef.current = false;
      }
    });

    return sub;
  }, [navigation]);

  const rawPhotoUri =
    draft?.localPhotoUrl || draft?.photoLocalPath || draft?.photoUrl || "";
  const effectivePhotoUri =
    rawPhotoUri ||
    (isE2EPhotoFixture(draft)
      ? "https://example.com/fitaly-e2e-photo-meal.jpg"
      : "");

  useEffect(() => {
    const url = effectivePhotoUri;
    if (!url) return;
    const isLocal =
      typeof url === "string" &&
      (url.startsWith("file://") || url.startsWith("content://"));
    if (!isLocal) return;
    if (isE2EModeEnabled()) return;

    let cancelled = false;
    setCheckingImage(true);
    FileSystem.getInfoAsync(url)
      .then((info) => {
        if (cancelled || info.exists) return;
        setDraft((current) =>
          current
            ? {
                ...current,
                localPhotoUrl: null,
                photoLocalPath: null,
                photoUrl: "",
              }
            : current,
        );
      })
      .finally(() => {
        if (!cancelled) setCheckingImage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectivePhotoUri]);

  const nutrition = useMemo(
    () => (draft ? calculateTotalNutrients([draft]) : null),
    [draft],
  );

  const startEdit = useCallback(async () => {
    if (!routeCloudId || !uid) return;
    const currentMeal = selectLocalMealByCloudId(uid, routeCloudId);
    if (!currentMeal) {
      setDraft(null);
      return;
    }
    navigation.navigate("EditHistoryMealDetails", {
      cloudId: currentMeal.cloudId!,
    });
  }, [navigation, routeCloudId, uid]);

  const goShare = useCallback(() => {
    if (!routeCloudId || !uid) return;
    const currentMeal = selectLocalMealByCloudId(uid, routeCloudId);
    if (!currentMeal) {
      setDraft(null);
      return;
    }
    const photoUri =
      currentMeal.localPhotoUrl ||
      currentMeal.photoLocalPath ||
      currentMeal.photoUrl ||
      (isE2EPhotoFixture(currentMeal)
        ? "https://example.com/fitaly-e2e-photo-meal.jpg"
        : "") ||
      "";
    if (!photoUri) return;
    navigation.navigate("MealShare", {
      meal: { ...currentMeal, photoUrl: currentMeal.photoUrl || photoUri },
      returnTo: "MealDetails",
    });
  }, [isE2EPhotoFixture, navigation, routeCloudId, uid]);

  const onImageError = useCallback(() => {
    if (isE2EModeEnabled()) return;
    setDraft((current) =>
      current
        ? {
            ...current,
            localPhotoUrl: null,
            photoLocalPath: null,
            photoUrl: "",
          }
        : current,
    );
  }, []);

  const openDeleteModal = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleting) return;
    setShowDeleteModal(false);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!routeCloudId || !uid || deleting) return;

    setDeleting(true);
    try {
      const historyMeal = selectLocalMealByCloudId(uid, routeCloudId);
      const deleteId = historyMeal?.cloudId || routeCloudId;
      if (!deleteId) return;

      await deleteMeal(deleteId);

      deletedRef.current = true;
      setShowDeleteModal(false);
      setDraft(null);

      if (navigation.canGoBack()) {
        allowNextBackRef.current = true;
        navigation.goBack();
      } else {
        navigation.navigate("HistoryList");
      }
    } catch {
      emit("ui:toast", { key: "unknownError", ns: "common" });
    } finally {
      setDeleting(false);
    }
  }, [
    deleteMeal,
    deleting,
    navigation,
    routeCloudId,
    uid,
  ]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      allowNextBackRef.current = true;
      navigation.goBack();
    } else {
      navigation.navigate("HistoryList");
    }
  }, [navigation]);

  return {
    draft,
    showDeleteModal,
    checkingImage,
    deleting,
    effectivePhotoUri,
    nutrition,
    startEdit,
    goShare,
    onImageError,
    openDeleteModal,
    closeDeleteModal,
    confirmDelete,
    handleBack,
    reloadFromLocal,
    showImageBlock: checkingImage || !!effectivePhotoUri,
  };
}
