/* eslint-disable @typescript-eslint/no-var-requires */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockAddEventListener = jest.fn<
  (listener: (state: { isConnected: boolean }) => void) => () => void
>();
const mockRunPushQueue = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockMealsPull = jest.fn<(...args: unknown[]) => Promise<number>>();
const mockMyMealsPull = jest.fn<(...args: unknown[]) => Promise<number>>();
const mockChatPull = jest.fn<(...args: unknown[]) => Promise<number>>();
const mockSmartMemoryPull = jest.fn<(...args: unknown[]) => Promise<number>>();
const mockProcessImageUploads = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockGetQueuedOpsCount = jest.fn<(...args: unknown[]) => Promise<number>>();
const mockGetPendingUploads = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockGetLastPullTs = jest.fn<(...args: unknown[]) => Promise<string | null>>();
const mockGetLastMyMealsPullTs = jest.fn<
  (...args: unknown[]) => Promise<string | null>
>();
const mockGetLastChatPullTs = jest.fn<(...args: unknown[]) => Promise<number>>();
const mockGetLastSmartMemoryPullTs = jest.fn<
  (...args: unknown[]) => Promise<string | null>
>();
const mockGetLastPullCheckTs = jest.fn<
  (...args: unknown[]) => Promise<string | null>
>();
const mockSetLastPullCheckTs = jest.fn<(...args: unknown[]) => Promise<void>>();
let mockE2EEnabled = false;

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: (...args: []) => mockNetInfoFetch(...args),
    addEventListener: (...args: [(state: { isConnected: boolean }) => void]) =>
      mockAddEventListener(...args),
  },
}));

jest.mock("./sync.push", () => ({
  runPushQueue: (...args: unknown[]) => mockRunPushQueue(...args),
}));

jest.mock("./queue.repo", () => ({
  getQueuedOpsCount: (...args: unknown[]) => mockGetQueuedOpsCount(...args),
}));

jest.mock("./images.repo", () => ({
  getPendingUploads: (...args: unknown[]) => mockGetPendingUploads(...args),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => mockE2EEnabled,
}));

jest.mock("./sync.storage", () => ({
  getLastPullTs: (...args: unknown[]) => mockGetLastPullTs(...args),
  setLastPullTs: jest.fn(),
  getLastMyMealsPullTs: (...args: unknown[]) => mockGetLastMyMealsPullTs(...args),
  setLastMyMealsPullTs: jest.fn(),
  getLastChatPullTs: (...args: unknown[]) => mockGetLastChatPullTs(...args),
  setLastChatPullTs: jest.fn(),
  getLastSmartMemoryPullTs: (...args: unknown[]) =>
    mockGetLastSmartMemoryPullTs(...args),
  setLastSmartMemoryPullTs: jest.fn(),
  getLastPullCheckTs: (...args: unknown[]) => mockGetLastPullCheckTs(...args),
  setLastPullCheckTs: (...args: unknown[]) => mockSetLastPullCheckTs(...args),
}));

jest.mock("./strategies/meals.strategy", () => ({
  mealsStrategy: {
    pull: (...args: unknown[]) => mockMealsPull(...args),
    handlePushOp: jest.fn(async () => false),
  },
}));

jest.mock("./strategies/myMeals.strategy", () => ({
  myMealsStrategy: {
    pull: (...args: unknown[]) => mockMyMealsPull(...args),
    handlePushOp: jest.fn(async () => false),
  },
}));

jest.mock("./strategies/chat.strategy", () => ({
  chatStrategy: {
    pull: (...args: unknown[]) => mockChatPull(...args),
    handlePushOp: jest.fn(async () => false),
  },
}));

jest.mock("./strategies/smartMemory.strategy", () => ({
  smartMemoryStrategy: {
    pull: (...args: unknown[]) => mockSmartMemoryPull(...args),
    handlePushOp: jest.fn(async () => false),
  },
}));

jest.mock("./strategies/userProfile.strategy", () => ({
  userProfileStrategy: {
    pull: jest.fn(async () => 0),
    handlePushOp: jest.fn(async () => false),
  },
}));

jest.mock("./strategies/images.strategy", () => ({
  imagesStrategy: {
    pull: jest.fn(async () => 0),
    handlePushOp: jest.fn(async () => false),
  },
  processImageUploads: (...args: unknown[]) => mockProcessImageUploads(...args),
}));

const flushPromises = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

describe("offline sync.engine selective coordinator", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockE2EEnabled = false;
    jest.useRealTimers();
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-04-28T10:00:00.000Z"));
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockRunPushQueue.mockResolvedValue({
      processed: 0,
      failed: 0,
      deadLettered: 0,
    });
    mockMealsPull.mockResolvedValue(0);
    mockMyMealsPull.mockResolvedValue(0);
    mockChatPull.mockResolvedValue(0);
    mockSmartMemoryPull.mockResolvedValue(0);
    mockProcessImageUploads.mockResolvedValue();
    mockGetQueuedOpsCount.mockResolvedValue(0);
    mockGetPendingUploads.mockResolvedValue([]);
    mockGetLastPullTs.mockResolvedValue("2026-04-28T09:59:00.000Z");
    mockGetLastMyMealsPullTs.mockResolvedValue("2026-04-28T09:59:00.000Z");
    mockGetLastChatPullTs.mockResolvedValue(Date.parse("2026-04-28T09:59:00.000Z"));
    mockGetLastSmartMemoryPullTs.mockResolvedValue("2026-04-28T09:59:00.000Z");
    mockGetLastPullCheckTs.mockResolvedValue("2026-04-28T09:59:00.000Z");
    mockSetLastPullCheckTs.mockResolvedValue();
  });

  it("starts runtime, runs startup reconcile, and stops network subscription", async () => {
    const unsub = jest.fn();
    mockAddEventListener.mockReturnValue(unsub);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { startSyncLoop, stopSyncLoop, getSyncStatus } = require("@/services/offline/sync.engine");

    startSyncLoop("user-1");
    expect(getSyncStatus().hasTimer).toBe(true);
    await flushPromises();

    expect(mockRunPushQueue).not.toHaveBeenCalled();
    expect(mockMealsPull).toHaveBeenCalledWith("user-1");
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
    expect(mockSmartMemoryPull).not.toHaveBeenCalled();

    stopSyncLoop();
    expect(unsub).toHaveBeenCalledTimes(1);
    expect(getSyncStatus()).toEqual({ running: false, hasTimer: false });
  });

  it("schedules reconnect only after a real offline to online transition", async () => {
    let networkListener: (state: { isConnected: boolean }) => void = () => undefined;
    let scheduledReconnect: (() => void) | null = null;
    const setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback: TimerHandler) => {
        scheduledReconnect = callback as () => void;
        return 1 as never;
      });
    mockAddEventListener.mockImplementation((listener) => {
      networkListener = listener;
      return jest.fn();
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { startSyncLoop, stopSyncLoop } = require("@/services/offline/sync.engine");

    startSyncLoop("user-1");
    await flushPromises();
    expect(mockMealsPull).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockRunPushQueue.mockResolvedValue({
      processed: 0,
      failed: 0,
      deadLettered: 0,
    });
    mockMealsPull.mockResolvedValue(0);
    mockMyMealsPull.mockResolvedValue(0);
    mockChatPull.mockResolvedValue(0);
    mockSmartMemoryPull.mockResolvedValue(0);
    mockProcessImageUploads.mockResolvedValue();
    mockGetQueuedOpsCount.mockResolvedValue(0);
    mockGetPendingUploads.mockResolvedValue([]);
    mockGetLastPullCheckTs.mockResolvedValue("2026-04-28T09:59:00.000Z");
    mockSetLastPullCheckTs.mockResolvedValue();

    networkListener({ isConnected: true });
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    networkListener({ isConnected: true });
    networkListener({ isConnected: true });
    networkListener({ isConnected: true });
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    networkListener({ isConnected: false });
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    networkListener({ isConnected: true });
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(scheduledReconnect).not.toBeNull();
    (scheduledReconnect as unknown as () => void)();
    await flushPromises();

    expect(mockRunPushQueue).not.toHaveBeenCalled();
    expect(mockMealsPull).not.toHaveBeenCalled();
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
    expect(mockSmartMemoryPull).not.toHaveBeenCalled();
    stopSyncLoop();
    setTimeoutSpy.mockRestore();
  });

  it("clean reconnect skips empty push and all fresh pulls", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runReconnectReconcile } = require("@/services/offline/sync.engine");

    const result = await runReconnectReconcile("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pushed: null,
        pulled: {},
        skipped: expect.objectContaining({
          push: "clean",
          meals: "clean",
          myMeals: "clean",
          chat: "clean",
          smartMemory: "clean",
        }),
      }),
    );
    expect(mockRunPushQueue).not.toHaveBeenCalled();
    expect(mockMealsPull).not.toHaveBeenCalled();
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
    expect(mockSmartMemoryPull).not.toHaveBeenCalled();
  });

  it("keeps E2E reconcile local-first by pushing but skipping remote pulls", async () => {
    mockE2EEnabled = true;
    mockGetQueuedOpsCount.mockImplementation(async (_uid, options) => {
      if (!options) return 1;
      return 0;
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runReconnectReconcile } = require("@/services/offline/sync.engine");

    const result = await runReconnectReconcile("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pulled: {},
        skipped: expect.objectContaining({
          images: "e2e",
          meals: "e2e",
          myMeals: "e2e",
          chat: "e2e",
          smartMemory: "e2e",
        }),
      }),
    );
    expect(mockRunPushQueue).toHaveBeenCalledTimes(1);
    expect(mockMealsPull).not.toHaveBeenCalled();
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
    expect(mockSmartMemoryPull).not.toHaveBeenCalled();
    expect(mockProcessImageUploads).not.toHaveBeenCalled();
  });

  it("stale reconnect pulls only stale domains", async () => {
    mockGetLastPullCheckTs.mockImplementation(async (_uid, domain) =>
      domain === "meals"
        ? "2026-04-27T09:59:00.000Z"
        : "2026-04-28T09:59:00.000Z",
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runReconnectReconcile } = require("@/services/offline/sync.engine");

    const result = await runReconnectReconcile("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pushed: null,
        pulled: { meals: 0 },
        skipped: expect.objectContaining({
          push: "clean",
          myMeals: "clean",
          chat: "clean",
          smartMemory: "clean",
        }),
      }),
    );
    expect(mockRunPushQueue).not.toHaveBeenCalled();
    expect(mockMealsPull).toHaveBeenCalledTimes(1);
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
    expect(mockSmartMemoryPull).not.toHaveBeenCalled();
  });

  it("coalesces concurrent sync requests so the pending queue pushes once", async () => {
    let releasePush!: () => void;
    mockRunPushQueue.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePush = () =>
            resolve({ processed: 1, failed: 0, deadLettered: 0 });
        }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestSync } = require("@/services/offline/sync.engine");

    const p1 = requestSync({
      uid: "user-1",
      domain: "meals",
      reason: "local-change",
    });
    const p2 = requestSync({
      uid: "user-1",
      domain: "chat",
      reason: "local-change",
    });

    await flushPromises();
    expect(mockRunPushQueue).toHaveBeenCalledTimes(1);

    releasePush();
    await Promise.all([p1, p2]);

    expect(mockRunPushQueue).toHaveBeenCalledTimes(1);
    expect(mockMealsPull).toHaveBeenCalledTimes(1);
    expect(mockChatPull).toHaveBeenCalledTimes(1);
  });

  it("routes meal pulls through the cursor-based meals strategy", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { pullChanges } = require("@/services/offline/sync.engine");

    await pullChanges("user-1");

    expect(mockMealsPull).toHaveBeenCalledTimes(1);
    expect(mockMealsPull).toHaveBeenCalledWith("user-1");
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
  });

  it("routes exported pull and upload helpers through their canonical strategies", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      pullMyMealChanges,
      pullChatChanges,
      pullSmartMemoryChanges,
      processImageUploads,
      pushQueue,
    } = require("@/services/offline/sync.engine");

    await pullMyMealChanges("user-1");
    await pullChatChanges("user-1");
    await pullSmartMemoryChanges("user-1");
    await processImageUploads("user-1");
    await pushQueue("user-1");

    expect(mockMyMealsPull).toHaveBeenCalledWith("user-1");
    expect(mockChatPull).toHaveBeenCalledWith("user-1");
    expect(mockSmartMemoryPull).toHaveBeenCalledWith("user-1");
    expect(mockProcessImageUploads).toHaveBeenCalledWith("user-1");
    expect(mockRunPushQueue).toHaveBeenCalledWith(
      "user-1",
      expect.any(Number),
      expect.any(Array),
    );
  });

  it("does not pull chat after a meal-only change", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestSync } = require("@/services/offline/sync.engine");

    await requestSync({
      uid: "user-1",
      domain: "meals",
      reason: "local-change",
    });

    expect(mockRunPushQueue).toHaveBeenCalledTimes(1);
    expect(mockMealsPull).toHaveBeenCalledTimes(1);
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
  });

  it("routes smart memory local changes through Smart Memory pull after push", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestSync } = require("@/services/offline/sync.engine");

    await requestSync({
      uid: "user-1",
      domain: "smartMemory",
      reason: "local-change",
    });

    expect(mockRunPushQueue).toHaveBeenCalledTimes(1);
    expect(mockSmartMemoryPull).toHaveBeenCalledWith("user-1");
    expect(mockMealsPull).not.toHaveBeenCalled();
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
  });

  it("skips pull after a push-only local change request", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestSync } = require("@/services/offline/sync.engine");

    await requestSync({
      uid: "user-1",
      domain: "meals",
      reason: "local-change",
      pullAfterPush: false,
    });

    expect(mockRunPushQueue).toHaveBeenCalledTimes(1);
    expect(mockMealsPull).not.toHaveBeenCalled();
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
  });

  it("reconnect pushes once and only pulls meal changes for dirty meal queue", async () => {
    mockGetQueuedOpsCount.mockImplementation(async (_uid, options) => {
      if (!options) return 1;
      const kinds = (options as { kinds?: string[] } | undefined)?.kinds ?? [];
      return kinds.includes("upsert") || kinds.includes("delete") ? 1 : 0;
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runReconnectReconcile } = require("@/services/offline/sync.engine");

    const result = await runReconnectReconcile("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pulled: { meals: 0 },
        skipped: expect.objectContaining({
          myMeals: "clean",
          chat: "clean",
        }),
      }),
    );
    expect(mockRunPushQueue).toHaveBeenCalledTimes(1);
    expect(mockMealsPull).toHaveBeenCalledTimes(1);
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
  });

  it("reconnect pushes once and only pulls Smart Memory for dirty Smart Memory queue", async () => {
    mockGetQueuedOpsCount.mockImplementation(async (_uid, options) => {
      if (!options) return 1;
      const kinds = (options as { kinds?: string[] } | undefined)?.kinds ?? [];
      return kinds.includes("smart_memory_item_edit") ||
        kinds.includes("smart_memory_settings_disable")
        ? 1
        : 0;
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runReconnectReconcile } = require("@/services/offline/sync.engine");

    const result = await runReconnectReconcile("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pulled: { smartMemory: 0 },
        skipped: expect.objectContaining({
          meals: "clean",
          myMeals: "clean",
          chat: "clean",
        }),
      }),
    );
    expect(mockRunPushQueue).toHaveBeenCalledTimes(1);
    expect(mockSmartMemoryPull).toHaveBeenCalledTimes(1);
    expect(mockMealsPull).not.toHaveBeenCalled();
    expect(mockMyMealsPull).not.toHaveBeenCalled();
    expect(mockChatPull).not.toHaveBeenCalled();
  });

  it("manual reconcile still pulls meals", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runManualReconcile } = require("@/services/offline/sync.engine");

    const result = await runManualReconcile("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pulled: expect.objectContaining({ meals: 0 }),
      }),
    );
    expect(mockRunPushQueue).not.toHaveBeenCalled();
    expect(mockMealsPull).toHaveBeenCalledTimes(1);
  });

  it("records a successful pull check even when the pull returns no items", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { pullChanges } = require("@/services/offline/sync.engine");

    await pullChanges("user-1");

    expect(mockMealsPull).toHaveBeenCalledTimes(1);
    expect(mockSetLastPullCheckTs).toHaveBeenCalledWith(
      "user-1",
      "meals",
      "2026-04-28T10:00:00.000Z",
    );
  });

  it("does not record a pull check when pull fails", async () => {
    mockMealsPull.mockRejectedValueOnce(new Error("network failed"));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { pullChanges } = require("@/services/offline/sync.engine");

    await expect(pullChanges("user-1")).rejects.toThrow("network failed");
    expect(mockSetLastPullCheckTs).not.toHaveBeenCalled();
  });

  it("rejects requestSync when push reports failed operations", async () => {
    mockRunPushQueue.mockResolvedValueOnce({
      processed: 0,
      failed: 1,
      deadLettered: 0,
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestSync } = require("@/services/offline/sync.engine");

    await expect(
      requestSync({
        uid: "user-1",
        domain: "meals",
        reason: "local-change",
      }),
    ).rejects.toMatchObject({ code: "sync/push-failed" });
    expect(mockMealsPull).not.toHaveBeenCalled();
  });
});
