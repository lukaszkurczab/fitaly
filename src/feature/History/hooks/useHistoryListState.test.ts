import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { useHistoryListState } from "@/feature/History/hooks/useHistoryListState";

const mockUseNetInfo = jest.fn<() => { isConnected: boolean }>();
const mockUseAuthContext = jest.fn<() => { uid: string | null }>();
const mockUsePremiumContext = jest.fn<() => { isPremium: boolean }>();
const mockUseFilters = jest.fn();
const mockUseHistorySectionsData = jest.fn();
const mockGetDeadLetterCount =
  jest.fn<(...args: unknown[]) => Promise<number>>();
const mockGetSyncCounts =
  jest.fn<(...args: unknown[]) => Promise<{ dead: number; pending: number }>>();
const mockGetDeadLetterOps =
  jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockRetryDeadLetterOps =
  jest.fn<(...args: unknown[]) => Promise<number>>();
const mockRequestSync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockEmit = jest.fn<(...args: unknown[]) => void>();
const mockOn = jest.fn<(...args: unknown[]) => () => void>();

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: {
        count?: number;
        operation?: string;
        pending?: number;
        defaultValue?: string;
      },
    ) => {
      if (key === "history.deadLetterTitle") {
        return `${options?.count ?? 0} meal changes need retry.`;
      }
      if (key === "history.deadLetterSubtitleWithLast") {
        return `Retry sends them back to sync. Pending meal changes: ${
          options?.pending ?? 0
        }. Last failed: ${options?.operation ?? ""}.`;
      }
      if (key === "history.deadLetterOperation.upsert") {
        return "meal update";
      }
      return options?.defaultValue ?? key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/PremiumContext", () => ({
  usePremiumContext: () => mockUsePremiumContext(),
}));

jest.mock("@/context/HistoryContext", () => ({
  useFilters: (...args: unknown[]) => mockUseFilters(...args),
}));

jest.mock("@/services/meals/mealService", () => ({
  FREE_WINDOW_DAYS: 30,
}));

jest.mock("@/feature/History/hooks/useHistorySectionsData", () => ({
  useHistorySectionsData: (...args: unknown[]) =>
    mockUseHistorySectionsData(...args),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  getDeadLetterCount: (...args: unknown[]) => mockGetDeadLetterCount(...args),
  getSyncCounts: (...args: unknown[]) => mockGetSyncCounts(...args),
  getDeadLetterOps: (...args: unknown[]) => mockGetDeadLetterOps(...args),
  retryDeadLetterOps: (...args: unknown[]) => mockRetryDeadLetterOps(...args),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (...args: unknown[]) => mockRequestSync(...args),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
  on: (...args: unknown[]) => mockOn(...args),
}));

describe("useHistoryListState dead-letter meal sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUsePremiumContext.mockReturnValue({ isPremium: true });
    mockUseFilters.mockReturnValue({
      query: "",
      setQuery: jest.fn(),
      filters: {},
      showFilters: false,
      toggleShowFilters: jest.fn(),
      filterCount: 0,
    });
    mockUseHistorySectionsData.mockReturnValue({
      loading: false,
      loadingMore: false,
      errorKind: null,
      sections: [],
      dataState: "ready",
      onEndReached: jest.fn(),
      refresh: jest.fn(),
    });
    mockOn.mockReturnValue(jest.fn());
    mockRequestSync.mockResolvedValue();
    mockRetryDeadLetterOps.mockResolvedValue(1);
  });

  it("shows failed meal ops, retries them to pending, and clears the warning after sync", async () => {
    mockGetDeadLetterCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockGetSyncCounts
      .mockResolvedValueOnce({ dead: 1, pending: 0 })
      .mockResolvedValueOnce({ dead: 0, pending: 1 })
      .mockResolvedValueOnce({ dead: 0, pending: 0 });
    mockGetDeadLetterOps
      .mockResolvedValueOnce([{ kind: "upsert" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useHistoryListState({ navigation: { navigate: jest.fn() } as never }),
    );

    await waitFor(() => {
      expect(result.current.deadLetterBanner).toEqual(
        expect.objectContaining({
          title: "1 meal changes need retry.",
          description:
            "Retry sends them back to sync. Pending meal changes: 0. Last failed: meal update.",
        }),
      );
    });

    expect(mockGetDeadLetterCount).toHaveBeenCalledWith("user-1", {
      kinds: ["upsert", "delete", "upsert_mymeal", "delete_mymeal"],
    });
    expect(mockGetSyncCounts).toHaveBeenCalledWith("user-1", {
      kinds: ["upsert", "delete", "upsert_mymeal", "delete_mymeal"],
    });
    expect(mockGetDeadLetterOps).toHaveBeenCalledWith({
      uid: "user-1",
      kinds: ["upsert", "delete", "upsert_mymeal", "delete_mymeal"],
      limit: 1,
    });

    await act(async () => {
      await result.current.retryFailedSyncOps();
    });

    expect(mockRetryDeadLetterOps).toHaveBeenCalledWith({
      uid: "user-1",
      kinds: ["upsert", "delete", "upsert_mymeal", "delete_mymeal"],
    });
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "meals",
      reason: "retry",
    });
    await waitFor(() => {
      expect(result.current.deadLetterBanner).toBeNull();
    });
  });

  it("uses the history namespace empty-state copy without nested key leakage", () => {
    mockUseHistorySectionsData.mockReturnValue({
      loading: false,
      loadingMore: false,
      errorKind: null,
      sections: [],
      dataState: "empty",
      onEndReached: jest.fn(),
      refresh: jest.fn(),
    });

    const { result } = renderHook(() =>
      useHistoryListState({ navigation: { navigate: jest.fn() } as never }),
    );

    expect(result.current.emptyState).toEqual({
      title: "emptyTitle",
      description: "emptyDescription",
    });
  });

  it("uses separate no-results copy for search and filters", () => {
    mockUseHistorySectionsData.mockReturnValue({
      loading: false,
      loadingMore: false,
      errorKind: null,
      sections: [],
      dataState: "empty",
      onEndReached: jest.fn(),
      refresh: jest.fn(),
    });

    mockUseFilters.mockReturnValueOnce({
      query: "salad",
      setQuery: jest.fn(),
      filters: {},
      showFilters: false,
      toggleShowFilters: jest.fn(),
      filterCount: 0,
    });

    const search = renderHook(() =>
      useHistoryListState({ navigation: { navigate: jest.fn() } as never }),
    );

    expect(search.result.current.emptyState).toEqual({
      title: "searchEmptyTitle",
      description: "searchEmptyDescription",
    });

    search.unmount();

    mockUseFilters.mockReturnValueOnce({
      query: "",
      setQuery: jest.fn(),
      filters: { calories: [300, 600] },
      showFilters: false,
      toggleShowFilters: jest.fn(),
      filterCount: 1,
    });

    const filters = renderHook(() =>
      useHistoryListState({ navigation: { navigate: jest.fn() } as never }),
    );

    expect(filters.result.current.emptyState).toEqual({
      title: "filtersEmptyTitle",
      description: "filtersEmptyDescription",
    });
  });
});
