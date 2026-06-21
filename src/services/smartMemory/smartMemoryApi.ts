import { get, patch, post } from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { requireRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import {
  SMART_MEMORY_CANDIDATE_STATES,
  SMART_MEMORY_SCHEMA_VERSION,
  SMART_MEMORY_STATES,
  SMART_MEMORY_TYPES,
  type SmartMemoryCandidate,
  type SmartMemoryCandidateResponse,
  type SmartMemoryCandidateUpsertInput,
  type SmartMemoryCandidatesPageResponse,
  type SmartMemoryItem,
  type SmartMemoryItemEditInput,
  type SmartMemoryItemMutationResponse,
  type SmartMemoryItemsPageResponse,
  type SmartMemorySettings,
  type SmartMemorySettingsResponse,
  type SmartMemorySourceDeletedInput,
} from "@/types/smartMemory";

const SMART_MEMORY_ENDPOINT = withV2("/users/me/smart-memory");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function recordsArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringsArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): Array<T[number]> {
  return Array.isArray(value)
    ? value.filter((item): item is T[number] => isOneOf(item, allowed))
    : [];
}

function normalizeItem(raw: unknown): SmartMemoryItem | null {
  if (!isRecord(raw)) return null;
  const memoryItemId = optionalString(raw.memoryItemId);
  const ownerUserId = optionalString(raw.ownerUserId);
  const memoryType = isOneOf(raw.memoryType, SMART_MEMORY_TYPES)
    ? raw.memoryType
    : null;
  const state = isOneOf(raw.state, SMART_MEMORY_STATES) ? raw.state : null;
  const createdAt = optionalString(raw.createdAt);
  const updatedAt = optionalString(raw.updatedAt);
  if (!memoryItemId || !ownerUserId || !memoryType || !state || !createdAt || !updatedAt) {
    return null;
  }

  return {
    memoryItemId,
    ownerUserId,
    schemaVersion: SMART_MEMORY_SCHEMA_VERSION,
    memoryType,
    state,
    stateReason: isOneOf(raw.stateReason, [
      "threshold_met",
      "user_muted",
      "user_restored",
      "user_deleted",
      "account_disabled",
      "source_deleted",
      "sync_failed",
      "conflict_remote_won",
      "local_pending",
    ] as const)
      ? raw.stateReason
      : null,
    subject: recordOrEmpty(raw.subject),
    userValue: recordOrEmpty(raw.userValue),
    evidenceSummary: recordOrEmpty(raw.evidenceSummary),
    sourceRefs: recordsArray(raw.sourceRefs),
    threshold: recordOrEmpty(raw.threshold),
    confidence: recordOrEmpty(raw.confidence),
    confidenceReasonCodes: stringsArray(raw.confidenceReasonCodes, [
      "single_observation",
      "distinct_days_met",
      "consistent_user_review",
      "ingredient_selection_repeated",
    ] as const),
    control: recordOrEmpty(raw.control),
    createdAt,
    updatedAt,
    lastEvaluatedAt: optionalString(raw.lastEvaluatedAt),
    mutedAt: optionalString(raw.mutedAt),
    deletedAt: optionalString(raw.deletedAt),
    editedAt: optionalString(raw.editedAt),
    restoredAt: optionalString(raw.restoredAt),
    sourceDeletedAt: optionalString(raw.sourceDeletedAt),
    serverRevision: Number.isFinite(Number(raw.serverRevision))
      ? Number(raw.serverRevision)
      : 0,
  };
}

function normalizeCandidate(raw: unknown): SmartMemoryCandidate | null {
  if (!isRecord(raw)) return null;
  const candidateId = optionalString(raw.candidateId);
  const ownerUserId = optionalString(raw.ownerUserId);
  const memoryType = isOneOf(raw.memoryType, SMART_MEMORY_TYPES)
    ? raw.memoryType
    : null;
  const state = isOneOf(raw.state, SMART_MEMORY_CANDIDATE_STATES)
    ? raw.state
    : null;
  const createdAt = optionalString(raw.createdAt);
  const updatedAt = optionalString(raw.updatedAt);
  if (!candidateId || !ownerUserId || !memoryType || !state || !createdAt || !updatedAt) {
    return null;
  }

  return {
    candidateId,
    ownerUserId,
    schemaVersion: SMART_MEMORY_SCHEMA_VERSION,
    memoryType,
    state,
    subject: recordOrEmpty(raw.subject),
    evidenceSummary: recordOrEmpty(raw.evidenceSummary),
    sourceRefs: recordsArray(raw.sourceRefs),
    confidenceReasonCodes: stringsArray(raw.confidenceReasonCodes, [
      "single_observation",
      "distinct_days_met",
      "consistent_user_review",
      "ingredient_selection_repeated",
    ] as const),
    suppressionChecks: recordOrEmpty(raw.suppressionChecks),
    createdAt,
    updatedAt,
    firstSeenAt: optionalString(raw.firstSeenAt),
    lastSeenAt: optionalString(raw.lastSeenAt),
    serverRevision: Number.isFinite(Number(raw.serverRevision))
      ? Number(raw.serverRevision)
      : 0,
  };
}

function normalizeSettings(raw: unknown): SmartMemorySettings | null {
  if (!isRecord(raw)) return null;
  const ownerUserId = optionalString(raw.ownerUserId);
  const updatedAt = optionalString(raw.updatedAt);
  if (!ownerUserId || typeof raw.enabled !== "boolean" || !updatedAt) {
    return null;
  }
  return {
    ownerUserId,
    enabled: raw.enabled,
    disabledAt: optionalString(raw.disabledAt),
    updatedAt,
    serverRevision: Number.isFinite(Number(raw.serverRevision))
      ? Number(raw.serverRevision)
      : 0,
    clientMutationId: optionalString(raw.clientMutationId),
  };
}

function toItemsPage(raw: unknown): SmartMemoryItemsPageResponse {
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new Error("Invalid Smart Memory items page response");
  }
  const items = raw.items.map((item) => {
    const normalized = normalizeItem(item);
    if (!normalized) {
      throw new Error("Invalid Smart Memory items page response");
    }
    return normalized;
  });
  return {
    items,
    nextCursor: optionalString(raw.nextCursor),
  };
}

function toCandidatesPage(raw: unknown): SmartMemoryCandidatesPageResponse {
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new Error("Invalid Smart Memory candidates page response");
  }
  const items = raw.items.map((item) => {
    const normalized = normalizeCandidate(item);
    if (!normalized) {
      throw new Error("Invalid Smart Memory candidates page response");
    }
    return normalized;
  });
  return {
    items,
    nextCursor: optionalString(raw.nextCursor),
  };
}

function requireItemResponse(raw: unknown): SmartMemoryItemMutationResponse {
  const item = normalizeItem(isRecord(raw) ? raw.item : null);
  if (!item) {
    throw new Error("Invalid Smart Memory item response");
  }
  return {
    item,
    updated: Boolean(isRecord(raw) ? raw.updated : false),
  };
}

function requireCandidateResponse(raw: unknown): SmartMemoryCandidateResponse {
  const candidate = normalizeCandidate(isRecord(raw) ? raw.candidate : null);
  if (!candidate) {
    throw new Error("Invalid Smart Memory candidate response");
  }
  return {
    candidate,
    updated: Boolean(isRecord(raw) ? raw.updated : false),
  };
}

function requireSettingsResponse(raw: unknown): SmartMemorySettingsResponse {
  const settings = normalizeSettings(isRecord(raw) ? raw.settings : null);
  if (!settings) {
    throw new Error("Invalid Smart Memory settings response");
  }
  return {
    settings,
    updated: Boolean(isRecord(raw) ? raw.updated : false),
  };
}

export async function fetchSmartMemoryItemsRemote(params?: {
  limit?: number;
}): Promise<SmartMemoryItemsPageResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  const limit = Math.max(1, Math.min(params?.limit ?? 100, 250));
  return toItemsPage(
    await get(`${SMART_MEMORY_ENDPOINT}/items?limit=${encodeURIComponent(String(limit))}`),
  );
}

export async function fetchSmartMemoryCandidatesRemote(params?: {
  limit?: number;
}): Promise<SmartMemoryCandidatesPageResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  const limit = Math.max(1, Math.min(params?.limit ?? 100, 250));
  return toCandidatesPage(
    await get(
      `${SMART_MEMORY_ENDPOINT}/candidates?limit=${encodeURIComponent(String(limit))}`,
    ),
  );
}

export async function fetchSmartMemorySettingsRemote(): Promise<SmartMemorySettingsResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  return requireSettingsResponse(await get(`${SMART_MEMORY_ENDPOINT}/settings`));
}

export async function upsertSmartMemoryCandidateRemote(params: {
  clientMutationId: string;
  input: SmartMemoryCandidateUpsertInput;
}): Promise<SmartMemoryCandidateResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  return requireCandidateResponse(
    await post(`${SMART_MEMORY_ENDPOINT}/candidates`, {
      clientMutationId: params.clientMutationId,
      ...params.input,
    }),
  );
}

export async function editSmartMemoryItemRemote(params: {
  memoryItemId: string;
  clientMutationId: string;
  input: SmartMemoryItemEditInput;
}): Promise<SmartMemoryItemMutationResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  return requireItemResponse(
    await patch(`${SMART_MEMORY_ENDPOINT}/items/${encodeURIComponent(params.memoryItemId)}`, {
      clientMutationId: params.clientMutationId,
      ...params.input,
    }),
  );
}

export async function muteSmartMemoryItemRemote(params: {
  memoryItemId: string;
  clientMutationId: string;
}): Promise<SmartMemoryItemMutationResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  return mutateSmartMemoryItemRemote(params.memoryItemId, "mute", params.clientMutationId);
}

export async function restoreSmartMemoryItemRemote(params: {
  memoryItemId: string;
  clientMutationId: string;
}): Promise<SmartMemoryItemMutationResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  return mutateSmartMemoryItemRemote(
    params.memoryItemId,
    "restore",
    params.clientMutationId,
  );
}

export async function deleteSmartMemoryItemRemote(params: {
  memoryItemId: string;
  clientMutationId: string;
}): Promise<SmartMemoryItemMutationResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  return mutateSmartMemoryItemRemote(params.memoryItemId, "delete", params.clientMutationId);
}

export async function markSmartMemoryItemSourceDeletedRemote(params: {
  memoryItemId: string;
  clientMutationId: string;
  input: SmartMemorySourceDeletedInput;
}): Promise<SmartMemoryItemMutationResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  return requireItemResponse(
    await post(
      `${SMART_MEMORY_ENDPOINT}/items/${encodeURIComponent(params.memoryItemId)}/source-deleted`,
      {
        clientMutationId: params.clientMutationId,
        sourceRef: params.input.sourceRef,
      },
    ),
  );
}

async function mutateSmartMemoryItemRemote(
  memoryItemId: string,
  action: "mute" | "restore" | "delete",
  clientMutationId: string,
): Promise<SmartMemoryItemMutationResponse> {
  return requireItemResponse(
    await post(
      `${SMART_MEMORY_ENDPOINT}/items/${encodeURIComponent(memoryItemId)}/${action}`,
      { clientMutationId },
    ),
  );
}

export async function updateSmartMemorySettingsRemote(params: {
  enabled: boolean;
  clientMutationId: string;
}): Promise<SmartMemorySettingsResponse> {
  requireRuntimeFeatureEnabled("smartMemory");
  return requireSettingsResponse(
    await patch(`${SMART_MEMORY_ENDPOINT}/settings`, {
      enabled: params.enabled,
      clientMutationId: params.clientMutationId,
    }),
  );
}
