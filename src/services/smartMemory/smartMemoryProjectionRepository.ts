import { getDB } from "@/services/offline/db";
import type {
  QueueKind,
  SmartMemoryCandidateRow,
  SmartMemoryItemRow,
  SmartMemorySettingsRow,
} from "@/services/offline/types";
import type { QueueOp } from "@/services/offline/sync.strategy";
import {
  type SmartMemoryCandidate,
  type SmartMemoryCandidateUpsertInput,
  type SmartMemoryItem,
  type SmartMemoryItemEditInput,
  type SmartMemoryLocalSyncState,
  type SmartMemoryProjectionState,
  type SmartMemoryQueuedOperation,
  type SmartMemoryQueuedOperationStatus,
  type SmartMemorySettings,
  type SmartMemorySourceDeletedInput,
  type SmartMemorySuggestionUse,
  type SmartMemoryUserControlOperation,
} from "@/types/smartMemory";

const MAX_PROJECTION_JSON_CHARS = 16_384;
const SETTINGS_ROW_ID = "settings";

export type SmartMemoryProjectionItem = {
  kind: "item";
  item: SmartMemoryItem;
  projectionState: SmartMemoryProjectionState;
  suggestionUse: SmartMemorySuggestionUse;
  syncState: SmartMemoryLocalSyncState;
  queuedOperation: SmartMemoryQueuedOperation | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type SmartMemoryProjectionCandidate = {
  kind: "candidate";
  candidate: SmartMemoryCandidate | SmartMemoryCandidateUpsertInput;
  projectionState: SmartMemoryProjectionState;
  suggestionUse: SmartMemorySuggestionUse;
  syncState: SmartMemoryLocalSyncState;
  queuedOperation: SmartMemoryQueuedOperation | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type SmartMemoryProjectionSettings = {
  kind: "settings";
  settings: SmartMemorySettings;
  projectionState: SmartMemoryProjectionState;
  suggestionUse: SmartMemorySuggestionUse;
  syncState: SmartMemoryLocalSyncState;
  queuedOperation: SmartMemoryQueuedOperation | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type SmartMemoryProjection = {
  settings: SmartMemoryProjectionSettings | null;
  items: SmartMemoryProjectionItem[];
  candidates: SmartMemoryProjectionCandidate[];
};

function serializeBoundedJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.length > MAX_PROJECTION_JSON_CHARS) {
    throw new Error("Smart Memory projection payload exceeds local cache limit");
  }
  return json;
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function nowMs(): number {
  return Date.now();
}

function toProjectionStateFromItem(item: SmartMemoryItem): SmartMemoryProjectionState {
  if (item.state === "active") return "active";
  if (item.state === "candidate") return "backend_candidate";
  return item.state;
}

function toProjectionStateFromCandidate(
  candidate: SmartMemoryCandidate,
): SmartMemoryProjectionState {
  if (candidate.state === "candidate") return "backend_candidate";
  if (candidate.state === "activated") return "activated";
  if (candidate.state === "source_deleted") return "source_deleted";
  return "deleted_suppressed";
}

function suggestionUseForProjection(
  projectionState: SmartMemoryProjectionState,
): SmartMemorySuggestionUse {
  if (projectionState === "active") return "allowed";
  if (
    projectionState === "backend_candidate" ||
    projectionState === "pending_offline_candidate"
  ) {
    return "pending_only";
  }
  return "blocked";
}

function projectionStateForQueuedOperation(
  operation: SmartMemoryUserControlOperation,
): SmartMemoryProjectionState {
  if (operation === "edit") return "queued_edit";
  if (operation === "mute") return "queued_mute";
  if (operation === "delete") return "queued_delete";
  if (operation === "settings_disable") return "queued_disable";
  if (operation === "candidate_upsert") return "pending_offline_candidate";
  if (operation === "source_deleted") return "source_deleted";
  if (operation === "settings_enable") return "disabled";
  return "muted";
}

function toQueuedOperation(row: {
  pending_operation: string | null;
  pending_client_mutation_id: string | null;
  pending_updated_at: string | null;
  sync_state: string;
}): SmartMemoryQueuedOperation | null {
  if (!row.pending_operation || !row.pending_client_mutation_id) return null;
  return {
    operation: row.pending_operation as SmartMemoryUserControlOperation,
    status: toQueuedOperationStatus(row.sync_state),
    clientMutationId: row.pending_client_mutation_id,
    updatedAt: row.pending_updated_at ?? new Date(0).toISOString(),
  };
}

function toQueuedOperationStatus(syncState: string): SmartMemoryQueuedOperationStatus {
  if (syncState === "sync_failed") return "sync_failed";
  if (syncState === "dead_letter") return "dead_letter";
  if (syncState === "conflicted") return "conflicted";
  return "queued";
}

function toLocalSyncState(value: string): SmartMemoryLocalSyncState {
  if (
    value === "synced" ||
    value === "pending" ||
    value === "sync_failed" ||
    value === "dead_letter" ||
    value === "conflicted"
  ) {
    return value;
  }
  return "synced";
}

function rowToProjectionItem(row: SmartMemoryItemRow): SmartMemoryProjectionItem | null {
  const item = parseJson<SmartMemoryItem>(row.payload);
  if (!item) return null;
  return {
    kind: "item",
    item,
    projectionState: row.projection_state as SmartMemoryProjectionState,
    suggestionUse: row.suggestion_use as SmartMemorySuggestionUse,
    syncState: toLocalSyncState(row.sync_state),
    queuedOperation: toQueuedOperation(row),
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
  };
}

function rowToProjectionCandidate(
  row: SmartMemoryCandidateRow,
): SmartMemoryProjectionCandidate | null {
  const candidate = parseJson<SmartMemoryCandidate | SmartMemoryCandidateUpsertInput>(
    row.payload,
  );
  if (!candidate) return null;
  return {
    kind: "candidate",
    candidate,
    projectionState: row.projection_state as SmartMemoryProjectionState,
    suggestionUse: row.suggestion_use as SmartMemorySuggestionUse,
    syncState: toLocalSyncState(row.sync_state),
    queuedOperation: toQueuedOperation(row),
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
  };
}

function rowToProjectionSettings(
  row: SmartMemorySettingsRow,
): SmartMemoryProjectionSettings | null {
  const settings = parseJson<SmartMemorySettings>(row.payload);
  if (!settings) return null;
  return {
    kind: "settings",
    settings,
    projectionState: row.projection_state as SmartMemoryProjectionState,
    suggestionUse: row.suggestion_use as SmartMemorySuggestionUse,
    syncState: toLocalSyncState(row.sync_state),
    queuedOperation: toQueuedOperation(row),
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
  };
}

function isPendingRow(row: {
  sync_state: string;
  pending_operation: string | null;
}): boolean {
  return row.pending_operation !== null && row.sync_state !== "synced";
}

export async function replaceSmartMemoryItemsProjection(
  uid: string,
  items: SmartMemoryItem[],
): Promise<void> {
  const db = getDB();
  const incomingIds = new Set(items.map((item) => item.memoryItemId));
  db.execSync("BEGIN");
  try {
    const existing = db.getAllSync(
      `SELECT memory_item_id, sync_state, pending_operation
       FROM smart_memory_items
       WHERE user_uid=?`,
      [uid],
    ) as Array<{
      memory_item_id: string;
      sync_state: string;
      pending_operation: string | null;
    }>;
    for (const row of existing) {
      if (!incomingIds.has(row.memory_item_id) && !isPendingRow(row)) {
        db.runSync(
          `DELETE FROM smart_memory_items WHERE user_uid=? AND memory_item_id=?`,
          [uid, row.memory_item_id],
        );
      }
    }
    for (const item of items) {
      upsertSmartMemoryItemProjectionSync(uid, item, { preservePending: true });
    }
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}

export async function replaceSmartMemoryCandidatesProjection(
  uid: string,
  candidates: SmartMemoryCandidate[],
): Promise<void> {
  const db = getDB();
  const incomingIds = new Set(candidates.map((candidate) => candidate.candidateId));
  db.execSync("BEGIN");
  try {
    const existing = db.getAllSync(
      `SELECT candidate_id, sync_state, pending_operation
       FROM smart_memory_candidates
       WHERE user_uid=?`,
      [uid],
    ) as Array<{
      candidate_id: string;
      sync_state: string;
      pending_operation: string | null;
    }>;
    for (const row of existing) {
      if (!incomingIds.has(row.candidate_id) && !isPendingRow(row)) {
        db.runSync(
          `DELETE FROM smart_memory_candidates WHERE user_uid=? AND candidate_id=?`,
          [uid, row.candidate_id],
        );
      }
    }
    for (const candidate of candidates) {
      upsertSmartMemoryCandidateProjectionSync(uid, candidate, {
        preservePending: true,
      });
    }
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}

export async function upsertSmartMemoryItemProjection(
  uid: string,
  item: SmartMemoryItem,
): Promise<void> {
  upsertSmartMemoryItemProjectionSync(uid, item, { preservePending: false });
}

function upsertSmartMemoryItemProjectionSync(
  uid: string,
  item: SmartMemoryItem,
  options: { preservePending: boolean },
): void {
  const db = getDB();
  const existing = options.preservePending
    ? (db.getFirstSync(
        `SELECT sync_state, projection_state, suggestion_use, pending_operation,
                pending_client_mutation_id, pending_updated_at, last_error_code,
                last_error_message
         FROM smart_memory_items
         WHERE user_uid=? AND memory_item_id=?`,
        [uid, item.memoryItemId],
      ) as Partial<SmartMemoryItemRow> | undefined)
    : undefined;
  const preservePending = Boolean(existing && isPendingRow({
    sync_state: String(existing.sync_state ?? "synced"),
    pending_operation: existing.pending_operation ?? null,
  }));
  const projectionState = preservePending
    ? (existing?.projection_state as SmartMemoryProjectionState)
    : toProjectionStateFromItem(item);
  const suggestionUse = preservePending
    ? (existing?.suggestion_use ?? "blocked")
    : suggestionUseForProjection(projectionState);
  db.runSync(
    `INSERT INTO smart_memory_items (
      memory_item_id, user_uid, memory_type, state, projection_state,
      suggestion_use, payload, server_revision, updated_at, last_synced_at,
      sync_state, pending_operation, pending_client_mutation_id,
      pending_updated_at, last_error_code, last_error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(memory_item_id) DO UPDATE SET
      user_uid=excluded.user_uid,
      memory_type=excluded.memory_type,
      state=excluded.state,
      projection_state=excluded.projection_state,
      suggestion_use=excluded.suggestion_use,
      payload=excluded.payload,
      server_revision=excluded.server_revision,
      updated_at=excluded.updated_at,
      last_synced_at=excluded.last_synced_at,
      sync_state=excluded.sync_state,
      pending_operation=excluded.pending_operation,
      pending_client_mutation_id=excluded.pending_client_mutation_id,
      pending_updated_at=excluded.pending_updated_at,
      last_error_code=excluded.last_error_code,
      last_error_message=excluded.last_error_message`,
    [
      item.memoryItemId,
      uid,
      item.memoryType,
      item.state,
      projectionState,
      suggestionUse,
      serializeBoundedJson(item),
      item.serverRevision,
      item.updatedAt,
      nowMs(),
      preservePending ? (existing?.sync_state ?? "pending") : "synced",
      preservePending ? (existing?.pending_operation ?? null) : null,
      preservePending ? (existing?.pending_client_mutation_id ?? null) : null,
      preservePending ? (existing?.pending_updated_at ?? null) : null,
      preservePending ? (existing?.last_error_code ?? null) : null,
      preservePending ? (existing?.last_error_message ?? null) : null,
    ],
  );
}

export async function upsertSmartMemoryCandidateProjection(
  uid: string,
  candidate: SmartMemoryCandidate,
): Promise<void> {
  upsertSmartMemoryCandidateProjectionSync(uid, candidate, { preservePending: false });
}

function upsertSmartMemoryCandidateProjectionSync(
  uid: string,
  candidate: SmartMemoryCandidate,
  options: { preservePending: boolean },
): void {
  const db = getDB();
  const existing = options.preservePending
    ? (db.getFirstSync(
        `SELECT sync_state, projection_state, suggestion_use, pending_operation,
                pending_client_mutation_id, pending_updated_at, last_error_code,
                last_error_message
         FROM smart_memory_candidates
         WHERE user_uid=? AND candidate_id=?`,
        [uid, candidate.candidateId],
      ) as Partial<SmartMemoryCandidateRow> | undefined)
    : undefined;
  const preservePending = Boolean(existing && isPendingRow({
    sync_state: String(existing.sync_state ?? "synced"),
    pending_operation: existing.pending_operation ?? null,
  }));
  const projectionState = preservePending
    ? (existing?.projection_state as SmartMemoryProjectionState)
    : toProjectionStateFromCandidate(candidate);
  const suggestionUse = preservePending
    ? (existing?.suggestion_use ?? "blocked")
    : suggestionUseForProjection(projectionState);
  db.runSync(
    `INSERT INTO smart_memory_candidates (
      candidate_id, user_uid, memory_type, state, projection_state,
      suggestion_use, payload, server_revision, updated_at, last_synced_at,
      sync_state, pending_operation, pending_client_mutation_id,
      pending_updated_at, last_error_code, last_error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(candidate_id) DO UPDATE SET
      user_uid=excluded.user_uid,
      memory_type=excluded.memory_type,
      state=excluded.state,
      projection_state=excluded.projection_state,
      suggestion_use=excluded.suggestion_use,
      payload=excluded.payload,
      server_revision=excluded.server_revision,
      updated_at=excluded.updated_at,
      last_synced_at=excluded.last_synced_at,
      sync_state=excluded.sync_state,
      pending_operation=excluded.pending_operation,
      pending_client_mutation_id=excluded.pending_client_mutation_id,
      pending_updated_at=excluded.pending_updated_at,
      last_error_code=excluded.last_error_code,
      last_error_message=excluded.last_error_message`,
    [
      candidate.candidateId,
      uid,
      candidate.memoryType,
      candidate.state,
      projectionState,
      suggestionUse,
      serializeBoundedJson(candidate),
      candidate.serverRevision,
      candidate.updatedAt,
      nowMs(),
      preservePending ? (existing?.sync_state ?? "pending") : "synced",
      preservePending ? (existing?.pending_operation ?? null) : null,
      preservePending ? (existing?.pending_client_mutation_id ?? null) : null,
      preservePending ? (existing?.pending_updated_at ?? null) : null,
      preservePending ? (existing?.last_error_code ?? null) : null,
      preservePending ? (existing?.last_error_message ?? null) : null,
    ],
  );
}

export async function upsertSmartMemorySettingsProjection(
  uid: string,
  settings: SmartMemorySettings,
  options?: { preservePending?: boolean },
): Promise<void> {
  const db = getDB();
  const existing = options?.preservePending
    ? (db.getFirstSync(
        `SELECT sync_state, projection_state, suggestion_use, pending_operation,
                pending_client_mutation_id, pending_updated_at, last_error_code,
                last_error_message
         FROM smart_memory_settings
         WHERE user_uid=?`,
        [uid],
      ) as Partial<SmartMemorySettingsRow> | undefined)
    : undefined;
  const preservePending = Boolean(existing && isPendingRow({
    sync_state: String(existing.sync_state ?? "synced"),
    pending_operation: existing.pending_operation ?? null,
  }));
  const projectionState = preservePending
    ? (existing?.projection_state as SmartMemoryProjectionState)
    : settings.enabled
      ? "no_signal"
      : "disabled";
  db.runSync(
    `INSERT INTO smart_memory_settings (
      user_uid, enabled, projection_state, suggestion_use, payload,
      server_revision, updated_at, last_synced_at, sync_state,
      pending_operation, pending_client_mutation_id, pending_updated_at,
      last_error_code, last_error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_uid) DO UPDATE SET
      enabled=excluded.enabled,
      projection_state=excluded.projection_state,
      suggestion_use=excluded.suggestion_use,
      payload=excluded.payload,
      server_revision=excluded.server_revision,
      updated_at=excluded.updated_at,
      last_synced_at=excluded.last_synced_at,
      sync_state=excluded.sync_state,
      pending_operation=excluded.pending_operation,
      pending_client_mutation_id=excluded.pending_client_mutation_id,
      pending_updated_at=excluded.pending_updated_at,
      last_error_code=excluded.last_error_code,
      last_error_message=excluded.last_error_message`,
    [
      uid,
      settings.enabled ? 1 : 0,
      projectionState,
      "blocked",
      serializeBoundedJson(settings),
      settings.serverRevision,
      settings.updatedAt,
      nowMs(),
      preservePending ? (existing?.sync_state ?? "pending") : "synced",
      preservePending ? (existing?.pending_operation ?? null) : null,
      preservePending ? (existing?.pending_client_mutation_id ?? null) : null,
      preservePending ? (existing?.pending_updated_at ?? null) : null,
      preservePending ? (existing?.last_error_code ?? null) : null,
      preservePending ? (existing?.last_error_message ?? null) : null,
    ],
  );
}

export async function markSmartMemoryCandidatePending(params: {
  uid: string;
  input: SmartMemoryCandidateUpsertInput;
  clientMutationId: string;
  updatedAt: string;
}): Promise<void> {
  const db = getDB();
  db.runSync(
    `INSERT INTO smart_memory_candidates (
      candidate_id, user_uid, memory_type, state, projection_state,
      suggestion_use, payload, server_revision, updated_at, last_synced_at,
      sync_state, pending_operation, pending_client_mutation_id,
      pending_updated_at, last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'candidate', 'pending_offline_candidate',
      'pending_only', ?, 0, ?, 0, 'pending', 'candidate_upsert', ?, ?, NULL, NULL)
    ON CONFLICT(candidate_id) DO UPDATE SET
      memory_type=excluded.memory_type,
      state=excluded.state,
      projection_state=excluded.projection_state,
      suggestion_use=excluded.suggestion_use,
      payload=excluded.payload,
      updated_at=excluded.updated_at,
      sync_state=excluded.sync_state,
      pending_operation=excluded.pending_operation,
      pending_client_mutation_id=excluded.pending_client_mutation_id,
      pending_updated_at=excluded.pending_updated_at,
      last_error_code=NULL,
      last_error_message=NULL`,
    [
      params.input.candidateId,
      params.uid,
      params.input.memoryType,
      serializeBoundedJson(params.input),
      params.updatedAt,
      params.clientMutationId,
      params.updatedAt,
    ],
  );
}

export async function markSmartMemoryItemPending(params: {
  uid: string;
  memoryItemId: string;
  operation: Exclude<
    SmartMemoryUserControlOperation,
    "candidate_upsert" | "settings_disable" | "settings_enable"
  >;
  payload?: SmartMemoryItemEditInput | SmartMemorySourceDeletedInput;
  clientMutationId: string;
  updatedAt: string;
}): Promise<void> {
  const db = getDB();
  const projectionState = projectionStateForQueuedOperation(params.operation);
  const existing = db.getFirstSync<SmartMemoryItemRow>(
    `SELECT * FROM smart_memory_items WHERE user_uid=? AND memory_item_id=?`,
    [params.uid, params.memoryItemId],
  );
  if (!existing) {
    throw new Error("Cannot queue Smart Memory item control without a projection row");
  }
  db.runSync(
    `UPDATE smart_memory_items
     SET projection_state=?,
         suggestion_use='blocked',
         sync_state='pending',
         pending_operation=?,
         pending_client_mutation_id=?,
         pending_updated_at=?,
         last_error_code=NULL,
         last_error_message=NULL
     WHERE user_uid=? AND memory_item_id=?`,
    [
      projectionState,
      params.operation,
      params.clientMutationId,
      params.updatedAt,
      params.uid,
      params.memoryItemId,
    ],
  );
}

export async function markSmartMemorySettingsPending(params: {
  uid: string;
  enabled: boolean;
  operation: Extract<
    SmartMemoryUserControlOperation,
    "settings_disable" | "settings_enable"
  >;
  clientMutationId: string;
  updatedAt: string;
}): Promise<void> {
  const db = getDB();
  const existing = db.getFirstSync<SmartMemorySettingsRow>(
    `SELECT * FROM smart_memory_settings WHERE user_uid=?`,
    [params.uid],
  );
  const settings: SmartMemorySettings =
    parseJson<SmartMemorySettings>(existing?.payload ?? "") ?? {
      ownerUserId: params.uid,
      enabled: params.enabled,
      disabledAt: params.enabled ? null : params.updatedAt,
      updatedAt: params.updatedAt,
      serverRevision: 0,
      clientMutationId: params.clientMutationId,
    };
  const nextSettings = {
    ...settings,
    enabled: params.enabled,
    disabledAt: params.enabled ? null : params.updatedAt,
    updatedAt: params.updatedAt,
    clientMutationId: params.clientMutationId,
  };
  db.runSync(
    `INSERT INTO smart_memory_settings (
      user_uid, enabled, projection_state, suggestion_use, payload,
      server_revision, updated_at, last_synced_at, sync_state,
      pending_operation, pending_client_mutation_id, pending_updated_at,
      last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'blocked', ?, ?, ?, 0, 'pending', ?, ?, ?, NULL, NULL)
    ON CONFLICT(user_uid) DO UPDATE SET
      enabled=excluded.enabled,
      projection_state=excluded.projection_state,
      suggestion_use=excluded.suggestion_use,
      payload=excluded.payload,
      updated_at=excluded.updated_at,
      sync_state=excluded.sync_state,
      pending_operation=excluded.pending_operation,
      pending_client_mutation_id=excluded.pending_client_mutation_id,
      pending_updated_at=excluded.pending_updated_at,
      last_error_code=NULL,
      last_error_message=NULL`,
    [
      params.uid,
      params.enabled ? 1 : 0,
      params.operation === "settings_disable" ? "queued_disable" : "disabled",
      serializeBoundedJson(nextSettings),
      existing?.server_revision ?? 0,
      params.updatedAt,
      params.operation,
      params.clientMutationId,
      params.updatedAt,
    ],
  );
}

export async function markSmartMemoryProjectionSyncFailed(params: {
  uid: string;
  op: QueueOp;
  dead: boolean;
  code?: string | null;
  message?: string | null;
}): Promise<void> {
  const syncState = params.dead ? "dead_letter" : "sync_failed";
  const projectionState: SmartMemoryProjectionState = "sync_failed";
  const operation = operationForQueueKind(params.op.kind);
  if (!operation) return;
  const db = getDB();
  const targetTable =
    params.op.kind === "smart_memory_candidate_upsert"
      ? "smart_memory_candidates"
      : params.op.kind === "smart_memory_settings_disable" || params.op.kind === "smart_memory_settings_enable"
        ? "smart_memory_settings"
        : "smart_memory_items";
  const idColumn =
    targetTable === "smart_memory_candidates"
      ? "candidate_id"
      : targetTable === "smart_memory_items"
        ? "memory_item_id"
        : "user_uid";
  const idValue = targetTable === "smart_memory_settings" ? params.uid : params.op.cloud_id;
  db.runSync(
    `UPDATE ${targetTable}
     SET projection_state=?,
         suggestion_use='blocked',
         sync_state=?,
         pending_operation=?,
         pending_client_mutation_id=?,
         pending_updated_at=?,
         last_error_code=?,
         last_error_message=?
     WHERE user_uid=? AND ${idColumn}=?`,
    [
      projectionState,
      syncState,
      operation,
      params.op.client_mutation_id,
      params.op.updated_at,
      params.code ?? null,
      params.message ?? null,
      params.uid,
      idValue,
    ],
  );
}

function operationForQueueKind(
  kind: QueueKind,
): SmartMemoryUserControlOperation | null {
  if (kind === "smart_memory_candidate_upsert") return "candidate_upsert";
  if (kind === "smart_memory_item_edit") return "edit";
  if (kind === "smart_memory_item_mute") return "mute";
  if (kind === "smart_memory_item_restore") return "restore";
  if (kind === "smart_memory_item_delete") return "delete";
  if (kind === "smart_memory_item_source_deleted") return "source_deleted";
  if (kind === "smart_memory_settings_disable") return "settings_disable";
  if (kind === "smart_memory_settings_enable") return "settings_enable";
  return null;
}

const FAILED_LOCAL_SYNC_STATES = ["sync_failed", "dead_letter", "conflicted"];

function failedStatePlaceholders(): string {
  return FAILED_LOCAL_SYNC_STATES.map(() => "?").join(",");
}

function itemProjectionFromPayload(
  row: SmartMemoryItemRow,
): {
  projectionState: SmartMemoryProjectionState;
  suggestionUse: SmartMemorySuggestionUse;
  payload: string;
  state: string;
  memoryType: string;
  serverRevision: number;
  updatedAt: string;
} | null {
  const item = parseJson<SmartMemoryItem>(row.payload);
  if (!item) return null;
  const projectionState = toProjectionStateFromItem(item);
  return {
    projectionState,
    suggestionUse: suggestionUseForProjection(projectionState),
    payload: serializeBoundedJson(item),
    state: item.state,
    memoryType: item.memoryType,
    serverRevision: item.serverRevision,
    updatedAt: item.updatedAt,
  };
}

function settingsProjectionAfterDiscard(
  row: SmartMemorySettingsRow,
): {
  settings: SmartMemorySettings;
  projectionState: SmartMemoryProjectionState;
} | null {
  const settings = parseJson<SmartMemorySettings>(row.payload);
  if (!settings) return null;
  const enabled = row.pending_operation === "settings_disable";
  const nextSettings: SmartMemorySettings = {
    ...settings,
    enabled,
    disabledAt: enabled ? null : (settings.disabledAt ?? settings.updatedAt),
    clientMutationId: null,
  };
  return {
    settings: nextSettings,
    projectionState: enabled ? "no_signal" : "disabled",
  };
}

export async function getFailedSmartMemoryClientMutationIds(
  uid: string,
): Promise<string[]> {
  const db = getDB();
  const states = failedStatePlaceholders();
  const params = [uid, ...FAILED_LOCAL_SYNC_STATES];
  const rows = [
    ...(db.getAllSync(
      `SELECT pending_client_mutation_id AS clientMutationId
       FROM smart_memory_items
       WHERE user_uid=? AND sync_state IN (${states})
         AND pending_client_mutation_id IS NOT NULL`,
      params,
    ) as Array<{ clientMutationId: string | null }>),
    ...(db.getAllSync(
      `SELECT pending_client_mutation_id AS clientMutationId
       FROM smart_memory_candidates
       WHERE user_uid=? AND sync_state IN (${states})
         AND pending_client_mutation_id IS NOT NULL`,
      params,
    ) as Array<{ clientMutationId: string | null }>),
    ...(db.getAllSync(
      `SELECT pending_client_mutation_id AS clientMutationId
       FROM smart_memory_settings
       WHERE user_uid=? AND sync_state IN (${states})
         AND pending_client_mutation_id IS NOT NULL`,
      params,
    ) as Array<{ clientMutationId: string | null }>),
  ];
  return Array.from(
    new Set(
      rows
        .map((row) => row.clientMutationId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
}

export async function markFailedSmartMemoryProjectionPending(
  uid: string,
): Promise<number> {
  const db = getDB();
  const states = failedStatePlaceholders();
  const itemResult = db.runSync(
    `UPDATE smart_memory_items
     SET projection_state=CASE pending_operation
           WHEN 'edit' THEN 'queued_edit'
           WHEN 'mute' THEN 'queued_mute'
           WHEN 'restore' THEN 'muted'
           WHEN 'delete' THEN 'queued_delete'
           WHEN 'source_deleted' THEN 'source_deleted'
           ELSE projection_state
         END,
         suggestion_use='blocked',
         sync_state='pending',
         last_error_code=NULL,
         last_error_message=NULL
     WHERE user_uid=? AND sync_state IN (${states})
       AND pending_operation IS NOT NULL`,
    [uid, ...FAILED_LOCAL_SYNC_STATES],
  ) as { changes?: number } | undefined;
  const candidateResult = db.runSync(
    `UPDATE smart_memory_candidates
     SET projection_state='pending_offline_candidate',
         suggestion_use='pending_only',
         sync_state='pending',
         last_error_code=NULL,
         last_error_message=NULL
     WHERE user_uid=? AND sync_state IN (${states})
       AND pending_operation IS NOT NULL`,
    [uid, ...FAILED_LOCAL_SYNC_STATES],
  ) as { changes?: number } | undefined;
  const settingsResult = db.runSync(
    `UPDATE smart_memory_settings
     SET projection_state=CASE pending_operation
           WHEN 'settings_disable' THEN 'queued_disable'
           WHEN 'settings_enable' THEN 'disabled'
           ELSE projection_state
         END,
         suggestion_use='blocked',
         sync_state='pending',
         last_error_code=NULL,
         last_error_message=NULL
     WHERE user_uid=? AND sync_state IN (${states})
       AND pending_operation IS NOT NULL`,
    [uid, ...FAILED_LOCAL_SYNC_STATES],
  ) as { changes?: number } | undefined;
  return (
    Number(itemResult?.changes ?? 0) +
    Number(candidateResult?.changes ?? 0) +
    Number(settingsResult?.changes ?? 0)
  );
}

export async function discardFailedSmartMemoryProjection(
  uid: string,
): Promise<number> {
  const db = getDB();
  const states = failedStatePlaceholders();
  const params = [uid, ...FAILED_LOCAL_SYNC_STATES];
  const itemRows = db.getAllSync(
    `SELECT * FROM smart_memory_items
     WHERE user_uid=? AND sync_state IN (${states})
       AND pending_operation IS NOT NULL`,
    params,
  ) as SmartMemoryItemRow[];
  const candidateRows = db.getAllSync(
    `SELECT * FROM smart_memory_candidates
     WHERE user_uid=? AND sync_state IN (${states})
       AND pending_operation IS NOT NULL`,
    params,
  ) as SmartMemoryCandidateRow[];
  const settingsRows = db.getAllSync(
    `SELECT * FROM smart_memory_settings
     WHERE user_uid=? AND sync_state IN (${states})
       AND pending_operation IS NOT NULL`,
    params,
  ) as SmartMemorySettingsRow[];
  let discarded = 0;

  db.execSync("BEGIN");
  try {
    for (const row of itemRows) {
      const next = itemProjectionFromPayload(row);
      if (!next) continue;
      db.runSync(
        `UPDATE smart_memory_items
         SET memory_type=?,
             state=?,
             projection_state=?,
             suggestion_use=?,
             payload=?,
             server_revision=?,
             updated_at=?,
             sync_state='synced',
             pending_operation=NULL,
             pending_client_mutation_id=NULL,
             pending_updated_at=NULL,
             last_error_code=NULL,
             last_error_message=NULL
         WHERE user_uid=? AND memory_item_id=?`,
        [
          next.memoryType,
          next.state,
          next.projectionState,
          next.suggestionUse,
          next.payload,
          next.serverRevision,
          next.updatedAt,
          uid,
          row.memory_item_id,
        ],
      );
      discarded++;
    }

    for (const row of candidateRows) {
      db.runSync(
        `DELETE FROM smart_memory_candidates
         WHERE user_uid=? AND candidate_id=?`,
        [uid, row.candidate_id],
      );
      discarded++;
    }

    for (const row of settingsRows) {
      const next = settingsProjectionAfterDiscard(row);
      if (!next) continue;
      db.runSync(
        `UPDATE smart_memory_settings
         SET enabled=?,
             projection_state=?,
             suggestion_use='blocked',
             payload=?,
             updated_at=?,
             sync_state='synced',
             pending_operation=NULL,
             pending_client_mutation_id=NULL,
             pending_updated_at=NULL,
             last_error_code=NULL,
             last_error_message=NULL
         WHERE user_uid=?`,
        [
          next.settings.enabled ? 1 : 0,
          next.projectionState,
          serializeBoundedJson(next.settings),
          next.settings.updatedAt,
          uid,
        ],
      );
      discarded++;
    }
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }

  return discarded;
}

export async function getSmartMemoryProjection(
  uid: string,
): Promise<SmartMemoryProjection> {
  const db = getDB();
  const settingsRow = db.getFirstSync<SmartMemorySettingsRow>(
    `SELECT * FROM smart_memory_settings WHERE user_uid=?`,
    [uid],
  );
  const itemRows = db.getAllSync(
    `SELECT * FROM smart_memory_items
     WHERE user_uid=?
     ORDER BY updated_at DESC, memory_item_id ASC`,
    [uid],
  ) as SmartMemoryItemRow[];
  const candidateRows = db.getAllSync(
    `SELECT * FROM smart_memory_candidates
     WHERE user_uid=?
     ORDER BY updated_at DESC, candidate_id ASC`,
    [uid],
  ) as SmartMemoryCandidateRow[];
  return {
    settings: settingsRow ? rowToProjectionSettings(settingsRow) : null,
    items: itemRows
      .map(rowToProjectionItem)
      .filter((item): item is SmartMemoryProjectionItem => item !== null),
    candidates: candidateRows
      .map(rowToProjectionCandidate)
      .filter(
        (candidate): candidate is SmartMemoryProjectionCandidate =>
          candidate !== null,
      ),
  };
}

export async function getActiveSmartMemoryItemsForReview(
  uid: string,
): Promise<SmartMemoryItem[]> {
  const db = getDB();
  const settingsRow = db.getFirstSync<SmartMemorySettingsRow>(
    `SELECT * FROM smart_memory_settings WHERE user_uid=?`,
    [uid],
  );
  if (
    settingsRow &&
    (settingsRow.enabled === 0 ||
      settingsRow.projection_state === "queued_disable" ||
      settingsRow.sync_state !== "synced")
  ) {
    return [];
  }
  const rows = db.getAllSync(
    `SELECT * FROM smart_memory_items
     WHERE user_uid=?
       AND projection_state='active'
       AND suggestion_use='allowed'
       AND sync_state='synced'
     ORDER BY updated_at DESC`,
    [uid],
  ) as SmartMemoryItemRow[];
  return rows
    .map((row) => parseJson<SmartMemoryItem>(row.payload))
    .filter((item): item is SmartMemoryItem => item !== null);
}

export function smartMemoryQueueKinds(): QueueKind[] {
  return [
    "smart_memory_candidate_upsert",
    "smart_memory_item_edit",
    "smart_memory_item_mute",
    "smart_memory_item_restore",
    "smart_memory_item_delete",
    "smart_memory_item_source_deleted",
    "smart_memory_settings_disable",
    "smart_memory_settings_enable",
  ];
}

export function smartMemorySettingsRowId(): string {
  return SETTINGS_ROW_ID;
}
