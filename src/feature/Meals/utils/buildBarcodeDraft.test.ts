import { describe, expect, it } from "@jest/globals";
import type { Ingredient } from "@/types";
import { buildBarcodeDraft } from "@/feature/Meals/utils/buildBarcodeDraft";

const PRODUCT_LIBRARY_FIELDS = [
  "libraryDomain",
  "productId",
  "productRef",
  "catalogId",
  "barcodeIdentities",
] as const;

const ingredient: Ingredient = {
  id: "5901234123457",
  name: "Greek yogurt",
  amount: 100,
  unit: "g",
  kcal: 120,
  protein: 12,
  fat: 4,
  carbs: 8,
};

function expectNoProductLibraryFields(value: Record<string, unknown>) {
  for (const field of PRODUCT_LIBRARY_FIELDS) {
    expect(value).not.toHaveProperty(field);
  }
}

describe("buildBarcodeDraft", () => {
  it("converts a barcode result into a normal Add Meal review draft only", () => {
    const draft = buildBarcodeDraft({
      uid: "user-1",
      existingMeal: null,
      mealId: "meal-1",
      code: "5901234123457",
      ingredient,
      productName: "Greek yogurt",
    });

    expect(draft).toEqual(
      expect.objectContaining({
        mealId: "meal-1",
        userUid: "user-1",
        name: "Greek yogurt",
        ingredients: [ingredient],
        notes: "barcode:5901234123457",
        source: "manual",
        inputMethod: "barcode",
        aiMeta: null,
        photoUrl: null,
        photoLocalPath: null,
        localPhotoUrl: null,
        imageId: null,
        syncState: "pending",
      }),
    );
    expectNoProductLibraryFields(draft as unknown as Record<string, unknown>);
    expectNoProductLibraryFields(
      draft.ingredients[0] as unknown as Record<string, unknown>,
    );
  });
});
