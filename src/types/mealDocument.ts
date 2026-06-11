import type {
  Ingredient,
  MealAiMeta,
  MealInputMethod,
  MealImageRef,
  MealSource,
  MealSyncState,
  MealType,
  Nutrients,
} from "@/types/meal";

export interface MealDocument {
  id: string;
  loggedAt: string;
  dayKey?: string | null;
  loggedAtLocalMin?: number | null;
  tzOffsetMin?: number | null;
  type: MealType;
  name: string | null;
  ingredients: Ingredient[];
  createdAt: string;
  updatedAt: string;
  source: MealSource;
  inputMethod?: MealInputMethod | null;
  aiMeta?: MealAiMeta | null;
  imageRef?: MealImageRef | null;
  notes?: string | null;
  tags: string[];
  deleted?: boolean;
  totals?: Nutrients;
  syncState?: MealSyncState;

  // Legacy mirrors kept for migration-safe reads.
  mealId?: string;
  cloudId?: string;
  timestamp?: string;
  imageId?: string | null;
  photoUrl?: string | null;
  userUid?: string | null;
}
