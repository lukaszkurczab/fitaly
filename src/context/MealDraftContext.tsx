import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Meal, Ingredient, MealType } from "@/types/meal";
import { v4 as uuidv4 } from "uuid";

export function getDraftKey(userUid: string) {
  return `current_meal_draft_${userUid}`;
}
export function getScreenKey(userUid: string) {
  return `current_meal_draft_screen_${userUid}`;
}

export type MealDraftContextType = {
  meal: Meal | null;
  setMeal: (meal: Meal) => void;
  updateMeal: (patch: Partial<Meal>) => void;
  clearMeal: (userUid: string) => void;
  addIngredient: (ingredient: Ingredient) => void;
  removeIngredient: (index: number) => void;
  updateIngredient: (index: number, ingredient: Ingredient) => void;
  setType: (type: MealType) => void;
  setPhotoUrl: (url: string | null) => void;
  setNotes: (notes: string | null) => void;
  setTags: (tags: string[]) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  isDraft: boolean;
  saveDraft: (userUid: string, draftOverride?: Meal | null) => Promise<void>;
  loadDraft: (userUid: string) => Promise<void>;
  removeDraft: (userUid: string) => Promise<void>;
  loadLastScreen: (userUid: string) => Promise<void>;
  lastScreen: string | null;
  setLastScreen: (userUid: string, screen: string) => Promise<void>;
  clearLastScreen: (userUid: string) => Promise<void>;
};

const MealDraftContext = createContext<MealDraftContextType>({
  meal: null,
  setMeal: () => {},
  updateMeal: () => {},
  clearMeal: () => {},
  addIngredient: () => {},
  removeIngredient: () => {},
  updateIngredient: () => {},
  setType: () => {},
  setPhotoUrl: () => {},
  setNotes: () => {},
  setTags: () => {},
  addTag: () => {},
  removeTag: () => {},
  isDraft: false,
  saveDraft: async () => {},
  loadDraft: async () => {},
  removeDraft: async () => {},
  lastScreen: null,
  setLastScreen: async () => {},
  loadLastScreen: async () => {},
  clearLastScreen: async () => {},
});

type Props = { children: ReactNode };

export const MealDraftProvider = ({ children }: Props) => {
  const [meal, setMealState] = useState<Meal | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [lastScreen, setLastScreenState] = useState<string | null>(null);
  const mealRef = useRef<Meal | null>(null);

  const saveDraft = useCallback(
    async (userUid: string, draftOverride?: Meal | null) => {
      const draftToSave = draftOverride ?? mealRef.current;
      if (draftToSave) {
        await AsyncStorage.setItem(
          getDraftKey(userUid),
          JSON.stringify(draftToSave),
        );
        setIsDraft(true);
      }
    },
    [],
  );

  const loadDraft = useCallback(async (userUid: string) => {
    const raw = await AsyncStorage.getItem(getDraftKey(userUid));
    if (!raw) {
      mealRef.current = null;
      setMealState(null);
      setIsDraft(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Meal;
      mealRef.current = parsed;
      setMealState(parsed);
      setIsDraft(true);
    } catch {
      mealRef.current = null;
      setMealState(null);
      setIsDraft(false);
      setLastScreenState(null);
      await AsyncStorage.multiRemove([getDraftKey(userUid), getScreenKey(userUid)]);
    }
  }, []);

  const clearLastScreen = useCallback(async (userUid: string) => {
    setLastScreenState(null);
    await AsyncStorage.removeItem(getScreenKey(userUid));
  }, []);

  const removeDraft = useCallback(
    async (userUid: string) => {
      await AsyncStorage.removeItem(getDraftKey(userUid));
      mealRef.current = null;
      setMealState(null);
      setIsDraft(false);
      await clearLastScreen(userUid);
    },
    [clearLastScreen],
  );

  const setLastScreen = useCallback(async (userUid: string, screen: string) => {
    const normalized =
      screen === "CameraDefault" ||
      screen === "BarcodeScan" ||
      screen === "PreparingReviewPhoto" ||
      screen === "DescribeMeal" ||
      screen === "TextAnalyzing" ||
      screen === "ReviewMeal" ||
      screen === "EditMealDetails" ||
      screen === "SelectSavedMeal" ||
      screen === "IngredientsNotRecognized"
        ? "AddMeal"
        : screen;

    setLastScreenState(normalized);
    await AsyncStorage.setItem(getScreenKey(userUid), normalized);
  }, []);

  const loadLastScreen = useCallback(async (userUid: string) => {
    const screen = await AsyncStorage.getItem(getScreenKey(userUid));
    const normalized =
      screen === "CameraDefault" ||
      screen === "BarcodeScan" ||
      screen === "PreparingReviewPhoto" ||
      screen === "DescribeMeal" ||
      screen === "TextAnalyzing" ||
      screen === "ReviewMeal" ||
      screen === "EditMealDetails" ||
      screen === "SelectSavedMeal" ||
      screen === "IngredientsNotRecognized"
        ? "AddMeal"
        : screen;

    setLastScreenState(normalized || null);
  }, []);

  const setMeal = useCallback((meal: Meal) => {
    mealRef.current = meal;
    setMealState(meal);
  }, []);

  const updateMeal = (patch: Partial<Meal>) => {
    setMealState((prev) =>
      {
        const next = prev
          ? { ...prev, ...patch, updatedAt: new Date().toISOString() }
          : null;
        mealRef.current = next;
        return next;
      },
    );
  };

  const addIngredient = (ingredient: Ingredient) => {
    setMealState((prev) =>
      {
        const next = prev
          ? {
              ...prev,
              ingredients: [
                ...(prev.ingredients ?? []),
                { ...ingredient, id: ingredient.id || uuidv4() },
              ],
              updatedAt: new Date().toISOString(),
            }
          : null;
        mealRef.current = next;
        return next;
      },
    );
  };

  const removeIngredient = (index: number) => {
    setMealState((prev) =>
      {
        const next = prev
          ? {
              ...prev,
              ingredients: (prev.ingredients ?? []).filter((_, i) => i !== index),
              updatedAt: new Date().toISOString(),
            }
          : null;
        mealRef.current = next;
        return next;
      },
    );
  };

  const updateIngredient = (index: number, ingredient: Ingredient) => {
    setMealState((prev) =>
      {
        const next = prev
          ? {
              ...prev,
              ingredients: (prev.ingredients ?? []).map((ing, i) =>
                i === index
                  ? {
                      ...ingredient,
                      id: ing.id || ingredient.id || uuidv4(),
                    }
                  : ing,
              ),
              updatedAt: new Date().toISOString(),
            }
          : null;
        mealRef.current = next;
        return next;
      },
    );
  };

  const setType = (type: MealType) => updateMeal({ type });
  const setPhotoUrl = (url: string | null) => updateMeal({ photoUrl: url });
  const setNotes = (notes: string | null) => updateMeal({ notes });
  const setTags = (tags: string[]) => updateMeal({ tags });

  const addTag = (tag: string) => {
    setMealState((prev) =>
      {
        const next =
          prev && tag
            ? {
                ...prev,
                tags: prev.tags ? [...prev.tags, tag] : [tag],
                updatedAt: new Date().toISOString(),
              }
            : prev;
        mealRef.current = next;
        return next;
      },
    );
  };

  const removeTag = (tag: string) => {
    setMealState((prev) =>
      {
        const next = prev
          ? {
              ...prev,
              tags: prev.tags?.filter((t) => t !== tag) || [],
              updatedAt: new Date().toISOString(),
            }
          : prev;
        mealRef.current = next;
        return next;
      },
    );
  };

  const clearMeal = useCallback(
    (userUid: string) => {
      mealRef.current = null;
      setMealState(null);
      void removeDraft(userUid);
    },
    [removeDraft],
  );

  return (
    <MealDraftContext.Provider
      value={{
        meal,
        setMeal,
        updateMeal,
        clearMeal,
        addIngredient,
        removeIngredient,
        updateIngredient,
        setType,
        setPhotoUrl,
        setNotes,
        setTags,
        addTag,
        removeTag,
        isDraft,
        saveDraft,
        loadDraft,
        removeDraft,
        loadLastScreen,
        lastScreen,
        setLastScreen,
        clearLastScreen,
      }}
    >
      {children}
    </MealDraftContext.Provider>
  );
};

export const useMealDraftContext = () => useContext(MealDraftContext);
export const useMealContext = useMealDraftContext;
