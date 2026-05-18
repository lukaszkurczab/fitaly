import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard } from "react-native";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import type { Ingredient, Meal, MealType } from "@/types/meal";
import type { MealAddFlowApi } from "@/feature/Meals/feature/MapMealAddScreens";

export type MealDetailsFormMode = "review";

type UseMealDetailsFormParams = {
  mode: MealDetailsFormMode;
  flow: MealAddFlowApi;
  onReviewSubmit?: (meal: Meal) => Promise<void> | void;
  draftAdapter: MealDetailsDraftAdapter;
};

export type MealDetailsDraftAdapter = {
  uid: string | null;
  meal: Meal | null;
  persistMeal: (meal: Meal) => Promise<void> | void;
  retryLoadDraft?: () => Promise<void> | void;
};

export function isValidIsoDate(value?: string | null) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function getMealDateOrNow(value?: string | null) {
  return isValidIsoDate(value) && value ? new Date(value) : new Date();
}

export function formatMealTime(value: Date, locale: string, hour12: boolean) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12,
  }).format(value);
}

function buildDraftIngredient(source?: Ingredient | null): Ingredient {
  return {
    id: source?.id ?? uuidv4(),
    name: source?.name ?? "",
    amount: source?.amount ?? 1,
    unit: source?.unit ?? "g",
    kcal: source?.kcal ?? 0,
    protein: source?.protein ?? 0,
    carbs: source?.carbs ?? 0,
    fat: source?.fat ?? 0,
  };
}

export function useMealDetailsForm({
  mode,
  flow,
  onReviewSubmit,
  draftAdapter,
}: UseMealDetailsFormParams) {
  const { i18n } = useTranslation(["meals", "common"]);
  const uid = draftAdapter.uid;
  const currentMeal = draftAdapter.meal;
  const mealTimestamp = currentMeal?.timestamp;

  const [mealName, setMealName] = useState(currentMeal?.name ?? "");
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [typeDraft, setTypeDraft] = useState<MealType>(currentMeal?.type ?? "other");
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(getMealDateOrNow(mealTimestamp));
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
  const [ingredientDraft, setIngredientDraft] = useState<Ingredient | null>(null);

  useEffect(() => {
    setMealName(currentMeal?.name ?? "");
  }, [currentMeal?.name]);

  useEffect(() => {
    setHasPendingChanges(false);
  }, [currentMeal?.mealId, mode]);

  useEffect(() => {
    setTypeDraft(currentMeal?.type ?? "other");
  }, [currentMeal?.type]);

  useEffect(() => {
    if (isValidIsoDate(mealTimestamp) && mealTimestamp) {
      setPickerDate(new Date(mealTimestamp));
    }
  }, [mealTimestamp]);

  const retryLoadDraft = useCallback(async () => {
    await draftAdapter.retryLoadDraft?.();
  }, [draftAdapter]);

  const persistMeal = useCallback(
    async (nextMeal: Meal) => {
      await draftAdapter.persistMeal(nextMeal);
    },
    [draftAdapter],
  );

  const persistMealPatch = useCallback(
    async (patch: Partial<Meal>) => {
      if (!currentMeal) return;
      const nextMeal: Meal = {
        ...currentMeal,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await persistMeal(nextMeal);
    },
    [currentMeal, persistMeal],
  );

  const handleNameBlur = useCallback(async () => {
    await persistMealPatch({ name: mealName.trim() || null });
  }, [mealName, persistMealPatch]);

  const handleMealNameChange = useCallback((value: string) => {
    setMealName(value);
    setHasPendingChanges(true);
  }, []);

  const handleOpenTypePicker = useCallback(() => {
    setTypeDraft(currentMeal?.type ?? "other");
    setTypePickerVisible(true);
  }, [currentMeal?.type]);

  const handleCloseTypePicker = useCallback(() => {
    setTypePickerVisible(false);
    setTypeDraft(currentMeal?.type ?? "other");
  }, [currentMeal?.type]);

  const handleApplyType = useCallback(
    async (nextType: MealType) => {
      await persistMealPatch({ type: nextType });
      setHasPendingChanges(true);
      setTypePickerVisible(false);
    },
    [persistMealPatch],
  );

  const handleCloseTimePicker = useCallback(() => {
    setPickerDate(getMealDateOrNow(mealTimestamp));
    setTimePickerVisible(false);
  }, [mealTimestamp]);

  const handleOpenTimePicker = useCallback(() => {
    Keyboard.dismiss();
    setPickerDate(getMealDateOrNow(mealTimestamp));
    setTimePickerVisible(true);
  }, [mealTimestamp]);

  const handleSaveTime = useCallback(async () => {
    const baseDate = getMealDateOrNow(mealTimestamp);
    const nextTimestamp = new Date(baseDate);
    nextTimestamp.setHours(pickerDate.getHours(), pickerDate.getMinutes(), 0, 0);

    await persistMealPatch({ timestamp: nextTimestamp.toISOString() });
    setHasPendingChanges(true);
    setTimePickerVisible(false);
  }, [mealTimestamp, persistMealPatch, pickerDate]);

  const handleOpenIngredientEditor = useCallback(
    (index: number | null) => {
      const source =
        index === null ? null : (currentMeal?.ingredients ?? [])[index] ?? null;
      setEditingIngredientIndex(index);
      setIngredientDraft(buildDraftIngredient(source));
    },
    [currentMeal?.ingredients],
  );

  const handleCloseIngredientEditor = useCallback(() => {
    setEditingIngredientIndex(null);
    setIngredientDraft(null);
  }, []);

  const handleCommitIngredient = useCallback(
    async (updated: Ingredient) => {
      if (!currentMeal) return;

      const currentIngredients = currentMeal.ingredients ?? [];
      const nextIngredients =
        editingIngredientIndex === null
          ? [...currentIngredients, updated]
          : currentIngredients.map((ingredient, index) =>
              index === editingIngredientIndex ? updated : ingredient,
            );

      await persistMeal({
        ...currentMeal,
        ingredients: nextIngredients,
        updatedAt: new Date().toISOString(),
      });
      setHasPendingChanges(true);
      handleCloseIngredientEditor();
    },
    [currentMeal, editingIngredientIndex, handleCloseIngredientEditor, persistMeal],
  );

  const handleDeleteIngredient = useCallback(async () => {
    if (!currentMeal || editingIngredientIndex === null) return;

    await persistMeal({
      ...currentMeal,
      ingredients: (currentMeal.ingredients ?? []).filter(
        (_ingredient, index) => index !== editingIngredientIndex,
      ),
      updatedAt: new Date().toISOString(),
    });
    setHasPendingChanges(true);
    handleCloseIngredientEditor();
  }, [currentMeal, editingIngredientIndex, handleCloseIngredientEditor, persistMeal]);

  const handleSubmit = useCallback(async () => {
    const trimmedName = mealName.trim();

    if (!currentMeal) return;
    const nextMeal: Meal = {
      ...currentMeal,
      name: trimmedName || null,
      updatedAt: new Date().toISOString(),
    };
    await persistMeal(nextMeal);
    if (onReviewSubmit) {
      await onReviewSubmit(nextMeal);
    } else {
      flow.goBack();
    }
    setHasPendingChanges(false);
  }, [
    flow,
    currentMeal,
    mealName,
    onReviewSubmit,
    persistMeal,
  ]);

  const locale = i18n?.language || "en";
  const prefers12h = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        timeZone: "UTC",
      }).formatToParts(new Date(Date.UTC(2020, 0, 1, 13)));
      return parts.some((part) => part.type === "dayPeriod");
    } catch {
      return false;
    }
  }, [locale]);

  const ingredients = currentMeal?.ingredients ?? [];

  return {
    uid,
    meal: currentMeal,
    mealTimestamp,
    mealName,
    setMealName: handleMealNameChange,
    typePickerVisible,
    setTypePickerVisible,
    typeDraft,
    setTypeDraft,
    timePickerVisible,
    setTimePickerVisible,
    pickerDate,
    setPickerDate,
    editingIngredientIndex,
    ingredientDraft,
    locale,
    prefers12h,
    ingredients,
    retryLoadDraft,
    handleNameBlur,
    handleOpenTypePicker,
    handleCloseTypePicker,
    handleApplyType,
    handleOpenTimePicker,
    handleCloseTimePicker,
    handleSaveTime,
    handleOpenIngredientEditor,
    handleCloseIngredientEditor,
    handleCommitIngredient,
    handleDeleteIngredient,
    handleSubmit,
    hasPendingChanges,
  };
}
