export type HomeNextActionType =
  | "log_missing_meal"
  | "continue_review"
  | "continue_planned_item"
  | "confirm_known_pattern"
  | "inspect_memory";

export type HomeNextActionSourceDomain =
  | "home_day"
  | "review_draft"
  | "planned_meal"
  | "known_pattern_candidate"
  | "smart_memory";

export type HomeNextActionState =
  | "eligible"
  | "pending"
  | "degraded"
  | "stale"
  | "expired"
  | "dismissed"
  | "cooldown"
  | "unavailable"
  | "no_action";

export type HomeNextActionOwnerFlow =
  | "MealAddMethod"
  | "ReviewMeal"
  | "Planning"
  | "KnownPatternConfirmation"
  | "MemoryCenter";

export type HomeNextActionReasonCode =
  | "candidate_cooldown"
  | "candidate_dismissed"
  | "candidate_expired"
  | "context_unavailable"
  | "inputs_degraded"
  | "inputs_insufficient"
  | "inputs_pending"
  | "known_pattern_available"
  | "known_pattern_cooldown"
  | "known_pattern_declined"
  | "memory_attention"
  | "missing_meal_available"
  | "primary_cta_duplicate"
  | "no_eligible_candidate"
  | "owner_flow_missing"
  | "planned_item_due"
  | "planned_item_expired"
  | "review_draft_available"
  | "source_stale"
  | "source_unavailable";

export type HomeNextActionDeepLink = {
  targetOwnerFlow: HomeNextActionOwnerFlow;
  params?: Record<string, unknown>;
};

type HomeNextActionBaseCandidate = {
  candidateId: string;
  sourceDomain: HomeNextActionSourceDomain;
  state: HomeNextActionState;
  priorityBucket: number;
  reasonCode: HomeNextActionReasonCode;
  expiresAt?: string | null;
  cooldownKey?: string | null;
  dismissedUntil?: string | null;
  sourceVersion?: string | null;
  explanationKey?: string | null;
  duplicatesPrimaryAction?: boolean | null;
};

export type HomeNextActionCandidate = HomeNextActionBaseCandidate & {
  actionType: HomeNextActionType;
  state: Exclude<HomeNextActionState, "no_action">;
  ownerFlow: HomeNextActionOwnerFlow | null;
  deepLink?: HomeNextActionDeepLink | null;
};

export type HomeNextActionNoActionCandidate = HomeNextActionBaseCandidate & {
  state: "no_action";
  actionType?: never;
  ownerFlow?: null;
  deepLink?: null;
};

export type HomeNextActionInput =
  | HomeNextActionCandidate
  | HomeNextActionNoActionCandidate;

export type HomeNextActionSelection =
  | {
      type: "action";
      action: HomeNextActionCandidate;
    }
  | {
      type: "no_action";
      reasonCode: HomeNextActionReasonCode;
      sourceCandidateId: string | null;
    };

export type SelectHomeNextActionParams = {
  candidates: readonly HomeNextActionInput[];
  now?: Date | string | number;
};

const ACTION_RANK: Record<HomeNextActionType, number> = {
  continue_review: 1,
  inspect_memory: 2,
  continue_planned_item: 3,
  confirm_known_pattern: 4,
  log_missing_meal: 5,
};

const OWNER_FLOWS_BY_ACTION: Record<
  HomeNextActionType,
  readonly HomeNextActionOwnerFlow[]
> = {
  continue_review: ["ReviewMeal"],
  inspect_memory: ["MemoryCenter"],
  continue_planned_item: ["Planning", "ReviewMeal"],
  confirm_known_pattern: ["KnownPatternConfirmation"],
  log_missing_meal: ["MealAddMethod"],
};

const SOURCE_DOMAINS_BY_ACTION: Record<
  HomeNextActionType,
  readonly HomeNextActionSourceDomain[]
> = {
  continue_review: ["review_draft"],
  inspect_memory: ["smart_memory"],
  continue_planned_item: ["planned_meal"],
  confirm_known_pattern: ["known_pattern_candidate"],
  log_missing_meal: ["home_day"],
};

function getStateSuppressionReason(
  candidate: HomeNextActionCandidate,
): HomeNextActionReasonCode | null {
  switch (candidate.state) {
    case "eligible":
      return null;
    case "pending":
      return "inputs_pending";
    case "degraded":
      return "inputs_degraded";
    case "stale":
      return "source_stale";
    case "expired":
      return candidate.actionType === "continue_planned_item"
        ? "planned_item_expired"
        : "candidate_expired";
    case "dismissed":
      return candidate.reasonCode === "known_pattern_declined"
        ? "known_pattern_declined"
        : "candidate_dismissed";
    case "cooldown":
      return candidate.reasonCode === "known_pattern_cooldown"
        ? "known_pattern_cooldown"
        : "candidate_cooldown";
    case "unavailable":
      return "source_unavailable";
    default:
      return "no_eligible_candidate";
  }
}

function toTimestamp(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareStrings(left: string | null | undefined, right: string | null | undefined): number {
  const normalizedLeft = left ?? "";
  const normalizedRight = right ?? "";

  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function compareCandidates(
  left: Pick<
    HomeNextActionBaseCandidate,
    "candidateId" | "priorityBucket" | "sourceVersion"
  >,
  right: Pick<
    HomeNextActionBaseCandidate,
    "candidateId" | "priorityBucket" | "sourceVersion"
  >,
): number {
  if (left.priorityBucket !== right.priorityBucket) {
    return left.priorityBucket - right.priorityBucket;
  }

  const sourceVersionOrder = compareStrings(left.sourceVersion, right.sourceVersion);
  if (sourceVersionOrder !== 0) return sourceVersionOrder;

  return compareStrings(left.candidateId, right.candidateId);
}

function comparePrimaryActions(
  left: HomeNextActionCandidate,
  right: HomeNextActionCandidate,
): number {
  const actionRankOrder = ACTION_RANK[left.actionType] - ACTION_RANK[right.actionType];
  if (actionRankOrder !== 0) return actionRankOrder;

  return compareCandidates(left, right);
}

function hasValidOwnership(candidate: HomeNextActionCandidate): boolean {
  if (!candidate.ownerFlow) return false;
  if (!OWNER_FLOWS_BY_ACTION[candidate.actionType].includes(candidate.ownerFlow)) {
    return false;
  }
  if (!SOURCE_DOMAINS_BY_ACTION[candidate.actionType].includes(candidate.sourceDomain)) {
    return false;
  }
  return (
    !candidate.deepLink ||
    candidate.deepLink.targetOwnerFlow === candidate.ownerFlow
  );
}

function getPrimaryActionSuppressionReason(
  candidate: HomeNextActionInput,
  nowTimestamp: number,
): HomeNextActionReasonCode | null {
  if (candidate.state === "no_action") return candidate.reasonCode;
  const stateSuppressionReason = getStateSuppressionReason(candidate);
  if (stateSuppressionReason) return stateSuppressionReason;
  if (!hasValidOwnership(candidate)) return "owner_flow_missing";

  const expiresAt = toTimestamp(candidate.expiresAt);
  if (expiresAt !== null && expiresAt <= nowTimestamp) {
    return candidate.actionType === "continue_planned_item"
      ? "planned_item_expired"
      : "candidate_expired";
  }

  const dismissedUntil = toTimestamp(candidate.dismissedUntil);
  if (dismissedUntil !== null && dismissedUntil > nowTimestamp) {
    return "candidate_dismissed";
  }

  if (candidate.duplicatesPrimaryAction) {
    return "primary_cta_duplicate";
  }

  return null;
}

function isEligiblePrimaryAction(
  candidate: HomeNextActionInput,
  nowTimestamp: number,
): candidate is HomeNextActionCandidate {
  return getPrimaryActionSuppressionReason(candidate, nowTimestamp) === null;
}

function compareSuppressedCandidates(
  left: HomeNextActionCandidate,
  right: HomeNextActionCandidate,
): number {
  const actionRankOrder = ACTION_RANK[left.actionType] - ACTION_RANK[right.actionType];
  if (actionRankOrder !== 0) return actionRankOrder;

  return compareCandidates(left, right);
}

export function rankHomeNextActionCandidates(
  candidates: readonly HomeNextActionInput[],
  params: { now?: Date | string | number } = {},
): HomeNextActionCandidate[] {
  const nowTimestamp = toTimestamp(params.now) ?? Date.now();

  return [...candidates]
    .filter((candidate): candidate is HomeNextActionCandidate =>
      isEligiblePrimaryAction(candidate, nowTimestamp),
    )
    .sort(comparePrimaryActions);
}

export function selectHomeNextAction(
  params: SelectHomeNextActionParams,
): HomeNextActionSelection {
  const rankedCandidates = rankHomeNextActionCandidates(params.candidates, {
    now: params.now,
  });
  const primaryAction = rankedCandidates[0];

  if (primaryAction) {
    return {
      type: "action",
      action: primaryAction,
    };
  }

  const explicitNoAction = [...params.candidates]
    .filter(
      (candidate): candidate is HomeNextActionNoActionCandidate =>
        candidate.state === "no_action",
    )
    .sort(compareCandidates)[0];

  if (explicitNoAction) {
    return {
      type: "no_action",
      reasonCode: explicitNoAction.reasonCode,
      sourceCandidateId: explicitNoAction.candidateId,
    };
  }

  const nowTimestamp = toTimestamp(params.now) ?? Date.now();
  const suppressedCandidate = [...params.candidates]
    .filter(
      (candidate): candidate is HomeNextActionCandidate =>
        candidate.state !== "no_action" &&
        getPrimaryActionSuppressionReason(candidate, nowTimestamp) !== null,
    )
    .sort(compareSuppressedCandidates)[0];
  const suppressionReason = suppressedCandidate
    ? getPrimaryActionSuppressionReason(suppressedCandidate, nowTimestamp)
    : null;

  return {
    type: "no_action",
    reasonCode: suppressionReason ?? "no_eligible_candidate",
    sourceCandidateId: suppressedCandidate?.candidateId ?? null,
  };
}
