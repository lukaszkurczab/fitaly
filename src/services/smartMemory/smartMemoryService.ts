import {
  discardDeadLetterOps,
  discardQueuedOpsByClientMutationIds,
  enqueueSmartMemoryCandidateUpsert,
  enqueueSmartMemoryItemDelete,
  enqueueSmartMemoryItemEdit,
  enqueueSmartMemoryItemMute,
  enqueueSmartMemoryItemRestore,
  enqueueSmartMemoryItemSourceDeleted,
  enqueueSmartMemorySettingsDisable,
  enqueueSmartMemorySettingsEnable,
  getDeadLetterOps,
  retryDeadLetterOps,
} from "@/services/offline/queue.repo";
import {
  discardFailedSmartMemoryProjection,
  getActiveSmartMemoryItemsForReview,
  getFailedSmartMemoryClientMutationIds,
  getSmartMemoryProjection,
  markFailedSmartMemoryProjectionPending,
  markSmartMemoryCandidatePending,
  markSmartMemoryItemPending,
  markSmartMemorySettingsPending,
  smartMemoryQueueKinds,
  type SmartMemoryProjection,
  type SmartMemoryProjectionCandidate,
  type SmartMemoryProjectionItem,
  type SmartMemoryProjectionSettings,
} from "./smartMemoryProjectionRepository";
import type {
  SmartMemoryCandidateUpsertInput,
  SmartMemoryItem,
  SmartMemoryItemEditInput,
  SmartMemoryType,
  SmartMemoryUserValue,
  SmartMemorySourceDeletedInput,
} from "@/types/smartMemory";

type ReviewIngredient = {
  name: string;
  amount?: number;
  unit?: string;
};

export type ReviewMemoryEvidence = {
  observationCount: number | null;
  distinctDayCount: number | null;
  selectionCount: number | null;
  correctionCount: number | null;
};

export type ReviewMemoryDetail = {
  key: string;
  memoryType: SmartMemoryType | "settings";
  state: "active" | "pending" | "failed";
  affectedLabel: string;
  usedValueLabel: string;
  evidence: ReviewMemoryEvidence;
};

export type ReviewMemoryRowKind =
  | "sync_failed"
  | "pending_offline"
  | "new_candidate";

export type ReviewMemoryRow = {
  kind: ReviewMemoryRowKind;
  detail: ReviewMemoryDetail;
};

export type ReviewMemoryExplanation = {
  activeIngredients: Array<{
    ingredientName: string;
    detail: ReviewMemoryDetail;
  }>;
  row: ReviewMemoryRow | null;
};

export type MemoryCenterServiceState = {
  settings: SmartMemoryProjectionSettings | null;
  accountEnabled: boolean;
  visibleItems: SmartMemoryProjectionItem[];
  candidates: SmartMemoryProjectionCandidate[];
  portionItems: SmartMemoryProjectionItem[];
  correctionItems: SmartMemoryProjectionItem[];
  ingredientProductItems: SmartMemoryProjectionItem[];
  hasRows: boolean;
  hasPendingRows: boolean;
  hasFailedRows: boolean;
};

const FAILED_SYNC_STATES = new Set(["sync_failed", "dead_letter", "conflicted"]);
const HIDDEN_PROJECTION_STATES = new Set([
  "muted",
  "activated",
  "deleted_suppressed",
  "disabled",
  "source_deleted",
  "queued_delete",
  "queued_disable",
]);

export type SmartMemoryQueueResult = {
  clientMutationId: string;
  updatedAt: string;
};

export async function readSmartMemoryProjection(
  uid: string,
): Promise<SmartMemoryProjection> {
  return getSmartMemoryProjection(uid);
}

export async function readActiveSmartMemoryForReview(
  uid: string,
): Promise<SmartMemoryItem[]> {
  return getActiveSmartMemoryItemsForReview(uid);
}

export async function readReviewSmartMemoryExplanation(params: {
  uid: string;
  ingredients: ReviewIngredient[];
}): Promise<ReviewMemoryExplanation> {
  const projection = await getSmartMemoryProjection(params.uid);
  return selectReviewSmartMemoryExplanation(projection, params.ingredients);
}

export function selectMemoryCenterState(
  projection: SmartMemoryProjection | null,
): MemoryCenterServiceState {
  const settings = projection?.settings ?? null;
  const accountEnabled = settings?.settings.enabled ?? true;
  const visibleItems = selectMemoryCenterVisibleItems(projection?.items ?? []);
  const candidates = projection?.candidates ?? [];
  const entries = [
    settings,
    ...(projection?.items ?? []),
    ...(projection?.candidates ?? []),
  ];

  return {
    settings,
    accountEnabled,
    visibleItems,
    candidates,
    portionItems: visibleItems.filter(
      (item) => item.item.memoryType === "typical_portion",
    ),
    correctionItems: visibleItems.filter(
      (item) => item.item.memoryType === "review_correction",
    ),
    ingredientProductItems: visibleItems.filter(
      (item) => item.item.memoryType === "ingredient_product_selection",
    ),
    hasRows: visibleItems.length > 0 || candidates.length > 0,
    hasPendingRows: entries.some((entry) => Boolean(entry?.queuedOperation)),
    hasFailedRows: entries.some((entry) => Boolean(entry && isFailedEntry(entry))),
  };
}

export function selectReviewSmartMemoryExplanation(
  projection: SmartMemoryProjection,
  ingredients: ReviewIngredient[],
): ReviewMemoryExplanation {
  const failedRow = selectFailedRow(projection);
  const settingsDisabled = isSettingsDisabled(projection.settings);
  const activeIngredients = settingsDisabled
    ? []
    : selectActiveIngredients(projection.items, ingredients);

  if (failedRow) {
    return { activeIngredients, row: failedRow };
  }

  if (settingsDisabled) {
    return { activeIngredients: [], row: null };
  }

  const pendingRow = selectCandidateRow(projection.candidates, "pending_offline");
  if (pendingRow) return { activeIngredients, row: pendingRow };

  const newCandidateRow = selectCandidateRow(projection.candidates, "new_candidate");
  return { activeIngredients, row: newCandidateRow };
}

function selectActiveIngredients(
  items: SmartMemoryProjectionItem[],
  ingredients: ReviewIngredient[],
): ReviewMemoryExplanation["activeIngredients"] {
  const result: ReviewMemoryExplanation["activeIngredients"] = [];
  const usedIngredientNames = new Set<string>();

  for (const item of items) {
    if (
      item.projectionState !== "active" ||
      item.suggestionUse !== "allowed" ||
      item.syncState !== "synced" ||
      item.item.state !== "active" ||
      isHiddenItem(item)
    ) {
      continue;
    }

    const affectedLabel = getSafeLabel(item.item.subject, [
      "displayLabel",
      "name",
      "alias",
      "ingredientName",
      "productName",
    ]);
    if (!affectedLabel) continue;

    const matchedIngredient = ingredients.find(
      (ingredient) => normalizeLabel(ingredient.name) === normalizeLabel(affectedLabel),
    );
    if (!matchedIngredient) continue;

    const normalizedName = normalizeLabel(matchedIngredient.name);
    if (usedIngredientNames.has(normalizedName)) continue;
    usedIngredientNames.add(normalizedName);

    result.push({
      ingredientName: matchedIngredient.name,
      detail: {
        key: `active-${result.length}`,
        memoryType: item.item.memoryType,
        state: "active",
        affectedLabel: matchedIngredient.name,
        usedValueLabel: formatSmartMemoryUserValue(item.item.userValue),
        evidence: readEvidence(item.item.evidenceSummary),
      },
    });
  }

  return result;
}

function selectFailedRow(projection: SmartMemoryProjection): ReviewMemoryRow | null {
  const failedEntry = [
    projection.settings,
    ...projection.items,
    ...projection.candidates,
  ].find((entry) => entry && isFailedEntry(entry));

  if (!failedEntry) return null;

  return {
    kind: "sync_failed",
    detail: detailForEntry(failedEntry, "failed"),
  };
}

function selectCandidateRow(
  candidates: SmartMemoryProjectionCandidate[],
  kind: Extract<ReviewMemoryRowKind, "pending_offline" | "new_candidate">,
): ReviewMemoryRow | null {
  const candidate = candidates.find((entry) => {
    if (isHiddenCandidate(entry)) return false;
    if (kind === "pending_offline") {
      return (
        entry.projectionState === "pending_offline_candidate" ||
        entry.syncState === "pending" ||
        entry.queuedOperation?.operation === "candidate_upsert"
      );
    }
    return (
      entry.projectionState === "backend_candidate" &&
      entry.suggestionUse === "pending_only" &&
      entry.syncState === "synced"
    );
  });

  if (!candidate) return null;

  return {
    kind,
    detail: detailForEntry(candidate, "pending"),
  };
}

function detailForEntry(
  entry:
    | SmartMemoryProjectionItem
    | SmartMemoryProjectionCandidate
    | SmartMemoryProjectionSettings,
  state: ReviewMemoryDetail["state"],
): ReviewMemoryDetail {
  if (entry.kind === "settings") {
    return {
      key: `settings-${state}`,
      memoryType: "settings",
      state,
      affectedLabel: "",
      usedValueLabel: "",
      evidence: emptyEvidence(),
    };
  }

  if (entry.kind === "item") {
    return {
      key: `item-${entry.item.memoryType}-${state}`,
      memoryType: entry.item.memoryType,
      state,
      affectedLabel:
        getSafeLabel(entry.item.subject, [
          "displayLabel",
          "name",
          "alias",
          "ingredientName",
          "productName",
        ]) ?? "",
      usedValueLabel: formatSmartMemoryUserValue(entry.item.userValue),
      evidence: readEvidence(entry.item.evidenceSummary),
    };
  }

  return {
    key: `candidate-${entry.candidate.memoryType}-${state}`,
    memoryType: entry.candidate.memoryType,
    state,
    affectedLabel:
      getSafeLabel(entry.candidate.subject, [
        "displayLabel",
        "name",
        "alias",
        "ingredientName",
        "productName",
      ]) ?? "",
    usedValueLabel: "",
    evidence: readEvidence(entry.candidate.evidenceSummary ?? {}),
  };
}

function isSettingsDisabled(settings: SmartMemoryProjectionSettings | null): boolean {
  return Boolean(
    settings &&
      (!settings.settings.enabled ||
        settings.projectionState === "disabled" ||
        settings.projectionState === "queued_disable"),
  );
}

function isFailedEntry(entry: {
  projectionState: string;
  syncState: string;
  queuedOperation: { status: string } | null;
}): boolean {
  return (
    FAILED_SYNC_STATES.has(entry.syncState) ||
    FAILED_SYNC_STATES.has(entry.queuedOperation?.status ?? "") ||
    entry.projectionState === "sync_failed" ||
    entry.projectionState === "conflicted"
  );
}

function isHiddenItem(entry: SmartMemoryProjectionItem): boolean {
  return (
    HIDDEN_PROJECTION_STATES.has(entry.projectionState) ||
    entry.item.state === "deleted_suppressed" ||
    entry.item.state === "source_deleted" ||
    entry.item.state === "muted"
  );
}

function isHiddenCandidate(entry: SmartMemoryProjectionCandidate): boolean {
  const candidateState =
    "state" in entry.candidate ? entry.candidate.state : "candidate";
  return (
    HIDDEN_PROJECTION_STATES.has(entry.projectionState) ||
    candidateState === "deleted_suppressed" ||
    candidateState === "source_deleted"
  );
}

function selectMemoryCenterVisibleItems(
  items: SmartMemoryProjectionItem[],
): SmartMemoryProjectionItem[] {
  return items.filter((item) => {
    if (item.queuedOperation) return true;
    if (isFailedEntry(item)) return true;
    return item.projectionState !== "deleted_suppressed";
  });
}

function formatSmartMemoryUserValue(value: SmartMemoryUserValue): string {
  if ("amount" in value && typeof value.amount === "number") {
    return `${value.amount} ${value.unit}`;
  }

  const label = getSafeLabel(value, ["displayLabel", "alias"]);
  return label ?? "";
}

function readEvidence(value: Record<string, unknown>): ReviewMemoryEvidence {
  return {
    observationCount: readNumber(value.observationCount),
    distinctDayCount: readNumber(value.distinctDayCount),
    selectionCount: readNumber(value.selectionCount),
    correctionCount: readNumber(value.correctionCount),
  };
}

function emptyEvidence(): ReviewMemoryEvidence {
  return {
    observationCount: null,
    distinctDayCount: null,
    selectionCount: null,
    correctionCount: null,
  };
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getSafeLabel(
  value: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function normalizeLabel(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export async function queueSmartMemoryCandidateUpsert(
  uid: string,
  input: SmartMemoryCandidateUpsertInput,
): Promise<SmartMemoryQueueResult> {
  const queued = await enqueueSmartMemoryCandidateUpsert(uid, input);
  await markSmartMemoryCandidatePending({
    uid,
    input,
    clientMutationId: queued.clientMutationId,
    updatedAt: queued.updatedAt,
  });
  return queued;
}

export async function queueSmartMemoryItemEdit(
  uid: string,
  memoryItemId: string,
  input: SmartMemoryItemEditInput,
): Promise<SmartMemoryQueueResult> {
  const queued = await enqueueSmartMemoryItemEdit(uid, memoryItemId, input);
  await markSmartMemoryItemPending({
    uid,
    memoryItemId,
    operation: "edit",
    payload: input,
    clientMutationId: queued.clientMutationId,
    updatedAt: queued.updatedAt,
  });
  return queued;
}

export async function queueSmartMemoryItemMute(
  uid: string,
  memoryItemId: string,
): Promise<SmartMemoryQueueResult> {
  const queued = await enqueueSmartMemoryItemMute(uid, memoryItemId);
  await markSmartMemoryItemPending({
    uid,
    memoryItemId,
    operation: "mute",
    clientMutationId: queued.clientMutationId,
    updatedAt: queued.updatedAt,
  });
  return queued;
}

export async function queueSmartMemoryItemRestore(
  uid: string,
  memoryItemId: string,
): Promise<SmartMemoryQueueResult> {
  const queued = await enqueueSmartMemoryItemRestore(uid, memoryItemId);
  await markSmartMemoryItemPending({
    uid,
    memoryItemId,
    operation: "restore",
    clientMutationId: queued.clientMutationId,
    updatedAt: queued.updatedAt,
  });
  return queued;
}

export async function queueSmartMemoryItemDelete(
  uid: string,
  memoryItemId: string,
): Promise<SmartMemoryQueueResult> {
  const queued = await enqueueSmartMemoryItemDelete(uid, memoryItemId);
  await markSmartMemoryItemPending({
    uid,
    memoryItemId,
    operation: "delete",
    clientMutationId: queued.clientMutationId,
    updatedAt: queued.updatedAt,
  });
  return queued;
}

export async function queueSmartMemoryItemSourceDeleted(
  uid: string,
  memoryItemId: string,
  input: SmartMemorySourceDeletedInput,
): Promise<SmartMemoryQueueResult> {
  const queued = await enqueueSmartMemoryItemSourceDeleted(uid, memoryItemId, input);
  await markSmartMemoryItemPending({
    uid,
    memoryItemId,
    operation: "source_deleted",
    payload: input,
    clientMutationId: queued.clientMutationId,
    updatedAt: queued.updatedAt,
  });
  return queued;
}

export async function queueSmartMemorySettingsDisable(
  uid: string,
): Promise<SmartMemoryQueueResult> {
  const queued = await enqueueSmartMemorySettingsDisable(uid);
  await markSmartMemorySettingsPending({
    uid,
    enabled: false,
    operation: "settings_disable",
    clientMutationId: queued.clientMutationId,
    updatedAt: queued.updatedAt,
  });
  return queued;
}

export async function queueSmartMemorySettingsEnable(
  uid: string,
): Promise<SmartMemoryQueueResult> {
  const queued = await enqueueSmartMemorySettingsEnable(uid);
  await markSmartMemorySettingsPending({
    uid,
    enabled: true,
    operation: "settings_enable",
    clientMutationId: queued.clientMutationId,
    updatedAt: queued.updatedAt,
  });
  return queued;
}

export async function retryFailedSmartMemoryControls(uid: string): Promise<{
  retried: number;
  projectionRows: number;
}> {
  const retried = await retryDeadLetterOps({
    uid,
    kinds: smartMemoryQueueKinds(),
  });
  const projectionRows = await markFailedSmartMemoryProjectionPending(uid);
  return { retried, projectionRows };
}

export async function discardFailedSmartMemoryControls(uid: string): Promise<{
  discardedQueueOps: number;
  discardedDeadLetterOps: number;
  projectionRows: number;
}> {
  const kinds = smartMemoryQueueKinds();
  const clientMutationIds = await getFailedSmartMemoryClientMutationIds(uid);
  const deadLetterOps = await getDeadLetterOps({ uid, kinds });
  const discardedDeadLetterOps = await discardDeadLetterOps({
    uid,
    ids: deadLetterOps.map((op) => op.id),
    kinds,
  });
  const discardedQueueOps = await discardQueuedOpsByClientMutationIds({
    uid,
    clientMutationIds,
    kinds,
  });
  const projectionRows = await discardFailedSmartMemoryProjection(uid);
  return { discardedQueueOps, discardedDeadLetterOps, projectionRows };
}
