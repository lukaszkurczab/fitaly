import { describe, expect, it } from "@jest/globals";
import {
  selectReviewSmartMemoryExplanation,
  type ReviewMemoryExplanation,
} from "@/services/smartMemory/smartMemoryService";
import type {
  SmartMemoryProjection,
  SmartMemoryProjectionCandidate,
  SmartMemoryProjectionItem,
  SmartMemoryProjectionSettings,
} from "@/services/smartMemory/smartMemoryProjectionRepository";
import type {
  SmartMemoryCandidate,
  SmartMemoryItem,
  SmartMemorySettings,
} from "@/types/smartMemory";

const now = "2026-06-15T10:00:00.000Z";

function settings(enabled = true): SmartMemoryProjectionSettings {
  const payload: SmartMemorySettings = {
    ownerUserId: "user-1",
    enabled,
    disabledAt: enabled ? null : now,
    updatedAt: now,
    serverRevision: 1,
  };
  return {
    kind: "settings",
    settings: payload,
    projectionState: enabled ? "no_signal" : "disabled",
    suggestionUse: "blocked",
    syncState: "synced",
    queuedOperation: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}

function item(overrides: Partial<SmartMemoryProjectionItem> = {}): SmartMemoryProjectionItem {
  const payload: SmartMemoryItem = {
    memoryItemId: "memory-1",
    ownerUserId: "user-1",
    schemaVersion: 1,
    memoryType: "typical_portion",
    state: "active",
    stateReason: "threshold_met",
    subject: { displayLabel: "Chicken" },
    userValue: { amount: 180, unit: "g" },
    evidenceSummary: { observationCount: 3, distinctDayCount: 2 },
    sourceRefs: [],
    threshold: {},
    confidence: {},
    confidenceReasonCodes: ["distinct_days_met"],
    control: {},
    createdAt: now,
    updatedAt: now,
    lastEvaluatedAt: now,
    mutedAt: null,
    deletedAt: null,
    editedAt: null,
    restoredAt: null,
    sourceDeletedAt: null,
    serverRevision: 1,
  };
  return {
    kind: "item",
    item: payload,
    projectionState: "active",
    suggestionUse: "allowed",
    syncState: "synced",
    queuedOperation: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<SmartMemoryProjectionCandidate> = {},
): SmartMemoryProjectionCandidate {
  const payload: SmartMemoryCandidate = {
    candidateId: "candidate-1",
    ownerUserId: "user-1",
    schemaVersion: 1,
    memoryType: "typical_portion",
    state: "candidate",
    subject: { displayLabel: "Chicken" },
    evidenceSummary: { observationCount: 1 },
    sourceRefs: [],
    confidenceReasonCodes: ["single_observation"],
    suppressionChecks: {},
    createdAt: now,
    updatedAt: now,
    firstSeenAt: now,
    lastSeenAt: now,
    serverRevision: 1,
  };
  return {
    kind: "candidate",
    candidate: payload,
    projectionState: "backend_candidate",
    suggestionUse: "pending_only",
    syncState: "synced",
    queuedOperation: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

function projection(
  overrides: Partial<SmartMemoryProjection> = {},
): SmartMemoryProjection {
  return {
    settings: settings(true),
    items: [],
    candidates: [],
    ...overrides,
  };
}

function select(input: SmartMemoryProjection): ReviewMemoryExplanation {
  return selectReviewSmartMemoryExplanation(input, [
    { name: "Chicken", amount: 180, unit: "g" },
  ]);
}

describe("selectReviewSmartMemoryExplanation", () => {
  it("selects active allowed memory only when it has a safe matching label", () => {
    const result = select(
      projection({
        items: [
          item(),
          item({
            item: {
              ...item().item,
              memoryItemId: "memory-hidden",
              subject: { aliasHash: "raw-hash-only" },
            },
          }),
        ],
      }),
    );

    expect(result.activeIngredients).toHaveLength(1);
    expect(result.activeIngredients[0]?.detail).toMatchObject({
      memoryType: "typical_portion",
      state: "active",
      usedValueLabel: "180 g",
    });
    expect(result.row).toBeNull();
  });

  it("suppresses active and candidate detail when memory settings are disabled", () => {
    const result = select(
      projection({
        settings: settings(false),
        items: [item()],
        candidates: [candidate()],
      }),
    );

    expect(result).toEqual({ activeIngredients: [], row: null });
  });

  it("prioritizes sync failures over pending and new candidates while preserving separate active icons", () => {
    const result = select(
      projection({
        items: [item()],
        candidates: [
          candidate({
            candidate: { ...candidate().candidate, candidateId: "pending" },
            projectionState: "pending_offline_candidate",
            syncState: "pending",
            queuedOperation: {
              operation: "candidate_upsert",
              status: "queued",
              clientMutationId: "pending-1",
              updatedAt: now,
            },
          }),
          candidate({
            candidate: { ...candidate().candidate, candidateId: "failed" },
            projectionState: "sync_failed",
            syncState: "sync_failed",
            queuedOperation: {
              operation: "candidate_upsert",
              status: "sync_failed",
              clientMutationId: "failed-1",
              updatedAt: now,
            },
          }),
        ],
      }),
    );

    expect(result.activeIngredients).toHaveLength(1);
    expect(result.row?.kind).toBe("sync_failed");
    expect(result.row?.detail.state).toBe("failed");
  });

  it("uses pending offline before backend new candidates", () => {
    const result = select(
      projection({
        candidates: [
          candidate({
            candidate: { ...candidate().candidate, candidateId: "new" },
          }),
          candidate({
            candidate: { ...candidate().candidate, candidateId: "pending" },
            projectionState: "pending_offline_candidate",
            syncState: "pending",
          }),
        ],
      }),
    );

    expect(result.row?.kind).toBe("pending_offline");
  });

  it("does not show deleted or source-deleted suggestions", () => {
    const result = select(
      projection({
        items: [
          item({
            projectionState: "source_deleted",
            suggestionUse: "blocked",
            item: {
              ...item().item,
              state: "source_deleted",
              sourceDeletedAt: now,
            },
          }),
        ],
        candidates: [
          candidate({
            projectionState: "deleted_suppressed",
            suggestionUse: "blocked",
            candidate: {
              ...candidate().candidate,
              state: "deleted_suppressed",
            },
          }),
        ],
      }),
    );

    expect(result).toEqual({ activeIngredients: [], row: null });
  });
});
