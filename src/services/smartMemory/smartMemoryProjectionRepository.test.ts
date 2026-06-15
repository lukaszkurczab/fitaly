/* eslint-disable @typescript-eslint/no-var-requires */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  SmartMemoryCandidateRow,
  SmartMemoryItemRow,
  SmartMemorySettingsRow,
} from "@/services/offline/types";
import type {
  SmartMemoryCandidateUpsertInput,
  SmartMemoryItem,
  SmartMemorySettings,
} from "@/types/smartMemory";

const mockRunSync = jest.fn<(sql: string, params?: unknown[]) => void>();
const mockGetFirstSync = jest.fn<(sql: string, params?: unknown[]) => unknown>();
const mockGetAllSync = jest.fn<(sql: string, params?: unknown[]) => unknown[]>();
const mockExecSync = jest.fn<(sql: string) => void>();

let itemRows = new Map<string, SmartMemoryItemRow>();
let candidateRows = new Map<string, SmartMemoryCandidateRow>();
let settingsRows = new Map<string, SmartMemorySettingsRow>();

jest.mock("@/services/offline/db", () => ({
  getDB: () => ({
    runSync: mockRunSync,
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
    execSync: mockExecSync,
  }),
}));

function sampleItem(overrides: Partial<SmartMemoryItem> = {}): SmartMemoryItem {
  return {
    memoryItemId: "memory-1",
    ownerUserId: "user-1",
    schemaVersion: 1,
    memoryType: "typical_portion",
    state: "active",
    stateReason: "threshold_met",
    subject: { kind: "ingredient_alias", aliasHash: "hash-1" },
    userValue: { amount: 60, unit: "g" },
    evidenceSummary: { observationCount: 3 },
    sourceRefs: [{ kind: "meal_review", sourceHash: "source-1" }],
    threshold: { minObservations: 3 },
    confidence: { level: "medium" },
    confidenceReasonCodes: ["distinct_days_met"],
    control: {},
    createdAt: "2026-06-04T09:00:00.000Z",
    updatedAt: "2026-06-04T10:00:00.000Z",
    lastEvaluatedAt: "2026-06-04T10:00:00.000Z",
    mutedAt: null,
    deletedAt: null,
    editedAt: null,
    restoredAt: null,
    sourceDeletedAt: null,
    serverRevision: 3,
    ...overrides,
  };
}

function sampleSettings(overrides: Partial<SmartMemorySettings> = {}): SmartMemorySettings {
  return {
    ownerUserId: "user-1",
    enabled: true,
    disabledAt: null,
    updatedAt: "2026-06-04T10:00:00.000Z",
    serverRevision: 1,
    clientMutationId: null,
    ...overrides,
  };
}

function sampleCandidateInput(): SmartMemoryCandidateUpsertInput {
  return {
    candidateId: "candidate-1",
    memoryType: "review_correction",
    subject: { kind: "nutrient_adjustment", subjectHash: "subject-1" },
    evidenceSummary: { correctionCount: 1 },
    sourceRefs: [{ kind: "review_confirmation", sourceHash: "source-1" }],
    confidenceReasonCodes: ["single_observation"],
    suppressionChecks: { settingsEnabled: true },
    firstSeenAt: "2026-06-04T09:00:00.000Z",
    lastSeenAt: "2026-06-04T09:00:00.000Z",
  };
}

function rowKey(uid: string, id: string): string {
  return `${uid}:${id}`;
}

function applyRunSync(sql: string, params: unknown[] = []): void {
  if (sql.includes("INSERT INTO smart_memory_items")) {
    const [
      memoryItemId,
      uid,
      memoryType,
      state,
      projectionState,
      suggestionUse,
      payload,
      serverRevision,
      updatedAt,
      lastSyncedAt,
      syncState,
      pendingOperation,
      pendingClientMutationId,
      pendingUpdatedAt,
      lastErrorCode,
      lastErrorMessage,
    ] = params;
    itemRows.set(rowKey(String(uid), String(memoryItemId)), {
      memory_item_id: String(memoryItemId),
      user_uid: String(uid),
      memory_type: String(memoryType),
      state: String(state),
      projection_state: String(projectionState),
      suggestion_use: String(suggestionUse),
      payload: String(payload),
      server_revision: Number(serverRevision),
      updated_at: String(updatedAt),
      last_synced_at: Number(lastSyncedAt),
      sync_state: String(syncState),
      pending_operation:
        typeof pendingOperation === "string" ? pendingOperation : null,
      pending_client_mutation_id:
        typeof pendingClientMutationId === "string"
          ? pendingClientMutationId
          : null,
      pending_updated_at:
        typeof pendingUpdatedAt === "string" ? pendingUpdatedAt : null,
      last_error_code: typeof lastErrorCode === "string" ? lastErrorCode : null,
      last_error_message:
        typeof lastErrorMessage === "string" ? lastErrorMessage : null,
    });
    return;
  }

  if (sql.includes("UPDATE smart_memory_items")) {
    if (sql.includes("memory_type=?")) {
      const key = rowKey(String(params[7]), String(params[8]));
      const row = itemRows.get(key);
      if (!row) return;
      row.memory_type = String(params[0]);
      row.state = String(params[1]);
      row.projection_state = String(params[2]);
      row.suggestion_use = String(params[3]);
      row.payload = String(params[4]);
      row.server_revision = Number(params[5]);
      row.updated_at = String(params[6]);
      row.sync_state = "synced";
      row.pending_operation = null;
      row.pending_client_mutation_id = null;
      row.pending_updated_at = null;
      row.last_error_code = null;
      row.last_error_message = null;
      return;
    }

    if (sql.includes("CASE pending_operation")) {
      for (const row of itemRows.values()) {
        if (row.user_uid !== String(params[0])) continue;
        if (
          !["sync_failed", "dead_letter", "conflicted"].includes(row.sync_state) ||
          !row.pending_operation
        ) {
          continue;
        }
        row.projection_state =
          row.pending_operation === "edit"
            ? "queued_edit"
            : row.pending_operation === "mute"
              ? "queued_mute"
              : row.pending_operation === "delete"
                ? "queued_delete"
                : row.pending_operation === "source_deleted"
                  ? "source_deleted"
                  : row.projection_state;
        row.suggestion_use = "blocked";
        row.sync_state = "pending";
        row.last_error_code = null;
        row.last_error_message = null;
      }
      return;
    }

    const key =
      params.length === 6
        ? rowKey(String(params[4]), String(params[5]))
        : rowKey(String(params[7]), String(params[8]));
    const row = itemRows.get(key);
    if (!row) return;
    if (params.length === 6) {
      row.projection_state = String(params[0]);
      row.suggestion_use = "blocked";
      row.sync_state = "pending";
      row.pending_operation = String(params[1]);
      row.pending_client_mutation_id = String(params[2]);
      row.pending_updated_at = String(params[3]);
      row.last_error_code = null;
      row.last_error_message = null;
    } else {
      row.projection_state = String(params[0]);
      row.suggestion_use = "blocked";
      row.sync_state = String(params[1]);
      row.pending_operation = String(params[2]);
      row.pending_client_mutation_id = String(params[3]);
      row.pending_updated_at = String(params[4]);
      row.last_error_code = typeof params[5] === "string" ? params[5] : null;
      row.last_error_message = typeof params[6] === "string" ? params[6] : null;
    }
    return;
  }

  if (sql.includes("INSERT INTO smart_memory_candidates")) {
    const [candidateId, uid, memoryType] = params;
    const isPendingCandidate = sql.includes("'pending_offline_candidate'");
    candidateRows.set(rowKey(String(uid), String(candidateId)), {
      candidate_id: String(candidateId),
      user_uid: String(uid),
      memory_type: String(memoryType),
      state: "candidate",
      projection_state: isPendingCandidate ? "pending_offline_candidate" : "backend_candidate",
      suggestion_use: "pending_only",
      payload: String(params[3]),
      server_revision: 0,
      updated_at: String(params[4]),
      last_synced_at: 0,
      sync_state: isPendingCandidate ? "pending" : "synced",
      pending_operation: isPendingCandidate ? "candidate_upsert" : null,
      pending_client_mutation_id: isPendingCandidate ? String(params[5]) : null,
      pending_updated_at: isPendingCandidate ? String(params[6]) : null,
      last_error_code: null,
      last_error_message: null,
    });
    return;
  }

  if (sql.includes("UPDATE smart_memory_candidates")) {
    if (sql.includes("pending_offline_candidate")) {
      for (const row of candidateRows.values()) {
        if (row.user_uid !== String(params[0])) continue;
        if (
          !["sync_failed", "dead_letter", "conflicted"].includes(row.sync_state) ||
          !row.pending_operation
        ) {
          continue;
        }
        row.projection_state = "pending_offline_candidate";
        row.suggestion_use = "pending_only";
        row.sync_state = "pending";
        row.last_error_code = null;
        row.last_error_message = null;
      }
      return;
    }

    const key = rowKey(String(params[7]), String(params[8]));
    const row = candidateRows.get(key);
    if (!row) return;
    row.projection_state = String(params[0]);
    row.suggestion_use = "blocked";
    row.sync_state = String(params[1]);
    row.pending_operation = String(params[2]);
    row.pending_client_mutation_id = String(params[3]);
    row.pending_updated_at = String(params[4]);
    row.last_error_code = typeof params[5] === "string" ? params[5] : null;
    row.last_error_message = typeof params[6] === "string" ? params[6] : null;
    return;
  }

  if (sql.includes("INSERT INTO smart_memory_settings")) {
    const uid = String(params[0]);
    const pendingInsert = sql.includes("'pending'");
    settingsRows.set(uid, {
      user_uid: uid,
      enabled: Number(params[1]),
      projection_state: String(params[2]),
      suggestion_use: "blocked",
      payload: String(pendingInsert ? params[3] : params[4]),
      server_revision: Number(pendingInsert ? params[4] : params[5]),
      updated_at: String(pendingInsert ? params[5] : params[6]),
      last_synced_at: 0,
      sync_state: pendingInsert ? "pending" : String(params[8] ?? "synced"),
      pending_operation: pendingInsert
        ? String(params[6])
        : typeof params[9] === "string"
          ? String(params[9])
          : null,
      pending_client_mutation_id:
        typeof (pendingInsert ? params[7] : params[10]) === "string"
          ? String(pendingInsert ? params[7] : params[10])
          : null,
      pending_updated_at:
        typeof (pendingInsert ? params[8] : params[11]) === "string"
          ? String(pendingInsert ? params[8] : params[11])
          : null,
      last_error_code: null,
      last_error_message: null,
    });
    return;
  }

  if (sql.includes("UPDATE smart_memory_settings")) {
    const uid = String(params[4]);
    const row = settingsRows.get(uid);
    if (!row) return;
    row.enabled = Number(params[0]);
    row.projection_state = String(params[1]);
    row.suggestion_use = "blocked";
    row.payload = String(params[2]);
    row.updated_at = String(params[3]);
    row.sync_state = "synced";
    row.pending_operation = null;
    row.pending_client_mutation_id = null;
    row.pending_updated_at = null;
    row.last_error_code = null;
    row.last_error_message = null;
    return;
  }

  if (sql.includes("DELETE FROM smart_memory_candidates")) {
    candidateRows.delete(rowKey(String(params[0]), String(params[1])));
  }
}

function applyGetFirstSync(sql: string, params: unknown[] = []): unknown {
  const uid = String(params[0]);
  if (sql.includes("FROM smart_memory_items")) {
    return itemRows.get(rowKey(uid, String(params[1])));
  }
  if (sql.includes("FROM smart_memory_settings")) {
    return settingsRows.get(uid);
  }
  return undefined;
}

function applyGetAllSync(sql: string, params: unknown[] = []): unknown[] {
  const uid = String(params[0]);
  if (sql.includes("FROM smart_memory_items")) {
    const rows = Array.from(itemRows.values()).filter((row) => row.user_uid === uid);
    if (sql.includes("projection_state='active'")) {
      return rows.filter(
        (row) =>
          row.projection_state === "active" &&
          row.suggestion_use === "allowed" &&
          row.sync_state === "synced",
      );
    }
    return rows;
  }
  if (sql.includes("FROM smart_memory_candidates")) {
    return Array.from(candidateRows.values()).filter((row) => row.user_uid === uid);
  }
  if (sql.includes("FROM smart_memory_settings")) {
    return Array.from(settingsRows.values()).filter((row) => row.user_uid === uid);
  }
  return [];
}

describe("smartMemoryProjectionRepository", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    itemRows = new Map();
    candidateRows = new Map();
    settingsRows = new Map();
    mockRunSync.mockImplementation(applyRunSync);
    mockGetFirstSync.mockImplementation(applyGetFirstSync);
    mockGetAllSync.mockImplementation(applyGetAllSync);
  });

  it("allows offline active reads only for backend-confirmed active memory", async () => {
    const repo = require("./smartMemoryProjectionRepository") as typeof import("./smartMemoryProjectionRepository");

    await repo.upsertSmartMemorySettingsProjection("user-1", sampleSettings());
    await repo.upsertSmartMemoryItemProjection("user-1", sampleItem());

    await expect(repo.getActiveSmartMemoryItemsForReview("user-1")).resolves.toEqual([
      expect.objectContaining({ memoryItemId: "memory-1", state: "active" }),
    ]);
  });

  it("keeps pending candidates pending-only and out of active memory", async () => {
    const repo = require("./smartMemoryProjectionRepository") as typeof import("./smartMemoryProjectionRepository");

    await repo.markSmartMemoryCandidatePending({
      uid: "user-1",
      input: sampleCandidateInput(),
      clientMutationId: "candidate-mutation-1",
      updatedAt: "2026-06-04T10:30:00.000Z",
    });

    const projection = await repo.getSmartMemoryProjection("user-1");
    expect(projection.candidates).toEqual([
      expect.objectContaining({
        projectionState: "pending_offline_candidate",
        suggestionUse: "pending_only",
        syncState: "pending",
        queuedOperation: expect.objectContaining({
          operation: "candidate_upsert",
          clientMutationId: "candidate-mutation-1",
        }),
      }),
    ]);
    await expect(repo.getActiveSmartMemoryItemsForReview("user-1")).resolves.toEqual([]);
  });

  it("queued edit, mute, delete, and disable suppress local suggestions", async () => {
    const repo = require("./smartMemoryProjectionRepository") as typeof import("./smartMemoryProjectionRepository");

    await repo.upsertSmartMemorySettingsProjection("user-1", sampleSettings());
    await repo.upsertSmartMemoryItemProjection("user-1", sampleItem());

    await repo.markSmartMemoryItemPending({
      uid: "user-1",
      memoryItemId: "memory-1",
      operation: "edit",
      clientMutationId: "edit-mutation",
      updatedAt: "2026-06-04T10:31:00.000Z",
    });
    expect((await repo.getSmartMemoryProjection("user-1")).items[0]).toEqual(
      expect.objectContaining({ projectionState: "queued_edit", suggestionUse: "blocked" }),
    );
    await repo.markSmartMemoryItemPending({
      uid: "user-1",
      memoryItemId: "memory-1",
      operation: "mute",
      clientMutationId: "mute-mutation",
      updatedAt: "2026-06-04T10:32:00.000Z",
    });
    expect((await repo.getSmartMemoryProjection("user-1")).items[0]).toEqual(
      expect.objectContaining({ projectionState: "queued_mute", suggestionUse: "blocked" }),
    );
    await repo.markSmartMemoryItemPending({
      uid: "user-1",
      memoryItemId: "memory-1",
      operation: "delete",
      clientMutationId: "delete-mutation",
      updatedAt: "2026-06-04T10:33:00.000Z",
    });
    await repo.markSmartMemorySettingsPending({
      uid: "user-1",
      enabled: false,
      operation: "settings_disable",
      clientMutationId: "disable-mutation",
      updatedAt: "2026-06-04T10:34:00.000Z",
    });

    const projection = await repo.getSmartMemoryProjection("user-1");
    expect(projection.items[0]).toEqual(
      expect.objectContaining({ projectionState: "queued_delete", suggestionUse: "blocked" }),
    );
    expect(projection.settings).toEqual(
      expect.objectContaining({ projectionState: "queued_disable", syncState: "pending" }),
    );
    await expect(repo.getActiveSmartMemoryItemsForReview("user-1")).resolves.toEqual([]);
  });

  it("marks sync failed and dead-letter states visible", async () => {
    const repo = require("./smartMemoryProjectionRepository") as typeof import("./smartMemoryProjectionRepository");

    await repo.upsertSmartMemoryItemProjection("user-1", sampleItem());
    await repo.markSmartMemoryProjectionSyncFailed({
      uid: "user-1",
      dead: false,
      code: "api/http-error",
      message: "Backend rejected",
      op: {
        id: 1,
        client_mutation_id: "edit-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_edit",
        payload: {},
        updated_at: "2026-06-04T10:40:00.000Z",
        attempts: 1,
      },
    });

    expect((await repo.getSmartMemoryProjection("user-1")).items[0]).toEqual(
      expect.objectContaining({
        projectionState: "sync_failed",
        syncState: "sync_failed",
        lastErrorCode: "api/http-error",
      }),
    );

    await repo.markSmartMemoryProjectionSyncFailed({
      uid: "user-1",
      dead: true,
      code: "api/http-error",
      message: "Backend rejected",
      op: {
        id: 2,
        client_mutation_id: "delete-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_delete",
        payload: {},
        updated_at: "2026-06-04T10:41:00.000Z",
        attempts: 10,
      },
    });

    expect((await repo.getSmartMemoryProjection("user-1")).items[0]).toEqual(
      expect.objectContaining({
        projectionState: "sync_failed",
        syncState: "dead_letter",
        queuedOperation: expect.objectContaining({
          operation: "delete",
          status: "dead_letter",
        }),
      }),
    );
  });

  it("retries failed projections by returning them to pending without suggestion use", async () => {
    const repo = require("./smartMemoryProjectionRepository") as typeof import("./smartMemoryProjectionRepository");

    await repo.upsertSmartMemoryItemProjection("user-1", sampleItem());
    await repo.markSmartMemoryProjectionSyncFailed({
      uid: "user-1",
      dead: true,
      code: "api/http-error",
      message: "Backend rejected",
      op: {
        id: 2,
        client_mutation_id: "delete-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_delete",
        payload: {},
        updated_at: "2026-06-04T10:41:00.000Z",
        attempts: 10,
      },
    });

    await expect(
      repo.markFailedSmartMemoryProjectionPending("user-1"),
    ).resolves.toBe(0);
    expect((await repo.getSmartMemoryProjection("user-1")).items[0]).toEqual(
      expect.objectContaining({
        projectionState: "queued_delete",
        syncState: "pending",
        suggestionUse: "blocked",
        lastErrorCode: null,
      }),
    );
  });

  it("discards failed item controls back to confirmed payload and hides local candidate failures", async () => {
    const repo = require("./smartMemoryProjectionRepository") as typeof import("./smartMemoryProjectionRepository");

    await repo.upsertSmartMemoryItemProjection("user-1", sampleItem());
    await repo.markSmartMemoryProjectionSyncFailed({
      uid: "user-1",
      dead: true,
      code: "api/http-error",
      message: "Backend rejected",
      op: {
        id: 2,
        client_mutation_id: "mute-mutation",
        cloud_id: "memory-1",
        user_uid: "user-1",
        kind: "smart_memory_item_mute",
        payload: {},
        updated_at: "2026-06-04T10:41:00.000Z",
        attempts: 10,
      },
    });
    await repo.markSmartMemoryCandidatePending({
      uid: "user-1",
      input: sampleCandidateInput(),
      clientMutationId: "candidate-mutation-1",
      updatedAt: "2026-06-04T10:42:00.000Z",
    });
    await repo.markSmartMemoryProjectionSyncFailed({
      uid: "user-1",
      dead: true,
      code: "api/http-error",
      message: "Backend rejected",
      op: {
        id: 3,
        client_mutation_id: "candidate-mutation-1",
        cloud_id: "candidate-1",
        user_uid: "user-1",
        kind: "smart_memory_candidate_upsert",
        payload: sampleCandidateInput(),
        updated_at: "2026-06-04T10:42:00.000Z",
        attempts: 10,
      },
    });

    await expect(
      repo.discardFailedSmartMemoryProjection("user-1"),
    ).resolves.toBe(2);

    const projection = await repo.getSmartMemoryProjection("user-1");
    expect(projection.items[0]).toEqual(
      expect.objectContaining({
        projectionState: "active",
        syncState: "synced",
        queuedOperation: null,
        suggestionUse: "allowed",
      }),
    );
    expect(projection.candidates).toEqual([]);
  });
});
