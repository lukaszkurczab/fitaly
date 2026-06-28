import { get, patch, post } from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { requireRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import {
  SMART_MEMORY_CANDIDATE_STATES,
  SMART_MEMORY_CONFIDENCE_REASON_CODES,
  SMART_MEMORY_SCHEMA_VERSION,
  SMART_MEMORY_STATE_REASON_CODES,
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

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : null;
}

function optionalOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null | undefined {
  if (value == null) return null;
  return isOneOf(value, allowed) ? value : undefined;
}

function exactStringsArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): Array<T[number]> | null {
  if (!Array.isArray(value)) return null;
  const items: Array<T[number]> = [];
  for (const item of value) {
    if (!isOneOf(item, allowed)) return null;
    items.push(item);
  }
  return items;
}

function hashedSourceRefsArray(
  value: unknown,
): Array<{ kind: string; sourceHash: string }> | null {
  if (!Array.isArray(value)) return null;
  const sourceRefs: Array<{ kind: string; sourceHash: string }> = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const kind = optionalString(item.kind);
    const sourceHash = optionalString(item.sourceHash);
    const keys = Object.keys(item);
    if (
      !kind ||
      !sourceHash ||
      keys.some((key) => key !== "kind" && key !== "sourceHash")
    ) {
      return null;
    }
    sourceRefs.push({ kind, sourceHash });
  }
  return sourceRefs;
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
  if (raw.schemaVersion !== SMART_MEMORY_SCHEMA_VERSION) return null;
  const stateReason = optionalOneOf(
    raw.stateReason,
    SMART_MEMORY_STATE_REASON_CODES,
  );
  const sourceRefs = hashedSourceRefsArray(raw.sourceRefs);
  const confidenceReasonCodes = exactStringsArray(
    raw.confidenceReasonCodes,
    SMART_MEMORY_CONFIDENCE_REASON_CODES,
  );
  const serverRevision = positiveInteger(raw.serverRevision);
  if (
    stateReason === undefined ||
    !sourceRefs ||
    !confidenceReasonCodes ||
    serverRevision === null
  ) {
    return null;
  }

  return {
    memoryItemId,
    ownerUserId,
    schemaVersion: SMART_MEMORY_SCHEMA_VERSION,
    memoryType,
    state,
    stateReason,
    subject: recordOrEmpty(raw.subject),
    userValue: recordOrEmpty(raw.userValue),
    evidenceSummary: recordOrEmpty(raw.evidenceSummary),
    sourceRefs,
    threshold: recordOrEmpty(raw.threshold),
    confidence: recordOrEmpty(raw.confidence),
    confidenceReasonCodes,
    control: recordOrEmpty(raw.control),
    createdAt,
    updatedAt,
    lastEvaluatedAt: optionalString(raw.lastEvaluatedAt),
    mutedAt: optionalString(raw.mutedAt),
    deletedAt: optionalString(raw.deletedAt),
    editedAt: optionalString(raw.editedAt),
    restoredAt: optionalString(raw.restoredAt),
    sourceDeletedAt: optionalString(raw.sourceDeletedAt),
    serverRevision,
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
  if (raw.schemaVersion !== SMART_MEMORY_SCHEMA_VERSION) return null;
  const sourceRefs = hashedSourceRefsArray(raw.sourceRefs);
  const confidenceReasonCodes = exactStringsArray(
    raw.confidenceReasonCodes,
    SMART_MEMORY_CONFIDENCE_REASON_CODES,
  );
  const serverRevision = positiveInteger(raw.serverRevision);
  if (!sourceRefs || !confidenceReasonCodes || serverRevision === null) {
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
    sourceRefs,
    confidenceReasonCodes,
    suppressionChecks: recordOrEmpty(raw.suppressionChecks),
    createdAt,
    updatedAt,
    firstSeenAt: optionalString(raw.firstSeenAt),
    lastSeenAt: optionalString(raw.lastSeenAt),
    serverRevision,
  };
}

function normalizeSettings(raw: unknown): SmartMemorySettings | null {
  if (!isRecord(raw)) return null;
  const ownerUserId = optionalString(raw.ownerUserId);
  const updatedAt = optionalString(raw.updatedAt);
  if (!ownerUserId || typeof raw.enabled !== "boolean" || !updatedAt) {
    return null;
  }
  const serverRevision = positiveInteger(raw.serverRevision);
  if (serverRevision === null) return null;
  return {
    ownerUserId,
    enabled: raw.enabled,
    disabledAt: optionalString(raw.disabledAt),
    updatedAt,
    serverRevision,
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
