import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import PlanningScreen from "@/feature/Planning/screens/PlanningScreen";
import {
  createPlannedMealRemote,
  deletePlannedMealRemote,
  fetchPlannedMealsRemote,
  updatePlannedMealRemote,
} from "@/services/plannedMeals/plannedMealsApi";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal } from "@/types/meal";
import type {
  PlannedMealItem,
  PlannedMealsListResponse,
  PlannedMealTimeBucket,
} from "@/types/plannedMeals";

const mockUseAuthContext = jest.fn();
const mockSetMeal = jest.fn<(meal: Meal) => void>();
const mockSaveDraft = jest.fn<(uid: string, meal?: Meal | null) => Promise<void>>();
const mockRemoveDraft = jest.fn<(uid: string) => Promise<void>>();
const mockSetLastScreen = jest.fn<(uid: string, screen: string) => Promise<void>>();
const mockUuid = jest.fn<() => string>();
const mockRuntimeFeatures: Record<string, boolean> = {
  planning: true,
};
const mockTrackPlannedMealCreated = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockTrackPlannedMealChanged = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockTrackPlannedMealSkipped = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockTrackPlannedMealConfirmed = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const overrides: Record<string, string> = {
        "planning.nutritionField.protein": "protein label",
        "planning.nutritionField.nutrition": "nutrition label",
        "planning.status.expired": "Expired label",
        "planning.status.source_unavailable": "Source unavailable label",
        "planning.status.converted_to_review": "Already sent to Review",
      };
      if (overrides[key]) return overrides[key];
      let value = options?.defaultValue ? String(options.defaultValue) : key;
      for (const [optionKey, optionValue] of Object.entries(options ?? {})) {
        if (optionKey === "defaultValue") continue;
        value = value.replace(
          new RegExp(`{{${optionKey}}}`, "g"),
          String(optionValue),
        );
      }
      return value;
    },
  }),
}));

jest.mock("@/services/plannedMeals/plannedMealsApi", () => ({
  fetchPlannedMealsRemote: jest.fn(),
  createPlannedMealRemote: jest.fn(),
  updatePlannedMealRemote: jest.fn(),
  deletePlannedMealRemote: jest.fn(),
}));

jest.mock("@/services/core/featureFlagGuard", () => ({
  isRuntimeFeatureEnabled: (domain: string) => mockRuntimeFeatures[domain] ?? true,
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackPlannedMealCreated: (input: Record<string, unknown>) =>
    mockTrackPlannedMealCreated(input),
  trackPlannedMealChanged: (input: Record<string, unknown>) =>
    mockTrackPlannedMealChanged(input),
  trackPlannedMealSkipped: (input: Record<string, unknown>) =>
    mockTrackPlannedMealSkipped(input),
  trackPlannedMealConfirmed: (input: Record<string, unknown>) =>
    mockTrackPlannedMealConfirmed(input),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/MealDraftContext", () => ({
  useMealDraftContext: () => ({
    setMeal: mockSetMeal,
    saveDraft: mockSaveDraft,
    removeDraft: mockRemoveDraft,
    setLastScreen: mockSetLastScreen,
  }),
}));

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

jest.mock("@/components", () => {
  const { Pressable, Text, TextInput, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Button: ({
      label,
      onPress,
      testID,
      disabled,
      loading,
    }: {
      label?: string;
      onPress?: () => void;
      testID?: string;
      disabled?: boolean;
      loading?: boolean;
    }) => (
      <Pressable
        accessibilityState={{
          disabled: Boolean(disabled),
          busy: Boolean(loading),
        }}
        disabled={disabled}
        onPress={disabled ? undefined : onPress}
        testID={testID}
      >
        <Text>{label}</Text>
      </Pressable>
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
    TextInput: ({
      label,
      helperText,
      value,
      onChangeText,
      testID,
      placeholder,
    }: {
      label?: string;
      helperText?: string;
      value: string;
      onChangeText: (text: string) => void;
      testID?: string;
      placeholder?: string;
    }) => (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          testID={testID}
        />
        {helperText ? <Text>{helperText}</Text> : null}
      </View>
    ),
  };
});

jest.mock("@/components/EmptyState", () => ({
  __esModule: true,
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => {
    const { Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </View>
    );
  },
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

const mockFetchPlannedMealsRemote =
  fetchPlannedMealsRemote as jest.MockedFunction<typeof fetchPlannedMealsRemote>;
const mockCreatePlannedMealRemote =
  createPlannedMealRemote as jest.MockedFunction<typeof createPlannedMealRemote>;
const mockUpdatePlannedMealRemote =
  updatePlannedMealRemote as jest.MockedFunction<typeof updatePlannedMealRemote>;
const mockDeletePlannedMealRemote =
  deletePlannedMealRemote as jest.MockedFunction<typeof deletePlannedMealRemote>;

const navigation = {
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  navigate: jest.fn(),
};

function plannedItem(
  overrides: Partial<PlannedMealItem> = {},
): PlannedMealItem {
  const timeBucket =
    (overrides.timeBucket as PlannedMealTimeBucket | null | undefined) ??
    "breakfast";

  return {
    plannedMealId: "planned-1",
    version: 1,
    dateBucket: "2026-06-19",
    timeBucket,
    sourceType: "manual",
    sourceRef: null,
    draftSnapshot: {
      name: "Planned oats",
      type: timeBucket === "any" ? "other" : timeBucket,
      ingredients: [
        {
          id: "ingredient-1",
          name: "Oats",
          amount: 50,
          unit: "g",
          kcal: 180,
          protein: 6,
          fat: 3,
          carbs: 32,
        },
      ],
      totals: {
        kcal: 180,
        protein: 6,
        fat: 3,
        carbs: 32,
      },
      notes: null,
      tags: [],
    },
    nutritionEstimate: {
      state: "known",
      totals: {
        kcal: 180,
        protein: 6,
        fat: 3,
        carbs: 32,
      },
      missingFields: [],
      confidence: "medium",
    },
    status: "planned",
    createdAt: "2026-06-18T08:00:00.000Z",
    updatedAt: "2026-06-18T08:00:00.000Z",
    ...overrides,
  };
}

function listResponse(items: PlannedMealItem[]): PlannedMealsListResponse {
  return {
    items,
    queryEcho: {
      startDate: "2026-06-19",
      days: 3,
      includeDeleted: false,
      returnedItems: items.length,
    },
  };
}

function expectPlanningTelemetryProps(
  props: Record<string, unknown>,
  expected: {
    estimateState: PlannedMealItem["nutritionEstimate"]["state"];
    actionResult?: "succeeded";
  },
) {
  const expectedKeys = expected.actionResult
    ? ["actionResult", "estimateState", "featureState", "sourceType", "surface"]
    : ["estimateState", "featureState", "sourceType", "surface"];
  expect(Object.keys(props).sort()).toEqual(expectedKeys.sort());
  expect(props).toEqual({
    sourceType: "manual",
    estimateState: expected.estimateState,
    surface: "planning",
    featureState: "enabled",
    ...(expected.actionResult ? { actionResult: expected.actionResult } : {}),
  });
}

describe("PlanningScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockSaveDraft.mockResolvedValue(undefined);
    mockRemoveDraft.mockResolvedValue(undefined);
    mockSetLastScreen.mockResolvedValue(undefined);
    mockTrackPlannedMealCreated.mockResolvedValue(undefined);
    mockTrackPlannedMealChanged.mockResolvedValue(undefined);
    mockTrackPlannedMealSkipped.mockResolvedValue(undefined);
    mockTrackPlannedMealConfirmed.mockResolvedValue(undefined);
    mockUuid.mockImplementation(() => `uuid-${mockUuid.mock.calls.length + 1}`);
    navigation.canGoBack.mockReturnValue(true);
    mockRuntimeFeatures.planning = true;
  });

  it("renders an unavailable state without loading or mutating planning when disabled", async () => {
    mockRuntimeFeatures.planning = false;

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    expect(screen.getByTestId("planning-feature-disabled-state")).toBeTruthy();
    expect(screen.queryByTestId("planning-refresh-button")).toBeNull();
    expect(screen.queryByTestId("planning-create-form")).toBeNull();
    expect(screen.queryByTestId("planning-list")).toBeNull();

    await waitFor(() => {
      expect(mockFetchPlannedMealsRemote).not.toHaveBeenCalled();
    });
    expect(mockCreatePlannedMealRemote).not.toHaveBeenCalled();
    expect(mockUpdatePlannedMealRemote).not.toHaveBeenCalled();
    expect(mockDeletePlannedMealRemote).not.toHaveBeenCalled();
    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(mockTrackPlannedMealCreated).not.toHaveBeenCalled();
    expect(mockTrackPlannedMealChanged).not.toHaveBeenCalled();
    expect(mockTrackPlannedMealSkipped).not.toHaveBeenCalled();
    expect(mockTrackPlannedMealConfirmed).not.toHaveBeenCalled();
  });

  it("shows loading then an explicit empty state without hiding the planning boundary", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(listResponse([]));

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    expect(screen.getByTestId("planning-loading")).toBeTruthy();
    expect(await screen.findByText("No planned meals yet")).toBeTruthy();
    expect(screen.getByTestId("planning-boundary")).toBeTruthy();
    expect(mockFetchPlannedMealsRemote).toHaveBeenCalledWith({
      startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      days: 3,
      includeDeleted: false,
    });
  });

  it("creates a manual name-only planned item with an explicit unknown estimate", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(listResponse([]));
    mockCreatePlannedMealRemote.mockResolvedValueOnce({
      item: plannedItem({
        plannedMealId: "planned-created",
        draftSnapshot: {
          ...plannedItem().draftSnapshot,
          name: "Protein bowl",
          ingredients: [],
          totals: null,
        },
        nutritionEstimate: {
          state: "unknown",
          totals: null,
          missingFields: ["kcal", "protein", "fat", "carbs"],
          confidence: null,
        },
      }),
      updated: true,
    });

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    await screen.findByText("No planned meals yet");
    fireEvent.changeText(screen.getByTestId("planning-create-name"), "Protein bowl");
    fireEvent.changeText(screen.getByTestId("planning-create-date"), "2026-06-20");
    fireEvent.press(screen.getByTestId("planning-create-time-lunch"));
    fireEvent.press(screen.getByTestId("planning-create-button"));

    await waitFor(() => {
      expect(mockCreatePlannedMealRemote).toHaveBeenCalledTimes(1);
    });

    expect(mockCreatePlannedMealRemote).toHaveBeenCalledWith(
      expect.objectContaining({
        clientMutationId: expect.stringMatching(/^planning:create:uuid-/),
        plannedMealId: expect.stringMatching(/^planned-uuid-/),
        dateBucket: "2026-06-20",
        timeBucket: "lunch",
        sourceType: "manual",
        sourceRef: null,
        draftSnapshot: expect.objectContaining({
          name: "Protein bowl",
          type: "lunch",
          ingredients: [],
          totals: null,
        }),
        nutritionEstimate: {
          state: "unknown",
          totals: null,
          missingFields: ["kcal", "protein", "fat", "carbs"],
          confidence: null,
        },
      }),
    );
    expect(await screen.findByText("Protein bowl")).toBeTruthy();
    expect(
      screen.getByTestId("planning-estimate-unknown-planned-created"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("planning-estimate-missing-planned-created"),
    ).toBeTruthy();
    expect(mockTrackPlannedMealCreated).toHaveBeenCalledTimes(1);
    expectPlanningTelemetryProps(
      mockTrackPlannedMealCreated.mock.calls[0][0],
      { estimateState: "unknown" },
    );
  });

  it("edits, reschedules, and deletes with the current API version guard", async () => {
    const initial = plannedItem();
    const edited = plannedItem({
      version: 2,
      dateBucket: "2026-06-20",
      timeBucket: "lunch",
      status: "rescheduled",
      draftSnapshot: {
        ...initial.draftSnapshot,
        name: "Edited oats",
      },
    });
    const rescheduled = plannedItem({
      ...edited,
      version: 3,
      dateBucket: "2026-06-21",
      status: "rescheduled",
    });
    const deleted = plannedItem({
      ...rescheduled,
      version: 4,
      status: "deleted",
    });

    mockFetchPlannedMealsRemote.mockResolvedValueOnce(listResponse([initial]));
    mockUpdatePlannedMealRemote
      .mockResolvedValueOnce({ item: edited, updated: true })
      .mockResolvedValueOnce({ item: rescheduled, updated: true });
    mockDeletePlannedMealRemote.mockResolvedValueOnce({
      item: deleted,
      updated: true,
    });

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    await screen.findByText("Planned oats");
    fireEvent.changeText(screen.getByTestId("planning-edit-name-planned-1"), "Edited oats");
    fireEvent.changeText(screen.getByTestId("planning-edit-date-planned-1"), "2026-06-20");
    fireEvent.press(screen.getByTestId("planning-edit-time-planned-1-lunch"));
    fireEvent.press(screen.getByTestId("planning-save-planned-1"));

    await waitFor(() => {
      expect(mockUpdatePlannedMealRemote).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdatePlannedMealRemote).toHaveBeenNthCalledWith(
      1,
      "planned-1",
      expect.objectContaining({
        expectedVersion: 1,
        dateBucket: "2026-06-20",
        timeBucket: "lunch",
        draftSnapshot: expect.objectContaining({ name: "Edited oats" }),
      }),
    );
    await screen.findByText("Edited oats");

    fireEvent.press(screen.getByTestId("planning-reschedule-planned-1"));
    await waitFor(() => {
      expect(mockUpdatePlannedMealRemote).toHaveBeenCalledTimes(2);
    });
    expect(mockUpdatePlannedMealRemote).toHaveBeenNthCalledWith(
      2,
      "planned-1",
      expect.objectContaining({
        expectedVersion: 2,
        dateBucket: "2026-06-21",
      }),
    );
    await screen.findByText("2026-06-21 • lunch • v3");

    fireEvent.press(screen.getByTestId("planning-delete-planned-1"));
    await waitFor(() => {
      expect(mockDeletePlannedMealRemote).toHaveBeenCalledWith(
        "planned-1",
        expect.objectContaining({
          expectedVersion: 3,
        }),
      );
    });
    expect(await screen.findByText("No planned meals yet")).toBeTruthy();
    expect(mockTrackPlannedMealChanged).toHaveBeenCalledTimes(2);
    expectPlanningTelemetryProps(
      mockTrackPlannedMealChanged.mock.calls[0][0],
      { estimateState: "known", actionResult: "succeeded" },
    );
    expectPlanningTelemetryProps(
      mockTrackPlannedMealChanged.mock.calls[1][0],
      { estimateState: "known", actionResult: "succeeded" },
    );
    expect(mockTrackPlannedMealSkipped).toHaveBeenCalledTimes(1);
    expectPlanningTelemetryProps(
      mockTrackPlannedMealSkipped.mock.calls[0][0],
      { estimateState: "known", actionResult: "succeeded" },
    );
  });

  it("does not emit Planning telemetry for validation or remote mutation failures", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(listResponse([]));

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    await screen.findByText("No planned meals yet");
    fireEvent.press(screen.getByTestId("planning-create-button"));

    await waitFor(() => {
      expect(mockCreatePlannedMealRemote).not.toHaveBeenCalled();
    });

    fireEvent.changeText(screen.getByTestId("planning-create-name"), "Protein bowl");
    fireEvent.changeText(screen.getByTestId("planning-create-date"), "2026-06-20");
    mockCreatePlannedMealRemote.mockRejectedValueOnce(new Error("remote failed"));
    fireEvent.press(screen.getByTestId("planning-create-button"));

    await waitFor(() => {
      expect(mockCreatePlannedMealRemote).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackPlannedMealCreated).not.toHaveBeenCalled();
    expect(mockTrackPlannedMealChanged).not.toHaveBeenCalled();
    expect(mockTrackPlannedMealSkipped).not.toHaveBeenCalled();
    expect(mockTrackPlannedMealConfirmed).not.toHaveBeenCalled();
  });

  it("keeps unknown and partial nutrition estimates visibly explicit", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(
      listResponse([
        plannedItem({
          plannedMealId: "unknown-1",
          nutritionEstimate: {
            state: "unknown",
            totals: null,
            missingFields: ["kcal", "protein", "fat", "carbs"],
            confidence: null,
          },
        }),
        plannedItem({
          plannedMealId: "partial-1",
          draftSnapshot: {
            ...plannedItem().draftSnapshot,
            name: "Partial toast",
          },
          nutritionEstimate: {
            state: "partial",
            totals: {
              kcal: 220,
              protein: 0,
              fat: 8,
              carbs: 30,
            },
            missingFields: ["protein"],
            confidence: "low",
          },
        }),
      ]),
    );

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    expect(
      await screen.findByTestId("planning-estimate-unknown-unknown-1"),
    ).toBeTruthy();
    expect(screen.getByTestId("planning-estimate-warning-unknown-1")).toBeTruthy();
    expect(
      screen.getByText(
        "Nutrition estimate is unknown and needs confirmation in Review.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("planning-estimate-partial-partial-1")).toBeTruthy();
    expect(
      screen.getByText("Nutrition estimate is partial. Missing: protein label."),
    ).toBeTruthy();
  });

  it("keeps terminal or unavailable planned statuses explicit and not reviewable", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(
      listResponse([
        plannedItem({
          status: "expired",
        }),
        plannedItem({
          plannedMealId: "source-1",
          status: "source_unavailable",
          draftSnapshot: {
            ...plannedItem().draftSnapshot,
            name: "Unavailable plan",
          },
        }),
        plannedItem({
          plannedMealId: "converted-1",
          status: "converted_to_review",
          linkedMealId: "meal-linked-1",
          convertedAt: "2026-06-19T09:15:00.000Z",
          conversionClientMutationId: "mutation-upsert-planned-link",
          draftSnapshot: {
            ...plannedItem().draftSnapshot,
            name: "Converted plan",
          },
        }),
      ]),
    );

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    expect(
      await screen.findByTestId("planning-status-expired-planned-1"),
    ).toBeTruthy();
    expect(screen.getByText("Expired label")).toBeTruthy();
    expect(
      screen.getByText(
        "This planned item is expired. Create a fresh plan before Review.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId("planning-status-source_unavailable-source-1"),
    ).toBeTruthy();
    expect(screen.getByText("Source unavailable label")).toBeTruthy();
    expect(
      screen.getByTestId("planning-status-converted_to_review-converted-1"),
    ).toBeTruthy();
    expect(screen.getByText("Already sent to Review")).toBeTruthy();
    expect(screen.getByTestId("planning-linked-meal-converted-1")).toBeTruthy();
    expect(
      screen.getByText("Logged meal meal-linked-1 • 2026-06-19T09:15:00.000Z"),
    ).toBeTruthy();

    expect(
      screen.getByTestId("planning-review-name-planned-oats").props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId("planning-review-name-unavailable-plan").props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId("planning-review-name-converted-plan").props
        .accessibilityState.disabled,
    ).toBe(true);

    fireEvent.press(screen.getByTestId("planning-review-name-planned-oats"));
    fireEvent.press(screen.getByTestId("planning-review-name-unavailable-plan"));
    fireEvent.press(screen.getByTestId("planning-review-name-converted-plan"));

    expect(mockSetMeal).not.toHaveBeenCalled();
    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
  });

  it("starts Add Meal Review from a planned item using only the local draft handoff", async () => {
    const item = plannedItem();
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(listResponse([item]));

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    await screen.findByText("Planned oats");
    fireEvent.press(screen.getByTestId("planning-review-name-planned-oats"));

    await waitFor(() => {
      expect(mockSetMeal).toHaveBeenCalledTimes(1);
    });

    const draft = mockSetMeal.mock.calls[0][0];
    expect(draft).toEqual(
      expect.objectContaining({
        userUid: "user-1",
        name: "Planned oats",
        source: "manual",
        inputMethod: "manual",
        syncState: "pending",
        dayKey: "2026-06-19",
      }),
    );
    expect(draft.notes).toContain("Nothing is logged until Review is saved.");
    expect(draft.notes).not.toContain("planned-1");
    expect(draft.planningSource).toEqual({
      plannedMealId: "planned-1",
      plannedMealVersion: 1,
      sourceType: "manual",
      sourceRef: null,
      nutritionEstimateState: "known",
      missingNutritionFields: [],
    });
    expect(mockSaveDraft).toHaveBeenCalledWith("user-1", draft);
    expect(mockSetLastScreen).toHaveBeenCalledWith("user-1", "ReviewMeal");
    expect(navigation.navigate).toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(mockCreatePlannedMealRemote).not.toHaveBeenCalled();
    expect(mockUpdatePlannedMealRemote).not.toHaveBeenCalled();
    expect(mockDeletePlannedMealRemote).not.toHaveBeenCalled();
    expect(mockTrackPlannedMealConfirmed).toHaveBeenCalledTimes(1);
    expectPlanningTelemetryProps(
      mockTrackPlannedMealConfirmed.mock.calls[0][0],
      { estimateState: "known", actionResult: "succeeded" },
    );
  });

  it("starts Review for an unknown planned item without synthetic ingredients or macros", async () => {
    const item = plannedItem({
      plannedMealId: "unknown-1",
      draftSnapshot: {
        ...plannedItem().draftSnapshot,
        name: "Name-only plan",
        ingredients: [],
        totals: null,
      },
      nutritionEstimate: {
        state: "unknown",
        totals: null,
        missingFields: ["kcal", "protein", "fat", "carbs"],
        confidence: null,
      },
    });
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(listResponse([item]));

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    await screen.findByText("Name-only plan");
    fireEvent.press(screen.getByTestId("planning-review-name-name-only-plan"));

    await waitFor(() => {
      expect(mockSetMeal).toHaveBeenCalledTimes(1);
    });

    const draft = mockSetMeal.mock.calls[0][0];
    expect(draft.name).toBe("Name-only plan");
    expect(draft.ingredients).toEqual([]);
    expect(draft.totals).toBeUndefined();
    expect(draft.planningSource).toEqual({
      plannedMealId: "unknown-1",
      plannedMealVersion: 1,
      sourceType: "manual",
      sourceRef: null,
      nutritionEstimateState: "unknown",
      missingNutritionFields: ["kcal", "protein", "fat", "carbs"],
    });
    expect(draft.notes).toContain(
      "Nutrition estimate is unknown. Review nutrition before saving.",
    );
    expect(draft.notes).toContain("Nothing is logged until Review is saved.");
  });

  it("rolls back a persisted draft and shows an error when Review handoff fails", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(listResponse([plannedItem()]));
    mockSetLastScreen.mockRejectedValueOnce(new Error("storage failed"));

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    await screen.findByText("Planned oats");
    fireEvent.press(screen.getByTestId("planning-review-name-planned-oats"));

    await waitFor(() => {
      expect(screen.getByTestId("planning-review-error")).toBeTruthy();
    });

    expect(mockSaveDraft).toHaveBeenCalledTimes(1);
    expect(mockRemoveDraft).toHaveBeenCalledWith("user-1");
    expect(mockSetMeal).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(mockTrackPlannedMealConfirmed).not.toHaveBeenCalled();
  });

  it("keeps Review handoff successful when Planning telemetry enqueue fails", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce(listResponse([plannedItem()]));
    mockTrackPlannedMealConfirmed.mockRejectedValueOnce(
      new Error("telemetry failed"),
    );

    const screen = renderWithTheme(
      <PlanningScreen navigation={navigation as never} />,
    );

    await screen.findByText("Planned oats");
    fireEvent.press(screen.getByTestId("planning-review-name-planned-oats"));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith("AddMeal", {
        start: "ReviewMeal",
      });
    });

    expect(mockSetMeal).toHaveBeenCalledTimes(1);
    expect(mockTrackPlannedMealConfirmed).toHaveBeenCalledTimes(1);
  });
});
