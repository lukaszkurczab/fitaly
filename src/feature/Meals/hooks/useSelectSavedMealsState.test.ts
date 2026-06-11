import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Meal } from "@/types/meal";
import { useSelectSavedMealsState } from "@/feature/Meals/hooks/useSelectSavedMealsState";

const mockUuid = jest.fn<() => string>();
const mockSubscribeToMyMealsOrderedByName = jest.fn();
const mockUnsubscribe = jest.fn();

let emitRepoData: ((items: Meal[]) => void) | null = null;

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

jest.mock("@/services/meals/myMealsRepository", () => ({
  subscribeToMyMealsOrderedByName: (params: {
    uid: string;
    onData: (items: Meal[]) => void;
  }) => {
    mockSubscribeToMyMealsOrderedByName(params);
    emitRepoData = params.onData;
    return mockUnsubscribe;
  },
}));

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-02-01T10:00:00.000Z",
  type: "lunch",
  name: "Chicken pasta",
  ingredients: [],
  createdAt: "2026-02-01T10:00:00.000Z",
  updatedAt: "2026-02-01T10:00:00.000Z",
  syncState: "synced",
  source: "saved",
  ...overrides,
});

describe("useSelectSavedMealsState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emitRepoData = null;
    mockUuid.mockReturnValue("uuid-new");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resets state when uid is missing", async () => {
    const { result } = renderHook(() =>
      useSelectSavedMealsState({
        uid: null,
        syncSavedMeals: jest.fn(async () => undefined),
        setMeal: jest.fn(),
        saveDraft: jest.fn<
          (uid: string, draftOverride?: Meal | null) => Promise<void>
        >(async () => undefined),
        setLastScreen: jest.fn(async () => undefined),
        onNavigateReview: jest.fn(),
        onStartOver: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pageItems).toEqual([]);
    expect(mockSubscribeToMyMealsOrderedByName).not.toHaveBeenCalled();
  });

  it("subscribes to repository data and keeps list sorted by name", async () => {
    const syncSavedMeals = jest.fn<() => Promise<void>>(async () => undefined);
    const { result, unmount } = renderHook(() =>
      useSelectSavedMealsState({
        uid: "user-1",
        syncSavedMeals,
        setMeal: jest.fn(),
        saveDraft: jest.fn<
          (uid: string, draftOverride?: Meal | null) => Promise<void>
        >(async () => undefined),
        setLastScreen: jest.fn(async () => undefined),
        onNavigateReview: jest.fn(),
        onStartOver: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(mockSubscribeToMyMealsOrderedByName).toHaveBeenCalledWith(
        expect.objectContaining({ uid: "user-1" }),
      );
    });
    expect(syncSavedMeals).toHaveBeenCalledTimes(1);

    act(() => {
      emitRepoData?.([
        meal({ mealId: "meal-2", name: "Apple pie" }),
        meal({ mealId: "meal-3", name: "Beef bowl" }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.pageItems.map((item) => item.name)).toEqual([
        "Apple pie",
        "Beef bowl",
      ]);
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("builds a saved-meal draft and navigates straight to review", async () => {
    const setMeal = jest.fn();
    const saveDraft = jest.fn<
      (uid: string, draftOverride?: Meal | null) => Promise<void>
    >(async () => undefined);
    const setLastScreen = jest.fn<
      (uid: string, screen: string) => Promise<void>
    >(async () => undefined);
    const onNavigateReview = jest.fn();
    const onStartOver = jest.fn();

    const { result } = renderHook(() =>
      useSelectSavedMealsState({
        uid: "user-1",
        syncSavedMeals: jest.fn(async () => undefined),
        setMeal,
        saveDraft,
        setLastScreen,
        onNavigateReview,
        onStartOver,
      }),
    );

    act(() => {
      emitRepoData?.([meal()]);
    });

    await waitFor(() => {
      expect(result.current.pageItems).toHaveLength(1);
    });

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-20T08:30:00.000Z"));

    await act(async () => {
      await result.current.handleAddMeal(result.current.pageItems[0]);
    });

    expect(setMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        mealId: "uuid-new",
        cloudId: undefined,
        savedMealRefId: "meal-1",
        source: "saved",
        inputMethod: "manual",
        name: "Chicken pasta",
        timestamp: "2026-03-20T08:30:00.000Z",
        dayKey: "2026-03-20",
      }),
    );
    expect(saveDraft).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        mealId: "uuid-new",
        source: "saved",
      }),
    );
    expect(setLastScreen).toHaveBeenCalledWith("user-1", "ReviewMeal");
    expect(onNavigateReview).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleStartOver();
    });
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });

  it("does not trigger background sync when uid is missing", async () => {
    const syncSavedMeals = jest.fn<() => Promise<void>>(async () => undefined);

    renderHook(() =>
      useSelectSavedMealsState({
        uid: null,
        syncSavedMeals,
        setMeal: jest.fn(),
        saveDraft: jest.fn<
          (uid: string, draftOverride?: Meal | null) => Promise<void>
        >(async () => undefined),
        setLastScreen: jest.fn(async () => undefined),
        onNavigateReview: jest.fn(),
        onStartOver: jest.fn(),
      }),
    );

    await Promise.resolve();
    expect(syncSavedMeals).not.toHaveBeenCalled();
  });

  it("tracks manual refresh separately from initial loading", async () => {
    let resolveSync: (() => void) | undefined;
    const syncSavedMeals = jest
      .fn<() => Promise<void>>(async () => undefined)
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSync = () => resolve();
          }),
      );

    const { result } = renderHook(() =>
      useSelectSavedMealsState({
        uid: "user-1",
        syncSavedMeals,
        setMeal: jest.fn(),
        saveDraft: jest.fn<
          (uid: string, draftOverride?: Meal | null) => Promise<void>
        >(async () => undefined),
        setLastScreen: jest.fn(async () => undefined),
        onNavigateReview: jest.fn(),
        onStartOver: jest.fn(),
      }),
    );

    act(() => {
      emitRepoData?.([meal()]);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(syncSavedMeals).toHaveBeenCalledTimes(1);

    let pendingRefresh: Promise<void>;
    await act(async () => {
      pendingRefresh = result.current.refresh();
    });
    await waitFor(() => {
      expect(result.current.refreshing).toBe(true);
    });

    resolveSync?.();
    await act(async () => {
      await pendingRefresh;
    });
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });
});
