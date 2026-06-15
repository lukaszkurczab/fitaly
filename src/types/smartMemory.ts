export const SMART_MEMORY_CONTRACT_NAME = "smart_memory_core_v1" as const;
export const SMART_MEMORY_SCHEMA_VERSION = 1 as const;

export const SMART_MEMORY_TYPES = [
  "typical_portion",
  "review_correction",
  "ingredient_product_selection",
] as const;

export const SMART_MEMORY_STATES = [
  "candidate",
  "active",
  "muted",
  "deleted_suppressed",
  "disabled",
  "source_deleted",
  "sync_failed",
  "conflicted",
] as const;

export const SMART_MEMORY_CANDIDATE_STATES = [
  "candidate",
  "deleted_suppressed",
  "source_deleted",
] as const;

export const SMART_MEMORY_STATE_REASON_CODES = [
  "threshold_met",
  "user_muted",
  "user_restored",
  "user_deleted",
  "account_disabled",
  "source_deleted",
  "sync_failed",
  "conflict_remote_won",
  "local_pending",
] as const;

export const SMART_MEMORY_CONFIDENCE_REASON_CODES = [
  "single_observation",
  "distinct_days_met",
  "consistent_user_review",
  "ingredient_selection_repeated",
] as const;

export const SMART_MEMORY_USER_VALUE_REASON_CODES = ["user_corrected"] as const;

export const SMART_MEMORY_USER_CONTROL_OPERATIONS = [
  "candidate_upsert",
  "edit",
  "mute",
  "restore",
  "delete",
  "source_deleted",
  "settings_disable",
  "settings_enable",
] as const;

export const SMART_MEMORY_QUEUE_KINDS = [
  "smart_memory_candidate_upsert",
  "smart_memory_item_edit",
  "smart_memory_item_mute",
  "smart_memory_item_restore",
  "smart_memory_item_delete",
  "smart_memory_item_source_deleted",
  "smart_memory_settings_disable",
  "smart_memory_settings_enable",
] as const;

export const SMART_MEMORY_PROJECTION_STATES = [
  "no_signal",
  "backend_candidate",
  "pending_offline_candidate",
  "active",
  "muted",
  "deleted_suppressed",
  "disabled",
  "source_deleted",
  "sync_failed",
  "conflicted",
  "queued_edit",
  "queued_mute",
  "queued_delete",
  "queued_disable",
] as const;

export const SMART_MEMORY_CENTER_STATES = [
  "empty_enabled",
  "empty_disabled",
  "has_active",
  "has_pending_controls",
  "has_sync_failed",
] as const;

export const SMART_MEMORY_REVIEW_STATES = ["used", "new", "disabled"] as const;

export type SmartMemoryType = (typeof SMART_MEMORY_TYPES)[number];
export type SmartMemoryState = (typeof SMART_MEMORY_STATES)[number];
export type SmartMemoryCandidateState =
  (typeof SMART_MEMORY_CANDIDATE_STATES)[number];
export type SmartMemoryStateReasonCode =
  (typeof SMART_MEMORY_STATE_REASON_CODES)[number];
export type SmartMemoryConfidenceReasonCode =
  (typeof SMART_MEMORY_CONFIDENCE_REASON_CODES)[number];
export type SmartMemoryUserValueReasonCode =
  (typeof SMART_MEMORY_USER_VALUE_REASON_CODES)[number];
export type SmartMemoryUserControlOperation =
  (typeof SMART_MEMORY_USER_CONTROL_OPERATIONS)[number];
export type SmartMemoryQueueKind = (typeof SMART_MEMORY_QUEUE_KINDS)[number];
export type SmartMemoryProjectionState =
  (typeof SMART_MEMORY_PROJECTION_STATES)[number];
export type SmartMemoryCenterState = (typeof SMART_MEMORY_CENTER_STATES)[number];
export type SmartMemoryReviewState = (typeof SMART_MEMORY_REVIEW_STATES)[number];
export type SmartMemoryPortionUnit = "g" | "ml" | "piece" | "serving";
export type SmartMemoryHashedSubject =
  | {
      kind: string;
      aliasHash: string;
      subjectHash?: never;
    }
  | {
      kind: string;
      subjectHash: string;
      aliasHash?: never;
    };
export type SmartMemoryHashedSourceRef = {
  kind: string;
  sourceHash: string;
};
export type SmartMemoryUserValue =
  | Record<string, never>
  | {
      amount: number;
      unit: SmartMemoryPortionUnit;
      reasonCode?: SmartMemoryUserValueReasonCode;
    }
  | {
      displayLabel?: string;
      alias?: string;
      ingredientProductId?: string;
    };

export type SmartMemoryItem = {
  memoryItemId: string;
  ownerUserId: string;
  schemaVersion: typeof SMART_MEMORY_SCHEMA_VERSION;
  memoryType: SmartMemoryType;
  state: SmartMemoryState;
  stateReason?: SmartMemoryStateReasonCode | null;
  subject: Record<string, unknown>;
  userValue: SmartMemoryUserValue;
  evidenceSummary: Record<string, unknown>;
  sourceRefs: Array<Record<string, unknown>>;
  threshold: Record<string, unknown>;
  confidence: Record<string, unknown>;
  confidenceReasonCodes: SmartMemoryConfidenceReasonCode[];
  control: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastEvaluatedAt?: string | null;
  mutedAt?: string | null;
  deletedAt?: string | null;
  editedAt?: string | null;
  restoredAt?: string | null;
  sourceDeletedAt?: string | null;
  serverRevision: number;
};

export type SmartMemoryCandidate = {
  candidateId: string;
  ownerUserId: string;
  schemaVersion: typeof SMART_MEMORY_SCHEMA_VERSION;
  memoryType: SmartMemoryType;
  state: SmartMemoryCandidateState;
  subject: Record<string, unknown>;
  evidenceSummary: Record<string, unknown>;
  sourceRefs: Array<Record<string, unknown>>;
  confidenceReasonCodes: SmartMemoryConfidenceReasonCode[];
  suppressionChecks: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  serverRevision: number;
};

export type SmartMemorySettings = {
  ownerUserId: string;
  enabled: boolean;
  disabledAt?: string | null;
  updatedAt: string;
  serverRevision: number;
  clientMutationId?: string | null;
};

export type SmartMemorySuggestionUse = "allowed" | "blocked" | "pending_only";
export type SmartMemoryLocalSyncState =
  | "synced"
  | "pending"
  | "sync_failed"
  | "dead_letter"
  | "conflicted";

export type SmartMemoryQueuedOperationStatus =
  | "queued"
  | "sync_failed"
  | "dead_letter"
  | "conflicted";

export type SmartMemoryQueuedOperation = {
  operation: SmartMemoryUserControlOperation;
  status: SmartMemoryQueuedOperationStatus;
  clientMutationId: string;
  updatedAt: string;
};

export type SmartMemoryItemsPageResponse = {
  items: SmartMemoryItem[];
  nextCursor?: string | null;
};

export type SmartMemoryCandidatesPageResponse = {
  items: SmartMemoryCandidate[];
  nextCursor?: string | null;
};

export type SmartMemoryCandidateResponse = {
  candidate: SmartMemoryCandidate;
  updated: boolean;
};

export type SmartMemoryItemMutationResponse = {
  item: SmartMemoryItem;
  updated: boolean;
};

export type SmartMemorySettingsResponse = {
  settings: SmartMemorySettings;
  updated: boolean;
};

export type SmartMemoryCandidateUpsertInput = {
  candidateId: string;
  memoryType: SmartMemoryType;
  subject: SmartMemoryHashedSubject;
  evidenceSummary?: Record<string, unknown>;
  sourceRefs?: SmartMemoryHashedSourceRef[];
  confidenceReasonCodes?: SmartMemoryConfidenceReasonCode[];
  suppressionChecks?: Record<string, unknown>;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
};

export type SmartMemoryItemEditInput = {
  userValue?: SmartMemoryUserValue;
  stateReason?: SmartMemoryStateReasonCode | null;
  editedFields?: string[];
};

export type SmartMemorySourceDeletedInput = {
  sourceRef: SmartMemoryHashedSourceRef;
};

export type SmartMemoryCoreContract = {
  contract: typeof SMART_MEMORY_CONTRACT_NAME;
  schemaVersion: typeof SMART_MEMORY_SCHEMA_VERSION;
  memoryTypes: SmartMemoryType[];
  memoryStates: SmartMemoryState[];
  candidateStates: SmartMemoryCandidateState[];
  reasonCodes: {
    stateReasonCodes: SmartMemoryStateReasonCode[];
    confidenceReasonCodes: SmartMemoryConfidenceReasonCode[];
    userValueReasonCodes: SmartMemoryUserValueReasonCode[];
  };
  userControlOperations: SmartMemoryUserControlOperation[];
  offlineProjectionStates: SmartMemoryProjectionState[];
  apiEndpoints: Array<{
    method: "GET" | "POST" | "PATCH";
    path: string;
    response: string;
  }>;
  apiResponseExamples: {
    emptyItemsPage: { items: SmartMemoryItem[] };
    itemsPage: { items: SmartMemoryItem[] };
    candidateResponse: { candidate: SmartMemoryCandidate; updated: boolean };
    itemDeleteResponse: { item: SmartMemoryItem; updated: boolean };
    settingsEnabledResponse: { settings: SmartMemorySettings; updated: boolean };
    settingsDisabledResponse: { settings: SmartMemorySettings; updated: boolean };
  };
  stateTransitionExamples: Array<{
    case: SmartMemoryProjectionState;
    memoryType?: SmartMemoryType | null;
    backendState?: SmartMemoryState | null;
    projectionState: SmartMemoryProjectionState;
    reviewState?: SmartMemoryReviewState | null;
    memoryItemId?: string | null;
    candidateId?: string | null;
    queuedOperation?: {
      operation: SmartMemoryUserControlOperation;
      status: "queued" | "sync_failed" | "conflicted";
      clientMutationId: string;
    } | null;
    suggestionUse: "allowed" | "blocked" | "pending_only";
  }>;
  memoryCenter: {
    states: SmartMemoryCenterState[];
    emptyEnabledAllowsCandidates: boolean;
    disabledBlocksCandidateWrites: boolean;
    syncFailedRequiresVisibleRetryOrDiscard: boolean;
  };
  review: {
    states: SmartMemoryReviewState[];
    usedCanReferenceBackendActiveMemory: boolean;
    newCannotDependOnPendingCandidate: boolean;
    disabledCannotWriteCandidate: boolean;
  };
  privacyBoundary: {
    excludesMealNarrativeText: boolean;
    excludesReviewDiffs: boolean;
    excludesProviderPayloads: boolean;
    excludesTelemetryPrivateIdentifiers: boolean;
    usesHashedSubjectAndSourceRefs: boolean;
  };
};
