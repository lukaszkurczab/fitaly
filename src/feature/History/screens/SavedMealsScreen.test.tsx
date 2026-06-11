import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ActivityIndicator } from "react-native";
import SavedMealsScreen from "@/feature/History/screens/SavedMealsScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal } from "@/types/meal";

const mockUseNetInfo = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUseMeals = jest.fn();
const mockUseFilters = jest.fn();
const mockUseMealDraftContext = jest.fn();
const mockUseSavedMealsData = jest.fn();
const mockUuid = jest.fn();
const mockSyncMyMeals = jest.fn<
  (uid: string | null | undefined) => Promise<void>
>();
const mockGetSyncCounts = jest.fn<
  (
    uid: string,
    options?: { kinds?: string[] },
  ) => Promise<{ dead: number; pending: number }>
>();
const mockGetDeadLetterOps = jest.fn<
  (params: {
    uid: string;
    kinds?: string[];
    limit?: number;
  }) => Promise<Array<{ id?: number; kind: string; payload?: unknown }>>
>();
const mockRetryDeadLetterOps = jest.fn<
  (params: { uid: string; kinds?: string[] }) => Promise<number>
>();
const mockDiscardDeadLetterOps = jest.fn<
  (params: { uid: string; ids: number[]; kinds?: string[] }) => Promise<number>
>();
const mockRequestSync = jest.fn<
  (params: { uid: string; domain: string; reason: string }) => Promise<void>
>();
const mockEmit = jest.fn<(event: string, payload?: unknown) => void>();
const mockOn = jest.fn<
  (event: string, handler: (payload?: unknown) => void) => () => void
>();
const mockEventHandlers = new Map<string, Set<(payload?: unknown) => void>>();
let savedMealsFocusEffect: (() => void) | undefined;

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) => {
    savedMealsFocusEffect = callback;
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@hooks/useMeals", () => ({
  useMeals: (uid: string) => mockUseMeals(uid),
}));

jest.mock("@/context/HistoryContext", () => ({
  useFilters: (scope: string) => mockUseFilters(scope),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("@/feature/History/hooks/useSavedMealsData", () => ({
  useSavedMealsData: (params: unknown) => mockUseSavedMealsData(params),
}));

jest.mock("@/services/meals/myMealService", () => ({
  syncMyMeals: (uid: string | null | undefined) => mockSyncMyMeals(uid),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  getSyncCounts: (...args: [string, { kinds?: string[] }?]) =>
    mockGetSyncCounts(...args),
  getDeadLetterOps: (...args: [{
    uid: string;
    kinds?: string[];
    limit?: number;
  }]) => mockGetDeadLetterOps(...args),
  retryDeadLetterOps: (...args: [{
    uid: string;
    kinds?: string[];
  }]) => mockRetryDeadLetterOps(...args),
  discardDeadLetterOps: (...args: [{
    uid: string;
    ids: number[];
    kinds?: string[];
  }]) => mockDiscardDeadLetterOps(...args),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (...args: [{ uid: string; domain: string; reason: string }]) =>
    mockRequestSync(...args),
}));

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload?: unknown) => mockEmit(event, payload),
  on: (event: string, handler: (payload?: unknown) => void) => {
    mockOn(event, handler);
    const handlers = mockEventHandlers.get(event) ?? new Set();
    handlers.add(handler);
    mockEventHandlers.set(event, handlers);
    return () => {
      handlers.delete(handler);
    };
  },
}));

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?:
        | {
            count?: number;
            defaultValue?: string;
            operation?: string;
            pending?: number;
          }
        | string,
    ) => {
      const params = typeof options === "object" ? options : undefined;
      if (key === "history.deadLetterTitle") {
        return `${params?.count ?? 0} saved meal changes need retry.`;
      }
      if (key === "history.deadLetterSubtitle") {
        return `Pending saved meal changes: ${params?.pending ?? 0}.`;
      }
      if (key === "history.deadLetterSubtitleWithLast") {
        return `Pending saved meal changes: ${params?.pending ?? 0}. Last failed: ${params?.operation ?? ""}.`;
      }
      if (key === "history.savedMealPhotoUploadRecoveryTitle") {
        return "Saved meal photo needs retry.";
      }
      if (key === "history.savedMealPhotoUploadRecoverySubtitle") {
        return `Saved meal change includes a failed local photo. Pending saved meal changes: ${params?.pending ?? 0}.`;
      }
      if (key === "history.savedMealPhotoUploadDiscardAction") {
        return "Discard saved-meal change";
      }
      if (key === "history.savedMealPhotoUploadDiscarded") {
        return `${params?.count ?? 0} saved-meal change with failed local photo discarded.`;
      }
      if (key === "history.deadLetterOperation.upsert_mymeal") {
        return "saved meal update";
      }
      if (key === "history.deadLetterOperation.delete_mymeal") {
        return "saved meal delete";
      }
      return typeof options === "string" ? options : options?.defaultValue ?? key;
    },
  }),
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: React.ReactNode }) =>
      createElement(View, null, children),
    FullScreenLoader: () => createElement(Text, null, "full-screen-loader"),
    SearchBox: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (value: string) => void;
    }) =>
      createElement(
        Pressable,
        { onPress: () => onChange("next query") },
        createElement(Text, null, `search:${value}`),
      ),
  };
});

jest.mock("@/components/MealListItem", () => ({
  MealListItem: ({
    meal,
    onPress,
    onDuplicate,
    onEdit,
    onDelete,
  }: {
    meal: Meal;
    onPress: () => void;
    onDuplicate: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      View,
      null,
      createElement(
        Pressable,
        { onPress },
        createElement(Text, null, `open:${meal.name}`),
      ),
      createElement(
        Pressable,
        { onPress: onDuplicate },
        createElement(Text, null, `duplicate:${meal.name}`),
      ),
      createElement(
        Pressable,
        { onPress: onEdit },
        createElement(Text, null, `edit:${meal.name}`),
      ),
      createElement(
        Pressable,
        { onPress: onDelete },
        createElement(Text, null, `delete:${meal.name}`),
      ),
    );
  },
}));

jest.mock("../components/EmptyState", () => ({
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      View,
      null,
      createElement(Text, null, `empty-title:${title}`),
      createElement(Text, null, `empty-description:${description}`),
    );
  },
}));

jest.mock("../components/FilterBadgeButton", () => ({
  FilterBadgeButton: ({
    activeCount,
    onPress,
  }: {
    activeCount: number;
    onPress: () => void;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(
      Pressable,
      { onPress },
      createElement(Text, null, `filter-badge:${activeCount}`),
    );
  },
}));

jest.mock("../components/FilterPanel", () => ({
  FilterPanel: ({ scope }: { scope: string }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, `filter-panel:${scope}`);
  },
}));

jest.mock("../components/LoadingSkeleton", () => ({
  LoadingSkeleton: ({ height }: { height: number }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, `loading-skeleton:${height}`);
  },
}));

const buildMeal = (overrides?: Partial<Meal>): Meal => ({
  mealId: "meal-1",
  cloudId: "cloud-1",
  userUid: "user-1",
  name: "Pasta bake",
  photoUrl: "https://example.com/pasta.jpg",
  ingredients: [
    {
      id: "ingredient-1",
      name: "Pasta",
      amount: 100,
      unit: "g",
      kcal: 150,
      protein: 5,
      carbs: 30,
      fat: 2,
    },
  ],
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
  timestamp: "2026-01-01T12:00:00.000Z",
  syncState: "synced",
  tags: [],
  deleted: false,
  notes: null,
  type: "lunch",
  source: "saved",
  ...overrides,
});

const emitCapturedEvent = (event: string, payload?: unknown) => {
  for (const handler of Array.from(mockEventHandlers.get(event) ?? [])) {
    handler(payload);
  }
};

describe("SavedMealsScreen", () => {
  beforeEach(() => {
    savedMealsFocusEffect = undefined;
    mockSyncMyMeals.mockReset();
    mockSyncMyMeals.mockResolvedValue(undefined);
    mockGetSyncCounts.mockReset();
    mockGetSyncCounts.mockResolvedValue({ dead: 0, pending: 0 });
    mockGetDeadLetterOps.mockReset();
    mockGetDeadLetterOps.mockResolvedValue([]);
    mockRetryDeadLetterOps.mockReset();
    mockRetryDeadLetterOps.mockResolvedValue(0);
    mockDiscardDeadLetterOps.mockReset();
    mockDiscardDeadLetterOps.mockResolvedValue(0);
    mockRequestSync.mockReset();
    mockRequestSync.mockResolvedValue(undefined);
    mockEmit.mockReset();
    mockOn.mockReset();
    mockEventHandlers.clear();
    mockUuid.mockReset();
    mockUuid
      .mockReturnValueOnce("duplicated-meal-id")
      .mockReturnValueOnce("edited-meal-id");
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUseMeals.mockReturnValue({ getMeals: jest.fn() });
    mockUseFilters.mockReturnValue({
      query: "",
      setQuery: jest.fn(),
      filters: null,
      showFilters: false,
      toggleShowFilters: jest.fn(),
      filterCount: 0,
    });
    mockUseMealDraftContext.mockReturnValue({
      meal: null,
      setMeal: jest.fn(),
      saveDraft: jest.fn<(uid: string) => Promise<void>>(
        async (_uid: string) => undefined,
      ),
      setLastScreen: jest.fn<(uid: string, screen: string) => Promise<void>>(
        async (_uid: string, _screen: string) => undefined,
      ),
    });
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      loading: false,
      loadingMore: false,
      validating: false,
      errorKind: null,
      dataState: "ready",
      visibleItems: [],
      refresh: jest.fn(),
      onDelete: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });
  });

  it("passes a sync callback that calls syncMyMeals with current uid", async () => {
    renderWithTheme(<SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />);

    expect(mockUseSavedMealsData).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        syncSavedMeals: expect.any(Function),
      }),
    );

    const params = mockUseSavedMealsData.mock.calls[0]?.[0] as {
      syncSavedMeals: () => Promise<void>;
    };

    await params.syncSavedMeals();
    expect(mockSyncMyMeals).toHaveBeenCalledWith("user-1");
  });

  it("refreshes on later focus but skips the initial mount focus", async () => {
    jest.spyOn(Date, "now").mockReturnValue(32_000);
    const refresh = jest.fn(async () => undefined);
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      loading: false,
      loadingMore: false,
      validating: false,
      refreshing: false,
      errorKind: null,
      dataState: "ready",
      visibleItems: [],
      refresh,
      onDelete: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    renderWithTheme(<SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />);

    savedMealsFocusEffect?.();
    expect(refresh).not.toHaveBeenCalled();

    savedMealsFocusEffect?.();
    expect(refresh).toHaveBeenCalledTimes(1);

    jest.restoreAllMocks();
  });

  it("renders loading and non-ready states", () => {
    const setQuery = jest.fn();

    mockUseFilters.mockReturnValue({
      query: "rice",
      setQuery,
      filters: null,
      showFilters: false,
      toggleShowFilters: jest.fn(),
      filterCount: 0,
    });

    mockUseSavedMealsData
      .mockReturnValueOnce({
        pageSize: 20,
        dataState: "loading",
      })
      .mockReturnValueOnce({
        pageSize: 20,
        dataState: "error",
        errorKind: "refresh",
      })
      .mockReturnValueOnce({
        pageSize: 20,
        dataState: "offline-empty",
        errorKind: null,
      })
      .mockReturnValueOnce({
        pageSize: 20,
        dataState: "empty",
        errorKind: null,
      });

    const loading = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    expect(loading.getByText("full-screen-loader")).toBeTruthy();

    const error = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    expect(error.getByText("search:rice")).toBeTruthy();
    expect(error.getByText("empty-title:savedMeals.errorTitle")).toBeTruthy();
    expect(
      error.getByText("empty-description:savedMeals.refreshError"),
    ).toBeTruthy();
    fireEvent.press(error.getByText("search:rice"));
    expect(setQuery).toHaveBeenCalledWith("next query");

    const offline = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    expect(
      offline.getByText("empty-description:savedMeals.offlineEmpty"),
    ).toBeTruthy();

    const empty = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    expect(
      empty.getByText("empty-description:Try a different search."),
    ).toBeTruthy();
  });

  it("renders filters branch outside the ready state", () => {
    mockUseFilters.mockReturnValue({
      query: "",
      setQuery: jest.fn(),
      filters: null,
      showFilters: true,
      toggleShowFilters: jest.fn(),
      filterCount: 1,
    });
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      dataState: "empty",
      errorKind: null,
    });

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    expect(screen.getByText("filter-panel:myMeals")).toBeTruthy();
  });

  it("does not render a saved meals dead-letter banner without saved-meal dead letters", async () => {
    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledWith("user-1", {
        kinds: ["upsert_mymeal", "delete_mymeal"],
      });
      expect(mockGetDeadLetterOps).toHaveBeenCalledWith({
        uid: "user-1",
        kinds: ["upsert_mymeal", "delete_mymeal"],
        limit: 500,
      });
    });
    expect(screen.queryByTestId("saved-meals-dead-letter-banner")).toBeNull();
  });

  it("renders saved-meal photo upload recovery copy from local photo payload evidence", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 2, pending: 3 });
    mockGetDeadLetterOps.mockResolvedValue([
      {
        kind: "delete_mymeal",
        payload: { cloudId: "saved-2", deleted: true },
      },
      {
        kind: "upsert_mymeal",
        payload: {
          cloudId: "saved-1",
          photoLocalPath: "file:///saved-meal.jpg",
          photoUrl: "https://cdn.example/old.jpg",
        },
      },
    ]);

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("saved-meals-dead-letter-banner")).toBeTruthy();
    });
    expect(screen.getByText("Saved meal photo needs retry.")).toBeTruthy();
    expect(
      screen.getByTestId("saved-meals-photo-upload-discard-button"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Saved meal change includes a failed local photo. Pending saved meal changes: 3.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Discard saved-meal change")).toBeTruthy();
    expect(
      screen.queryByText(
        "Pending saved meal changes: 3. Last failed: saved meal delete.",
      ),
    ).toBeNull();
  });

  it("renders saved-meal photo upload recovery when local photo evidence is not in the first dead-letter rows", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 103, pending: 1 });
    mockGetDeadLetterOps.mockResolvedValue([
      ...Array.from({ length: 102 }, (_, index) => ({
        kind: "delete_mymeal",
        payload: { cloudId: `saved-delete-${index + 1}`, deleted: true },
      })),
      {
        kind: "upsert_mymeal",
        payload: {
          cloudId: "saved-photo-1",
          photoLocalPath: "file:///late-saved-meal.jpg",
        },
      },
    ]);

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("saved-meals-dead-letter-banner")).toBeTruthy();
    });
    expect(mockGetDeadLetterOps).toHaveBeenCalledWith({
      uid: "user-1",
      kinds: ["upsert_mymeal", "delete_mymeal"],
      limit: 500,
    });
    expect(screen.getByText("Saved meal photo needs retry.")).toBeTruthy();
    expect(
      screen.getByText(
        "Saved meal change includes a failed local photo. Pending saved meal changes: 1.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        "Pending saved meal changes: 1. Last failed: saved meal delete.",
      ),
    ).toBeNull();
  });

  it("renders saved-meal dead-letter diagnostics without a visible saved meal row", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 2, pending: 3 });
    mockGetDeadLetterOps.mockResolvedValue([
      { kind: "delete_mymeal", payload: { cloudId: "saved-1", deleted: true } },
    ]);
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      dataState: "empty",
      errorKind: null,
    });

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("saved-meals-dead-letter-banner")).toBeTruthy();
    });
    expect(screen.getByText("2 saved meal changes need retry.")).toBeTruthy();
    expect(
      screen.queryByTestId("saved-meals-photo-upload-discard-button"),
    ).toBeNull();
    expect(
      screen.getByText(
        "Pending saved meal changes: 3. Last failed: saved meal delete.",
      ),
    ).toBeTruthy();
  });

  it("keeps generic saved-meal recovery copy for upsert dead letters without local photo evidence", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 0 });
    mockGetDeadLetterOps.mockResolvedValue([
      {
        kind: "upsert_mymeal",
        payload: {
          cloudId: "saved-1",
          photoUrl: "https://cdn.example/saved-meal.jpg",
        },
      },
    ]);

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("saved-meals-dead-letter-banner")).toBeTruthy();
    });
    expect(screen.getByText("1 saved meal changes need retry.")).toBeTruthy();
    expect(
      screen.queryByTestId("saved-meals-photo-upload-discard-button"),
    ).toBeNull();
    expect(
      screen.getByText(
        "Pending saved meal changes: 0. Last failed: saved meal update.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Saved meal photo needs retry.")).toBeNull();
  });

  it("keeps generic saved-meal recovery copy for delete dead letters with local-looking payload fields", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 0 });
    mockGetDeadLetterOps.mockResolvedValue([
      {
        kind: "delete_mymeal",
        payload: {
          cloudId: "saved-1",
          photoLocalPath: "file:///saved-meal.jpg",
        },
      },
    ]);

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("saved-meals-dead-letter-banner")).toBeTruthy();
    });
    expect(screen.getByText("1 saved meal changes need retry.")).toBeTruthy();
    expect(
      screen.queryByTestId("saved-meals-photo-upload-discard-button"),
    ).toBeNull();
    expect(
      screen.getByText(
        "Pending saved meal changes: 0. Last failed: saved meal delete.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Saved meal photo needs retry.")).toBeNull();
  });

  it("detects saved-meal photo upload recovery from localPhotoUri and local photoUrl payload evidence", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 0 });
    mockGetDeadLetterOps
      .mockResolvedValueOnce([
        {
          kind: "upsert_mymeal",
          payload: {
            cloudId: "saved-1",
            localPhotoUri: "content://saved-meal",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          kind: "upsert_mymeal",
          payload: {
            cloudId: "saved-2",
            photoUrl: "file:///saved-meal.jpg",
          },
        },
      ]);

    const contentUriScreen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    await waitFor(() => {
      expect(
        contentUriScreen.getByText("Saved meal photo needs retry."),
      ).toBeTruthy();
    });

    const photoUrlScreen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );
    await waitFor(() => {
      expect(photoUrlScreen.getByText("Saved meal photo needs retry.")).toBeTruthy();
    });
  });

  it("keeps saved-meal diagnostics visible when a later diagnostic refresh fails", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 2 });
    mockGetDeadLetterOps.mockResolvedValue([
      { kind: "upsert_mymeal", payload: { cloudId: "saved-1" } },
    ]);

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("saved-meals-dead-letter-banner")).toBeTruthy();
    });
    expect(screen.getByText("1 saved meal changes need retry.")).toBeTruthy();

    mockGetSyncCounts.mockRejectedValueOnce(new Error("diagnostic read failed"));
    mockGetDeadLetterOps.mockResolvedValueOnce([
      { kind: "delete_mymeal", payload: { cloudId: "saved-1" } },
    ]);

    await act(async () => {
      emitCapturedEvent("sync:op:dead", {
        uid: "user-1",
        kind: "upsert_mymeal",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId("saved-meals-dead-letter-banner")).toBeTruthy();
    expect(screen.getByText("1 saved meal changes need retry.")).toBeTruthy();
    expect(
      screen.getByText(
        "Pending saved meal changes: 2. Last failed: saved meal update.",
      ),
    ).toBeTruthy();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("retries saved-meal dead letters with the saved-meal kinds and myMeals domain", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 4 });
    mockGetDeadLetterOps.mockResolvedValue([
      {
        kind: "upsert_mymeal",
        payload: { cloudId: "saved-1", photoLocalPath: "file:///saved.jpg" },
      },
    ]);
    mockRetryDeadLetterOps.mockResolvedValue(2);

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("saved-meals-dead-letter-retry")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("saved-meals-dead-letter-retry"));
    fireEvent.press(screen.getByTestId("saved-meals-dead-letter-retry"));

    await waitFor(() => {
      expect(mockRetryDeadLetterOps).toHaveBeenCalledTimes(1);
    });
    expect(mockRetryDeadLetterOps).toHaveBeenCalledWith({
      uid: "user-1",
      kinds: ["upsert_mymeal", "delete_mymeal"],
    });
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      key: "history.deadLetterRetryQueued",
      ns: "meals",
      options: { count: 2 },
    });
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "myMeals",
      reason: "retry",
    });
  });

  it("discards only saved-meal photo upsert dead letters with local photo evidence", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 3, pending: 1 });
    mockGetDeadLetterOps.mockImplementation(async (params) => {
      if (params.kinds?.length === 1 && params.kinds[0] === "upsert_mymeal") {
        return [
          {
            id: 10,
            kind: "upsert_mymeal",
            payload: {
              cloudId: "saved-photo",
              photoLocalPath: "file:///saved-photo.jpg",
            },
          },
          {
            id: 11,
            kind: "upsert_mymeal",
            payload: {
              cloudId: "saved-remote",
              photoUrl: "https://cdn.example/saved.jpg",
            },
          },
        ];
      }

      return [
        {
          id: 10,
          kind: "upsert_mymeal",
          payload: {
            cloudId: "saved-photo",
            photoLocalPath: "file:///saved-photo.jpg",
          },
        },
        {
          id: 11,
          kind: "upsert_mymeal",
          payload: {
            cloudId: "saved-remote",
            photoUrl: "https://cdn.example/saved.jpg",
          },
        },
        {
          id: 12,
          kind: "delete_mymeal",
          payload: {
            cloudId: "saved-delete",
            photoLocalPath: "file:///delete-payload.jpg",
          },
        },
      ];
    });
    mockDiscardDeadLetterOps.mockResolvedValue(1);

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("saved-meals-photo-upload-discard-button"),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("saved-meals-photo-upload-discard-button"));
    fireEvent.press(screen.getByTestId("saved-meals-photo-upload-discard-button"));

    await waitFor(() => {
      expect(mockDiscardDeadLetterOps).toHaveBeenCalledTimes(1);
    });
    expect(mockDiscardDeadLetterOps).toHaveBeenCalledWith({
      uid: "user-1",
      ids: [10],
      kinds: ["upsert_mymeal"],
    });
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      key: "history.savedMealPhotoUploadDiscarded",
      ns: "meals",
      options: { count: 1 },
    });
    expect(mockRequestSync).not.toHaveBeenCalled();
  });

  it("refreshes saved-meal diagnostics for same-uid dead-letter and retry events", async () => {
    renderWithTheme(<SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />);

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledTimes(1);
    });
    mockGetSyncCounts.mockClear();
    mockGetDeadLetterOps.mockClear();

    act(() => {
      emitCapturedEvent("sync:op:dead", {
        uid: "user-1",
        kind: "delete_mymeal",
      });
    });

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledTimes(1);
    });
    expect(mockGetDeadLetterOps).toHaveBeenCalledTimes(1);
    mockGetSyncCounts.mockClear();
    mockGetDeadLetterOps.mockClear();

    act(() => {
      emitCapturedEvent("sync:op:retried", {
        uid: "user-1",
        count: 1,
      });
    });

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledTimes(1);
    });
    expect(mockGetDeadLetterOps).toHaveBeenCalledTimes(1);
  });

  it("does not refresh saved-meal diagnostics for unrelated uid events", async () => {
    renderWithTheme(<SavedMealsScreen navigation={{ navigate: jest.fn() } as never} />);

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledTimes(1);
    });
    mockGetSyncCounts.mockClear();
    mockGetDeadLetterOps.mockClear();

    await act(async () => {
      emitCapturedEvent("sync:op:dead", {
        uid: "other-user",
        kind: "upsert_mymeal",
      });
      await Promise.resolve();
    });

    expect(mockGetSyncCounts).not.toHaveBeenCalled();
    expect(mockGetDeadLetterOps).not.toHaveBeenCalled();
  });

  it("renders ready list state and handles saved meal actions", async () => {
    const navigate = jest.fn<(screen: string, params?: unknown) => void>();
    const toggleShowFilters = jest.fn();
    const setMeal = jest.fn();
    const saveDraft = jest.fn<
      (uid: string, draftOverride?: Meal | null) => Promise<void>
    >(
      async (_uid: string) => undefined,
    );
    const setLastScreen = jest.fn<(uid: string, screen: string) => Promise<void>>(
      async (_uid: string, _screen: string) => undefined,
    );
    const onDelete = jest.fn();
    const getMeals = jest.fn(async () => undefined);
    const refresh = jest.fn();
    const meal = buildMeal();

    mockUseMeals.mockReturnValue({ getMeals });
    mockUseFilters.mockReturnValue({
      query: "",
      setQuery: jest.fn(),
      filters: null,
      showFilters: false,
      toggleShowFilters,
      filterCount: 3,
    });
    mockUseMealDraftContext.mockReturnValue({
      meal: null,
      setMeal,
      saveDraft,
      setLastScreen,
    });
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      loading: false,
      loadingMore: true,
      validating: true,
      errorKind: null,
      dataState: "ready",
      visibleItems: [meal],
      refresh,
      onDelete,
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate } as never} />,
    );

    expect(screen.getByText("search:")).toBeTruthy();
    expect(screen.getByText("filter-badge:3")).toBeTruthy();
    expect(screen.getByText("open:Pasta bake")).toBeTruthy();
    expect(screen.getByText("loading-skeleton:56")).toBeTruthy();
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();

    fireEvent.press(screen.getByText("filter-badge:3"));
    fireEvent.press(screen.getByText("open:Pasta bake"));
    fireEvent.press(screen.getByText("duplicate:Pasta bake"));
    fireEvent.press(screen.getByText("edit:Pasta bake"));
    fireEvent.press(screen.getByText("delete:Pasta bake"));

    expect(toggleShowFilters).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenNthCalledWith(1, "MealDetails", {
      cloudId: "cloud-1",
    });
    expect(onDelete).toHaveBeenCalledWith(meal);

    await waitFor(() => {
      expect(setMeal).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          mealId: "duplicated-meal-id",
          cloudId: undefined,
          savedMealRefId: "cloud-1",
          source: "saved",
          name: "Pasta bake",
          photoUrl: "https://example.com/pasta.jpg",
          ingredients: meal.ingredients,
          userUid: "user-1",
        }),
      );
      expect(saveDraft).toHaveBeenNthCalledWith(
        1,
        "user-1",
        expect.objectContaining({
          mealId: "duplicated-meal-id",
          cloudId: undefined,
          savedMealRefId: "cloud-1",
          source: "saved",
        }),
      );
      expect(setLastScreen).toHaveBeenNthCalledWith(1, "user-1", "ReviewMeal");
      expect(navigate).toHaveBeenNthCalledWith(2, "AddMeal", {
        start: "ReviewMeal",
      });
      expect(setMeal).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          mealId: "edited-meal-id",
          cloudId: undefined,
          savedMealRefId: "cloud-1",
          source: "saved",
          name: "Pasta bake",
          photoUrl: "https://example.com/pasta.jpg",
          ingredients: meal.ingredients,
          userUid: "user-1",
        }),
      );
      expect(saveDraft).toHaveBeenNthCalledWith(
        2,
        "user-1",
        expect.objectContaining({
          mealId: "edited-meal-id",
          cloudId: undefined,
          savedMealRefId: "cloud-1",
          source: "saved",
        }),
      );
      expect(setLastScreen).toHaveBeenNthCalledWith(
        2,
        "user-1",
        "EditMealDetails",
      );
      expect(navigate).toHaveBeenNthCalledWith(3, "AddMeal", {
        start: "EditMealDetails",
        submitIntent: "replaceReview",
      });
    });
  });

  it("does not duplicate or edit when the user is missing", async () => {
    const navigate = jest.fn<(screen: string, params?: unknown) => void>();
    const setMeal = jest.fn();
    const saveDraft = jest.fn<
      (uid: string, draftOverride?: Meal | null) => Promise<void>
    >(
      async (_uid: string) => undefined,
    );
    const setLastScreen = jest.fn<(uid: string, screen: string) => Promise<void>>(
      async (_uid: string, _screen: string) => undefined,
    );
    const meal = buildMeal({ cloudId: undefined });

    mockUseAuthContext.mockReturnValue({ uid: null });
    mockUseMealDraftContext.mockReturnValue({
      meal: buildMeal({ mealId: "existing-draft" }),
      setMeal,
      saveDraft,
      setLastScreen,
    });
    mockUseSavedMealsData.mockReturnValue({
      pageSize: 20,
      loading: false,
      loadingMore: false,
      validating: false,
      errorKind: null,
      dataState: "ready",
      visibleItems: [meal],
      refresh: jest.fn(),
      onDelete: jest.fn(),
      onViewableItemsChanged: { current: jest.fn() },
      viewabilityConfig: {},
    });

    const screen = renderWithTheme(
      <SavedMealsScreen navigation={{ navigate } as never} />,
    );

    fireEvent.press(screen.getByText("duplicate:Pasta bake"));
    fireEvent.press(screen.getByText("edit:Pasta bake"));

    await waitFor(() => {
      expect(setMeal).not.toHaveBeenCalled();
      expect(saveDraft).not.toHaveBeenCalled();
      expect(setLastScreen).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
