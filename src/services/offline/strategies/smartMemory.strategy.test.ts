import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockFetchItems = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetchCandidates = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetchSettings = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpsertCandidateRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockEditItemRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockMuteItemRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRestoreItemRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockDeleteItemRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockMarkSourceDeletedRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpdateSettingsRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockReplaceItems = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockReplaceCandidates = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUpsertItem = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUpsertCandidate = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUpsertSettings = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockSetLastSmartMemoryPullTs = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockRuntimeConfig = {
  apiVersion: "v1",
  foodLibraryEnabled: true,
  smartMemoryEnabled: true,
  knownPatternsEnabled: true,
  recipeCatalogEnabled: true,
  planningEnabled: true,
  homeNextActionEnabled: true,
};

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: (...args: []) => mockNetInfoFetch(...args) },
}));

jest.mock("@/services/smartMemory/smartMemoryApi", () => ({
  fetchSmartMemoryItemsRemote: (...args: unknown[]) => mockFetchItems(...args),
  fetchSmartMemoryCandidatesRemote: (...args: unknown[]) =>
    mockFetchCandidates(...args),
  fetchSmartMemorySettingsRemote: (...args: unknown[]) =>
    mockFetchSettings(...args),
  upsertSmartMemoryCandidateRemote: (...args: unknown[]) =>
    mockUpsertCandidateRemote(...args),
  editSmartMemoryItemRemote: (...args: unknown[]) => mockEditItemRemote(...args),
  muteSmartMemoryItemRemote: (...args: unknown[]) => mockMuteItemRemote(...args),
  restoreSmartMemoryItemRemote: (...args: unknown[]) =>
    mockRestoreItemRemote(...args),
  deleteSmartMemoryItemRemote: (...args: unknown[]) =>
    mockDeleteItemRemote(...args),
  markSmartMemoryItemSourceDeletedRemote: (...args: unknown[]) =>
    mockMarkSourceDeletedRemote(...args),
  updateSmartMemorySettingsRemote: (...args: unknown[]) =>
    mockUpdateSettingsRemote(...args),
}));

jest.mock("@/services/smartMemory/smartMemoryProjectionRepository", () => ({
  replaceSmartMemoryItemsProjection: (...args: unknown[]) =>
    mockReplaceItems(...args),
  replaceSmartMemoryCandidatesProjection: (...args: unknown[]) =>
    mockReplaceCandidates(...args),
  upsertSmartMemoryCandidateProjection: (...args: unknown[]) =>
    mockUpsertCandidate(...args),
  upsertSmartMemoryItemProjection: (...args: unknown[]) => mockUpsertItem(...args),
  upsertSmartMemorySettingsProjection: (...args: unknown[]) =>
    mockUpsertSettings(...args),
}));

jest.mock("@/services/offline/sync.storage", () => ({
  setLastSmartMemoryPullTs: (...args: unknown[]) =>
    mockSetLastSmartMemoryPullTs(...args),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockRuntimeConfig,
}));

const item = {
  memoryItemId: "memory-1",
  ownerUserId: "user-1",
  schemaVersion: 1,
  memoryType: "typical_portion",
  state: "active",
  subject: {},
  userValue: {},
  evidenceSummary: {},
  sourceRefs: [],
  threshold: {},
  confidence: {},
  confidenceReasonCodes: [],
  control: {},
  createdAt: "2026-06-04T09:00:00.000Z",
  updatedAt: "2026-06-04T10:00:00.000Z",
  serverRevision: 1,
};

const candidate = {
  candidateId: "candidate-1",
  ownerUserId: "user-1",
  schemaVersion: 1,
  memoryType: "review_correction",
  state: "candidate",
  subject: {},
  evidenceSummary: {},
  sourceRefs: [],
  confidenceReasonCodes: [],
  suppressionChecks: {},
  createdAt: "2026-06-04T09:00:00.000Z",
  updatedAt: "2026-06-04T10:00:00.000Z",
  serverRevision: 1,
};

const settings = {
  ownerUserId: "user-1",
  enabled: true,
  disabledAt: null,
  updatedAt: "2026-06-04T10:00:00.000Z",
  serverRevision: 1,
};

describe("smartMemoryStrategy", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockFetchItems.mockResolvedValue({ items: [item] });
    mockFetchCandidates.mockResolvedValue({ items: [candidate] });
    mockFetchSettings.mockResolvedValue({ settings, updated: false });
    mockUpsertCandidateRemote.mockResolvedValue({ candidate, updated: true });
    mockEditItemRemote.mockResolvedValue({ item, updated: true });
    mockMuteItemRemote.mockResolvedValue({
      item: { ...item, state: "muted", stateReason: "user_muted" },
      updated: true,
    });
    mockRestoreItemRemote.mockResolvedValue({
      item: { ...item, state: "active", stateReason: "user_restored" },
      updated: true,
    });
    mockDeleteItemRemote.mockResolvedValue({
      item: { ...item, state: "deleted_suppressed", stateReason: "user_deleted" },
      updated: true,
    });
    mockMarkSourceDeletedRemote.mockResolvedValue({
      item: { ...item, state: "source_deleted", sourceDeletedAt: "2026-06-04T10:12:00.000Z" },
      updated: true,
    });
    mockUpdateSettingsRemote.mockResolvedValue({
      settings: { ...settings, enabled: false },
      updated: true,
    });
    mockReplaceItems.mockResolvedValue();
    mockReplaceCandidates.mockResolvedValue();
    mockUpsertItem.mockResolvedValue();
    mockUpsertCandidate.mockResolvedValue();
    mockUpsertSettings.mockResolvedValue();
    mockSetLastSmartMemoryPullTs.mockResolvedValue();
    mockRuntimeConfig.smartMemoryEnabled = true;
  });

  it("does not pull or push Smart Memory backend work when Smart Memory is disabled", async () => {
    mockRuntimeConfig.smartMemoryEnabled = false;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { smartMemoryStrategy } = require("@/services/offline/strategies/smartMemory.strategy");

    await expect(smartMemoryStrategy.pull("user-1")).resolves.toBe(0);
    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 1,
        client_mutation_id: "candidate-mutation",
        cloud_id: "candidate-1",
        user_uid: "user-1",
        kind: "smart_memory_candidate_upsert",
        payload: {
          candidateId: "candidate-1",
          memoryType: "review_correction",
          subject: {},
        },
        updated_at: "2026-06-04T10:00:00.000Z",
        attempts: 0,
      }),
    ).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });

    expect(mockNetInfoFetch).not.toHaveBeenCalled();
    expect(mockFetchItems).not.toHaveBeenCalled();
    expect(mockFetchCandidates).not.toHaveBeenCalled();
    expect(mockFetchSettings).not.toHaveBeenCalled();
    expect(mockUpsertCandidateRemote).not.toHaveBeenCalled();
    expect(mockEditItemRemote).not.toHaveBeenCalled();
    expect(mockMuteItemRemote).not.toHaveBeenCalled();
    expect(mockRestoreItemRemote).not.toHaveBeenCalled();
    expect(mockDeleteItemRemote).not.toHaveBeenCalled();
    expect(mockMarkSourceDeletedRemote).not.toHaveBeenCalled();
    expect(mockUpdateSettingsRemote).not.toHaveBeenCalled();
  });

  it("pulls items, candidates, and settings into projection", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { smartMemoryStrategy } = require("@/services/offline/strategies/smartMemory.strategy");

    await expect(smartMemoryStrategy.pull("user-1")).resolves.toBe(3);

    expect(mockFetchItems).toHaveBeenCalledWith({ limit: 250 });
    expect(mockFetchCandidates).toHaveBeenCalledWith({ limit: 250 });
    expect(mockReplaceItems).toHaveBeenCalledWith("user-1", [item]);
    expect(mockReplaceCandidates).toHaveBeenCalledWith("user-1", [candidate]);
    expect(mockUpsertSettings).toHaveBeenCalledWith("user-1", settings, {
      preservePending: true,
    });
    expect(mockSetLastSmartMemoryPullTs).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
    );
  });

  it("pulls promoted active items while preserving activated candidates", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { smartMemoryStrategy } = require("@/services/offline/strategies/smartMemory.strategy");
    const promotedItem = {
      ...item,
      memoryItemId: "memory-promoted-1",
      control: { sourceCandidateId: "candidate-promoted-1" },
    };
    const activatedCandidate = {
      ...candidate,
      candidateId: "candidate-promoted-1",
      memoryType: "typical_portion",
      state: "activated",
      suppressionChecks: {
        promotedToMemoryItemId: "memory-promoted-1",
      },
      serverRevision: 2,
    };
    mockFetchItems.mockResolvedValueOnce({ items: [promotedItem] });
    mockFetchCandidates.mockResolvedValueOnce({ items: [activatedCandidate] });

    await expect(smartMemoryStrategy.pull("user-1")).resolves.toBe(3);

    expect(mockReplaceItems).toHaveBeenCalledWith("user-1", [promotedItem]);
    expect(mockReplaceCandidates).toHaveBeenCalledWith("user-1", [
      activatedCandidate,
    ]);
  });

  it("pushes candidate upserts with queued clientMutationId", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { smartMemoryStrategy } = require("@/services/offline/strategies/smartMemory.strategy");

    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 1,
        client_mutation_id: "candidate-mutation",
        cloud_id: "candidate-1",
        user_uid: "user-1",
        kind: "smart_memory_candidate_upsert",
        payload: {
          candidateId: "candidate-1",
          memoryType: "review_correction",
          subject: {},
        },
        updated_at: "2026-06-04T10:00:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);

    expect(mockUpsertCandidateRemote).toHaveBeenCalledWith({
      clientMutationId: "candidate-mutation",
      input: expect.objectContaining({ candidateId: "candidate-1" }),
    });
    expect(mockUpsertCandidate).toHaveBeenCalledWith("user-1", candidate);
  });

  it("pushes item controls and settings updates to Smart Memory endpoints", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { smartMemoryStrategy } = require("@/services/offline/strategies/smartMemory.strategy");

    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 2,
        client_mutation_id: "edit-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_edit",
        payload: { userValue: { amount: 70, unit: "g" } },
        updated_at: "2026-06-04T10:10:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);
    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 3,
        client_mutation_id: "mute-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_mute",
        payload: {},
        updated_at: "2026-06-04T10:11:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);
    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 4,
        client_mutation_id: "disable-mutation",
        cloud_id: "settings",
        user_uid: "user-1",
        kind: "smart_memory_settings_disable",
        payload: { enabled: false },
        updated_at: "2026-06-04T10:12:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);
    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 5,
        client_mutation_id: "restore-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_restore",
        payload: {},
        updated_at: "2026-06-04T10:13:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);
    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 6,
        client_mutation_id: "delete-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_delete",
        payload: {},
        updated_at: "2026-06-04T10:14:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);
    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 7,
        client_mutation_id: "enable-mutation",
        cloud_id: "settings",
        user_uid: "user-1",
        kind: "smart_memory_settings_enable",
        payload: { enabled: true },
        updated_at: "2026-06-04T10:15:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);

    expect(mockEditItemRemote).toHaveBeenCalledWith({
      memoryItemId: "memory-1",
      clientMutationId: "edit-mutation",
      input: { userValue: { amount: 70, unit: "g" } },
    });
    expect(mockMuteItemRemote).toHaveBeenCalledWith({
      memoryItemId: "memory-1",
      clientMutationId: "mute-mutation",
    });
    expect(mockRestoreItemRemote).toHaveBeenCalledWith({
      memoryItemId: "memory-1",
      clientMutationId: "restore-mutation",
    });
    expect(mockDeleteItemRemote).toHaveBeenCalledWith({
      memoryItemId: "memory-1",
      clientMutationId: "delete-mutation",
    });
    expect(mockUpdateSettingsRemote).toHaveBeenCalledWith({
      enabled: false,
      clientMutationId: "disable-mutation",
    });
    expect(mockUpdateSettingsRemote).toHaveBeenCalledWith({
      enabled: true,
      clientMutationId: "enable-mutation",
    });
  });

  it("requires hash-only source refs for source-deleted queued controls", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { smartMemoryStrategy } = require("@/services/offline/strategies/smartMemory.strategy");

    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 5,
        client_mutation_id: "source-delete-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_source_deleted",
        payload: {
          sourceRef: {
            kind: "meal_portion_observation",
            sourceHash: "source-hash-1",
          },
        },
        updated_at: "2026-06-04T10:13:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);

    expect(mockMarkSourceDeletedRemote).toHaveBeenCalledWith({
      memoryItemId: "memory-1",
      clientMutationId: "source-delete-mutation",
      input: {
        sourceRef: {
          kind: "meal_portion_observation",
          sourceHash: "source-hash-1",
        },
      },
    });

    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 6,
        client_mutation_id: "bad-source-delete-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_source_deleted",
        payload: {},
        updated_at: "2026-06-04T10:14:00.000Z",
        attempts: 0,
      }),
    ).rejects.toMatchObject({
      code: "sync/smart-memory-source-deleted-missing-source-ref",
      retryable: false,
    });

    await expect(
      smartMemoryStrategy.handlePushOp("user-1", {
        id: 7,
        client_mutation_id: "extra-source-delete-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_source_deleted",
        payload: {
          sourceRef: {
            kind: "meal_portion_observation",
            sourceHash: "source-hash-1",
            extra: "not-allowed",
          },
        },
        updated_at: "2026-06-04T10:15:00.000Z",
        attempts: 0,
      }),
    ).rejects.toMatchObject({
      code: "sync/smart-memory-source-deleted-invalid-source-ref",
      retryable: false,
    });
  });
});
