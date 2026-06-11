export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";
export type MealSource = "ai" | "manual" | "saved" | null;
export type MealSyncState = "synced" | "pending" | "conflict" | "failed";
export type MealInputMethod =
  | "manual"
  | "photo"
  | "barcode"
  | "text"
  | "saved";

export type MealAiMeta = {
  model?: string | null;
  runId?: string | null;
  confidence?: number | null;
  warnings?: string[] | null;
};

export type MealImageRef = {
  imageId: string;
  storagePath?: string;
  downloadUrl?: string | null;
};

export type Ingredient = {
  id: string;
  name: string;
  amount: number;
  unit?: "g" | "ml";
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type Nutrients = {
  protein: number;
  fat: number;
  carbs: number;
  kcal: number;
};

export interface Meal {
  userUid: string;
  mealId: string;
  savedMealRefId?: string | null;
  timestamp: string;
  dayKey?: string | null;
  loggedAtLocalMin?: number | null;
  tzOffsetMin?: number | null;
  type: MealType;
  name: string | null;
  ingredients: Ingredient[];
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: number | null;
  syncState: MealSyncState;
  source: MealSource;
  inputMethod?: MealInputMethod | null;
  aiMeta?: MealAiMeta | null;
  imageRef?: MealImageRef | null;
  imageId?: string | null;
  photoLocalPath?: string | null;
  photoUrl?: string | null;
  localPhotoUrl?: string | null;
  notes?: string | null;
  tags?: string[];
  deleted?: boolean;
  cloudId?: string;
  totals?: Nutrients;
}
