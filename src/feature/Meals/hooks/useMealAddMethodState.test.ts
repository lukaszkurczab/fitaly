import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { useMealAddMethodState } from "@/feature/Meals/hooks/useMealAddMethodState";

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
const mockSetMeal = jest.fn();
const mockSaveDraft = jest.fn<(uid: string, meal: unknown) => Promise<void>>();
const mockSetLastScreen = jest.fn<(uid: string, screen: string) => Promise<void>>();
const mockLoadDraft = jest.fn<(uid: string) => Promise<void>>();
const mockRemoveDraft = jest.fn<(uid: string) => Promise<void>>();
const mockUseAuthContext = jest.fn();
const mockFetchKnownPatternCandidatesRemote =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockMarkKnownPatternCandidateRemote =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockOpenKnownPatternReviewDraftRemote =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockTrackKnownPatternCandidateShown =
  jest.fn<(input: unknown) => Promise<void>>();
const mockTrackKnownPatternReviewStarted =
  jest.fn<(input: unknown) => Promise<void>>();
const mockTrackKnownPatternCandidateDismissed =
  jest.fn<(input: unknown) => Promise<void>>();
const mockRuntimeConfig = {
  apiVersion: "v1",
  foodLibraryEnabled: true,
  smartMemoryEnabled: true,
  knownPatternsEnabled: true,
  recipeCatalogEnabled: true,
  planningEnabled: true,
  homeNextActionEnabled: true,
};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  getDraftKey: (uid: string) => `draft:${uid}`,
  getScreenKey: (uid: string) => `screen:${uid}`,
  useMealDraftContext: () => ({
    setMeal: mockSetMeal,
    saveDraft: (uid: string, meal: unknown) => mockSaveDraft(uid, meal),
    setLastScreen: (uid: string, screen: string) => mockSetLastScreen(uid, screen),
    loadDraft: (uid: string) => mockLoadDraft(uid),
    removeDraft: (uid: string) => mockRemoveDraft(uid),
  }),
}));

jest.mock("@/services/e2e/config", () => ({
  E2E_DETERMINISTIC_INGREDIENT: {
    id: "ingredient-1",
    name: "ingredient",
    kcal: 100,
    protein: 1,
    fat: 1,
    carbs: 1,
    amount: 1,
    unit: "g",
  },
  isE2EModeEnabled: () => false,
}));

jest.mock("@/services/knownPatterns/knownPatternCandidatesApi", () => ({
  fetchKnownPatternCandidatesRemote: (...args: unknown[]) =>
    mockFetchKnownPatternCandidatesRemote(...args),
  markKnownPatternCandidateRemote: (...args: unknown[]) =>
    mockMarkKnownPatternCandidateRemote(...args),
  openKnownPatternReviewDraftRemote: (...args: unknown[]) =>
    mockOpenKnownPatternReviewDraftRemote(...args),
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackKnownPatternCandidateShown: (input: unknown) =>
    mockTrackKnownPatternCandidateShown(input),
  trackKnownPatternReviewStarted: (input: unknown) =>
    mockTrackKnownPatternReviewStarted(input),
  trackKnownPatternCandidateDismissed: (input: unknown) =>
    mockTrackKnownPatternCandidateDismissed(input),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockRuntimeConfig,
}));

const knownPatternCandidate = {
  candidateId: "a1b2c3d4e5f6a1b2",
  candidateType: "repeated_meal_snapshot",
  subjectKeyHash: "b2c3d4e5f6a1b2c3",
  state: "candidate",
  confidenceBucket: "medium",
  sourceCountBucket: "3_4",
  distinctDayCountBucket: "3_4",
  firstSeenAt: "2026-06-15T07:30:00.000Z",
  lastSeenAt: "2026-06-17T07:40:00.000Z",
  expiresAt: "2026-07-01T07:40:00.000Z",
  sourceRefs: [
    {
      sourceType: "meal_snapshot",
      sourceHash: "c3d4e5f6a1b2c3d4",
    },
  ],
  explanation: {
    key: "knownPattern.explanation.repeatedMealSnapshot",
    reasonCode: "repeated_meal_recent_distinct_days",
  },
  suggestedAction: "open_review_draft",
  createdByRuleVersion: "known-pattern-v1",
} as const;

const knownPatternDraftResponse = {
  draft: {
    name: "Owsianka z owocami",
    type: "breakfast",
    ingredients: [
      {
        id: "ingredient-1",
        name: "Płatki owsiane",
        amount: 50,
        unit: "g",
        kcal: 180,
        protein: 6,
        fat: 3,
        carbs: 32,
      },
    ],
    totals: { kcal: 180, protein: 6, fat: 3, carbs: 32 },
    notes: null,
    tags: [],
  },
  control: {
    controlId: "d4e5f6a1b2c3d4e5",
    candidateId: knownPatternCandidate.candidateId,
    subjectKeyHash: knownPatternCandidate.subjectKeyHash,
    state: "shown",
    createdByRuleVersion: "known-pattern-v1",
    expiresAt: "2026-07-01T07:40:00.000Z",
    createdAt: "2026-06-18T07:40:00.000Z",
    updatedAt: "2026-06-18T07:40:00.000Z",
  },
  updated: true,
} as const;

describe("useMealAddMethodState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ uid: null });
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockSaveDraft.mockResolvedValue(undefined);
    mockSetLastScreen.mockResolvedValue(undefined);
    mockLoadDraft.mockResolvedValue(undefined);
    mockRemoveDraft.mockResolvedValue(undefined);
    mockFetchKnownPatternCandidatesRemote.mockResolvedValue({ items: [] });
    mockMarkKnownPatternCandidateRemote.mockResolvedValue({
      control: knownPatternDraftResponse.control,
      updated: true,
    });
    mockOpenKnownPatternReviewDraftRemote.mockResolvedValue(
      knownPatternDraftResponse,
    );
    mockRuntimeConfig.knownPatternsEnabled = true;
  });

  it("broadcasts persisted default method changes to other hook instances", async () => {
    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const homeHook = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );
    const chooserHook = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        persistSelection: true,
      }),
    );

    await waitFor(() => {
      expect(homeHook.result.current.preferredMethodKey).toBe("photo");
    });

    const textOption = chooserHook.result.current.options.find(
      (option) => option.key === "text",
    );

    expect(textOption).toBeTruthy();

    await act(async () => {
      await chooserHook.result.current.handleOptionPress(textOption!);
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      "meal-add-preferred-method",
      "text",
    );
    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "DescribeMeal",
    });

    await waitFor(() => {
      expect(homeHook.result.current.preferredMethodKey).toBe("text");
    });
    expect(homeHook.result.current.preferredOption.key).toBe("text");
  });

  it("resumes unfinished AddMeal drafts in the new review flow", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "draft:user-1") {
        return JSON.stringify({
          mealId: "draft-1",
          createdAt: "2026-03-30T08:00:00.000Z",
          ingredients: [{ name: "Chicken", amount: 120, kcal: 220 }],
        });
      }
      if (key === "screen:user-1") return "AddMeal";
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
      }),
    );

    await act(async () => {
      await result.current.handleOptionPress(result.current.options[0]);
    });

    expect(result.current.showResumeModal).toBe(true);
    expect(result.current.resumeDraftMeal).toEqual(
      expect.objectContaining({ mealId: "draft-1" }),
    );

    await act(async () => {
      await result.current.handleContinueDraft();
    });

    expect(mockLoadDraft).toHaveBeenCalledWith("user-1");
    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(result.current.resumeDraftMeal).toBeNull();
  });

  it("starts the preferred photo method at the instructional entry by default", async () => {
    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );

    await act(async () => {
      await result.current.handleDirectStart();
    });

    expect(mockNavigate).toHaveBeenCalledWith("AddMeal", {
      start: "CameraDefault",
      attempt: 1,
    });
  });

  it("starts the preferred photo method in fullscreen camera mode when stored", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "meal-add:photo-fullscreen:user-1") return "true";
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );

    await act(async () => {
      await result.current.handleDirectStart();
    });

    expect(mockNavigate).toHaveBeenCalledWith("AddMeal", {
      start: "CameraDefault",
      attempt: 1,
      fullscreenPreferred: true,
    });
  });

  it("falls back to the instructional photo entry for invalid fullscreen preference values", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "meal-add:photo-fullscreen:user-1") return "fullscreen";
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );

    await act(async () => {
      await result.current.handleDirectStart();
    });

    expect(mockNavigate).toHaveBeenCalledWith("AddMeal", {
      start: "CameraDefault",
      attempt: 1,
    });
  });

  it("falls back to the instructional photo entry when fullscreen preference storage fails", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "meal-add:photo-fullscreen:user-1") {
        throw new Error("storage unavailable");
      }
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );

    await act(async () => {
      await result.current.handleDirectStart();
    });

    expect(mockNavigate).toHaveBeenCalledWith("AddMeal", {
      start: "CameraDefault",
      attempt: 1,
    });
  });

  it("resets the stack when starting a new method from inside the meal add flow", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        resetStackOnStart: true,
      }),
    );

    const textOption = result.current.options.find((option) => option.key === "text");

    await act(async () => {
      await result.current.handleOptionPress(textOption!);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: {
          index: 1,
          routes: [
            { name: "Home" },
            { name: "AddMeal", params: { start: "DescribeMeal" } },
          ],
        },
      }),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("starts manual meals at the details editor with a manual draft", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
      }),
    );

    const manualOption = result.current.options.find(
      (option) => option.key === "manual",
    );

    expect(manualOption).toBeTruthy();

    await act(async () => {
      await result.current.handleOptionPress(manualOption!);
    });

    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "EditMealDetails",
      submitIntent: "replaceReview",
    });
    expect(mockSaveDraft).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        inputMethod: "manual",
      }),
    );
  });

  it("starts saved-meal reuse inside the AddMeal stack without priming an empty draft", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
      }),
    );

    const savedOption = result.current.options.find(
      (option) => option.key === "saved",
    );

    expect(savedOption).toBeTruthy();

    await act(async () => {
      await result.current.handleOptionPress(savedOption!);
    });

    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "SelectSavedMeal",
    });
    expect(mockSetMeal).not.toHaveBeenCalled();
    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(mockSetLastScreen).not.toHaveBeenCalled();
  });

  it("opens known-pattern review as an editable local draft without saving a meal", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockFetchKnownPatternCandidatesRemote.mockResolvedValue({
      items: [knownPatternCandidate],
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        loadKnownPatternCandidate: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.knownPatternCandidate?.candidateId).toBe(
        knownPatternCandidate.candidateId,
      );
    });
    expect(mockTrackKnownPatternCandidateShown).toHaveBeenCalledWith({
      surface: "meal_add_method",
      confidenceBucket: "medium",
      sourceCountBucket: "3_4",
      featureState: "enabled",
    });

    await act(async () => {
      await result.current.handleKnownPatternReview();
    });

    expect(mockOpenKnownPatternReviewDraftRemote).toHaveBeenCalledWith(
      knownPatternCandidate.candidateId,
      expect.objectContaining({
        clientMutationId: expect.stringContaining("known-pattern:review:user-1:"),
        subjectKeyHash: knownPatternCandidate.subjectKeyHash,
        createdByRuleVersion: "known-pattern-v1",
      }),
    );
    expect(mockSetMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Owsianka z owocami",
        type: "breakfast",
        inputMethod: "manual",
        source: null,
        syncState: "pending",
        ingredients: knownPatternDraftResponse.draft.ingredients,
        totals: knownPatternDraftResponse.draft.totals,
      }),
    );
    expect(mockSaveDraft).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "Owsianka z owocami" }),
    );
    expect(mockSetLastScreen).toHaveBeenCalledWith("user-1", "ReviewMeal");
    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(mockTrackKnownPatternReviewStarted).toHaveBeenCalledWith({
      surface: "meal_add_method",
      confidenceBucket: "medium",
      sourceCountBucket: "3_4",
      actionResult: "succeeded",
      featureState: "enabled",
    });
  });

  it("does not fetch known-pattern candidate when Known Patterns is disabled", async () => {
    mockRuntimeConfig.knownPatternsEnabled = false;
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        loadKnownPatternCandidate: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.knownPatternCandidate).toBeNull();
    });
    expect(mockFetchKnownPatternCandidatesRemote).not.toHaveBeenCalled();
  });

  it("declines a known-pattern candidate and removes it from the chooser", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockFetchKnownPatternCandidatesRemote.mockResolvedValue({
      items: [knownPatternCandidate],
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        loadKnownPatternCandidate: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.knownPatternCandidate).not.toBeNull();
    });

    await act(async () => {
      await result.current.handleKnownPatternDismiss();
    });

    expect(mockMarkKnownPatternCandidateRemote).toHaveBeenCalledWith(
      knownPatternCandidate.candidateId,
      expect.objectContaining({
        clientMutationId: expect.stringContaining("known-pattern:decline:user-1:"),
        subjectKeyHash: knownPatternCandidate.subjectKeyHash,
        createdByRuleVersion: "known-pattern-v1",
        action: "declined",
      }),
    );
    expect(result.current.knownPatternCandidate).toBeNull();
    expect(mockSetMeal).not.toHaveBeenCalled();
    expect(mockTrackKnownPatternCandidateDismissed).toHaveBeenCalledWith({
      surface: "meal_add_method",
      confidenceBucket: "medium",
      sourceCountBucket: "3_4",
      actionResult: "succeeded",
      featureState: "enabled",
    });
  });

  it("does not emit raw Known Pattern identity in telemetry props", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockFetchKnownPatternCandidatesRemote.mockResolvedValue({
      items: [knownPatternCandidate],
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        loadKnownPatternCandidate: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.knownPatternCandidate).not.toBeNull();
    });

    await act(async () => {
      await result.current.handleKnownPatternDismiss();
    });

    for (const mockFn of [
      mockTrackKnownPatternCandidateShown,
      mockTrackKnownPatternCandidateDismissed,
    ]) {
      for (const [props] of mockFn.mock.calls) {
        expect(JSON.stringify(props)).not.toContain(
          knownPatternCandidate.candidateId,
        );
        expect(JSON.stringify(props)).not.toContain(
          knownPatternCandidate.subjectKeyHash,
        );
        expect(JSON.stringify(props)).not.toContain(
          knownPatternCandidate.createdByRuleVersion,
        );
      }
    }
  });

  it("does not overwrite an active draft before opening a known-pattern review", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockFetchKnownPatternCandidatesRemote.mockResolvedValue({
      items: [knownPatternCandidate],
    });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "draft:user-1") {
        return JSON.stringify({
          mealId: "draft-1",
          createdAt: "2026-06-18T08:00:00.000Z",
          ingredients: [{ name: "Existing", amount: 120, kcal: 220 }],
        });
      }
      if (key === "screen:user-1") return "AddMeal";
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        loadKnownPatternCandidate: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.knownPatternCandidate).not.toBeNull();
    });

    await act(async () => {
      await result.current.handleKnownPatternReview();
    });

    expect(result.current.showResumeModal).toBe(true);
    expect(mockOpenKnownPatternReviewDraftRemote).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleDiscardDraft();
    });

    expect(mockRemoveDraft).toHaveBeenCalledWith("user-1");
    expect(mockOpenKnownPatternReviewDraftRemote).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
  });
});
