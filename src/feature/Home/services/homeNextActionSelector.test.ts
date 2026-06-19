import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDraftKey, getScreenKey } from "@/context/MealDraftContext";
import { fetchKnownPatternCandidatesRemote } from "@/services/knownPatterns/knownPatternCandidatesApi";
import { fetchPlannedMealsRemote } from "@/services/plannedMeals/plannedMealsApi";
import {
  buildHomeKnownPatternNextActionCandidate,
  buildHomePlannedMealNextActionCandidate,
  buildHomeReviewDraftNextActionCandidate,
  dismissHomeReviewDraftNextAction,
  getHomeNextActionDismissalsKey,
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
import type { Meal } from "@/types/meal";
import type { KnownPatternCandidate } from "@/types/knownPatterns";
import type { PlannedMealItem } from "@/types/plannedMeals";

jest.mock("@/services/knownPatterns/knownPatternCandidatesApi", () => ({
  fetchKnownPatternCandidatesRemote: jest.fn(),
}));

jest.mock("@/services/plannedMeals/plannedMealsApi", () => ({
  fetchPlannedMealsRemote: jest.fn(),
}));

const mockFetchKnownPatternCandidatesRemote =
  fetchKnownPatternCandidatesRemote as jest.MockedFunction<
    typeof fetchKnownPatternCandidatesRemote
  >;
const mockFetchPlannedMealsRemote =
  fetchPlannedMealsRemote as jest.MockedFunction<typeof fetchPlannedMealsRemote>;

const NOW = "2026-06-18T12:00:00.000Z";
const FUTURE = "2026-06-18T13:00:00.000Z";
const PAST = "2026-06-18T11:00:00.000Z";

const meaningfulDraft: Meal = {
  userUid: "user-1",
  mealId: "draft-1",
  timestamp: "",
  type: "breakfast",
  name: "Draft breakfast",
  ingredients: [
    {
      id: "ingredient-1",
      name: "Oats",
      amount: 80,
      unit: "g",
      kcal: 300,
      protein: 10,
      fat: 6,
      carbs: 52,
    },
  ],
  createdAt: "2026-06-18T10:00:00.000Z",
  updatedAt: "2026-06-18T10:05:00.000Z",
  syncState: "pending",
  source: null,
  inputMethod: "manual",
  aiMeta: null,
  tags: [],
  deleted: false,
  notes: null,
};

function plannedItem(
  overrides: Partial<PlannedMealItem> = {},
): PlannedMealItem {
  return {
    plannedMealId: "planned-1",
    version: 2,
    dateBucket: "2026-06-18",
    timeBucket: "lunch",
    sourceType: "manual",
    sourceRef: null,
    draftSnapshot: {
      name: "Planned bowl",
      type: "lunch",
      ingredients: [
        {
          id: "planned-ingredient-1",
          name: "Planned bowl",
          amount: 1,
          kcal: 420,
          protein: 26,
          fat: 14,
          carbs: 48,
        },
      ],
      totals: {
        kcal: 420,
        protein: 26,
        fat: 14,
        carbs: 48,
      },
      notes: null,
      tags: [],
    },
    nutritionEstimate: {
      state: "known",
      totals: {
        kcal: 420,
        protein: 26,
        fat: 14,
        carbs: 48,
      },
      missingFields: [],
      confidence: "medium",
    },
    status: "planned",
    createdAt: "2026-06-18T09:00:00.000Z",
    updatedAt: "2026-06-18T09:05:00.000Z",
    ...overrides,
  };
}

function knownPatternCandidate(
  overrides: Partial<KnownPatternCandidate> = {},
): KnownPatternCandidate {
  return {
    candidateId: "a1b2c3d4e5f6a1b2",
    candidateType: "repeated_meal_snapshot",
    subjectKeyHash: "b1c2d3e4f5a6b1c2",
    state: "candidate",
    confidenceBucket: "high",
    sourceCountBucket: "3_4",
    distinctDayCountBucket: "3_4",
    firstSeenAt: "2026-06-15T08:00:00.000Z",
    lastSeenAt: "2026-06-18T08:00:00.000Z",
    expiresAt: FUTURE,
    sourceRefs: [
      {
        sourceType: "meal_snapshot",
        sourceHash: "c1d2e3f4a5b6c1d2",
      },
    ],
    explanation: {
      key: "knownPattern.explanation.repeatedMealSnapshot",
      reasonCode: "repeated_meal_recent_distinct_days",
    },
    suggestedAction: "open_review_draft",
    createdByRuleVersion: "known-pattern-v1",
    ...overrides,
  };
}

const OWNER_BY_ACTION: Record<HomeNextActionType, HomeNextActionCandidate["ownerFlow"]> = {
  log_missing_meal: "MealAddMethod",
  continue_review: "ReviewMeal",
  continue_planned_item: "Planning",
  confirm_known_pattern: "MealAddMethod",
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
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockFetchKnownPatternCandidatesRemote.mockReset();
    mockFetchPlannedMealsRemote.mockReset();
  });

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

  it("builds an eligible continue_review candidate for a meaningful AddMeal review draft", async () => {
    await AsyncStorage.setItem(getDraftKey("user-1"), JSON.stringify(meaningfulDraft));
    await AsyncStorage.setItem(getScreenKey("user-1"), "AddMeal");

    await expect(
      buildHomeReviewDraftNextActionCandidate({ uid: "user-1" }),
    ).resolves.toEqual({
      candidateId: "review-draft:local",
      actionType: "continue_review",
      sourceDomain: "review_draft",
      state: "eligible",
      priorityBucket: 1,
      reasonCode: "review_draft_available",
      ownerFlow: "ReviewMeal",
      deepLink: {
        targetOwnerFlow: "ReviewMeal",
        params: { route: "AddMeal", start: "ReviewMeal" },
      },
      sourceVersion: "2026-06-18T10:05:00.000Z",
    });
  });

  it("also treats legacy ReviewMeal last-screen storage as resumable", async () => {
    await AsyncStorage.setItem(getDraftKey("user-1"), JSON.stringify(meaningfulDraft));
    await AsyncStorage.setItem(getScreenKey("user-1"), "ReviewMeal");

    const candidate = await buildHomeReviewDraftNextActionCandidate({
      uid: "user-1",
    });

    expect(candidate).toEqual(
      expect.objectContaining({
        actionType: "continue_review",
        state: "eligible",
        ownerFlow: "ReviewMeal",
      }),
    );
  });

  it("persists review draft dismissal only for the current source version and cooldown window", async () => {
    await AsyncStorage.setItem(getDraftKey("user-1"), JSON.stringify(meaningfulDraft));
    await AsyncStorage.setItem(getScreenKey("user-1"), "AddMeal");

    await dismissHomeReviewDraftNextAction({
      uid: "user-1",
      candidateId: "review-draft:local",
      sourceVersion: meaningfulDraft.updatedAt,
      now: NOW,
    });

    await expect(
      buildHomeReviewDraftNextActionCandidate({ uid: "user-1", now: NOW }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "candidate_dismissed",
      }),
    );
    await expect(
      AsyncStorage.getItem(getHomeNextActionDismissalsKey("user-1")),
    ).resolves.toContain("review-draft:local");

    await AsyncStorage.setItem(
      getDraftKey("user-1"),
      JSON.stringify({
        ...meaningfulDraft,
        updatedAt: "2026-06-18T10:06:00.000Z",
      }),
    );
    await expect(
      buildHomeReviewDraftNextActionCandidate({ uid: "user-1", now: NOW }),
    ).resolves.toEqual(
      expect.objectContaining({
        actionType: "continue_review",
        state: "eligible",
      }),
    );

    await AsyncStorage.setItem(getDraftKey("user-1"), JSON.stringify(meaningfulDraft));
    await expect(
      buildHomeReviewDraftNextActionCandidate({
        uid: "user-1",
        now: "2026-06-19T12:01:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        actionType: "continue_review",
        state: "eligible",
      }),
    );
  });

  it("builds an eligible planned-item candidate from the next three planning days", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce({
      items: [
        plannedItem({
          plannedMealId: "planned-dinner",
          timeBucket: "dinner",
        }),
        plannedItem({
          plannedMealId: "planned-breakfast",
          timeBucket: "breakfast",
          updatedAt: "2026-06-18T09:10:00.000Z",
        }),
      ],
      queryEcho: {
        startDate: "2026-06-18",
        days: 3,
        includeDeleted: false,
        returnedItems: 2,
      },
    });

    await expect(
      buildHomePlannedMealNextActionCandidate({
        uid: "user-1",
        now: NOW,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        candidateId: "planned-meal:planned-breakfast",
        actionType: "continue_planned_item",
        sourceDomain: "planned_meal",
        state: "eligible",
        reasonCode: "planned_item_due",
        ownerFlow: "Planning",
        sourceVersion: "2:2026-06-18T09:10:00.000Z",
      }),
    );
    expect(mockFetchPlannedMealsRemote).toHaveBeenCalledWith({
      startDate: "2026-06-18",
      days: 3,
      includeDeleted: false,
    });
  });

  it("keeps review draft above an eligible planned-item candidate", async () => {
    await AsyncStorage.setItem(getDraftKey("user-1"), JSON.stringify(meaningfulDraft));
    await AsyncStorage.setItem(getScreenKey("user-1"), "AddMeal");
    mockFetchPlannedMealsRemote.mockResolvedValueOnce({
      items: [plannedItem()],
      queryEcho: {
        startDate: "2026-06-18",
        days: 3,
        includeDeleted: false,
        returnedItems: 1,
      },
    });

    const reviewCandidate = await buildHomeReviewDraftNextActionCandidate({
      uid: "user-1",
      now: NOW,
    });
    const plannedCandidate = await buildHomePlannedMealNextActionCandidate({
      uid: "user-1",
      now: NOW,
    });

    expect(
      selectHomeNextAction({
        candidates: [plannedCandidate, reviewCandidate],
        now: NOW,
      }),
    ).toEqual(
      expect.objectContaining({
        type: "action",
        action: expect.objectContaining({
          actionType: "continue_review",
        }),
      }),
    );
  });

  it("suppresses unknown or unavailable planned items instead of showing safe copy", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce({
      items: [
        plannedItem({
          plannedMealId: "unknown-plan",
          nutritionEstimate: {
            state: "unknown",
            totals: null,
            missingFields: ["kcal", "protein", "fat", "carbs"],
            confidence: null,
          },
        }),
        plannedItem({
          plannedMealId: "unavailable-plan",
          status: "source_unavailable",
        }),
        plannedItem({
          plannedMealId: "converted-plan",
          status: "converted_to_review",
        }),
      ],
      queryEcho: {
        startDate: "2026-06-18",
        days: 3,
        includeDeleted: false,
        returnedItems: 3,
      },
    });

    await expect(
      buildHomePlannedMealNextActionCandidate({
        uid: "user-1",
        now: NOW,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "inputs_insufficient",
      }),
    );
  });

  it("persists planned-item dismissal by candidate source version", async () => {
    const item = plannedItem();
    mockFetchPlannedMealsRemote.mockResolvedValue({
      items: [item],
      queryEcho: {
        startDate: "2026-06-18",
        days: 3,
        includeDeleted: false,
        returnedItems: 1,
      },
    });

    const firstCandidate = await buildHomePlannedMealNextActionCandidate({
      uid: "user-1",
      now: NOW,
    });
    if (firstCandidate.state === "no_action") {
      throw new Error("Expected planned-item action candidate.");
    }

    await dismissHomeReviewDraftNextAction({
      uid: "user-1",
      candidateId: firstCandidate.candidateId,
      sourceVersion: firstCandidate.sourceVersion,
      now: NOW,
    });

    await expect(
      buildHomePlannedMealNextActionCandidate({
        uid: "user-1",
        now: NOW,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "inputs_insufficient",
      }),
    );
  });

  it("builds an eligible known-pattern candidate for the existing MealAddMethod surface", async () => {
    mockFetchKnownPatternCandidatesRemote.mockResolvedValueOnce({
      items: [knownPatternCandidate()],
      queryEcho: {
        ruleVersion: "known-pattern-v1",
        minSourceCount: 3,
        minDistinctDays: 3,
        maxHistoryItems: 20,
        returnedCandidates: 1,
      },
    });

    await expect(
      buildHomeKnownPatternNextActionCandidate({
        uid: "user-1",
        now: NOW,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        candidateId: "known-pattern:a1b2c3d4e5f6a1b2",
        actionType: "confirm_known_pattern",
        sourceDomain: "known_pattern_candidate",
        state: "eligible",
        reasonCode: "known_pattern_available",
        ownerFlow: "MealAddMethod",
        sourceVersion:
          "known-pattern-v1:2026-06-18T08:00:00.000Z:2026-06-18T13:00:00.000Z",
      }),
    );
    expect(mockFetchKnownPatternCandidatesRemote).toHaveBeenCalledWith({
      limit: 1,
    });
  });

  it("keeps planned items above known-pattern candidates", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce({
      items: [plannedItem()],
      queryEcho: {
        startDate: "2026-06-18",
        days: 3,
        includeDeleted: false,
        returnedItems: 1,
      },
    });
    mockFetchKnownPatternCandidatesRemote.mockResolvedValueOnce({
      items: [knownPatternCandidate()],
      queryEcho: {
        ruleVersion: "known-pattern-v1",
        minSourceCount: 3,
        minDistinctDays: 3,
        maxHistoryItems: 20,
        returnedCandidates: 1,
      },
    });

    const plannedCandidate = await buildHomePlannedMealNextActionCandidate({
      uid: "user-1",
      now: NOW,
    });
    const knownCandidate = await buildHomeKnownPatternNextActionCandidate({
      uid: "user-1",
      now: NOW,
    });

    expect(
      selectHomeNextAction({
        candidates: [knownCandidate, plannedCandidate],
        now: NOW,
      }),
    ).toEqual(
      expect.objectContaining({
        type: "action",
        action: expect.objectContaining({
          actionType: "continue_planned_item",
        }),
      }),
    );
  });

  it("suppresses unsafe or unavailable known-pattern states", async () => {
    for (const state of [
      "declined",
      "expired",
      "unavailable",
      "suppressed",
      "converted_to_review",
    ] as const) {
      mockFetchKnownPatternCandidatesRemote.mockResolvedValueOnce({
        items: [knownPatternCandidate({ state })],
        queryEcho: {
          ruleVersion: "known-pattern-v1",
          minSourceCount: 3,
          minDistinctDays: 3,
          maxHistoryItems: 20,
          returnedCandidates: 1,
        },
      });

      await expect(
        buildHomeKnownPatternNextActionCandidate({
          uid: "user-1",
          now: NOW,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          state: "no_action",
          reasonCode: "inputs_insufficient",
        }),
      );
    }
  });

  it("persists known-pattern Home dismissal without declining the candidate", async () => {
    mockFetchKnownPatternCandidatesRemote.mockResolvedValue({
      items: [knownPatternCandidate()],
      queryEcho: {
        ruleVersion: "known-pattern-v1",
        minSourceCount: 3,
        minDistinctDays: 3,
        maxHistoryItems: 20,
        returnedCandidates: 1,
      },
    });

    const firstCandidate = await buildHomeKnownPatternNextActionCandidate({
      uid: "user-1",
      now: NOW,
    });
    if (firstCandidate.state === "no_action") {
      throw new Error("Expected known-pattern action candidate.");
    }

    await dismissHomeReviewDraftNextAction({
      uid: "user-1",
      candidateId: firstCandidate.candidateId,
      sourceVersion: firstCandidate.sourceVersion,
      now: NOW,
    });

    await expect(
      buildHomeKnownPatternNextActionCandidate({
        uid: "user-1",
        now: NOW,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "inputs_insufficient",
      }),
    );
  });

  it("returns explicit no_action for missing uid, missing draft, malformed draft, nonmeaningful draft, nonresumable screen, and dismissed state", async () => {
    await expect(
      buildHomeReviewDraftNextActionCandidate({ uid: null }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "context_unavailable",
      }),
    );

    await expect(
      buildHomeReviewDraftNextActionCandidate({ uid: "user-1" }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "inputs_insufficient",
      }),
    );

    await AsyncStorage.setItem(getDraftKey("user-1"), "{bad-json");
    await AsyncStorage.setItem(getScreenKey("user-1"), "AddMeal");
    await expect(
      buildHomeReviewDraftNextActionCandidate({ uid: "user-1" }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "inputs_degraded",
      }),
    );

    await AsyncStorage.setItem(
      getDraftKey("user-1"),
      JSON.stringify({
        ...meaningfulDraft,
        ingredients: [],
        totals: undefined,
        photoUrl: null,
      }),
    );
    await expect(
      buildHomeReviewDraftNextActionCandidate({ uid: "user-1" }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "inputs_insufficient",
      }),
    );

    await AsyncStorage.setItem(getDraftKey("user-1"), JSON.stringify(meaningfulDraft));
    await AsyncStorage.setItem(getScreenKey("user-1"), "DescribeMeal");
    await expect(
      buildHomeReviewDraftNextActionCandidate({ uid: "user-1" }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "owner_flow_missing",
      }),
    );

    await AsyncStorage.setItem(getScreenKey("user-1"), "AddMeal");
    await expect(
      buildHomeReviewDraftNextActionCandidate({
        uid: "user-1",
        dismissedCandidateIds: ["review-draft:local"],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: "no_action",
        reasonCode: "candidate_dismissed",
      }),
    );
  });
});
