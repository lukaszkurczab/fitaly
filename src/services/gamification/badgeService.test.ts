import {
  clearBadgeRuntime,
  listBadges,
  primeBadges,
  subscribeBadges,
  unlockPremiumBadgesIfEligible,
} from "@/services/gamification/badgeService";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type BadgeListCallback = (badges: Array<{ id: string }>) => void;

const mockGet = jest.fn<(url: string) => Promise<unknown>>();
const mockPost = jest.fn<(url: string, data?: unknown) => Promise<unknown>>();
const mockEmit = jest.fn<(event: string, payload?: unknown) => void>();
const mockOn = jest.fn<(...args: unknown[]) => () => void>();
const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

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

describe("badgeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOn.mockReturnValue(() => undefined);
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue();
  });

  it("lists badges through backend read endpoint", async () => {
    mockGet.mockResolvedValue({
      items: [
        {
          id: "premium_start",
          type: "premium",
          label: "Premium started",
          milestone: "start",
          icon: "⭐",
          color: "#F7A541",
          unlockedAt: 2,
        },
        {
          id: "streak_7",
          type: "streak",
          label: "7 days streak",
          milestone: 7,
          icon: "🔥",
          color: "#5AA469",
          unlockedAt: 1,
        },
      ],
    });

    await expect(listBadges("user-1")).resolves.toEqual([
      expect.objectContaining({ id: "streak_7", unlockedAt: 1 }),
      expect.objectContaining({ id: "premium_start", unlockedAt: 2 }),
    ]);
    expect(mockGet).toHaveBeenCalledWith("/users/me/badges");
    expect(mockSetItem).toHaveBeenCalledWith(
      "badge:list:user-1",
      expect.any(String),
    );
  });

  it("returns cached badges when backend is unavailable", async () => {
    mockGet.mockRejectedValueOnce(new Error("offline"));
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify([
        {
          id: "streak_7",
          type: "streak",
          label: "7",
          milestone: 7,
          icon: "🔥",
          color: "#0f0",
          unlockedAt: 1,
        },
      ]),
    );

    await expect(listBadges("user-1")).resolves.toEqual([
      expect.objectContaining({ id: "streak_7" }),
    ]);
  });

  it("subscribes via event bus and refreshes backend-backed badge list", async () => {
    const off = jest.fn();
    let handler: ((payload?: { uid?: string }) => void) | undefined;
    mockOn.mockImplementation(
      (...args: unknown[]) => {
        const [event, next] = args as [
          string,
          (payload?: { uid?: string }) => void,
        ];
        if (event === "badge:changed") {
          handler = next;
        }
        return off;
      },
    );
    mockGet
      .mockResolvedValueOnce({
        items: [
          {
            id: "streak_7",
            type: "streak",
            label: "7",
            milestone: 7,
            icon: "🔥",
            color: "#0f0",
            unlockedAt: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "premium_start",
            type: "premium",
            label: "Premium",
            milestone: "start",
            icon: "⭐",
            color: "#ff0",
            unlockedAt: 2,
          },
        ],
      });

    const cb = jest.fn<BadgeListCallback>();
    const unsubscribe = subscribeBadges("user-events", cb);
    await flushAsync();

    handler?.({ uid: "user-events" });
    await flushAsync();

    expect(cb).toHaveBeenCalled();
    expect(cb.mock.calls.some((call) => call[0]?.[0]?.id === "streak_7")).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(off).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent badge fetches for the same uid", async () => {
    mockGet.mockResolvedValue({
      items: [
        {
          id: "streak_7",
          type: "streak",
          label: "7",
          milestone: 7,
          icon: "🔥",
          color: "#0f0",
          unlockedAt: 1,
        },
      ],
    });

    const cb1 = jest.fn<BadgeListCallback>();
    const cb2 = jest.fn<BadgeListCallback>();
    const unsubscribe1 = subscribeBadges("user-dedupe", cb1);
    const unsubscribe2 = subscribeBadges("user-dedupe", cb2);

    await flushAsync();
    expect(mockGet).toHaveBeenCalledTimes(1);

    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();

    unsubscribe1();
    unsubscribe2();
  });

  it("fences stale in-flight badge list writes after clearing one uid", async () => {
    const staleUser = createDeferred<unknown>();
    const otherUser = createDeferred<unknown>();
    mockGet
      .mockImplementationOnce(() => staleUser.promise)
      .mockImplementationOnce(() => otherUser.promise);

    const staleRequest = listBadges("user-stale");
    const otherRequest = listBadges("user-other");

    clearBadgeRuntime("user-stale");

    staleUser.resolve({
      items: [
        {
          id: "old_stale",
          type: "streak",
          label: "Old",
          milestone: 3,
          icon: "old",
          color: "#111",
          unlockedAt: 1,
        },
      ],
    });
    otherUser.resolve({
      items: [
        {
          id: "other_ok",
          type: "streak",
          label: "Other",
          milestone: 4,
          icon: "other",
          color: "#222",
          unlockedAt: 2,
        },
      ],
    });

    await expect(staleRequest).resolves.toEqual([
      expect.objectContaining({ id: "old_stale" }),
    ]);
    await expect(otherRequest).resolves.toEqual([
      expect.objectContaining({ id: "other_ok" }),
    ]);

    expect(mockSetItem).not.toHaveBeenCalledWith(
      "badge:list:user-stale",
      expect.any(String),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "badge:list:user-other",
      expect.stringContaining("other_ok"),
    );
  });

  it("does not reuse a cleared badge list in-flight request for later calls", async () => {
    const staleUser = createDeferred<unknown>();
    const nextUser = createDeferred<unknown>();
    mockGet
      .mockImplementationOnce(() => staleUser.promise)
      .mockImplementationOnce(() => nextUser.promise);

    const staleRequest = listBadges("user-reset");
    clearBadgeRuntime("user-reset");
    const nextRequest = listBadges("user-reset");

    expect(mockGet).toHaveBeenCalledTimes(2);

    staleUser.resolve({
      items: [
        {
          id: "old_badge",
          type: "streak",
          label: "Old",
          milestone: 3,
          icon: "old",
          color: "#111",
          unlockedAt: 1,
        },
      ],
    });
    nextUser.resolve({
      items: [
        {
          id: "new_badge",
          type: "streak",
          label: "New",
          milestone: 4,
          icon: "new",
          color: "#222",
          unlockedAt: 2,
        },
      ],
    });

    await expect(staleRequest).resolves.toEqual([
      expect.objectContaining({ id: "old_badge" }),
    ]);
    await expect(nextRequest).resolves.toEqual([
      expect.objectContaining({ id: "new_badge" }),
    ]);

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      "badge:list:user-reset",
      expect.stringContaining("new_badge"),
    );
  });

  it("clears badge stream state for one uid without clearing another uid", async () => {
    mockGet
      .mockResolvedValueOnce({
        items: [
          {
            id: "stale_stream",
            type: "streak",
            label: "Stale",
            milestone: 3,
            icon: "stale",
            color: "#111",
            unlockedAt: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "other_stream",
            type: "streak",
            label: "Other",
            milestone: 4,
            icon: "other",
            color: "#222",
            unlockedAt: 2,
          },
        ],
      });

    await primeBadges("user-stream-stale");
    await primeBadges("user-stream-other");
    clearBadgeRuntime("user-stream-stale");

    const staleCb = jest.fn<BadgeListCallback>();
    const otherCb = jest.fn<BadgeListCallback>();
    const staleUnsubscribe = subscribeBadges("user-stream-stale", staleCb);
    const otherUnsubscribe = subscribeBadges("user-stream-other", otherCb);
    await flushAsync();

    expect(staleCb).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "stale_stream" })]),
    );
    expect(otherCb).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "other_stream" })]),
    );

    staleUnsubscribe();
    otherUnsubscribe();
  });

  it("loads badges at startup and does not refetch on later subscribe", async () => {
    mockGet.mockResolvedValue({
      items: [
        {
          id: "streak_7",
          type: "streak",
          label: "7",
          milestone: 7,
          icon: "🔥",
          color: "#0f0",
          unlockedAt: 1,
        },
      ],
    });

    await primeBadges("user-startup");
    const cb = jest.fn<BadgeListCallback>();
    const unsubscribe = subscribeBadges("user-startup", cb);

    await flushAsync();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "streak_7" })]),
    );

    unsubscribe();
  });

  it("delegates premium badge reconcile to backend", async () => {
    mockPost.mockResolvedValue({
      awardedBadgeIds: ["premium_start"],
      hasPremiumBadge: true,
      updated: true,
    });

    await unlockPremiumBadgesIfEligible("user-1", true);

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/badges/premium/reconcile",
      { isPremium: true },
    );
    expect(mockEmit).toHaveBeenCalledWith("badge:changed", { uid: "user-1" });
  });

  it("deduplicates concurrent premium reconcile calls with same state", async () => {
    mockPost.mockResolvedValue({
      awardedBadgeIds: ["premium_start"],
      hasPremiumBadge: true,
      updated: true,
    });

    const one = unlockPremiumBadgesIfEligible("user-1", true);
    const two = unlockPremiumBadgesIfEligible("user-1", true);

    await Promise.all([one, two]);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith("badge:changed", { uid: "user-1" });
  });

  it("fences stale premium reconcile event emission after clear", async () => {
    const staleReconcile = createDeferred<unknown>();
    mockPost.mockImplementationOnce(() => staleReconcile.promise);

    const request = unlockPremiumBadgesIfEligible("user-premium", true);
    clearBadgeRuntime("user-premium");
    staleReconcile.resolve({
      awardedBadgeIds: ["premium_start"],
      hasPremiumBadge: true,
      updated: true,
    });

    await expect(request).resolves.toBeUndefined();
    expect(mockEmit).not.toHaveBeenCalledWith("badge:changed", {
      uid: "user-premium",
    });
  });

  it("no-ops when uid is missing", async () => {
    await unlockPremiumBadgesIfEligible("", true);

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
