import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGet = jest.fn<(url: string) => Promise<unknown>>();
const mockPost = jest.fn<(url: string, data?: unknown) => Promise<unknown>>();
const mockEmit = jest.fn<(event: string, payload?: unknown) => void>();
const mockOn = jest.fn<(...args: unknown[]) => () => void>();
const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();

jest.mock("@/services/core/apiClient", () => ({
  get: (url: string) => mockGet(url),
  post: (url: string, data?: unknown) => mockPost(url, data),
}));

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload?: unknown) => mockEmit(event, payload),
  on: (...args: unknown[]) => mockOn(...args),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const streakService = require("@/services/gamification/streakService") as typeof import("@/services/gamification/streakService");
const {
  clearStreakRuntime,
  ensureStreakDoc,
  getStreak,
  refreshStreakFromBackend,
  resetIfMissed,
  subscribeStreak,
  updateStreakIfThresholdMet,
} = streakService;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("streakService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockOn.mockReturnValue(() => undefined);
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue();
  });

  it("delegates ensure and reset writes to backend streak endpoints", async () => {
    mockPost.mockResolvedValue({
      current: 0,
      lastDate: null,
      awardedBadgeIds: [],
    });

    await expect(ensureStreakDoc("user-1")).resolves.toEqual({
      current: 0,
      lastDate: null,
    });
    await expect(
      resetIfMissed("user-1", new Date("2026-03-03T12:00:00.000Z"))
    ).resolves.toEqual({
      current: 0,
      lastDate: null,
    });

    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      "/users/me/streak/ensure",
      { dayKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      "/users/me/streak/reset-if-missed",
      { dayKey: "2026-03-03" }
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "streak:last:user-1",
      JSON.stringify({ current: 0, lastDate: null }),
    );
    expect(mockEmit).toHaveBeenNthCalledWith(
      1,
      "streak:changed",
      { uid: "user-1", streak: { current: 0, lastDate: null } },
    );
  });

  it("delegates streak threshold recalculation to backend", async () => {
    mockPost.mockResolvedValue({
      current: 7,
      lastDate: "2026-03-03",
      awardedBadgeIds: ["streak_7"],
    });

    await expect(
      updateStreakIfThresholdMet({
        uid: "user-1",
        todaysKcal: 1600,
        targetKcal: 2000,
        thresholdPct: 0.8,
        now: new Date("2026-03-03T18:00:00.000Z"),
      })
    ).resolves.toEqual({
      current: 7,
      lastDate: "2026-03-03",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/streak/recalculate",
      {
        dayKey: "2026-03-03",
        todaysKcal: 1600,
        targetKcal: 2000,
        thresholdPct: 0.8,
      }
    );
    expect(mockEmit).toHaveBeenCalledWith(
      "badge:changed",
      { uid: "user-1", awardedBadgeIds: ["streak_7"] },
    );
  });

  it("reads streak from backend and falls back to cached streak on API failure", async () => {
    mockGet
      .mockResolvedValueOnce({
        current: 4,
        lastDate: "2026-03-03",
        awardedBadgeIds: [],
      })
      .mockRejectedValueOnce(new Error("backend down"));
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({ current: 2, lastDate: "2026-03-02" }),
    );

    await expect(getStreak("user-1")).resolves.toEqual({
      current: 4,
      lastDate: "2026-03-03",
    });
    await expect(getStreak("user-1")).resolves.toEqual({
      current: 2,
      lastDate: "2026-03-02",
    });

    expect(mockGet).toHaveBeenNthCalledWith(1, "/users/me/streak");
    expect(mockGet).toHaveBeenNthCalledWith(2, "/users/me/streak");
  });

  it("deduplicates concurrent getStreak requests for the same uid", async () => {
    mockGet.mockResolvedValue({
      current: 5,
      lastDate: "2026-03-04",
      awardedBadgeIds: [],
    });

    const one = getStreak("user-1");
    const two = getStreak("user-1");

    await expect(Promise.all([one, two])).resolves.toEqual([
      { current: 5, lastDate: "2026-03-04" },
      { current: 5, lastDate: "2026-03-04" },
    ]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("fences stale in-flight getStreak writes after clearing one uid", async () => {
    const staleUser = createDeferred<unknown>();
    const otherUser = createDeferred<unknown>();
    mockGet
      .mockImplementationOnce(() => staleUser.promise)
      .mockImplementationOnce(() => otherUser.promise);

    const staleRequest = getStreak("user-stale");
    const otherRequest = getStreak("user-other");

    clearStreakRuntime("user-stale");

    staleUser.resolve({
      current: 8,
      lastDate: "2026-03-08",
      awardedBadgeIds: [],
    });
    otherUser.resolve({
      current: 3,
      lastDate: "2026-03-03",
      awardedBadgeIds: [],
    });

    await expect(staleRequest).resolves.toEqual({
      current: 8,
      lastDate: "2026-03-08",
    });
    await expect(otherRequest).resolves.toEqual({
      current: 3,
      lastDate: "2026-03-03",
    });

    expect(mockSetItem).not.toHaveBeenCalledWith(
      "streak:last:user-stale",
      expect.any(String),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "streak:last:user-other",
      JSON.stringify({ current: 3, lastDate: "2026-03-03" }),
    );
  });

  it("does not reuse a cleared getStreak in-flight request for later calls", async () => {
    const staleUser = createDeferred<unknown>();
    const nextUser = createDeferred<unknown>();
    mockGet
      .mockImplementationOnce(() => staleUser.promise)
      .mockImplementationOnce(() => nextUser.promise);

    const staleRequest = getStreak("user-reset");
    clearStreakRuntime("user-reset");
    const nextRequest = getStreak("user-reset");

    expect(mockGet).toHaveBeenCalledTimes(2);

    staleUser.resolve({
      current: 6,
      lastDate: "2026-03-06",
      awardedBadgeIds: [],
    });
    nextUser.resolve({
      current: 1,
      lastDate: "2026-03-01",
      awardedBadgeIds: [],
    });

    await expect(staleRequest).resolves.toEqual({
      current: 6,
      lastDate: "2026-03-06",
    });
    await expect(nextRequest).resolves.toEqual({
      current: 1,
      lastDate: "2026-03-01",
    });

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      "streak:last:user-reset",
      JSON.stringify({ current: 1, lastDate: "2026-03-01" }),
    );
  });

  it("does not emit stale refresh completion after clear invalidates the uid", async () => {
    const staleRefresh = createDeferred<unknown>();
    mockGet.mockImplementationOnce(() => staleRefresh.promise);

    const request = refreshStreakFromBackend("user-refresh-stale", {
      refreshBadges: true,
    });

    clearStreakRuntime("user-refresh-stale");
    staleRefresh.resolve({
      current: 9,
      lastDate: "2026-03-09",
      awardedBadgeIds: [],
    });

    await expect(request).resolves.toEqual({
      current: 9,
      lastDate: "2026-03-09",
    });
    expect(mockEmit).not.toHaveBeenCalledWith(
      "streak:changed",
      expect.objectContaining({ uid: "user-refresh-stale" }),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "badge:changed",
      expect.objectContaining({ uid: "user-refresh-stale" }),
    );
  });

  it("emits current-generation refresh streak and badge changes", async () => {
    mockGet.mockResolvedValueOnce({
      current: 4,
      lastDate: "2026-03-04",
      awardedBadgeIds: [],
    });

    await expect(
      refreshStreakFromBackend("user-refresh-current", {
        refreshBadges: true,
      }),
    ).resolves.toEqual({
      current: 4,
      lastDate: "2026-03-04",
    });

    expect(mockEmit).toHaveBeenCalledWith("streak:changed", {
      uid: "user-refresh-current",
      streak: { current: 4, lastDate: "2026-03-04" },
    });
    expect(mockEmit).toHaveBeenCalledWith("badge:changed", {
      uid: "user-refresh-current",
    });
  });

  it("fences stale streak mutation writes and badge emissions after clear", async () => {
    const staleMutation = createDeferred<unknown>();
    mockPost.mockImplementationOnce(() => staleMutation.promise);

    const request = updateStreakIfThresholdMet({
      uid: "user-mutation",
      todaysKcal: 1600,
      targetKcal: 2000,
      now: new Date("2026-03-08T12:00:00.000Z"),
    });

    clearStreakRuntime("user-mutation");
    staleMutation.resolve({
      current: 7,
      lastDate: "2026-03-08",
      awardedBadgeIds: ["streak_7"],
    });

    await expect(request).resolves.toEqual({
      current: 7,
      lastDate: "2026-03-08",
    });
    expect(mockSetItem).not.toHaveBeenCalledWith(
      "streak:last:user-mutation",
      expect.any(String),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "badge:changed",
      expect.objectContaining({ uid: "user-mutation" }),
    );
  });

  it("subscribes through event bus and refreshes streak state", async () => {
    const off = jest.fn();
    let handler:
      | ((payload?: { uid?: string; streak?: { current?: number; lastDate?: string | null } }) => void)
      | undefined;
    mockOn.mockImplementation(
      (...args: unknown[]) => {
        const [event, next] = args as [
          string,
          (payload?: {
            uid?: string;
            streak?: { current?: number; lastDate?: string | null };
          }) => void,
        ];
        if (event === "streak:changed") {
          handler = next;
        }
        return off;
      },
    );
    mockGet.mockResolvedValueOnce({
      current: 3,
      lastDate: "2026-03-02",
      awardedBadgeIds: [],
    });

    const cb = jest.fn();
    const unsubscribe = subscribeStreak("user-1", cb);
    await Promise.resolve();
    await Promise.resolve();

    handler?.({
      uid: "user-1",
      streak: { current: 4, lastDate: "2026-03-03" },
    });
    await Promise.resolve();

    expect(cb).toHaveBeenCalled();
    expect(cb.mock.calls.at(-1)?.[0]).toEqual({
      current: 4,
      lastDate: "2026-03-03",
    });

    unsubscribe();
    expect(off).toHaveBeenCalled();
  });
});
