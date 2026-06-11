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
    identityFields: ["ingredientProductId", "ownerUserId"],
    ownedFields: [
      "displayName",
      "kind",
      "brandName",
      "ingredientName",
      "barcodeIdentities",
      "servingSizes",
      "nutritionPerServing",
      "sourceAttribution",
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

export type FoodLibraryDomainContract =
  (typeof FOOD_LIBRARY_DOMAIN_CONTRACTS)[FoodLibraryDomain];

export type FoodLibraryDomainsContract = {
  contract: "food_library_domains_v1";
  libraryDomains: FoodLibraryDomain[];
  domainContracts: {
    [Domain in FoodLibraryDomain]: FoodLibraryDomainContract;
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
