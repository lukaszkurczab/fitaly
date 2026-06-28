import type { Ingredient, MealType, Nutrients } from "@/types/meal";

export const PLANNED_MEAL_SOURCE_TYPES = [
  "manual",
  "saved_meal",
  "recipe",
  "ingredient_product_draft",
] as const;

export const PLANNED_MEAL_TIME_BUCKETS = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "any",
] as const;

export const PLANNED_MEAL_STATUSES = [
  "planned",
  "edited",
  "rescheduled",
  "deleted",
  "expired",
  "source_unavailable",
  "converted_to_review",
] as const;

export const PLANNED_MEAL_UPDATE_STATUSES = [
  "planned",
  "edited",
  "rescheduled",
  "expired",
  "source_unavailable",
] as const;

export const PLANNED_MEAL_ESTIMATE_STATES = [
  "known",
  "partial",
  "unknown",
] as const;

export const PLANNED_MEAL_NUTRITION_FIELDS = [
  "kcal",
  "protein",
  "fat",
  "carbs",
] as const;

export const PLANNED_MEAL_CONFIDENCE_LEVELS = [
  "low",
  "medium",
  "high",
] as const;

export type PlannedMealSourceType =
  (typeof PLANNED_MEAL_SOURCE_TYPES)[number];
export type PlannedMealTimeBucket =
  (typeof PLANNED_MEAL_TIME_BUCKETS)[number];
export type PlannedMealStatus = (typeof PLANNED_MEAL_STATUSES)[number];
export type PlannedMealUpdateStatus =
  (typeof PLANNED_MEAL_UPDATE_STATUSES)[number];
export type PlannedMealEstimateState =
  (typeof PLANNED_MEAL_ESTIMATE_STATES)[number];
export type PlannedMealNutritionField =
  (typeof PLANNED_MEAL_NUTRITION_FIELDS)[number];
export type PlannedMealConfidence =
  (typeof PLANNED_MEAL_CONFIDENCE_LEVELS)[number];

export type PlannedMealSourceRef = {
  sourceId: string;
  sourceVersion: number | null;
  snapshotName: string | null;
};

export type PlannedMealDraftSnapshot = {
  name: string | null;
  type: MealType;
  ingredients: Ingredient[];
  totals: Nutrients | null;
  notes: string | null;
  tags: string[];
};

export type PlannedMealNutritionEstimate = {
  state: PlannedMealEstimateState;
  totals: Nutrients | null;
  missingFields: PlannedMealNutritionField[];
  confidence: PlannedMealConfidence | null;
};

export type PlannedMealItem = {
  plannedMealId: string;
  version: number;
  dateBucket: string;
  timeBucket: PlannedMealTimeBucket | null;
  sourceType: PlannedMealSourceType;
  sourceRef: PlannedMealSourceRef | null;
  draftSnapshot: PlannedMealDraftSnapshot;
  nutritionEstimate: PlannedMealNutritionEstimate;
  status: PlannedMealStatus;
  linkedMealId?: string | null;
  convertedAt?: string | null;
  conversionClientMutationId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlannedMealsListQueryEcho = {
  startDate: string;
  days: number;
  includeDeleted: boolean;
  returnedItems: number;
};

export type PlannedMealsListResponse = {
  items: PlannedMealItem[];
  queryEcho: PlannedMealsListQueryEcho;
};

export type PlannedMealsListRequest = {
  startDate?: string;
  days?: number;
  includeDeleted?: boolean;
};

export type PlannedMealCreateRequest = {
  clientMutationId: string;
  plannedMealId: string;
  dateBucket: string;
  timeBucket?: PlannedMealTimeBucket | null;
  sourceType: PlannedMealSourceType;
  sourceRef?: PlannedMealSourceRef | null;
  draftSnapshot: PlannedMealDraftSnapshot;
  nutritionEstimate: PlannedMealNutritionEstimate;
};

export type PlannedMealUpdateRequest = {
  clientMutationId: string;
  expectedVersion: number;
  dateBucket?: string;
  timeBucket?: PlannedMealTimeBucket | null;
  sourceType?: PlannedMealSourceType;
  sourceRef?: PlannedMealSourceRef | null;
  draftSnapshot?: PlannedMealDraftSnapshot;
  nutritionEstimate?: PlannedMealNutritionEstimate;
  status?: PlannedMealUpdateStatus;
};

export type PlannedMealDeleteRequest = {
  clientMutationId: string;
  expectedVersion: number;
};

export type PlannedMealMutationResponse = {
  item: PlannedMealItem;
  updated: boolean;
};
