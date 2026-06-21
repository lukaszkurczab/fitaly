import { describe, expect, it } from "@jest/globals";
import {
  selectMemoryCenterState,
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

  it("suppresses active memory for allergy profiles when memory compatibility is unknown", () => {
    const result = selectReviewSmartMemoryExplanation(
      projection({
        items: [
          item({
            item: {
              ...item().item,
              subject: {
                displayLabel: "Chicken",
              },
            },
          }),
        ],
      }),
      [{ name: "Chicken", amount: 180, unit: "g" }],
      { allergies: ["peanuts"], preferences: [] },
    );

    expect(result).toEqual({ activeIngredients: [], row: null });
  });

  it("suppresses active memory for hard restrictions when memory compatibility is unknown", () => {
    const result = selectReviewSmartMemoryExplanation(
      projection({
        items: [
          item({
            item: {
              ...item().item,
              subject: {
                displayLabel: "Chicken",
              },
            },
          }),
        ],
      }),
      [{ name: "Chicken", amount: 180, unit: "g" }],
      { allergies: [], preferences: ["vegan"] },
    );

    expect(result).toEqual({ activeIngredients: [], row: null });
  });

  it("allows active memory when explicit dietary flags satisfy a hard restriction", () => {
    const result = selectReviewSmartMemoryExplanation(
      projection({
        items: [
          item({
            item: {
              ...item().item,
              subject: {
                displayLabel: "Tofu",
                dietaryFlags: ["vegan"],
              },
            },
          }),
        ],
      }),
      [{ name: "Tofu", amount: 180, unit: "g" }],
      { allergies: [], preferences: ["vegan"] },
    );

    expect(result.activeIngredients).toHaveLength(1);
    expect(result.activeIngredients[0]?.detail).toMatchObject({
      memoryType: "typical_portion",
      state: "active",
      affectedLabel: "Tofu",
      usedValueLabel: "180 g",
    });
  });

  it("does not treat macro-style preferences as hard memory exclusions", () => {
    const result = selectReviewSmartMemoryExplanation(
      projection({
        items: [
          item({
            item: {
              ...item().item,
              subject: {
                displayLabel: "Chicken",
              },
            },
          }),
        ],
      }),
      [{ name: "Chicken", amount: 180, unit: "g" }],
      { allergies: [], preferences: ["highProtein"] },
    );

    expect(result.activeIngredients).toHaveLength(1);
    expect(result.activeIngredients[0]?.detail).toMatchObject({
      memoryType: "typical_portion",
      state: "active",
      usedValueLabel: "180 g",
    });
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

  it("uses promoted active item while hiding the activated source candidate", () => {
    const promotedCandidate = candidate({
      projectionState: "activated",
      suggestionUse: "blocked",
      candidate: {
        ...candidate().candidate,
        state: "activated",
        suppressionChecks: {
          promotedToMemoryItemId: "memory-1",
        },
      },
    });

    const result = select(
      projection({
        items: [item()],
        candidates: [promotedCandidate],
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
});

describe("selectMemoryCenterState", () => {
  it("derives empty enabled and disabled account states", () => {
    expect(selectMemoryCenterState(null)).toMatchObject({
      accountEnabled: true,
      hasRows: false,
      hasPendingRows: false,
      hasFailedRows: false,
      visibleItems: [],
      candidates: [],
    });

    expect(
      selectMemoryCenterState(
        projection({
          settings: settings(false),
        }),
      ),
    ).toMatchObject({
      accountEnabled: false,
      hasRows: false,
      hasPendingRows: false,
      hasFailedRows: false,
    });
  });

  it("groups visible memory items by first-slice type", () => {
    const portion = item();
    const correction = item({
      item: {
        ...item().item,
        memoryItemId: "memory-correction",
        memoryType: "review_correction",
        userValue: { amount: 70, unit: "g", reasonCode: "user_corrected" },
      },
    });
    const ingredientProduct = item({
      item: {
        ...item().item,
        memoryItemId: "memory-product",
        memoryType: "ingredient_product_selection",
        userValue: { displayLabel: "Private product" },
      },
    });
    const deleted = item({
      projectionState: "deleted_suppressed",
      item: {
        ...item().item,
        memoryItemId: "memory-deleted",
        state: "deleted_suppressed",
      },
    });

    const result = selectMemoryCenterState(
      projection({
        items: [portion, correction, ingredientProduct, deleted],
      }),
    );

    expect(result.visibleItems.map((entry) => entry.item.memoryItemId)).toEqual([
      "memory-1",
      "memory-correction",
      "memory-product",
    ]);
    expect(result.portionItems).toHaveLength(1);
    expect(result.correctionItems).toHaveLength(1);
    expect(result.ingredientProductItems).toHaveLength(1);
    expect(result.hasRows).toBe(true);
  });

  it("keeps pending and failed controls visible for recovery", () => {
    const pending = item({
      projectionState: "queued_delete",
      queuedOperation: {
        operation: "delete",
        status: "queued",
        clientMutationId: "delete-1",
        updatedAt: now,
      },
    });
    const failed = item({
      item: {
        ...item().item,
        memoryItemId: "memory-failed",
      },
      projectionState: "sync_failed",
      syncState: "dead_letter",
      queuedOperation: {
        operation: "mute",
        status: "dead_letter",
        clientMutationId: "mute-1",
        updatedAt: now,
      },
    });

    const result = selectMemoryCenterState(
      projection({
        items: [pending, failed],
      }),
    );

    expect(result.visibleItems.map((entry) => entry.item.memoryItemId)).toEqual([
      "memory-1",
      "memory-failed",
    ]);
    expect(result.hasPendingRows).toBe(true);
    expect(result.hasFailedRows).toBe(true);
  });

  it("counts candidates as rows without activating them", () => {
    const result = selectMemoryCenterState(
      projection({
        candidates: [candidate()],
      }),
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.hasRows).toBe(true);
    expect(result.visibleItems).toEqual([]);
  });
});
