import type { ReactNode } from "react";
import { Text } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { MealListItem } from "@/components/MealListItem";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal } from "@/types/meal";

const mockFallbackImage = jest.fn(
  (props: { uri: string | null; children?: ReactNode }) => (
    <Text>{`image:${props.uri ?? "none"}`}</Text>
  ),
);
const mockEnsureLocalMealPhoto = jest.fn<
  (input: {
    uid: string;
    cloudId: string | null;
    imageId: string | null;
    photoUrl: string | null;
  }) => Promise<string | null>
>();
const mockGetInfoAsync = jest.fn<
  (uri: string) => Promise<{ exists: boolean }>
>();

jest.mock("../feature/History/components/FallbackImage", () => ({
  FallbackImage: (props: { uri: string | null }) => mockFallbackImage(props),
}));

jest.mock("@/components/MacroChip", () => ({
  MacroChip: ({ kind, value }: { kind: string; value: number }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text: RNText } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(RNText, null, `${kind}:${value}`);
  },
}));

jest.mock("@/utils/calculateTotalNutrients", () => ({
  calculateTotalNutrients: () => ({
    kcal: 530,
    protein: 42,
    carbs: 51,
    fat: 19,
  }),
}));

jest.mock("@/services/core/fileSystem", () => ({
  getInfoAsync: (uri: string) => mockGetInfoAsync(uri),
}));

jest.mock("@/services/meals/mealService.images", () => ({
  ensureLocalMealPhoto: (input: {
    uid: string;
    cloudId: string | null;
    imageId: string | null;
    photoUrl: string | null;
  }) => mockEnsureLocalMealPhoto(input),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) =>
      options?.ns ? `${options.ns}:${key}` : key,
  }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

const buildMeal = (overrides?: Partial<Meal>): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-01-01T10:00:00.000Z",
  type: "lunch",
  name: "Chicken bowl",
  ingredients: [],
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  syncState: "synced",
  source: "manual",
  ...overrides,
});

describe("MealListItem", () => {
  beforeEach(() => {
    mockFallbackImage.mockClear();
    mockEnsureLocalMealPhoto.mockReset();
    mockEnsureLocalMealPhoto.mockResolvedValue(null);
    mockGetInfoAsync.mockReset();
    mockGetInfoAsync.mockResolvedValue({ exists: false });
  });

  it("renders meal data and triggers action callbacks", () => {
    const onPress = jest.fn();
    const onDelete = jest.fn();
    const onEdit = jest.fn();
    const onDuplicate = jest.fn();

    const { getByText, getByLabelText } = renderWithTheme(
      <MealListItem
        meal={buildMeal({ photoUrl: null })}
        onPress={onPress}
        onDelete={onDelete}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
      />,
    );

    fireEvent.press(getByText("Chicken bowl"));
    fireEvent.press(getByLabelText("common:delete"));
    fireEvent.press(getByLabelText("common:edit"));
    fireEvent.press(getByLabelText("common:duplicate"));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(getByText("530 kcal")).toBeTruthy();
    expect(getByText("protein:42")).toBeTruthy();
  });

  it("renders translated fallback name when meal name is missing", () => {
    const { getByText } = renderWithTheme(
      <MealListItem
        meal={buildMeal({ name: null, photoUrl: null })}
        onPress={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
      />,
    );

    expect(getByText("home:meal")).toBeTruthy();
  });

  it("renders sync status indicator for failed meals", () => {
    const { getByLabelText, getByTestId, queryByText } = renderWithTheme(
      <MealListItem
        meal={buildMeal({ syncState: "failed", photoUrl: null })}
        onPress={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
      />,
    );

    expect(getByLabelText("history.syncStatus.failed.label")).toBeTruthy();
    expect(queryByText("history.syncStatus.failed.label")).toBeNull();
    expect(getByTestId("meal-list-sync-failed")).toBeTruthy();
  });

  it("renders sync status indicator for pending meals", () => {
    const { getByLabelText, getByTestId, queryByText } = renderWithTheme(
      <MealListItem
        meal={buildMeal({ syncState: "pending", photoUrl: null })}
        onPress={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
      />,
    );

    expect(getByLabelText("history.syncStatus.pending.label")).toBeTruthy();
    expect(queryByText("history.syncStatus.pending.label")).toBeNull();
    expect(getByTestId("meal-list-sync-pending")).toBeTruthy();
  });

  it("does not render a persistent sync indicator for synced meals", () => {
    const { queryByTestId } = renderWithTheme(
      <MealListItem
        meal={buildMeal({ syncState: "synced", photoUrl: null })}
        onPress={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
      />,
    );

    expect(queryByTestId("meal-list-sync-synced")).toBeNull();
  });

  it("triggers selection callback when checkbox is pressed", () => {
    const onSelect = jest.fn();
    const { getByRole, getByText } = renderWithTheme(
      <MealListItem
        meal={buildMeal({ photoUrl: null })}
        onPress={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        onSelect={onSelect}
        selected
      />,
    );

    fireEvent.press(getByRole("checkbox"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(getByText("✓")).toBeTruthy();
  });

  it("resolves local image via ensureLocalMealPhoto when direct file is missing", async () => {
    mockEnsureLocalMealPhoto.mockResolvedValue("file:///resolved.jpg");

    const { getByText } = renderWithTheme(
      <MealListItem
        meal={buildMeal({
          cloudId: "cloud-1",
          imageId: "img-1",
          photoUrl: "file:///missing.jpg",
        })}
        onPress={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(mockEnsureLocalMealPhoto).toHaveBeenCalledWith({
        uid: "user-1",
        cloudId: "cloud-1",
        imageId: "img-1",
        photoUrl: "file:///missing.jpg",
      });
      expect(getByText("image:file:///resolved.jpg")).toBeTruthy();
    });
  });
});
