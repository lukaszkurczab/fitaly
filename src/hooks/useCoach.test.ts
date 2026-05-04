import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { emit } from "@/services/core/events";
import type { CoachResult } from "@/services/coach/coachTypes";
import { createFallbackCoachResponse } from "@/services/coach/coachService";
import { useCoach } from "@/hooks/useCoach";

const COACH_MUTATION_REFRESH_DELAY_MS = 1_000;

const mockGetCoach = jest.fn<
  (uid: string | null | undefined, options?: { dayKey?: string | null; force?: boolean }) => Promise<CoachResult>
>();
const mockRefreshCoach = jest.fn<
  (uid: string | null | undefined, options?: { dayKey?: string | null }) => Promise<CoachResult>
>();
const mockInvalidateCoachCache = jest.fn<
  (uid: string | null | undefined, options?: { dayKey?: string | null }) => Promise<void>
>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

jest.mock("@/services/coach/coachService", () => {
  const actual =
    jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");
  return {
    ...actual,
    getCoach: (
      uid: string | null | undefined,
      options?: { dayKey?: string | null; force?: boolean },
    ) => mockGetCoach(uid, options),
    refreshCoach: (
      uid: string | null | undefined,
      options?: { dayKey?: string | null },
    ) => mockRefreshCoach(uid, options),
    invalidateCoachCache: (
      uid: string | null | undefined,
      options?: { dayKey?: string | null },
    ) => mockInvalidateCoachCache(uid, options),
  };
});

describe("useCoach", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockInvalidateCoachCache.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("loads coach data for the requested uid and day", async () => {
    const remoteCoach = createFallbackCoachResponse("2026-03-18");
    remoteCoach.meta.available = true;
    remoteCoach.meta.emptyReason = "no_data";

    mockGetCoach.mockResolvedValue({
      coach: remoteCoach,
      source: "remote",
      status: "live_success",
      enabled: true,
      isStale: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useCoach({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetCoach).toHaveBeenCalledWith("user-1", { dayKey: "2026-03-18" });
    expect(result.current.coach.meta.available).toBe(true);
    expect(result.current.source).toBe("remote");
    expect(result.current.status).toBe("live_success");
    expect(result.current.enabled).toBe(true);
  });

  it("returns a stable fallback when uid is missing and skips the service", async () => {
    const { result } = renderHook(() => useCoach({ uid: null }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetCoach).not.toHaveBeenCalled();
    expect(result.current.source).toBe("fallback");
    expect(result.current.status).toBe("no_user");
    expect(result.current.isStale).toBe(true);
    expect(result.current.coach.topInsight).toBeNull();
  });

  it("does not request coach data when inactive", async () => {
    const { result } = renderHook(() =>
      useCoach({ uid: "user-1", dayKey: "2026-03-18", active: false }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetCoach).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
    expect(result.current.source).toBe("disabled");
    expect(result.current.status).toBe("disabled");

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockRefreshCoach).not.toHaveBeenCalled();
    expect(result.current.coach.dayKey).toBe("2026-03-18");
  });

  it("exposes service fallback when coach endpoint is unavailable", async () => {
    mockGetCoach.mockResolvedValue({
      coach: createFallbackCoachResponse("2026-03-18"),
      source: "fallback",
      status: "service_unavailable",
      enabled: true,
      isStale: true,
      error: new Error("backend down"),
    });

    const { result } = renderHook(() =>
      useCoach({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.enabled).toBe(true);
    expect(result.current.source).toBe("fallback");
    expect(result.current.status).toBe("service_unavailable");
  });

  it("keeps coach fallback stable on failure and supports explicit refresh", async () => {
    const fallbackCoach = createFallbackCoachResponse("2026-03-18");
    fallbackCoach.meta.available = true;
    fallbackCoach.meta.emptyReason = "insufficient_data";

    const refreshedCoach = createFallbackCoachResponse("2026-03-18");
    refreshedCoach.meta.available = true;
    refreshedCoach.topInsight = {
      id: "2026-03-18:under_logging",
      type: "under_logging",
      priority: 100,
      title: "Logging looks too light to coach well",
      body: "Log your next meal so today is easier to interpret and adjust.",
      actionLabel: "Log next meal",
      actionType: "log_next_meal",
      reasonCodes: ["valid_logging_days_7_low"],
      source: "rules",
      validUntil: "2026-03-18T23:59:59Z",
      confidence: 0.92,
      isPositive: false,
    };
    refreshedCoach.insights = [refreshedCoach.topInsight];

    mockGetCoach.mockResolvedValue({
      coach: fallbackCoach,
      source: "storage",
      status: "stale_cache",
      enabled: true,
      isStale: true,
      error: new Error("backend down"),
    });
    mockRefreshCoach.mockResolvedValue({
      coach: refreshedCoach,
      source: "remote",
      status: "live_success",
      enabled: true,
      isStale: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useCoach({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.coach.meta.emptyReason).toBe("insufficient_data");
    expect(result.current.source).toBe("storage");
    expect(result.current.status).toBe("stale_cache");
    expect(result.current.error).toEqual(expect.any(Error));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockRefreshCoach).toHaveBeenCalledWith("user-1", { dayKey: "2026-03-18" });
    await waitFor(() => {
      expect(result.current.coach.topInsight?.type).toBe("under_logging");
    });
    expect(result.current.source).toBe("remote");
    expect(result.current.status).toBe("live_success");
    expect(result.current.isStale).toBe(false);
  });

  it("surfaces service unavailable distinctly when no live or cached coach payload exists", async () => {
    mockGetCoach.mockResolvedValue({
      coach: createFallbackCoachResponse("2026-03-18"),
      source: "fallback",
      status: "service_unavailable",
      enabled: true,
      isStale: true,
      error: new Error("backend down"),
    });

    const { result } = renderHook(() =>
      useCoach({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.source).toBe("fallback");
    expect(result.current.status).toBe("service_unavailable");
    expect(result.current.coach.meta.available).toBe(false);
    expect(result.current.error).toEqual(expect.any(Error));
  });

  it("invalidates and refreshes coach after a meal mutation for the same user", async () => {
    jest.useFakeTimers();
    const initialCoach = createFallbackCoachResponse("2026-03-18");
    initialCoach.meta.available = true;

    const refreshedCoach = createFallbackCoachResponse("2026-03-18");
    refreshedCoach.meta.available = true;
    refreshedCoach.topInsight = {
      id: "2026-03-18:under_logging",
      type: "under_logging",
      priority: 100,
      title: "Logging looks too light to coach well",
      body: "Log your next meal so today is easier to interpret and adjust.",
      actionLabel: "Log next meal",
      actionType: "log_next_meal",
      reasonCodes: ["valid_logging_days_7_low"],
      source: "rules",
      validUntil: "2026-03-18T23:59:59Z",
      confidence: 0.92,
      isPositive: false,
    };
    refreshedCoach.insights = [refreshedCoach.topInsight];

    mockGetCoach.mockResolvedValue({
      coach: initialCoach,
      source: "remote",
      status: "live_success",
      enabled: true,
      isStale: false,
      error: null,
    });
    mockRefreshCoach.mockResolvedValue({
      coach: refreshedCoach,
      source: "remote",
      status: "live_success",
      enabled: true,
      isStale: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useCoach({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      emit("meal:added", { uid: "user-1" });
    });

    expect(mockInvalidateCoachCache).not.toHaveBeenCalled();
    expect(mockRefreshCoach).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(COACH_MUTATION_REFRESH_DELAY_MS);
    });

    await waitFor(() => {
      expect(mockInvalidateCoachCache).toHaveBeenCalledWith("user-1", {
        dayKey: "2026-03-18",
      });
    });
    expect(mockRefreshCoach).toHaveBeenCalledWith("user-1", {
      dayKey: "2026-03-18",
    });
    await waitFor(() => {
      expect(result.current.coach.topInsight?.type).toBe("under_logging");
    });
  });

  it("invalidates and refreshes coach after a committed meal delete for the same user", async () => {
    jest.useFakeTimers();
    const initialCoach = createFallbackCoachResponse("2026-03-18");
    initialCoach.meta.available = true;

    const refreshedCoach = createFallbackCoachResponse("2026-03-18");
    refreshedCoach.meta.available = true;
    refreshedCoach.topInsight = {
      id: "2026-03-18:post-delete",
      type: "under_logging",
      priority: 100,
      title: "Meal removed",
      body: "Refresh after delete.",
      actionLabel: "Log next meal",
      actionType: "log_next_meal",
      reasonCodes: ["delete"],
      source: "rules",
      validUntil: "2026-03-18T23:59:59Z",
      confidence: 0.92,
      isPositive: false,
    };
    refreshedCoach.insights = [refreshedCoach.topInsight];

    mockGetCoach.mockResolvedValue({
      coach: initialCoach,
      source: "remote",
      status: "live_success",
      enabled: true,
      isStale: false,
      error: null,
    });
    mockRefreshCoach.mockResolvedValue({
      coach: refreshedCoach,
      source: "remote",
      status: "live_success",
      enabled: true,
      isStale: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useCoach({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      emit("meal:delete:committed", { uid: "user-1", cloudId: "meal-1" });
    });

    await act(async () => {
      jest.advanceTimersByTime(COACH_MUTATION_REFRESH_DELAY_MS);
    });

    await waitFor(() => {
      expect(mockInvalidateCoachCache).toHaveBeenCalledWith("user-1", {
        dayKey: "2026-03-18",
      });
    });
    expect(mockRefreshCoach).toHaveBeenCalledWith("user-1", {
      dayKey: "2026-03-18",
    });
    await waitFor(() => {
      expect(result.current.coach.topInsight?.title).toBe("Meal removed");
    });
  });

  it("ignores stale coach loads after day changes", async () => {
    const firstCoach = createFallbackCoachResponse("2026-03-18");
    firstCoach.meta.available = true;
    firstCoach.topInsight = {
      id: "stale",
      type: "under_logging",
      priority: 100,
      title: "Stale",
      body: "Stale result",
      actionLabel: "Log next meal",
      actionType: "log_next_meal",
      reasonCodes: ["stale"],
      source: "rules",
      validUntil: "2026-03-18T23:59:59Z",
      confidence: 0.6,
      isPositive: false,
    };
    firstCoach.insights = [firstCoach.topInsight];

    const secondCoach = createFallbackCoachResponse("2026-03-19");
    secondCoach.meta.available = true;
    secondCoach.topInsight = {
      id: "fresh",
      type: "stable",
      priority: 50,
      title: "Fresh",
      body: "Fresh result",
      actionLabel: null,
      actionType: "none",
      reasonCodes: ["fresh"],
      source: "rules",
      validUntil: "2026-03-19T23:59:59Z",
      confidence: 0.9,
      isPositive: true,
    };
    secondCoach.insights = [secondCoach.topInsight];

    const firstRequest = deferred<CoachResult>();
    const secondRequest = deferred<CoachResult>();
    mockGetCoach
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({ dayKey }: { dayKey: string }) => useCoach({ uid: "user-1", dayKey }),
      {
        initialProps: { dayKey: "2026-03-18" },
      },
    );

    rerender({ dayKey: "2026-03-19" });

    await act(async () => {
      secondRequest.resolve({
        coach: secondCoach,
        source: "remote",
        status: "live_success",
        enabled: true,
        isStale: false,
        error: null,
      });
      await secondRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.coach.dayKey).toBe("2026-03-19");
      expect(result.current.coach.topInsight?.title).toBe("Fresh");
    });

    await act(async () => {
      firstRequest.resolve({
        coach: firstCoach,
        source: "remote",
        status: "live_success",
        enabled: true,
        isStale: false,
        error: null,
      });
      await firstRequest.promise;
    });

    expect(result.current.coach.dayKey).toBe("2026-03-19");
    expect(result.current.coach.topInsight?.title).toBe("Fresh");
  });

  it("coalesces three quick meal mutation events into one invalidate and refresh", async () => {
    jest.useFakeTimers();
    const initialCoach = createFallbackCoachResponse("2026-03-18");
    initialCoach.meta.available = true;

    const refreshedCoach = createFallbackCoachResponse("2026-03-18");
    refreshedCoach.meta.available = true;

    mockGetCoach.mockResolvedValue({
      coach: initialCoach,
      source: "remote",
      status: "live_success",
      enabled: true,
      isStale: false,
      error: null,
    });
    mockRefreshCoach.mockResolvedValue({
      coach: refreshedCoach,
      source: "remote",
      status: "live_success",
      enabled: true,
      isStale: false,
      error: null,
    });

    renderHook(() => useCoach({ uid: "user-1", dayKey: "2026-03-18" }));

    await waitFor(() => {
      expect(mockGetCoach).toHaveBeenCalledWith("user-1", { dayKey: "2026-03-18" });
    });

    act(() => {
      emit("meal:added", { uid: "user-1" });
      emit("meal:updated", { uid: "user-1" });
      emit("meal:delete:committed", { uid: "user-1", cloudId: "meal-1" });
    });

    await act(async () => {
      jest.advanceTimersByTime(COACH_MUTATION_REFRESH_DELAY_MS - 1);
    });

    expect(mockInvalidateCoachCache).not.toHaveBeenCalled();
    expect(mockRefreshCoach).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(mockInvalidateCoachCache).toHaveBeenCalledTimes(1);
      expect(mockRefreshCoach).toHaveBeenCalledTimes(1);
    });
    expect(mockInvalidateCoachCache).toHaveBeenCalledWith("user-1", {
      dayKey: "2026-03-18",
    });
    expect(mockRefreshCoach).toHaveBeenCalledWith("user-1", {
      dayKey: "2026-03-18",
    });
  });

  it("clears pending mutation refresh when dayKey changes", async () => {
    jest.useFakeTimers();
    const dayOneCoach = createFallbackCoachResponse("2026-03-18");
    dayOneCoach.meta.available = true;

    const dayTwoCoach = createFallbackCoachResponse("2026-03-19");
    dayTwoCoach.meta.available = true;

    mockGetCoach
      .mockResolvedValueOnce({
        coach: dayOneCoach,
        source: "remote",
        status: "live_success",
        enabled: true,
        isStale: false,
        error: null,
      })
      .mockResolvedValueOnce({
        coach: dayTwoCoach,
        source: "remote",
        status: "live_success",
        enabled: true,
        isStale: false,
        error: null,
      });

    const { rerender } = renderHook(
      ({ dayKey }: { dayKey: string }) => useCoach({ uid: "user-1", dayKey }),
      {
        initialProps: { dayKey: "2026-03-18" },
      },
    );

    await waitFor(() => {
      expect(mockGetCoach).toHaveBeenCalledWith("user-1", { dayKey: "2026-03-18" });
    });

    act(() => {
      emit("meal:added", { uid: "user-1" });
    });

    rerender({ dayKey: "2026-03-19" });

    await waitFor(() => {
      expect(mockGetCoach).toHaveBeenCalledWith("user-1", { dayKey: "2026-03-19" });
    });

    await act(async () => {
      jest.advanceTimersByTime(COACH_MUTATION_REFRESH_DELAY_MS);
    });

    expect(mockInvalidateCoachCache).not.toHaveBeenCalled();
    expect(mockRefreshCoach).not.toHaveBeenCalled();
  });
});
