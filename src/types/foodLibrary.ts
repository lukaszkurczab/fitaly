export const FOOD_LIBRARY_DOMAINS = [
  "MealTemplate",
  "Recipe",
  "Ingredient/Product",
  "ShoppingList",
] as const;

export type FoodLibraryDomain = (typeof FOOD_LIBRARY_DOMAINS)[number];

export const FOOD_LIBRARY_DOMAIN_CONTRACTS = {
  MealTemplate: {
    owner: "meal_template_library",
    identityFields: ["templateId", "ownerUserId", "templateVersion"],
    ownedFields: [
      "displayName",
      "description",
      "mealTypeHint",
      "draftItems",
      "draftTotals",
      "nutritionSnapshot",
      "imageRef",
    ],
  },
  Recipe: {
    owner: "recipe_library",
    identityFields: ["recipeId", "ownerUserId", "recipeVersion"],
    ownedFields: [
      "title",
      "description",
      "ingredients",
      "steps",
      "instructions",
      "servings",
      "yield",
      "prepTimeMin",
      "cookTimeMin",
      "nutritionSnapshot",
      "imageRef",
    ],
  },
  "Ingredient/Product": {
    owner: "ingredient_product_library",
    identityFields: ["ingredientProductId", "recordScope"],
    ownedFields: [
      "displayName",
      "kind",
      "lifecycleState",
      "ownerUserId",
      "brandName",
      "ingredientName",
      "packageName",
      "category",
      "barcodeIdentities",
      "externalSourceIds",
      "servingSizes",
      "nutritionPer100",
      "defaultServing",
      "sourceAttribution",
      "confidence",
      "profileFlags",
      "dietaryFlags",
      "allergenFlags",
      "createdAt",
      "updatedAt",
    ],
  },
  ShoppingList: {
    owner: "shopping_list_library",
    identityFields: ["listId", "ownerUserId"],
    ownedFields: ["title", "items", "itemRefs", "checkedState", "sortOrder", "notes"],
  },
} as const satisfies Record<
  FoodLibraryDomain,
  {
    owner: string;
    identityFields: readonly string[];
    ownedFields: readonly string[];
  }
>;

export const FOOD_LIBRARY_MEAL_TEMPLATE_FORBIDDEN_LOGGED_MEAL_FIELDS = [
  "loggedAt",
  "dayKey",
  "loggedAtLocalMin",
  "tzOffsetMin",
  "syncState",
  "source",
  "inputMethod",
  "savedMealRefId",
] as const;

export const FOOD_LIBRARY_LOGGED_MEAL_OWNER = "meal_logging" as const;
export const FOOD_LIBRARY_LOGGED_MEAL_SCHEMA = "Meal" as const;

export const FOOD_LIBRARY_LOGGED_MEAL_FORBIDDEN_FIELDS = [
  "mealTemplateId",
  "templateId",
  "templateVersion",
  "recipeId",
  "recipeInstructions",
  "recipeSteps",
  "recipeYield",
  "recipeServings",
  "productId",
  "productBarcode",
  "productCatalogId",
  "productLifecycleState",
  "shoppingListId",
  "shoppingListItems",
  "shoppingListCheckedAt",
  "shoppingListLifecycleState",
] as const;

export type FoodLibraryLoggedMealForbiddenField =
  (typeof FOOD_LIBRARY_LOGGED_MEAL_FORBIDDEN_FIELDS)[number];

export const FOOD_LIBRARY_CURRENT_SAVED_MEAL_NAMES = [
  "myMeals",
  "saved_meals",
] as const;

export const FOOD_LIBRARY_LEGACY_MARKERS_NOT_CANONICAL = [
  "myMeals",
  "saved_meals",
  "source:saved",
  "inputMethod:saved",
  "savedMealRefId",
] as const;

export type FoodLibraryLegacyMarker =
  (typeof FOOD_LIBRARY_LEGACY_MARKERS_NOT_CANONICAL)[number];

export const FOOD_LIBRARY_BARCODE_RESULT_OWNERS = [
  "backend_provider_adapter",
  "add_meal_draft_source",
] as const;

export type FoodLibraryBarcodeResultOwner =
  (typeof FOOD_LIBRARY_BARCODE_RESULT_OWNERS)[number];

export const INGREDIENT_PRODUCT_KINDS = [
  "generic_ingredient",
  "branded_product",
] as const;

export const INGREDIENT_PRODUCT_RECORD_SCOPES = [
  "global_seed",
  "global_internal",
  "user_scoped",
] as const;

export const INGREDIENT_PRODUCT_LIFECYCLE_STATES = [
  "candidate",
  "verified",
  "rejected",
] as const;

export const INGREDIENT_PRODUCT_SOURCE_TYPES = [
  "internal_seed",
  "internal_review",
  "user_created",
  "external_provider",
  "barcode_identity",
  "runtime_ai_candidate",
] as const;

export const INGREDIENT_PRODUCT_CONFIDENCE_LEVELS = [
  "unknown",
  "low",
  "medium",
  "high",
  "verified",
] as const;

export const INGREDIENT_PRODUCT_NUTRITION_BASES = [
  "per_100g",
  "per_100ml",
] as const;

export const INGREDIENT_PRODUCT_SERVING_UNITS = [
  "g",
  "ml",
  "piece",
  "serving",
] as const;

export const INGREDIENT_PRODUCT_PROFILE_COMPATIBILITY_STATUSES = [
  "unknown",
  "compatible",
  "incompatible",
  "warning",
] as const;

export const INGREDIENT_PRODUCT_DIETARY_FLAGS = [
  "vegan",
  "vegetarian",
  "gluten_free",
  "lactose_free",
  "halal",
  "kosher",
] as const;

export const INGREDIENT_PRODUCT_ALLERGEN_FLAGS = [
  "milk",
  "eggs",
  "fish",
  "shellfish",
  "tree_nuts",
  "peanuts",
  "wheat",
  "soy",
  "sesame",
] as const;

export const INGREDIENT_PRODUCT_WARNING_REASON_CODES = [
  "profile_unknown",
  "profile_warning",
  "profile_incompatible",
  "nutrition_low_confidence",
  "nutrition_missing",
  "source_candidate_only",
  "cache_stale",
  "offline_cache",
  "pending_user_record",
  "query_too_short",
  "backend_degraded",
] as const;

export const INGREDIENT_PRODUCT_RANKING_SIGNALS = [
  "exact_user",
  "exact_match",
  "user_scoped",
  "verified_seed",
  "verified_global",
  "profile_warning",
  "nutrition_warning",
  "pending_user_record",
] as const;

export const INGREDIENT_PRODUCT_CACHE_STATES = [
  "fresh",
  "stale",
  "offline",
  "pending_local",
] as const;

export const INGREDIENT_PRODUCT_REQUIRED_FIELDS = [
  "ingredientProductId",
  "recordScope",
  "lifecycleState",
  "kind",
  "displayName",
  "sourceAttribution",
  "confidence",
  "nutritionPer100",
  "defaultServing",
  "servingSizes",
  "profileFlags",
  "createdAt",
  "updatedAt",
] as const;

export const INGREDIENT_PRODUCT_OPTIONAL_FIELDS = [
  "ownerUserId",
  "brandName",
  "ingredientName",
  "packageName",
  "category",
  "barcodeIdentities",
  "externalSourceIds",
  "dietaryFlags",
  "allergenFlags",
] as const;

export const INGREDIENT_PRODUCT_SOURCE_ATTRIBUTION_REQUIRED_FIELDS = [
  "sourceType",
  "sourceId",
  "sourceName",
] as const;

export const INGREDIENT_PRODUCT_SOURCE_ATTRIBUTION_OPTIONAL_FIELDS = [
  "provider",
  "license",
  "observedAt",
  "reviewedAt",
  "reviewedBy",
] as const;

export const INGREDIENT_PRODUCT_CONFIDENCE_FIELDS = [
  "identity",
  "nutrition",
  "profile",
] as const;

export const INGREDIENT_PRODUCT_NUTRITION_REQUIRED_FIELDS = [
  "basis",
  "unit",
  "kcal",
  "protein",
  "fat",
  "carbs",
] as const;

export const INGREDIENT_PRODUCT_NUTRITION_OPTIONAL_FIELDS = [
  "fiber",
  "sugar",
  "salt",
  "saturatedFat",
] as const;

export const INGREDIENT_PRODUCT_SERVING_REQUIRED_FIELDS = [
  "defaultServing",
  "servingSizes",
] as const;

export const INGREDIENT_PRODUCT_SERVING_SIZE_FIELDS = [
  "servingSizeId",
  "label",
  "quantity",
  "unit",
] as const;

export const INGREDIENT_PRODUCT_BARCODE_MINIMAL_IDENTITY_FIELDS = [
  "barcode",
  "format",
  "sourceType",
] as const;

export const INGREDIENT_PRODUCT_BARCODE_OPTIONAL_FIELDS = [
  "normalizedBarcode",
  "country",
  "sourceId",
  "observedAt",
] as const;

export type IngredientProductKind = (typeof INGREDIENT_PRODUCT_KINDS)[number];
export type IngredientProductRecordScope =
  (typeof INGREDIENT_PRODUCT_RECORD_SCOPES)[number];
export type IngredientProductLifecycleState =
  (typeof INGREDIENT_PRODUCT_LIFECYCLE_STATES)[number];
export type IngredientProductSourceType =
  (typeof INGREDIENT_PRODUCT_SOURCE_TYPES)[number];
export type IngredientProductConfidenceLevel =
  (typeof INGREDIENT_PRODUCT_CONFIDENCE_LEVELS)[number];
export type IngredientProductNutritionBasis =
  (typeof INGREDIENT_PRODUCT_NUTRITION_BASES)[number];
export type IngredientProductServingUnit =
  (typeof INGREDIENT_PRODUCT_SERVING_UNITS)[number];
export type IngredientProductProfileCompatibilityStatus =
  (typeof INGREDIENT_PRODUCT_PROFILE_COMPATIBILITY_STATUSES)[number];
export type IngredientProductDietaryFlag =
  (typeof INGREDIENT_PRODUCT_DIETARY_FLAGS)[number];
export type IngredientProductAllergenFlag =
  (typeof INGREDIENT_PRODUCT_ALLERGEN_FLAGS)[number];
export type IngredientProductWarningReasonCode =
  (typeof INGREDIENT_PRODUCT_WARNING_REASON_CODES)[number];
export type IngredientProductRankingSignal =
  (typeof INGREDIENT_PRODUCT_RANKING_SIGNALS)[number];
export type IngredientProductCacheState =
  (typeof INGREDIENT_PRODUCT_CACHE_STATES)[number];
export type IngredientProductContractField =
  | (typeof INGREDIENT_PRODUCT_REQUIRED_FIELDS)[number]
  | (typeof INGREDIENT_PRODUCT_OPTIONAL_FIELDS)[number];
export type IngredientProductSourceAttributionRequiredField =
  (typeof INGREDIENT_PRODUCT_SOURCE_ATTRIBUTION_REQUIRED_FIELDS)[number];
export type IngredientProductSourceAttributionOptionalField =
  (typeof INGREDIENT_PRODUCT_SOURCE_ATTRIBUTION_OPTIONAL_FIELDS)[number];
export type IngredientProductConfidenceField =
  (typeof INGREDIENT_PRODUCT_CONFIDENCE_FIELDS)[number];
export type IngredientProductNutritionRequiredField =
  (typeof INGREDIENT_PRODUCT_NUTRITION_REQUIRED_FIELDS)[number];
export type IngredientProductNutritionOptionalField =
  (typeof INGREDIENT_PRODUCT_NUTRITION_OPTIONAL_FIELDS)[number];
export type IngredientProductServingRequiredField =
  (typeof INGREDIENT_PRODUCT_SERVING_REQUIRED_FIELDS)[number];
export type IngredientProductServingSizeField =
  (typeof INGREDIENT_PRODUCT_SERVING_SIZE_FIELDS)[number];
export type IngredientProductBarcodeMinimalIdentityField =
  (typeof INGREDIENT_PRODUCT_BARCODE_MINIMAL_IDENTITY_FIELDS)[number];
export type IngredientProductBarcodeOptionalField =
  (typeof INGREDIENT_PRODUCT_BARCODE_OPTIONAL_FIELDS)[number];

export type IngredientProductSourceAttribution = {
  sourceType: IngredientProductSourceType;
  sourceId: string;
  sourceName: string;
  provider: string | null;
  license: string | null;
  observedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type IngredientProductConfidence = {
  identity: IngredientProductConfidenceLevel;
  nutrition: IngredientProductConfidenceLevel;
  profile: IngredientProductConfidenceLevel;
};

export type IngredientProductNutritionPer100 = {
  basis: IngredientProductNutritionBasis;
  unit: IngredientProductServingUnit;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  sugar: number | null;
  salt: number | null;
  saturatedFat: number | null;
};

export type IngredientProductServing = {
  quantity: number;
  unit: IngredientProductServingUnit;
};

export type IngredientProductServingSize = IngredientProductServing & {
  servingSizeId: string;
  label: string;
};

export type IngredientProductProfileCompatibility = {
  status: IngredientProductProfileCompatibilityStatus;
  dietaryFlags: IngredientProductDietaryFlag[];
  allergenFlags: IngredientProductAllergenFlag[];
};

export type IngredientProductSearchRow = {
  ingredientProductId: string;
  recordScope: IngredientProductRecordScope;
  lifecycleState: IngredientProductLifecycleState;
  displayName: string;
  kind: IngredientProductKind;
  defaultServing: IngredientProductServing;
  nutritionPer100: IngredientProductNutritionPer100 | null;
  confidence: IngredientProductConfidence;
  sourceAttribution: IngredientProductSourceAttribution;
  profileCompatibility: IngredientProductProfileCompatibility;
  warningReasonCodes: IngredientProductWarningReasonCode[];
  rankingSignals: IngredientProductRankingSignal[];
  brandName: string | null;
  ingredientName: string | null;
  packageName: string | null;
  category: string | null;
  servingSizes: IngredientProductServingSize[];
  dietaryFlags: IngredientProductDietaryFlag[];
  allergenFlags: IngredientProductAllergenFlag[];
  cacheState: IngredientProductCacheState | null;
  ownerUserId: string | null;
};

export type IngredientProductSearchQueryEcho = {
  normalizedQuery: string;
  queryLength: number;
  limit: number;
  includeUserScoped: boolean;
  includeGlobal: boolean;
  locale: string | null;
};

export type IngredientProductSearchCachePolicy = {
  cacheGeneration: "ingredient_product_search_v1";
  maxAgeSeconds: number;
};

export type IngredientProductSearchResponse = {
  items: IngredientProductSearchRow[];
  queryEcho: IngredientProductSearchQueryEcho;
  cachePolicy: IngredientProductSearchCachePolicy | null;
  warnings: IngredientProductWarningReasonCode[];
};

export type IngredientProductSearchRequest = {
  query: string;
  locale?: string | null;
  limit?: number;
  includeUserScoped?: boolean;
  includeGlobal?: boolean;
};

export type IngredientProductCreateRequest = {
  clientMutationId: string;
  ingredientProductId: string;
  displayName: string;
  kind?: IngredientProductKind;
  defaultServing: IngredientProductServing;
  nutritionPer100?: IngredientProductNutritionPer100 | null;
  brandName?: string | null;
  ingredientName?: string | null;
  packageName?: string | null;
  category?: string | null;
  servingSizes?: IngredientProductServingSize[];
  dietaryFlags?: IngredientProductDietaryFlag[];
  allergenFlags?: IngredientProductAllergenFlag[];
};

export type IngredientProductCreateResponse = {
  item: IngredientProductSearchRow;
  updated: boolean;
};

export type IngredientProductSearchStatus =
  | "idle"
  | "results"
  | "no_results"
  | "offline_warm_cache"
  | "offline_no_cache"
  | "stale"
  | "warning"
  | "backend_degraded";

export type IngredientProductSearchResult = {
  status: IngredientProductSearchStatus;
  items: IngredientProductSearchRow[];
  queryEcho: IngredientProductSearchQueryEcho | null;
  warnings: IngredientProductWarningReasonCode[];
  cachePolicy: IngredientProductSearchCachePolicy | null;
  source: "remote" | "cache" | "none";
  isStale: boolean;
  errorCode: string | null;
};

export type FoodLibraryDomainContract =
  (typeof FOOD_LIBRARY_DOMAIN_CONTRACTS)[FoodLibraryDomain];

export type FoodLibraryDomainsContract = {
  contract: "food_library_domains_v1";
  libraryDomains: FoodLibraryDomain[];
  domainContracts: {
    [Domain in FoodLibraryDomain]: FoodLibraryDomainContract;
  };
  ingredientProductRecordContract: {
    recordKinds: IngredientProductKind[];
    recordScopes: IngredientProductRecordScope[];
    lifecycleStates: IngredientProductLifecycleState[];
    verifiedMeaning:
      "verified_for_fitaly_catalog_use_not_medical_or_dietary_safety_claim";
    requiredFields: IngredientProductContractField[];
    optionalFields: IngredientProductContractField[];
    kindSpecificRequiredFields: {
      generic_ingredient: IngredientProductContractField[];
      branded_product: IngredientProductContractField[];
    };
    ownership: {
      scopeField: "recordScope";
      ownerField: "ownerUserId";
      userScopedScope: "user_scoped";
      userScopedRequiresOwnerUserId: true;
      globalScopesMustNotUseOwnerUserId: Array<
        Extract<IngredientProductRecordScope, "global_seed" | "global_internal">
      >;
      globalRecordsAreUserAccountData: false;
    };
    sourceAttribution: {
      requiredFields: IngredientProductSourceAttributionRequiredField[];
      optionalFields: IngredientProductSourceAttributionOptionalField[];
      sourceTypes: IngredientProductSourceType[];
      candidateOnlySourceTypes: IngredientProductSourceType[];
      durableTruthRequiresNonAiSource: true;
    };
    confidence: {
      requiredFields: IngredientProductConfidenceField[];
      levels: IngredientProductConfidenceLevel[];
      unknownMeansNotSafeToAssume: true;
    };
    nutritionPer100: {
      requiredFields: IngredientProductNutritionRequiredField[];
      optionalFields: IngredientProductNutritionOptionalField[];
      allowedBases: IngredientProductNutritionBasis[];
      missingNutritionPolicy: "unknown_not_guessed";
      runtimeAiMayBecomeDurableNutritionTruth: false;
    };
    serving: {
      requiredFields: IngredientProductServingRequiredField[];
      servingSizeFields: IngredientProductServingSizeField[];
      allowedUnits: IngredientProductServingUnit[];
    };
    profileFlags: {
      requiredFields: string[];
      allowedDietaryFlags: IngredientProductDietaryFlag[];
      allowedAllergenFlags: IngredientProductAllergenFlag[];
      compatibilityStatuses: IngredientProductProfileCompatibilityStatus[];
      missingProfilePolicy: "unknown_not_guessed";
      verifiedIsMedicalOrDietarySafetyClaim: false;
      runtimeAiMayBecomeDurableProfileTruth: false;
    };
    barcodeIdentities: {
      minimalIdentityFields: IngredientProductBarcodeMinimalIdentityField[];
      optionalFields: IngredientProductBarcodeOptionalField[];
      noCatalogWriteInThisSlice: true;
      noTopLevelAddMealBarcodePath: true;
    };
    localCacheBoundary: {
      representedAs: "projection_only";
      localCacheIsTruth: false;
      mayPromoteToGlobalWithoutReview: false;
    };
  };
  loggedMealBoundary: {
    owner: typeof FOOD_LIBRARY_LOGGED_MEAL_OWNER;
    schemaName: typeof FOOD_LIBRARY_LOGGED_MEAL_SCHEMA;
    mustRemainNarrow: true;
    mustNotServeAsLibraryCatchAll: true;
    mustNotGainFields: FoodLibraryLoggedMealForbiddenField[];
    rationale: string;
  };
  currentSavedMealsBoundary: {
    currentNames: Array<(typeof FOOD_LIBRARY_CURRENT_SAVED_MEAL_NAMES)[number]>;
    isFinalLibraryFoundation: false;
    laterTargetDomain: "MealTemplate";
    compatibilityFallbackToOldShapeAccepted: false;
    legacyMarkersNotCanonicalLibraryFoundation: FoodLibraryLegacyMarker[];
    mustNotExpandWith: FoodLibraryLoggedMealForbiddenField[];
    rationale: string;
  };
  barcodeBoundary: {
    resultOwnership: FoodLibraryBarcodeResultOwner[];
    addMealDraftSourceOnly: true;
    createsFirstPartyProductCatalogInThisSlice: false;
    mustNotWriteLibraryDomains: Array<Extract<FoodLibraryDomain, "Ingredient/Product">>;
    rationale: string;
  };
};
