import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import RecipeCatalogScreen from "@/feature/Recipes/screens/RecipeCatalogScreen";
import { fetchRecipeCatalogRemote } from "@/services/recipes/recipeCatalogApi";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type {
  RecipeCatalogFilterResponse,
  RecipeCatalogFilterResult,
  RecipeCatalogRecord,
} from "@/types/recipes";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.defaultValue ? String(options.defaultValue) : key,
  }),
}));

jest.mock("@/services/recipes/recipeCatalogApi", () => ({
  fetchRecipeCatalogRemote: jest.fn(),
}));

jest.mock("@/components", () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Button: ({
      label,
      onPress,
      testID,
    }: {
      label?: string;
      onPress?: () => void;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
        <Text>{label}</Text>
      </Pressable>
    ),
    EmptyState: ({
      title,
      subtitle,
    }: {
      title: string;
      subtitle?: string;
    }) => (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </View>
    ),
    FormScreenShell: ({
      title,
      intro,
      children,
      trailingAction,
      testID,
    }: {
      title: string;
      intro?: string;
      children: ReactNode;
      trailingAction?: { onPress: () => void; testID?: string };
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        {intro ? <Text>{intro}</Text> : null}
        {trailingAction ? (
          <Pressable
            onPress={trailingAction.onPress}
            testID={trailingAction.testID}
          >
            <Text>refresh</Text>
          </Pressable>
        ) : null}
        {children}
      </View>
    ),
    InfoBlock: ({
      title,
      body,
      testID,
    }: {
      title: string;
      body: string;
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        <Text>{body}</Text>
      </View>
    ),
  };
});

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

const mockFetchRecipeCatalogRemote =
  fetchRecipeCatalogRemote as jest.MockedFunction<
    typeof fetchRecipeCatalogRemote
  >;

const navigation = {
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  navigate: jest.fn(),
};

function recipe(
  overrides: Partial<RecipeCatalogRecord> = {},
): RecipeCatalogRecord {
  return {
    recipeId: "recipe-visible",
    version: 1,
    lifecycleState: "active",
    locale: "en-US",
    title: "Oat bowl",
    description: "Oats with fruit",
    servings: 1,
    yield: "1 serving",
    sourceAttribution: {
      sourceType: "internal_curated",
      sourceId: "seed-1",
      sourceName: "Fitaly curated",
      reviewedAt: "2026-06-18T08:00:00.000Z",
    },
    updatedAt: "2026-06-18T08:00:00.000Z",
    reviewState: "curated",
    ingredients: [
      {
        ingredientProductId: "oats",
        snapshotName: "Oats",
        quantity: 80,
        unit: "g",
      },
    ],
    steps: ["Mix ingredients."],
    prepTimeMin: 5,
    cookTimeMin: 10,
    nutritionSnapshot: {
      kcal: 420,
      proteinGrams: 18,
      fatGrams: 12,
      carbsGrams: 56,
      confidence: "medium",
      isPartial: true,
    },
    imageRef: null,
    profileFlagState: "complete",
    dietaryFlags: ["vegetarian"],
    allergenFlags: [],
    unknownDietaryFlags: [],
    unknownAllergenFlags: [],
    styleTags: ["balanced"],
    ...overrides,
  };
}

function result(
  overrides: Partial<RecipeCatalogFilterResult> = {},
): RecipeCatalogFilterResult {
  return {
    recipe: recipe(),
    status: "visible",
    hardExclusionReasons: [],
    unknownReasons: [],
    softPreferenceStatus: "match",
    softPreferenceMatches: ["balanced"],
    softPreferenceMisses: [],
    softPreferenceScore: 1,
    ...overrides,
  };
}

function response(
  overrides: Partial<RecipeCatalogFilterResponse> = {},
): RecipeCatalogFilterResponse {
  return {
    items: [result()],
    queryEcho: {
      activeAllergies: ["gluten"],
      activeRestrictions: ["glutenFree"],
      activeSoftPreferences: ["balanced"],
      ignoredChronicDiseases: [],
      ignoredAllergiesOtherPresent: false,
      ignoredLifestylePresent: false,
      showHidden: false,
      revealUnknown: false,
      lowResultsThreshold: 6,
    },
    totalCatalogCount: 12,
    visibleCount: 1,
    hiddenHardExclusionCount: 0,
    unknownRevealRequiredCount: 0,
    lowResults: false,
    emptyCatalog: false,
    ...overrides,
  };
}

describe("RecipeCatalogScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    navigation.canGoBack.mockReturnValue(true);
  });

  it("loads read-only catalog data with profile defaults and shows warnings", async () => {
    mockFetchRecipeCatalogRemote.mockResolvedValueOnce(
      response({
        hiddenHardExclusionCount: 2,
        unknownRevealRequiredCount: 3,
        lowResults: true,
        queryEcho: {
          activeAllergies: ["gluten"],
          activeRestrictions: ["glutenFree"],
          activeSoftPreferences: ["balanced"],
          ignoredChronicDiseases: ["diabetes"],
          ignoredAllergiesOtherPresent: true,
          ignoredLifestylePresent: true,
          showHidden: false,
          revealUnknown: false,
          lowResultsThreshold: 6,
        },
      }),
    );

    const screen = renderWithTheme(
      <RecipeCatalogScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(mockFetchRecipeCatalogRemote).toHaveBeenCalledWith({
        showHidden: false,
        revealUnknown: false,
      });
    });

    expect(await screen.findByText("Oat bowl")).toBeTruthy();
    expect(screen.getByTestId("recipe-catalog-summary")).toBeTruthy();
    expect(screen.getByTestId("recipe-catalog-low-results")).toBeTruthy();
    expect(screen.getByTestId("recipe-catalog-ignored-context")).toBeTruthy();
  });

  it("refetches when hidden and unknown catalog states are revealed", async () => {
    mockFetchRecipeCatalogRemote
      .mockResolvedValueOnce(
        response({
          items: [],
          visibleCount: 0,
          emptyCatalog: false,
        }),
      )
      .mockResolvedValueOnce(
        response({
          items: [
            result({
              recipe: recipe({ recipeId: "recipe-excluded" }),
              status: "hidden_hard_exclusion",
              hardExclusionReasons: [
                {
                  code: "explicit_allergen_match",
                  filterType: "allergy",
                  profileValue: "gluten",
                  catalogFlag: "gluten",
                },
              ],
            }),
          ],
          hiddenHardExclusionCount: 1,
          queryEcho: {
            activeAllergies: ["gluten"],
            activeRestrictions: [],
            activeSoftPreferences: [],
            ignoredChronicDiseases: [],
            ignoredAllergiesOtherPresent: false,
            ignoredLifestylePresent: false,
            showHidden: true,
            revealUnknown: false,
            lowResultsThreshold: 6,
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          items: [
            result({
              recipe: recipe({
                recipeId: "recipe-unknown",
                profileFlagState: "unknown",
                unknownAllergenFlags: ["gluten"],
              }),
              status: "unknown_reveal_required",
              unknownReasons: [
                {
                  code: "unknown_allergen_flag",
                  filterType: "allergy",
                  profileValue: "gluten",
                  catalogFlag: "gluten",
                },
              ],
            }),
          ],
          unknownRevealRequiredCount: 1,
          queryEcho: {
            activeAllergies: ["gluten"],
            activeRestrictions: [],
            activeSoftPreferences: [],
            ignoredChronicDiseases: [],
            ignoredAllergiesOtherPresent: false,
            ignoredLifestylePresent: false,
            showHidden: true,
            revealUnknown: true,
            lowResultsThreshold: 6,
          },
        }),
      );

    const screen = renderWithTheme(
      <RecipeCatalogScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(mockFetchRecipeCatalogRemote).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByTestId("recipe-catalog-show-hidden-toggle"));

    await waitFor(() => {
      expect(mockFetchRecipeCatalogRemote).toHaveBeenLastCalledWith({
        showHidden: true,
        revealUnknown: false,
      });
    });
    expect(
      await screen.findByTestId("recipe-catalog-hard-recipe-excluded"),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("recipe-catalog-reveal-unknown-toggle"));

    await waitFor(() => {
      expect(mockFetchRecipeCatalogRemote).toHaveBeenLastCalledWith({
        showHidden: true,
        revealUnknown: true,
      });
    });
    expect(
      await screen.findByTestId("recipe-catalog-unknown-recipe-unknown"),
    ).toBeTruthy();
  });

  it("shows an explicit error state and can retry loading", async () => {
    mockFetchRecipeCatalogRemote
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        response({
          items: [],
          totalCatalogCount: 0,
          visibleCount: 0,
          emptyCatalog: true,
        }),
      );

    const screen = renderWithTheme(
      <RecipeCatalogScreen navigation={navigation as never} />,
    );

    expect(await screen.findByTestId("recipe-catalog-error")).toBeTruthy();
    expect(screen.getByText("Recipes could not load")).toBeTruthy();
    expect(
      screen.getByText(
        "Try refreshing. Existing meal history and Review remain unchanged.",
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("recipe-catalog-refresh-button"));

    await waitFor(() => {
      expect(mockFetchRecipeCatalogRemote).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Recipe catalog is empty")).toBeTruthy();
  });
});
