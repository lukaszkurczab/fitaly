import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { SyncStrategy } from "@/services/offline/sync.strategy";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockNextBatch = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockMarkDone = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockBumpAttempts = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockMoveToDeadLetter = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockSetMealSyncStateLocal = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockSetMyMealSyncStateLocal = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockMarkSmartMemoryProjectionSyncFailed = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockEmit = jest.fn();

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: (...args: []) => mockNetInfoFetch(...args) },
}));

jest.mock("@/services/offline/queue.repo", () => ({
  nextBatch: (...args: unknown[]) => mockNextBatch(...args),
  markDone: (...args: unknown[]) => mockMarkDone(...args),
  bumpAttempts: (...args: unknown[]) => mockBumpAttempts(...args),
  moveToDeadLetter: (...args: unknown[]) => mockMoveToDeadLetter(...args),
  MAX_QUEUE_ATTEMPTS: 10,
}));

jest.mock("@/services/offline/meals.repo", () => ({
  setMealSyncStateLocal: (...args: unknown[]) => mockSetMealSyncStateLocal(...args),
}));

jest.mock("@/services/offline/myMeals.repo", () => ({
  setMyMealSyncStateLocal: (...args: unknown[]) => mockSetMyMealSyncStateLocal(...args),
}));

jest.mock("@/services/smartMemory/smartMemoryProjectionRepository", () => ({
  markSmartMemoryProjectionSyncFailed: (...args: unknown[]) =>
    mockMarkSmartMemoryProjectionSyncFailed(...args),
  smartMemoryQueueKinds: () => [
    "smart_memory_candidate_upsert",
    "smart_memory_item_edit",
    "smart_memory_item_mute",
    "smart_memory_item_restore",
    "smart_memory_item_delete",
    "smart_memory_item_source_deleted",
    "smart_memory_settings_disable",
    "smart_memory_settings_enable",
  ],
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

describe("sync.push", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockNextBatch.mockReset();
    mockMarkDone.mockResolvedValue();
    mockBumpAttempts.mockResolvedValue();
    mockMoveToDeadLetter.mockResolvedValue();
    mockSetMealSyncStateLocal.mockResolvedValue();
    mockSetMyMealSyncStateLocal.mockResolvedValue();
    mockMarkSmartMemoryProjectionSyncFailed.mockResolvedValue();
  });

  it("moves unknown ops to dead letter without marking them done", async () => {
    mockNextBatch
      .mockResolvedValueOnce([
        {
          id: 1,
          cloud_id: "x-1",
          user_uid: "user-1",
          kind: "unknown_kind",
          payload: {},
          updated_at: "2026-03-03T12:00:00.000Z",
          attempts: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    const strategy: SyncStrategy = {
      pull: async () => 0,
      handlePushOp: async () => false,
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPushQueue } = require("@/services/offline/sync.push");

    const result = await runPushQueue("user-1", 25, [strategy]);

    expect(result).toEqual({ processed: 0, failed: 1, deadLettered: 1 });
    expect(mockMarkDone).not.toHaveBeenCalledWith(1);
    expect(mockBumpAttempts).not.toHaveBeenCalled();
    expect(mockMoveToDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, kind: "unknown_kind", attempts: 0 }),
      1,
      expect.objectContaining({
        code: "sync/unknown-op",
        message: "Unknown queue operation: unknown_kind",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("sync:op:dead", {
      uid: "user-1",
      opId: 1,
      cloudId: "x-1",
      kind: "unknown_kind",
      attempts: 1,
      code: "sync/unknown-op",
    });
  });

  it("keeps failed upserts pending for diagnostics before dead-lettering them", async () => {
    mockNextBatch
      .mockResolvedValueOnce([
        {
          id: 7,
          cloud_id: "meal-7",
          user_uid: "user-1",
          kind: "upsert",
          payload: {},
          updated_at: "2026-03-03T12:00:00.000Z",
          attempts: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    const strategy: SyncStrategy = {
      pull: async () => 0,
      handlePushOp: async () => {
        throw new Error("temporary outage");
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPushQueue } = require("@/services/offline/sync.push");

    const result = await runPushQueue("user-1", 25, [strategy]);

    expect(result).toEqual({ processed: 0, failed: 1, deadLettered: 0 });
    expect(mockBumpAttempts).toHaveBeenCalledWith(7);
    expect(mockMoveToDeadLetter).not.toHaveBeenCalled();
    expect(mockSetMealSyncStateLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        cloudId: "meal-7",
        syncState: "pending",
        updatedAt: "2026-03-03T12:00:00.000Z",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("meal:failed", {
      uid: "user-1",
      opId: 7,
      cloudId: "meal-7",
      dead: false,
    });
  });

  it("moves poisoned ops to dead letter after max retries", async () => {
    mockNextBatch
      .mockResolvedValueOnce([
        {
          id: 99,
          cloud_id: "meal-99",
          user_uid: "user-1",
          kind: "upsert",
          payload: {},
          updated_at: "2026-03-03T12:00:00.000Z",
          attempts: 9,
        },
      ])
      .mockResolvedValueOnce([]);

    const strategy: SyncStrategy = {
      pull: async () => 0,
      handlePushOp: async () => {
        throw new Error("invalid payload");
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPushQueue } = require("@/services/offline/sync.push");

    const result = await runPushQueue("user-1", 25, [strategy]);

    expect(result).toEqual({ processed: 0, failed: 1, deadLettered: 1 });
    expect(mockMoveToDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, kind: "upsert", attempts: 9 }),
      10,
      expect.objectContaining({ code: "sync/unknown" }),
    );
    expect(mockSetMealSyncStateLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        cloudId: "meal-99",
        syncState: "failed",
      }),
    );
    expect(mockMarkDone).not.toHaveBeenCalledWith(99);
  });

  it("marks Smart Memory failed controls visible without meal failure events", async () => {
    mockNextBatch
      .mockResolvedValueOnce([
        {
          id: 17,
          client_mutation_id: "smart-memory:mute:user-1:memory-1:uuid",
          cloud_id: "memory-1",
          user_uid: "user-1",
          kind: "smart_memory_item_mute",
          payload: {},
          updated_at: "2026-06-04T12:00:00.000Z",
          attempts: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    const strategy: SyncStrategy = {
      pull: async () => 0,
      handlePushOp: async () => {
        throw new Error("temporary outage");
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPushQueue } = require("@/services/offline/sync.push");

    const result = await runPushQueue("user-1", 25, [strategy]);

    expect(result).toEqual({ processed: 0, failed: 1, deadLettered: 0 });
    expect(mockMarkSmartMemoryProjectionSyncFailed).toHaveBeenCalledWith({
      uid: "user-1",
      op: expect.objectContaining({ id: 17, kind: "smart_memory_item_mute" }),
      dead: false,
      code: "sync/unknown",
      message: "temporary outage",
    });
    expect(mockEmit).toHaveBeenCalledWith("smart-memory:failed", {
      uid: "user-1",
      opId: 17,
      cloudId: "memory-1",
      kind: "smart_memory_item_mute",
      dead: false,
    });
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:failed",
      expect.objectContaining({ opId: 17 }),
    );
  });

  it("marks Smart Memory dead-letter controls visible", async () => {
    mockNextBatch
      .mockResolvedValueOnce([
        {
          id: 18,
          client_mutation_id: "smart-memory:delete:user-1:memory-1:uuid",
          cloud_id: "memory-1",
          user_uid: "user-1",
          kind: "smart_memory_item_delete",
          payload: {},
          updated_at: "2026-06-04T12:00:00.000Z",
          attempts: 9,
        },
      ])
      .mockResolvedValueOnce([]);

    const strategy: SyncStrategy = {
      pull: async () => 0,
      handlePushOp: async () => {
        throw new Error("invalid payload");
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPushQueue } = require("@/services/offline/sync.push");

    const result = await runPushQueue("user-1", 25, [strategy]);

    expect(result).toEqual({ processed: 0, failed: 1, deadLettered: 1 });
    expect(mockMoveToDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 18, kind: "smart_memory_item_delete" }),
      10,
      expect.objectContaining({ code: "sync/unknown" }),
    );
    expect(mockMarkSmartMemoryProjectionSyncFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        dead: true,
      }),
    );
  });
});
