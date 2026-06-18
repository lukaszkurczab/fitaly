import { describe, expect, it } from "@jest/globals";
import {
  rankHomeNextActionCandidates,
  selectHomeNextAction,
} from "@/feature/Home/services/homeNextActionSelector";
import type {
  HomeNextActionCandidate,
  HomeNextActionInput,
  HomeNextActionNoActionCandidate,
  HomeNextActionReasonCode,
  HomeNextActionType,
} from "@/feature/Home/services/homeNextActionSelector";

const NOW = "2026-06-18T12:00:00.000Z";
const FUTURE = "2026-06-18T13:00:00.000Z";
const PAST = "2026-06-18T11:00:00.000Z";

const OWNER_BY_ACTION: Record<HomeNextActionType, HomeNextActionCandidate["ownerFlow"]> = {
  log_missing_meal: "MealAddMethod",
  continue_review: "ReviewMeal",
  continue_planned_item: "Planning",
  confirm_known_pattern: "KnownPatternConfirmation",
  inspect_memory: "MemoryCenter",
};

const SOURCE_BY_ACTION: Record<HomeNextActionType, HomeNextActionCandidate["sourceDomain"]> = {
  log_missing_meal: "home_day",
  continue_review: "review_draft",
  continue_planned_item: "planned_meal",
  confirm_known_pattern: "known_pattern_candidate",
  inspect_memory: "smart_memory",
};

const REASON_BY_ACTION: Record<HomeNextActionType, HomeNextActionReasonCode> = {
  log_missing_meal: "missing_meal_available",
  continue_review: "review_draft_available",
  continue_planned_item: "planned_item_due",
  confirm_known_pattern: "known_pattern_available",
  inspect_memory: "memory_attention",
};

function action(
  actionType: HomeNextActionType,
  overrides: Partial<HomeNextActionCandidate> = {},
): HomeNextActionCandidate {
  return {
    candidateId: `${actionType}-candidate`,
    actionType,
    sourceDomain: SOURCE_BY_ACTION[actionType],
    state: "eligible",
    priorityBucket: 10,
    reasonCode: REASON_BY_ACTION[actionType],
    ownerFlow: OWNER_BY_ACTION[actionType],
    sourceVersion: "v1",
    ...overrides,
  };
}

function noAction(
  overrides: Partial<HomeNextActionNoActionCandidate> = {},
): HomeNextActionNoActionCandidate {
  return {
    candidateId: "no-action",
    sourceDomain: "home_day",
    state: "no_action",
    priorityBucket: 99,
    reasonCode: "inputs_insufficient",
    ...overrides,
  };
}

function selectedActionType(candidates: HomeNextActionInput[]): HomeNextActionType | null {
  const selection = selectHomeNextAction({ candidates, now: NOW });
  return selection.type === "action" ? selection.action.actionType : null;
}

describe("homeNextActionSelector", () => {
  it("returns explicit no_action for a new user with no candidates", () => {
    expect(selectHomeNextAction({ candidates: [], now: NOW })).toEqual({
      type: "no_action",
      reasonCode: "no_eligible_candidate",
      sourceCandidateId: null,
    });
  });

  it("selects interrupted review above every lower-ranked candidate", () => {
    expect(
      selectedActionType([
        action("log_missing_meal"),
        action("continue_planned_item"),
        action("confirm_known_pattern"),
        action("inspect_memory"),
        action("continue_review", {
          candidateId: "review-draft-1",
          sourceDomain: "review_draft",
        }),
      ]),
    ).toBe("continue_review");
  });

  it("suppresses dismissed review candidates and falls through to the next eligible candidate", () => {
    expect(
      selectHomeNextAction({
        candidates: [
          action("continue_review", {
            state: "dismissed",
            dismissedUntil: FUTURE,
            sourceDomain: "review_draft",
          }),
          action("confirm_known_pattern"),
        ],
        now: NOW,
      }),
    ).toEqual({
      type: "action",
      action: expect.objectContaining({
        actionType: "confirm_known_pattern",
      }),
    });
  });

  it("returns a bounded suppressed reason when no lower-priority candidate is eligible", () => {
    expect(
      selectHomeNextAction({
        candidates: [
          action("continue_review", {
            candidateId: "review-dismissed",
            state: "dismissed",
            dismissedUntil: FUTURE,
          }),
        ],
        now: NOW,
      }),
    ).toEqual({
      type: "no_action",
      reasonCode: "candidate_dismissed",
      sourceCandidateId: "review-dismissed",
    });
  });

  it("selects memory inspection above planned, known-pattern, and missing-meal candidates", () => {
    expect(
      selectedActionType([
        action("log_missing_meal"),
        action("confirm_known_pattern", {
          sourceDomain: "known_pattern_candidate",
        }),
        action("continue_planned_item", {
          sourceDomain: "planned_meal",
        }),
        action("inspect_memory", {
          sourceDomain: "smart_memory",
        }),
      ]),
    ).toBe("inspect_memory");
  });

  it("selects a fresh planned item when no higher candidate is present", () => {
    const selection = selectHomeNextAction({
      candidates: [
        action("continue_planned_item", {
          candidateId: "planned-due-soon",
          sourceDomain: "planned_meal",
          expiresAt: FUTURE,
        }),
      ],
      now: NOW,
    });

    expect(selection).toEqual({
      type: "action",
      action: expect.objectContaining({
        actionType: "continue_planned_item",
        candidateId: "planned-due-soon",
      }),
    });
  });

  it("suppresses expired planned items", () => {
    expect(
      selectHomeNextAction({
        candidates: [
          action("continue_planned_item", {
            sourceDomain: "planned_meal",
            expiresAt: PAST,
          }),
        ],
        now: NOW,
      }).type,
    ).toBe("no_action");
  });

  it("suppresses stale and unavailable candidates", () => {
    expect(
      selectHomeNextAction({
        candidates: [
          action("inspect_memory", {
            candidateId: "memory-stale",
            state: "stale",
            reasonCode: "source_stale",
          }),
          action("continue_planned_item", {
            candidateId: "planned-unavailable",
            state: "unavailable",
            reasonCode: "source_unavailable",
          }),
        ],
        now: NOW,
      }).type,
    ).toBe("no_action");
  });

  it("selects an eligible known-pattern confirmation candidate", () => {
    expect(
      selectedActionType([
        action("confirm_known_pattern", {
          candidateId: "known-pattern-1",
          sourceDomain: "known_pattern_candidate",
        }),
      ]),
    ).toBe("confirm_known_pattern");
  });

  it("suppresses declined or cooldown known-pattern candidates", () => {
    expect(
      selectHomeNextAction({
        candidates: [
          action("confirm_known_pattern", {
            candidateId: "known-pattern-declined",
            sourceDomain: "known_pattern_candidate",
            state: "dismissed",
          }),
          action("confirm_known_pattern", {
            candidateId: "known-pattern-cooldown",
            sourceDomain: "known_pattern_candidate",
            state: "cooldown",
            cooldownKey: "known-pattern:breakfast",
          }),
        ],
        now: NOW,
      }).type,
    ).toBe("no_action");
  });

  it("selects missing-meal only when no higher candidate is eligible", () => {
    expect(
      selectedActionType([
        action("log_missing_meal", {
          duplicatesPrimaryAction: false,
        }),
      ]),
    ).toBe("log_missing_meal");
    expect(
      selectedActionType([
        action("log_missing_meal"),
        action("confirm_known_pattern", {
          sourceDomain: "known_pattern_candidate",
        }),
      ]),
    ).toBe("confirm_known_pattern");
  });

  it("suppresses missing-meal candidates that duplicate the primary Home CTA", () => {
    expect(
      selectHomeNextAction({
        candidates: [
          action("log_missing_meal", {
            candidateId: "log-duplicate-hero",
            duplicatesPrimaryAction: true,
          }),
        ],
        now: NOW,
      }),
    ).toEqual({
      type: "no_action",
      reasonCode: "primary_cta_duplicate",
      sourceCandidateId: "log-duplicate-hero",
    });
  });

  it("does not select pending, degraded, or ownerless candidates and preserves explicit no_action reason", () => {
    expect(
      selectHomeNextAction({
        candidates: [
          action("continue_review", {
            state: "pending",
            sourceDomain: "review_draft",
          }),
          action("inspect_memory", {
            state: "degraded",
            sourceDomain: "smart_memory",
          }),
          action("continue_planned_item", {
            ownerFlow: null,
            sourceDomain: "planned_meal",
          }),
          noAction({
            candidateId: "no-action-inputs-pending",
            reasonCode: "inputs_pending",
          }),
        ],
        now: NOW,
      }),
    ).toEqual({
      type: "no_action",
      reasonCode: "inputs_pending",
      sourceCandidateId: "no-action-inputs-pending",
    });
  });

  it("does not select candidates with mismatched source, owner flow, or deep link", () => {
    expect(
      selectHomeNextAction({
        candidates: [
          action("continue_review", {
            candidateId: "review-wrong-source",
            sourceDomain: "home_day",
          }),
          action("inspect_memory", {
            candidateId: "memory-wrong-owner",
            ownerFlow: "MealAddMethod",
          }),
          action("log_missing_meal", {
            candidateId: "log-wrong-deep-link",
            deepLink: { targetOwnerFlow: "MemoryCenter" },
          }),
        ],
        now: NOW,
      }).type,
    ).toBe("no_action");
  });

  it("uses priority bucket, source version, and candidate id as deterministic tie-breakers", () => {
    const ranked = rankHomeNextActionCandidates(
      [
        action("inspect_memory", {
          candidateId: "memory-z",
          priorityBucket: 2,
          sourceVersion: "v1",
          sourceDomain: "smart_memory",
        }),
        action("inspect_memory", {
          candidateId: "memory-b",
          priorityBucket: 1,
          sourceVersion: "v2",
          sourceDomain: "smart_memory",
        }),
        action("inspect_memory", {
          candidateId: "memory-c",
          priorityBucket: 1,
          sourceVersion: "v1",
          sourceDomain: "smart_memory",
        }),
        action("inspect_memory", {
          candidateId: "memory-a",
          priorityBucket: 1,
          sourceVersion: "v1",
          sourceDomain: "smart_memory",
        }),
      ],
      { now: NOW },
    );

    expect(ranked.map((candidate) => candidate.candidateId)).toEqual([
      "memory-a",
      "memory-c",
      "memory-b",
      "memory-z",
    ]);
  });
});
