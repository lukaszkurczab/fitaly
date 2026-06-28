import { Keyboard, TextInput as RNTextInput } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { IngredientEditor } from "@/components/IngredientEditor";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type {
  IngredientProductSearchResult,
  IngredientProductSearchRow,
} from "@/types/foodLibrary";

const mockSearchIngredientProducts = jest.fn<
  (...args: unknown[]) => Promise<IngredientProductSearchResult>
>();
const mockCreateOrQueueIngredientProduct = jest.fn<
  (...args: unknown[]) => Promise<unknown>
>();
const mockDiscardIngredientProductConflict = jest.fn<
  (...args: unknown[]) => Promise<unknown>
>();
const mockDeleteOrQueueIngredientProduct = jest.fn<
  (...args: unknown[]) => Promise<unknown>
>();
const mockUpdateOrQueueIngredientProduct = jest.fn<
  (...args: unknown[]) => Promise<unknown>
>();
const mockTrackAutocompleteSearchOutcome = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockTrackAutocompleteResultSelected = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockTrackIngredientProductCreateOutcome = jest.fn<
  (...args: unknown[]) => Promise<void>
>();

jest.mock("@/services/foodLibrary/ingredientProductSearchService", () => ({
  searchIngredientProducts: (...args: unknown[]) =>
    mockSearchIngredientProducts(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductCreateService", () => ({
  createOrQueueIngredientProduct: (...args: unknown[]) =>
    mockCreateOrQueueIngredientProduct(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductConflictService", () => ({
  discardIngredientProductConflict: (...args: unknown[]) =>
    mockDiscardIngredientProductConflict(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductDeleteService", () => ({
  deleteOrQueueIngredientProduct: (...args: unknown[]) =>
    mockDeleteOrQueueIngredientProduct(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductUpdateService", () => ({
  updateOrQueueIngredientProduct: (...args: unknown[]) =>
    mockUpdateOrQueueIngredientProduct(...args),
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackAutocompleteSearchOutcome: (...args: unknown[]) =>
    mockTrackAutocompleteSearchOutcome(...args),
  trackAutocompleteResultSelected: (...args: unknown[]) =>
    mockTrackAutocompleteResultSelected(...args),
  trackIngredientProductCreateOutcome: (...args: unknown[]) =>
    mockTrackIngredientProductCreateOutcome(...args),
}));

jest.mock("uuid", () => ({
  v4: () => "uuid-created",
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) =>
      options?.ns ? `${options.ns}:${key}` : key,
  }),
}));

function sampleIngredientProductSearchRow(
  overrides: Partial<IngredientProductSearchRow> = {},
): IngredientProductSearchRow {
  return {
    ingredientProductId: "catalog-oats",
    recordScope: "global_seed",
    lifecycleState: "verified",
    displayName: "Owies górski",
    kind: "generic_ingredient",
    defaultServing: { quantity: 50, unit: "g" },
    nutritionPer100: {
      basis: "per_100g",
      unit: "g",
      kcal: 389,
      protein: 16.9,
      fat: 6.9,
      carbs: 66.3,
      fiber: null,
      sugar: null,
      salt: null,
      saturatedFat: null,
    },
    confidence: {
      identity: "verified",
      nutrition: "high",
      profile: "unknown",
    },
    sourceAttribution: {
      sourceType: "internal_seed",
      sourceId: "seed-oats",
      sourceName: "Fitaly seed",
      provider: null,
      license: null,
      observedAt: null,
      reviewedAt: null,
      reviewedBy: null,
    },
    profileCompatibility: {
      status: "unknown",
      dietaryFlags: [],
      allergenFlags: [],
    },
    warningReasonCodes: [],
    rankingSignals: ["verified_seed"],
    brandName: null,
    ingredientName: null,
    packageName: null,
    category: null,
    servingSizes: [],
    dietaryFlags: [],
    allergenFlags: [],
    cacheState: "fresh",
    ownerUserId: null,
    ...overrides,
  };
}

function sampleIngredientProductSearchResult(
  items: IngredientProductSearchRow[],
): IngredientProductSearchResult {
  return {
    status: "results",
    items,
    queryEcho: {
      normalizedQuery: "owies",
      queryLength: 5,
      limit: 6,
      includeUserScoped: true,
      includeGlobal: true,
      locale: "pl-PL",
    },
    warnings: [],
    cachePolicy: {
      cacheGeneration: "ingredient_product_search_v1",
      maxAgeSeconds: 3600,
    },
    source: "remote",
    isStale: false,
    errorCode: null,
  };
}

function samplePrivateIngredientProductSearchRow(
  overrides: Partial<IngredientProductSearchRow> = {},
): IngredientProductSearchRow {
  return sampleIngredientProductSearchRow({
    ingredientProductId: "user-oats-private",
    recordScope: "user_scoped",
    displayName: "Owies prywatny",
    rankingSignals: ["user_scoped"],
    ownerUserId: "user-1",
    nutritionPer100: {
      basis: "per_100g",
      unit: "g",
      kcal: 200,
      protein: 10,
      fat: 4,
      carbs: 20,
      fiber: null,
      sugar: null,
      salt: null,
      saturatedFat: null,
    },
    ...overrides,
  });
}

describe("IngredientEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteOrQueueIngredientProduct.mockResolvedValue({
      status: "synced",
      ingredientProductId: "user-oats-private",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    mockDiscardIngredientProductConflict.mockResolvedValue({
      discarded: true,
      ingredientProductId: "user-conflict-oats",
      queuedOpsDiscarded: 1,
      deadLetterOpsDiscarded: 1,
    });
    mockUpdateOrQueueIngredientProduct.mockResolvedValue({
      status: "synced",
      item: samplePrivateIngredientProductSearchRow(),
    });
    mockTrackAutocompleteSearchOutcome.mockResolvedValue(undefined);
    mockTrackAutocompleteResultSelected.mockResolvedValue(undefined);
    mockTrackIngredientProductCreateOutcome.mockResolvedValue(undefined);
  });

  it("commits parsed ingredient values", () => {
    const onCommit = jest.fn();
    const { UNSAFE_getAllByType, getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-1",
          name: "Apple",
          amount: 100,
          unit: "g",
          protein: 1,
          carbs: 10,
          fat: 2,
          kcal: 50,
        }}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const inputs = UNSAFE_getAllByType(RNTextInput);
    fireEvent.changeText(inputs[0], "  Banana  ");
    fireEvent.changeText(inputs[1], "150");
    fireEvent.changeText(inputs[2], "2.5");
    fireEvent.changeText(inputs[3], "30");
    fireEvent.changeText(inputs[4], "0.3");
    fireEvent.changeText(inputs[5], "120");

    fireEvent.press(getByText("common:save_changes"));

    expect(onCommit).toHaveBeenCalledWith({
      id: "ing-1",
      name: "Banana",
      amount: 150,
      unit: "g",
      protein: 2.5,
      carbs: 30,
      fat: 0.3,
      kcal: 120,
    });
  });

  it("does not commit when there are validation errors", () => {
    const onCommit = jest.fn();
    const { getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-1",
          name: "Apple",
          amount: 100,
          unit: "g",
          protein: 1,
          carbs: 10,
          fat: 2,
          kcal: 50,
        }}
        errors={{ name: "required" }}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.press(getByText("common:save_changes"));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("dismisses the keyboard from the name field submit action", () => {
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(jest.fn());
    const { UNSAFE_getAllByType } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-2",
          name: "Apple",
          amount: 100,
          unit: "g",
          protein: 1,
          carbs: 10,
          fat: 2,
          kcal: 50,
        }}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const [nameInput] = UNSAFE_getAllByType(RNTextInput);

    expect(nameInput.props.returnKeyType).toBe("done");

    fireEvent(nameInput, "submitEditing");

    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });

  it("supports the sheet variant actions for adding a new ingredient", () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { getByTestId, getByText, queryByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-2",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        submitLabel="meals:add_ingredient"
        showDelete={false}
        onCommit={onCommit}
        onCancel={onCancel}
        onDelete={() => undefined}
      />,
    );

    fireEvent.press(getByText("common:cancel"));
    fireEvent.press(getByText("meals:add_ingredient"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(getByTestId("ingredient-editor-macro-error")).toBeTruthy();

    fireEvent.changeText(getByTestId("ingredient-editor-protein-input"), "2");
    fireEvent.press(getByText("meals:add_ingredient"));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        protein: 2,
        kcal: 8,
      }),
    );
    expect(queryByText("common:remove")).toBeNull();
  });

  it("shows unit only once in sheet variant and removes fake unit affordance", () => {
    const { getAllByText, queryByDisplayValue, queryByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-3",
          name: "Milk",
          amount: 250,
          unit: "ml",
          protein: 8,
          carbs: 12,
          fat: 5,
          kcal: 140,
        }}
        variant="sheet"
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(getAllByText("ml")).toHaveLength(1);
    expect(queryByText("meals:review_meal_edit_ingredient_unit")).toBeNull();
    expect(queryByDisplayValue("ml")).toBeNull();
    expect(queryByText("›")).toBeNull();
  });

  it("shows macro estimate fields in sheet variant", () => {
    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-8",
          name: "Rice",
          amount: 150,
          unit: "g",
          protein: 4,
          carbs: 42,
          fat: 1,
          kcal: 190,
        }}
        variant="sheet"
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(getByTestId("ingredient-editor-nutrition-section")).toBeTruthy();
    expect(getByTestId("ingredient-editor-kcal-input")).toBeTruthy();
    expect(getByTestId("ingredient-editor-protein-input")).toBeTruthy();
    expect(getByTestId("ingredient-editor-carbs-input")).toBeTruthy();
    expect(getByTestId("ingredient-editor-fat-input")).toBeTruthy();
  });

  it("applies a catalog autocomplete suggestion in sheet variant", async () => {
    const onCommit = jest.fn();
    mockSearchIngredientProducts.mockResolvedValue({
      status: "results",
      items: [
        {
          ingredientProductId: "catalog-oats",
          recordScope: "global_seed",
          lifecycleState: "verified",
          displayName: "Owies górski",
          kind: "generic_ingredient",
          defaultServing: { quantity: 50, unit: "g" },
          nutritionPer100: {
            basis: "per_100g",
            unit: "g",
            kcal: 389,
            protein: 16.9,
            fat: 6.9,
            carbs: 66.3,
            fiber: null,
            sugar: null,
            salt: null,
            saturatedFat: null,
          },
          confidence: {
            identity: "verified",
            nutrition: "high",
            profile: "unknown",
          },
          sourceAttribution: {
            sourceType: "internal_seed",
            sourceId: "seed-oats",
            sourceName: "Fitaly seed",
            provider: null,
            license: null,
            observedAt: null,
            reviewedAt: null,
            reviewedBy: null,
          },
          profileCompatibility: {
            status: "unknown",
            dietaryFlags: [],
            allergenFlags: [],
          },
          warningReasonCodes: [],
          rankingSignals: ["verified_seed"],
          brandName: null,
          ingredientName: null,
          packageName: null,
          category: null,
          servingSizes: [],
          dietaryFlags: [],
          allergenFlags: [],
          cacheState: "fresh",
          ownerUserId: null,
        },
      ],
      queryEcho: {
        normalizedQuery: "owies",
        queryLength: 5,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: {
        cacheGeneration: "ingredient_product_search_v1",
        maxAgeSeconds: 3600,
      },
      source: "remote",
      isStale: false,
      errorCode: null,
    });

    const { getByTestId, getByDisplayValue, getByText, queryByTestId } =
      renderWithTheme(
        <IngredientEditor
          initial={{
            id: "ing-10",
            name: "",
            amount: 1,
            unit: "g",
            protein: 0,
            carbs: 0,
            fat: 0,
            kcal: 0,
          }}
          variant="sheet"
          submitLabel="meals:add_ingredient"
          showDelete={false}
          autocompleteUid="user-1"
          autocompleteLocale="pl-PL"
          autocompleteDebounceMs={0}
          onCommit={onCommit}
          onCancel={() => undefined}
          onDelete={() => undefined}
        />,
      );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    expect(mockSearchIngredientProducts).toHaveBeenCalledWith({
      uid: "user-1",
      query: "Owies",
      locale: "pl-PL",
      limit: 6,
    });

    expect(getByTestId("ingredient-autocomplete-results")).toBeTruthy();

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));

    expect(queryByTestId("ingredient-editor-product-delete-button")).toBeNull();
    expect(queryByTestId("ingredient-editor-product-update-button")).toBeNull();
    expect(getByDisplayValue("Owies górski")).toBeTruthy();
    expect(getByDisplayValue("50")).toBeTruthy();
    expect(getByDisplayValue("8.4")).toBeTruthy();
    expect(getByDisplayValue("33.1")).toBeTruthy();
    expect(getByDisplayValue("3.5")).toBeTruthy();
    expect(getByDisplayValue("195")).toBeTruthy();

    fireEvent.press(getByText("meals:add_ingredient"));

    expect(onCommit).toHaveBeenCalledWith({
      id: "ing-10",
      name: "Owies górski",
      amount: 50,
      unit: "g",
      protein: 8.4,
      carbs: 33.1,
      fat: 3.5,
      kcal: 195,
    });
  });

  it("does not expose private controls for a user-scoped row owned by another user", async () => {
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        samplePrivateIngredientProductSearchRow({
          ownerUserId: "other-user",
          displayName: "Owies innego użytkownika",
        }),
      ]),
    );

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-29",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));

    expect(queryByTestId("ingredient-editor-product-update-button")).toBeNull();
    expect(queryByTestId("ingredient-editor-product-delete-button")).toBeNull();
  });

  it("hides the private update action when the selected private item form is invalid", async () => {
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        samplePrivateIngredientProductSearchRow(),
      ]),
    );

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-28",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    expect(getByTestId("ingredient-editor-product-update-button")).toBeTruthy();

    fireEvent.changeText(getByTestId("ingredient-editor-amount-input"), "0");

    expect(queryByTestId("ingredient-editor-product-update-button")).toBeNull();
    expect(getByTestId("ingredient-editor-product-delete-button")).toBeTruthy();
  });

  it("deletes a selected private Product/Ingredient without deleting the meal ingredient", async () => {
    const onDelete = jest.fn();
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        samplePrivateIngredientProductSearchRow(),
      ]),
    );

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-30",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={onDelete}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));

    expect(getByTestId("ingredient-editor-product-delete-panel")).toBeTruthy();
    fireEvent.press(getByTestId("ingredient-editor-product-delete-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-delete-success")).toBeTruthy();
    });

    expect(mockDeleteOrQueueIngredientProduct).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-oats-private",
    });
    expect(onDelete).not.toHaveBeenCalled();
    expect(queryByTestId("ingredient-editor-product-delete-button")).toBeNull();
  });

  it("updates a selected private Product/Ingredient from the current form without committing the meal ingredient", async () => {
    const onCommit = jest.fn();
    const onDelete = jest.fn();
    const privateRow = samplePrivateIngredientProductSearchRow();
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([privateRow]),
    );
    mockUpdateOrQueueIngredientProduct.mockResolvedValueOnce({
      status: "synced",
      item: samplePrivateIngredientProductSearchRow({
        displayName: "Owies nocny",
        defaultServing: { quantity: 100, unit: "g" },
        nutritionPer100: {
          basis: "per_100g",
          unit: "g",
          kcal: 200,
          protein: 10,
          fat: 4,
          carbs: 20,
          fiber: null,
          sugar: null,
          salt: null,
          saturatedFat: null,
        },
      }),
    });

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-33",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={onDelete}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Owies nocny",
    );
    fireEvent.changeText(getByTestId("ingredient-editor-amount-input"), "100");
    fireEvent.changeText(getByTestId("ingredient-editor-protein-input"), "10");
    fireEvent.changeText(getByTestId("ingredient-editor-carbs-input"), "20");
    fireEvent.changeText(getByTestId("ingredient-editor-fat-input"), "4");
    fireEvent.changeText(getByTestId("ingredient-editor-kcal-input"), "200");
    fireEvent.press(getByTestId("ingredient-editor-product-update-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-update-success")).toBeTruthy();
    });

    expect(mockUpdateOrQueueIngredientProduct).toHaveBeenCalledWith({
      uid: "user-1",
      baseItem: privateRow,
      searchQuery: "Owies nocny",
      locale: "pl-PL",
      request: {
        clientMutationId:
          "ingredient-product:update:user-1:user-oats-private:uuid-created",
        ingredientProductId: "user-oats-private",
        displayName: "Owies nocny",
        defaultServing: {
          quantity: 100,
          unit: "g",
        },
        nutritionPer100: {
          basis: "per_100g",
          unit: "g",
          kcal: 200,
          protein: 10,
          fat: 4,
          carbs: 20,
          fiber: null,
          sugar: null,
          salt: null,
          saturatedFat: null,
        },
      },
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(getByTestId("ingredient-editor-product-delete-button")).toBeTruthy();
  });

  it("preserves ml units in a selected private Product/Ingredient update payload", async () => {
    const privateRow = samplePrivateIngredientProductSearchRow({
      ingredientProductId: "user-kefir-private",
      displayName: "Kefir prywatny",
      defaultServing: { quantity: 250, unit: "ml" },
      nutritionPer100: {
        basis: "per_100ml",
        unit: "ml",
        kcal: 60,
        protein: 2,
        fat: 1,
        carbs: 8,
        fiber: null,
        sugar: null,
        salt: null,
        saturatedFat: null,
      },
    });
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([privateRow]),
    );
    mockUpdateOrQueueIngredientProduct.mockResolvedValueOnce({
      status: "synced",
      item: privateRow,
    });

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-38",
          name: "",
          amount: 1,
          unit: "ml",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Kefir");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    fireEvent.press(getByTestId("ingredient-editor-product-update-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-update-success")).toBeTruthy();
    });

    expect(mockUpdateOrQueueIngredientProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          ingredientProductId: "user-kefir-private",
          defaultServing: {
            quantity: 250,
            unit: "ml",
          },
          nutritionPer100: {
            basis: "per_100ml",
            unit: "ml",
            kcal: 60,
            protein: 2,
            fat: 1,
            carbs: 8,
            fiber: null,
            sugar: null,
            salt: null,
            saturatedFat: null,
          },
        }),
      }),
    );
  });

  it("queues a selected private Product/Ingredient update and keeps private controls coherent", async () => {
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        samplePrivateIngredientProductSearchRow(),
      ]),
    );
    mockUpdateOrQueueIngredientProduct.mockResolvedValueOnce({
      status: "queued",
      item: samplePrivateIngredientProductSearchRow({
        displayName: "Owies prywatny",
        cacheState: "pending_local",
        warningReasonCodes: ["pending_user_record"],
        rankingSignals: ["user_scoped", "pending_user_record"],
      }),
      clientMutationId:
        "ingredient-product:update:user-1:user-oats-private:uuid-created",
    });

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-34",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    fireEvent.changeText(getByTestId("ingredient-editor-protein-input"), "0");
    fireEvent.changeText(getByTestId("ingredient-editor-carbs-input"), "0");
    fireEvent.changeText(getByTestId("ingredient-editor-fat-input"), "0");
    fireEvent.changeText(getByTestId("ingredient-editor-kcal-input"), "0");
    fireEvent.press(getByTestId("ingredient-editor-product-update-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-update-queued")).toBeTruthy();
    });

    expect(mockUpdateOrQueueIngredientProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          nutritionPer100: null,
        }),
      }),
    );
    expect(getByTestId("ingredient-editor-product-delete-button")).toBeTruthy();
  });

  it("clears private controls after update when the returned item is not a current-user row", async () => {
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        samplePrivateIngredientProductSearchRow(),
      ]),
    );
    mockUpdateOrQueueIngredientProduct.mockResolvedValueOnce({
      status: "synced",
      item: sampleIngredientProductSearchRow({
        ingredientProductId: "catalog-oats-promoted",
        recordScope: "global_seed",
        displayName: "Owies globalny",
        ownerUserId: null,
      }),
    });

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-37",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    fireEvent.press(getByTestId("ingredient-editor-product-update-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-update-success")).toBeTruthy();
    });

    expect(queryByTestId("ingredient-editor-product-update-button")).toBeNull();
    expect(queryByTestId("ingredient-editor-product-delete-button")).toBeNull();
  });

  it("keeps the private Product/Ingredient update action retryable after failure", async () => {
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        samplePrivateIngredientProductSearchRow(),
      ]),
    );
    mockUpdateOrQueueIngredientProduct
      .mockRejectedValueOnce(new Error("backend failed"))
      .mockResolvedValueOnce({
        status: "synced",
        item: samplePrivateIngredientProductSearchRow(),
      });

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-35",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    fireEvent.press(getByTestId("ingredient-editor-product-update-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-update-failed")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-editor-product-update-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-update-success")).toBeTruthy();
    });

    expect(mockUpdateOrQueueIngredientProduct).toHaveBeenCalledTimes(2);
  });

  it("shows explicit conflict feedback when a private Product/Ingredient update returns a 409", async () => {
    const onCommit = jest.fn();
    const onDelete = jest.fn();
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        samplePrivateIngredientProductSearchRow(),
      ]),
    );
    mockUpdateOrQueueIngredientProduct.mockRejectedValueOnce(
      Object.assign(new Error("conflict"), { status: 409 }),
    );

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-36",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={onDelete}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    fireEvent.press(getByTestId("ingredient-editor-product-update-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-update-conflict")).toBeTruthy();
    });

    expect(getByTestId("ingredient-editor-product-update-button")).toBeTruthy();
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows queued state when a private Product/Ingredient delete is queued", async () => {
    mockDeleteOrQueueIngredientProduct.mockResolvedValueOnce({
      status: "queued",
      ingredientProductId: "user-oats-private",
      clientMutationId: "ingredient-product:delete:user-1:user-oats-private:uuid",
    });
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        sampleIngredientProductSearchRow({
          ingredientProductId: "user-oats-private",
          recordScope: "user_scoped",
          displayName: "Owies prywatny",
          rankingSignals: ["user_scoped"],
          ownerUserId: "user-1",
        }),
      ]),
    );

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-31",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    fireEvent.press(getByTestId("ingredient-editor-product-delete-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-delete-queued")).toBeTruthy();
    });
  });

  it("keeps the private Product/Ingredient delete action retryable after failure", async () => {
    mockDeleteOrQueueIngredientProduct.mockRejectedValueOnce(
      new Error("backend failed"),
    );
    mockSearchIngredientProducts.mockResolvedValue(
      sampleIngredientProductSearchResult([
        sampleIngredientProductSearchRow({
          ingredientProductId: "user-oats-private",
          recordScope: "user_scoped",
          displayName: "Owies prywatny",
          rankingSignals: ["user_scoped"],
          ownerUserId: "user-1",
        }),
      ]),
    );

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-32",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-autocomplete-row-0"));
    fireEvent.press(getByTestId("ingredient-editor-product-delete-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-delete-failed")).toBeTruthy();
    });

    expect(getByTestId("ingredient-editor-product-delete-button")).toBeTruthy();
  });

  it("does not show catalog suggestions that cannot map to the meal ingredient unit", async () => {
    mockSearchIngredientProducts.mockResolvedValue({
      status: "results",
      items: [
        {
          ingredientProductId: "catalog-egg",
          recordScope: "global_seed",
          lifecycleState: "verified",
          displayName: "Jajko",
          kind: "generic_ingredient",
          defaultServing: { quantity: 1, unit: "piece" },
          nutritionPer100: {
            basis: "per_100g",
            unit: "g",
            kcal: 155,
            protein: 13,
            fat: 11,
            carbs: 1.1,
            fiber: null,
            sugar: null,
            salt: null,
            saturatedFat: null,
          },
          confidence: {
            identity: "verified",
            nutrition: "high",
            profile: "unknown",
          },
          sourceAttribution: {
            sourceType: "internal_seed",
            sourceId: "seed-egg",
            sourceName: "Fitaly seed",
            provider: null,
            license: null,
            observedAt: null,
            reviewedAt: null,
            reviewedBy: null,
          },
          profileCompatibility: {
            status: "unknown",
            dietaryFlags: [],
            allergenFlags: [],
          },
          warningReasonCodes: [],
          rankingSignals: ["verified_seed"],
          brandName: null,
          ingredientName: null,
          packageName: null,
          category: null,
          servingSizes: [],
          dietaryFlags: [],
          allergenFlags: [],
          cacheState: "fresh",
          ownerUserId: null,
        },
      ],
      queryEcho: {
        normalizedQuery: "jajko",
        queryLength: 5,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: null,
      source: "remote",
      isStale: false,
      errorCode: null,
    });

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-11",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Jajko");

    await waitFor(() => {
      expect(mockSearchIngredientProducts).toHaveBeenCalled();
    });

    expect(queryByTestId("ingredient-autocomplete-row-0")).toBeNull();
  });

  it("surfaces offline warm cache status when cached suggestions exist", async () => {
    mockSearchIngredientProducts.mockResolvedValue({
      status: "offline_warm_cache",
      items: [
        {
          ingredientProductId: "cached-oats",
          recordScope: "global_seed",
          lifecycleState: "verified",
          displayName: "Owies offline",
          kind: "generic_ingredient",
          defaultServing: { quantity: 50, unit: "g" },
          nutritionPer100: {
            basis: "per_100g",
            unit: "g",
            kcal: 389,
            protein: 16.9,
            fat: 6.9,
            carbs: 66.3,
            fiber: null,
            sugar: null,
            salt: null,
            saturatedFat: null,
          },
          confidence: {
            identity: "verified",
            nutrition: "high",
            profile: "unknown",
          },
          sourceAttribution: {
            sourceType: "internal_seed",
            sourceId: "seed-oats",
            sourceName: "Fitaly seed",
            provider: null,
            license: null,
            observedAt: null,
            reviewedAt: null,
            reviewedBy: null,
          },
          profileCompatibility: {
            status: "unknown",
            dietaryFlags: [],
            allergenFlags: [],
          },
          warningReasonCodes: [],
          rankingSignals: ["verified_seed"],
          brandName: null,
          ingredientName: null,
          packageName: null,
          category: null,
          servingSizes: [],
          dietaryFlags: [],
          allergenFlags: [],
          cacheState: "offline",
          ownerUserId: null,
        },
      ],
      queryEcho: {
        normalizedQuery: "owies",
        queryLength: 5,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: null,
      },
      warnings: ["offline_cache"],
      cachePolicy: null,
      source: "cache",
      isStale: false,
      errorCode: null,
    });

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-12",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByTestId("ingredient-editor-name-input"), "Owies");

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-offline")).toBeTruthy();
    });

    expect(getByTestId("ingredient-autocomplete-results")).toBeTruthy();
    expect(getByTestId("ingredient-autocomplete-row-0")).toBeTruthy();
  });

  it("creates a private ingredient product only from the explicit no-results action", async () => {
    const onCommit = jest.fn();
    mockSearchIngredientProducts.mockResolvedValue({
      status: "no_results",
      items: [],
      queryEcho: {
        normalizedQuery: "owsianka domowa",
        queryLength: 15,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: null,
      source: "remote",
      isStale: false,
      errorCode: null,
    });
    mockCreateOrQueueIngredientProduct.mockResolvedValue({
      status: "synced",
      item: sampleIngredientProductSearchRow({
        ingredientProductId: "user-uuid-created",
        recordScope: "user_scoped",
        displayName: "Owsianka domowa",
        rankingSignals: ["user_scoped"],
        ownerUserId: "user-1",
      }),
    });
    mockTrackIngredientProductCreateOutcome.mockRejectedValueOnce(
      new Error("telemetry down"),
    );

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-20",
          name: "",
          amount: 50,
          unit: "g",
          protein: 5,
          carbs: 20,
          fat: 3,
          kcal: 130,
        }}
        variant="sheet"
        submitLabel="meals:add_ingredient"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Owsianka domowa",
    );

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-no-results")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-editor-create-product-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-success")).toBeTruthy();
    });

    expect(mockTrackIngredientProductCreateOutcome).toHaveBeenCalledWith({
      surface: "manual_ingredient_sheet",
      outcome: "synced",
    });
    expect(mockCreateOrQueueIngredientProduct).toHaveBeenCalledWith({
      uid: "user-1",
      searchQuery: "Owsianka domowa",
      locale: "pl-PL",
      request: {
        clientMutationId: "ingredient-product:create:user-1:uuid-created",
        ingredientProductId: "user-uuid-created",
        displayName: "Owsianka domowa",
        kind: "generic_ingredient",
        defaultServing: {
          quantity: 50,
          unit: "g",
        },
        nutritionPer100: {
          basis: "per_100g",
          unit: "g",
          kcal: 260,
          protein: 10,
          fat: 6,
          carbs: 40,
          fiber: null,
          sugar: null,
          salt: null,
          saturatedFat: null,
        },
      },
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not expose delete after create when the returned row is not owned by the current user", async () => {
    mockSearchIngredientProducts.mockResolvedValue({
      status: "no_results",
      items: [],
      queryEcho: {
        normalizedQuery: "owsianka domowa",
        queryLength: 15,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: null,
      source: "remote",
      isStale: false,
      errorCode: null,
    });
    mockCreateOrQueueIngredientProduct.mockResolvedValue({
      status: "synced",
      item: sampleIngredientProductSearchRow({
        ingredientProductId: "user-uuid-created",
        recordScope: "user_scoped",
        displayName: "Owsianka domowa",
        rankingSignals: ["user_scoped"],
        ownerUserId: "other-user",
      }),
    });

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-24",
          name: "",
          amount: 50,
          unit: "g",
          protein: 5,
          carbs: 20,
          fat: 3,
          kcal: 130,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Owsianka domowa",
    );

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-editor-create-product-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-success")).toBeTruthy();
    });

    expect(queryByTestId("ingredient-editor-product-delete-button")).toBeNull();
  });

  it("shows an explicit conflict state when private product creation returns a 409", async () => {
    const onCommit = jest.fn();
    mockSearchIngredientProducts.mockResolvedValue({
      status: "no_results",
      items: [],
      queryEcho: {
        normalizedQuery: "owsianka domowa",
        queryLength: 15,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: null,
      source: "remote",
      isStale: false,
      errorCode: null,
    });
    const conflictError = Object.assign(new Error("conflict"), { status: 409 });
    mockCreateOrQueueIngredientProduct.mockRejectedValueOnce(conflictError);

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-25",
          name: "",
          amount: 50,
          unit: "g",
          protein: 5,
          carbs: 20,
          fat: 3,
          kcal: 130,
        }}
        variant="sheet"
        submitLabel="meals:add_ingredient"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Owsianka domowa",
    );

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-editor-create-product-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-conflict")).toBeTruthy();
    });

    expect(mockTrackIngredientProductCreateOutcome).toHaveBeenCalledWith({
      surface: "manual_ingredient_sheet",
      outcome: "failed",
    });
    expect(queryByTestId("ingredient-editor-product-delete-button")).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("ingredient-editor-submit-button"));

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-25",
        name: "Owsianka domowa",
        amount: 50,
        protein: 5,
        carbs: 20,
        fat: 3,
      }),
    );
  });

  it("shows preserved local product conflicts without exposing them as suggestions", async () => {
    const onCommit = jest.fn();
    mockSearchIngredientProducts.mockResolvedValue({
      status: "no_results",
      items: [],
      conflicts: [
        {
          item: sampleIngredientProductSearchRow({
            ingredientProductId: "user-conflict-oats",
            recordScope: "user_scoped",
            displayName: "Owsianka domowa",
            ownerUserId: "user-1",
            rankingSignals: ["user_scoped"],
            sourceAttribution: {
              sourceType: "user_created",
              sourceId: "local-mutation-1",
              sourceName: "User",
              provider: null,
              license: null,
              observedAt: null,
              reviewedAt: null,
              reviewedBy: null,
            },
          }),
          updatedAt: "2026-06-16T10:00:00.000Z",
          lastErrorCode: "food-library/conflict",
          lastErrorMessage: "Remote record conflicts with pending local create.",
        },
      ],
      queryEcho: {
        normalizedQuery: "owsianka domowa",
        queryLength: 15,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: null,
      source: "remote",
      isStale: false,
      errorCode: null,
    });

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-26",
          name: "",
          amount: 50,
          unit: "g",
          protein: 5,
          carbs: 20,
          fat: 3,
          kcal: 130,
        }}
        variant="sheet"
        submitLabel="meals:add_ingredient"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Owsianka domowa",
    );

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-product-conflict")).toBeTruthy();
    });

    expect(
      getByTestId("ingredient-editor-product-conflict-discard-button"),
    ).toBeTruthy();
    expect(queryByTestId("ingredient-editor-create-product-button")).toBeNull();
    expect(queryByTestId("ingredient-editor-product-update-button")).toBeNull();
    expect(queryByTestId("ingredient-autocomplete-row-0")).toBeNull();
    expect(mockCreateOrQueueIngredientProduct).not.toHaveBeenCalled();

    fireEvent.press(
      getByTestId("ingredient-editor-product-conflict-discard-button"),
    );

    await waitFor(() => {
      expect(mockDiscardIngredientProductConflict).toHaveBeenCalledWith({
        uid: "user-1",
        ingredientProductId: "user-conflict-oats",
      });
    });
    await waitFor(() => {
      expect(queryByTestId("ingredient-editor-product-conflict")).toBeNull();
      expect(getByTestId("ingredient-editor-create-product-button")).toBeTruthy();
    });
    expect(queryByTestId("ingredient-autocomplete-row-0")).toBeNull();
    expect(mockCreateOrQueueIngredientProduct).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("ingredient-editor-submit-button"));

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-26",
        name: "Owsianka domowa",
        amount: 50,
      }),
    );
  });

  it("ignores non-current-user product conflicts in autocomplete state", async () => {
    mockSearchIngredientProducts.mockResolvedValue({
      status: "no_results",
      items: [],
      conflicts: [
        {
          item: sampleIngredientProductSearchRow({
            ingredientProductId: "other-conflict-oats",
            recordScope: "user_scoped",
            displayName: "Owsianka domowa",
            ownerUserId: "other-user",
            rankingSignals: ["user_scoped"],
          }),
          updatedAt: "2026-06-16T10:00:00.000Z",
          lastErrorCode: "food-library/conflict",
          lastErrorMessage: "Other user conflict.",
        },
      ],
      queryEcho: {
        normalizedQuery: "owsianka domowa",
        queryLength: 15,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: null,
      source: "remote",
      isStale: false,
      errorCode: null,
    });

    const { getByTestId, queryByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-27",
          name: "",
          amount: 50,
          unit: "g",
          protein: 5,
          carbs: 20,
          fat: 3,
          kcal: 130,
        }}
        variant="sheet"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Owsianka domowa",
    );

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-button")).toBeTruthy();
    });

    expect(queryByTestId("ingredient-editor-product-conflict")).toBeNull();
    expect(
      queryByTestId("ingredient-editor-product-conflict-discard-button"),
    ).toBeNull();
    expect(mockDiscardIngredientProductConflict).not.toHaveBeenCalled();
  });

  it("does not create a private ingredient product from the ordinary add action", async () => {
    const onCommit = jest.fn();
    mockSearchIngredientProducts.mockResolvedValue({
      status: "no_results",
      items: [],
      queryEcho: {
        normalizedQuery: "kasza domowa",
        queryLength: 12,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: null,
      source: "remote",
      isStale: false,
      errorCode: null,
    });

    const { getByTestId, getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-21",
          name: "",
          amount: 80,
          unit: "g",
          protein: 4,
          carbs: 34,
          fat: 1,
          kcal: 160,
        }}
        variant="sheet"
        submitLabel="meals:add_ingredient"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Kasza domowa",
    );

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-button")).toBeTruthy();
    });

    fireEvent.press(getByText("meals:add_ingredient"));

    expect(mockCreateOrQueueIngredientProduct).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-21",
        name: "Kasza domowa",
      }),
    );
  });

  it("queues private product creation when autocomplete is offline without cache", async () => {
    mockSearchIngredientProducts.mockResolvedValue({
      status: "offline_no_cache",
      items: [],
      queryEcho: {
        normalizedQuery: "offline bowl",
        queryLength: 12,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: null,
      },
      warnings: ["offline_cache"],
      cachePolicy: null,
      source: "none",
      isStale: false,
      errorCode: "offline",
    });
    mockCreateOrQueueIngredientProduct.mockResolvedValue({
      status: "queued",
      item: sampleIngredientProductSearchRow({
        ingredientProductId: "user-uuid-created",
        recordScope: "user_scoped",
        displayName: "Offline bowl",
        rankingSignals: ["user_scoped"],
        ownerUserId: "user-1",
      }),
      clientMutationId: "ingredient-product:create:user-1:uuid-created",
    });

    const { getByTestId } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-22",
          name: "",
          amount: 100,
          unit: "g",
          protein: 8,
          carbs: 20,
          fat: 4,
          kcal: 148,
        }}
        variant="sheet"
        autocompleteUid="user-1"
        autocompleteDebounceMs={0}
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Offline bowl",
    );

    await waitFor(() => {
      expect(getByTestId("ingredient-autocomplete-offline")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-editor-create-product-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-queued")).toBeTruthy();
    });
    expect(mockTrackIngredientProductCreateOutcome).toHaveBeenCalledWith({
      surface: "manual_ingredient_sheet",
      outcome: "queued",
    });
    expect(mockCreateOrQueueIngredientProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        searchQuery: "Offline bowl",
        request: expect.objectContaining({
          displayName: "Offline bowl",
          ingredientProductId: "user-uuid-created",
        }),
      }),
    );
  });

  it("emits failed create outcome and still allows ordinary meal ingredient add", async () => {
    const onCommit = jest.fn();
    mockSearchIngredientProducts.mockResolvedValue({
      status: "no_results",
      items: [],
      queryEcho: {
        normalizedQuery: "domowy twarog",
        queryLength: 12,
        limit: 6,
        includeUserScoped: true,
        includeGlobal: true,
        locale: "pl-PL",
      },
      warnings: [],
      cachePolicy: null,
      source: "remote",
      isStale: false,
      errorCode: null,
    });
    mockCreateOrQueueIngredientProduct.mockRejectedValueOnce(
      new Error("backend failed"),
    );

    const { getByTestId, getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-23",
          name: "",
          amount: 100,
          unit: "g",
          protein: 18,
          carbs: 4,
          fat: 5,
          kcal: 133,
        }}
        variant="sheet"
        submitLabel="meals:add_ingredient"
        showDelete={false}
        autocompleteUid="user-1"
        autocompleteLocale="pl-PL"
        autocompleteDebounceMs={0}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(
      getByTestId("ingredient-editor-name-input"),
      "Domowy twarog",
    );

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("ingredient-editor-create-product-button"));

    await waitFor(() => {
      expect(getByTestId("ingredient-editor-create-product-failed")).toBeTruthy();
    });

    expect(mockTrackIngredientProductCreateOutcome).toHaveBeenCalledWith({
      surface: "manual_ingredient_sheet",
      outcome: "failed",
    });

    fireEvent.press(getByText("meals:add_ingredient"));

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-23",
        name: "Domowy twarog",
      }),
    );
  });

  it("keeps unit read-only in sheet variant commit flow", () => {
    const onCommit = jest.fn();
    const { getByDisplayValue, getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-4",
          name: "Olive oil",
          amount: 77,
          unit: "ml",
          protein: 0,
          carbs: 0,
          fat: 100,
          kcal: 884,
        }}
        variant="sheet"
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByDisplayValue("77"), "150.5");
    fireEvent.press(getByText("common:save_changes"));

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 150.5,
        unit: "ml",
      }),
    );
  });

  it("commits without asking for recalculation from save", () => {
    const onCommit = jest.fn();
    const { getByDisplayValue, getByText, queryByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-5",
          name: "Rice",
          amount: 250,
          unit: "g",
          protein: 10,
          carbs: 70,
          fat: 2,
          kcal: 330,
        }}
        variant="sheet"
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByDisplayValue("250"), "300");
    fireEvent.press(getByText("common:save_changes"));

    expect(onCommit).toHaveBeenCalledWith({
      id: "ing-5",
      name: "Rice",
      amount: 300,
      unit: "g",
      protein: 10,
      carbs: 70,
      fat: 2,
      kcal: 330,
    });
    expect(queryByText("meals:recalc_title")).toBeNull();
  });

  it("derives kcal from sheet macros when kcal is left empty", () => {
    const onCommit = jest.fn();
    const { getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-9",
          name: "Cottage cheese",
          amount: 100,
          unit: "g",
          protein: 12,
          carbs: 4,
          fat: 3,
          kcal: 0,
        }}
        variant="sheet"
        submitLabel="meals:add_ingredient"
        showDelete={false}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.press(getByText("meals:add_ingredient"));

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        protein: 12,
        carbs: 4,
        fat: 3,
        kcal: 91,
      }),
    );
  });

  it("asks after amount blur and recalculates fields without committing", () => {
    const onCommit = jest.fn();
    const { getByDisplayValue, getByText, queryByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-6",
          name: "Rice",
          amount: 250,
          unit: "g",
          protein: 10,
          carbs: 70,
          fat: 2,
          kcal: 330,
        }}
        variant="sheet"
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const amountInput = getByDisplayValue("250");
    fireEvent.changeText(amountInput, "300");
    fireEvent(amountInput, "blur");

    expect(getByText("meals:recalc_title")).toBeTruthy();

    fireEvent.press(getByText("meals:recalc_confirm"));

    expect(onCommit).not.toHaveBeenCalled();
    expect(queryByText("meals:recalc_title")).toBeNull();
    expect(getByDisplayValue("12")).toBeTruthy();
    expect(getByDisplayValue("84")).toBeTruthy();
    expect(getByDisplayValue("2.4")).toBeTruthy();
    expect(getByDisplayValue("396")).toBeTruthy();

    fireEvent.press(getByText("common:save_changes"));

    expect(onCommit).toHaveBeenCalledWith({
      id: "ing-6",
      name: "Rice",
      amount: 300,
      unit: "g",
      protein: 12,
      carbs: 84,
      fat: 2.4,
      kcal: 396,
    });
  });

  it("keeps macros after amount prompt without committing", () => {
    const onCommit = jest.fn();
    const { getByDisplayValue, getByText, queryByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-7",
          name: "Rice",
          amount: 250,
          unit: "g",
          protein: 10,
          carbs: 70,
          fat: 2,
          kcal: 330,
        }}
        variant="sheet"
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const amountInput = getByDisplayValue("250");
    fireEvent.changeText(amountInput, "300");
    fireEvent(amountInput, "blur");
    fireEvent.press(getByText("meals:recalc_keep_values"));

    expect(onCommit).not.toHaveBeenCalled();
    expect(queryByText("meals:recalc_title")).toBeNull();
    expect(getByDisplayValue("10")).toBeTruthy();
    expect(getByDisplayValue("70")).toBeTruthy();
    expect(getByDisplayValue("2")).toBeTruthy();
    expect(getByDisplayValue("330")).toBeTruthy();
  });
});
