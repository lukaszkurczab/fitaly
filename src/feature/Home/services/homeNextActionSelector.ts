import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDraftKey, getScreenKey } from "@/context/MealDraftContext";
import { fetchPlannedMealsRemote } from "@/services/plannedMeals/plannedMealsApi";
import type { Meal } from "@/types/meal";
import type {
  PlannedMealItem,
  PlannedMealStatus,
  PlannedMealTimeBucket,
} from "@/types/plannedMeals";

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

export type BuildHomeReviewDraftNextActionParams = {
  uid: string | null | undefined;
  dismissedCandidateIds?: readonly string[];
  now?: Date | string | number;
};

export type DismissHomeReviewDraftNextActionParams = {
  uid: string;
  candidateId: string;
  sourceVersion: string | null | undefined;
  now?: Date | string | number;
};

export type BuildHomePlannedMealNextActionParams = {
  uid: string | null | undefined;
  now?: Date | string | number;
};

export type DismissHomeNextActionCandidateParams =
  DismissHomeReviewDraftNextActionParams;

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

const REVIEW_DRAFT_CANDIDATE_ID = "review-draft:local";
const REVIEW_DRAFT_PRIORITY_BUCKET = 1;
const PLANNED_ITEM_PRIORITY_OFFSET = 10;
const REVIEW_DRAFT_DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RESUMABLE_REVIEW_DRAFT_SCREENS = new Set(["AddMeal", "ReviewMeal"]);
const HOME_PLANNED_ITEM_WINDOW_DAYS = 3;
const REVIEWABLE_PLANNED_STATUSES = new Set<PlannedMealStatus>([
  "planned",
  "edited",
  "rescheduled",
]);
const TIME_BUCKET_ORDER: Record<PlannedMealTimeBucket, number> = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
  any: 5,
};

type StoredNextActionDismissal = {
  candidateId: string;
  sourceVersion: string | null;
  dismissedAt: string;
  dismissedUntil: string;
};

type StoredNextActionDismissals = Record<string, StoredNextActionDismissal>;

export function getHomeNextActionDismissalsKey(uid: string): string {
  return `home-next-action-dismissals:${uid}`;
}

function getDismissalRecordKey(
  candidateId: string,
  sourceVersion: string | null | undefined,
): string {
  return `${candidateId}:${sourceVersion ?? "none"}`;
}

const hasNonEmptyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function ingredientHasMeaningfulContent(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const ingredient = payload as Partial<Meal["ingredients"][number]>;

  return Boolean(
    hasNonEmptyText(ingredient.name) ||
      isPositiveNumber(ingredient.amount) ||
      isPositiveNumber(ingredient.kcal) ||
      isPositiveNumber(ingredient.protein) ||
      isPositiveNumber(ingredient.carbs) ||
      isPositiveNumber(ingredient.fat),
  );
}

export function hasMeaningfulReviewDraft(payload: unknown): payload is Meal {
  if (!payload || typeof payload !== "object") return false;
  const draft = payload as Partial<Meal> & { isDirty?: unknown };
  const hasIdentity =
    hasNonEmptyText(draft.mealId) || hasNonEmptyText(draft.createdAt);
  if (!hasIdentity) return false;

  const hasIngredients =
    Array.isArray(draft.ingredients) &&
    draft.ingredients.some((ingredient) =>
      ingredientHasMeaningfulContent(ingredient),
    );
  const hasPhoto =
    hasNonEmptyText(draft.photoUrl) ||
    hasNonEmptyText(draft.localPhotoUrl) ||
    hasNonEmptyText(draft.photoLocalPath) ||
    hasNonEmptyText(draft.imageRef?.downloadUrl);
  const hasTotals =
    !!draft.totals &&
    (isPositiveNumber(draft.totals.kcal) ||
      isPositiveNumber(draft.totals.protein) ||
      isPositiveNumber(draft.totals.carbs) ||
      isPositiveNumber(draft.totals.fat));
  const hasDirtyFlag = draft.isDirty === true;

  return hasIngredients || hasPhoto || hasTotals || hasDirtyFlag;
}

function reviewDraftNoAction(
  reasonCode: HomeNextActionReasonCode,
): HomeNextActionNoActionCandidate {
  return {
    candidateId: REVIEW_DRAFT_CANDIDATE_ID,
    sourceDomain: "review_draft",
    state: "no_action",
    priorityBucket: REVIEW_DRAFT_PRIORITY_BUCKET,
    reasonCode,
  };
}

function parseStoredDismissals(raw: string | null): StoredNextActionDismissals {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as StoredNextActionDismissals;
  } catch {
    return {};
  }
}

function isDismissalActive(
  dismissals: StoredNextActionDismissals,
  candidateId: string,
  sourceVersion: string | null | undefined,
  nowTimestamp: number,
): boolean {
  const record =
    dismissals[getDismissalRecordKey(candidateId, sourceVersion)] ?? null;
  if (!record || record.candidateId !== candidateId) return false;
  if ((record.sourceVersion ?? null) !== (sourceVersion ?? null)) return false;

  const dismissedUntilTimestamp = toTimestamp(record.dismissedUntil);
  return (
    dismissedUntilTimestamp !== null &&
    dismissedUntilTimestamp > nowTimestamp
  );
}

function buildReviewDraftAction(sourceVersion: string | null): HomeNextActionCandidate {
  return {
    candidateId: REVIEW_DRAFT_CANDIDATE_ID,
    actionType: "continue_review",
    sourceDomain: "review_draft",
    state: "eligible",
    priorityBucket: REVIEW_DRAFT_PRIORITY_BUCKET,
    reasonCode: "review_draft_available",
    ownerFlow: "ReviewMeal",
    deepLink: {
      targetOwnerFlow: "ReviewMeal",
      params: { route: "AddMeal", start: "ReviewMeal" },
    },
    sourceVersion,
  };
}

function formatLocalDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function dayOffsetFromStart(dateBucket: string, start: Date): number | null {
  for (let offset = 0; offset < HOME_PLANNED_ITEM_WINDOW_DAYS; offset += 1) {
    if (dateBucket === formatLocalDateKey(addDays(start, offset))) {
      return offset;
    }
  }
  return null;
}

function isHomeActionablePlannedItem(item: PlannedMealItem): boolean {
  return (
    REVIEWABLE_PLANNED_STATUSES.has(item.status) &&
    item.nutritionEstimate.state !== "unknown"
  );
}

function comparePlannedItems(
  left: PlannedMealItem,
  right: PlannedMealItem,
): number {
  if (left.dateBucket !== right.dateBucket) {
    return left.dateBucket.localeCompare(right.dateBucket);
  }

  const leftTime = TIME_BUCKET_ORDER[left.timeBucket ?? "any"];
  const rightTime = TIME_BUCKET_ORDER[right.timeBucket ?? "any"];
  if (leftTime !== rightTime) return leftTime - rightTime;

  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt.localeCompare(right.updatedAt);
  }

  return left.plannedMealId.localeCompare(right.plannedMealId);
}

function buildPlannedMealAction(
  item: PlannedMealItem,
  start: Date,
): HomeNextActionCandidate | null {
  const dayOffset = dayOffsetFromStart(item.dateBucket, start);
  if (dayOffset === null) return null;

  return {
    candidateId: `planned-meal:${item.plannedMealId}`,
    actionType: "continue_planned_item",
    sourceDomain: "planned_meal",
    state: "eligible",
    priorityBucket:
      PLANNED_ITEM_PRIORITY_OFFSET +
      dayOffset * 10 +
      TIME_BUCKET_ORDER[item.timeBucket ?? "any"],
    reasonCode: "planned_item_due",
    ownerFlow: "Planning",
    deepLink: {
      targetOwnerFlow: "Planning",
      params: { route: "Planning" },
    },
    sourceVersion: `${item.version}:${item.updatedAt}`,
  };
}

export async function buildHomeReviewDraftNextActionCandidate({
  uid,
  dismissedCandidateIds = [],
  now,
}: BuildHomeReviewDraftNextActionParams): Promise<HomeNextActionInput> {
  if (!uid) {
    return reviewDraftNoAction("context_unavailable");
  }

  let draftRaw: string | null;
  let lastScreenStored: string | null;
  let dismissalsRaw: string | null;
  try {
    [draftRaw, lastScreenStored, dismissalsRaw] = await Promise.all([
      AsyncStorage.getItem(getDraftKey(uid)),
      AsyncStorage.getItem(getScreenKey(uid)),
      AsyncStorage.getItem(getHomeNextActionDismissalsKey(uid)),
    ]);
  } catch {
    return reviewDraftNoAction("source_unavailable");
  }

  if (!draftRaw) {
    return reviewDraftNoAction("inputs_insufficient");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(draftRaw);
  } catch {
    return reviewDraftNoAction("inputs_degraded");
  }

  if (!hasMeaningfulReviewDraft(parsed)) {
    return reviewDraftNoAction("inputs_insufficient");
  }

  if (!lastScreenStored || !RESUMABLE_REVIEW_DRAFT_SCREENS.has(lastScreenStored)) {
    return reviewDraftNoAction("owner_flow_missing");
  }

  const draft = parsed as Partial<Meal>;
  const sourceVersion = draft.updatedAt ?? draft.createdAt ?? null;
  if (
    dismissedCandidateIds.includes(REVIEW_DRAFT_CANDIDATE_ID) ||
    isDismissalActive(
      parseStoredDismissals(dismissalsRaw),
      REVIEW_DRAFT_CANDIDATE_ID,
      sourceVersion,
      toTimestamp(now) ?? Date.now(),
    )
  ) {
    return reviewDraftNoAction("candidate_dismissed");
  }

  return buildReviewDraftAction(sourceVersion);
}

export async function dismissHomeReviewDraftNextAction({
  uid,
  candidateId,
  sourceVersion,
  now,
}: DismissHomeReviewDraftNextActionParams): Promise<void> {
  await dismissHomeNextActionCandidate({ uid, candidateId, sourceVersion, now });
}

export async function dismissHomeNextActionCandidate({
  uid,
  candidateId,
  sourceVersion,
  now,
}: DismissHomeNextActionCandidateParams): Promise<void> {
  const nowTimestamp = toTimestamp(now) ?? Date.now();
  const dismissedAt = new Date(nowTimestamp).toISOString();
  const dismissedUntil = new Date(
    nowTimestamp + REVIEW_DRAFT_DISMISS_COOLDOWN_MS,
  ).toISOString();
  const storageKey = getHomeNextActionDismissalsKey(uid);
  const existing = parseStoredDismissals(await AsyncStorage.getItem(storageKey));

  existing[getDismissalRecordKey(candidateId, sourceVersion)] = {
    candidateId,
    sourceVersion: sourceVersion ?? null,
    dismissedAt,
    dismissedUntil,
  };

  await AsyncStorage.setItem(storageKey, JSON.stringify(existing));
}

export async function buildHomePlannedMealNextActionCandidate({
  uid,
  now,
}: BuildHomePlannedMealNextActionParams): Promise<HomeNextActionInput> {
  if (!uid) {
    return {
      candidateId: "planned-meal:window",
      sourceDomain: "planned_meal",
      state: "no_action",
      priorityBucket: PLANNED_ITEM_PRIORITY_OFFSET,
      reasonCode: "context_unavailable",
    };
  }

  const providedTimestamp = toTimestamp(now);
  const nowDate =
    providedTimestamp !== null ? new Date(providedTimestamp) : new Date();
  const startDate = formatLocalDateKey(nowDate);

  let response;
  let dismissalsRaw: string | null;
  try {
    [response, dismissalsRaw] = await Promise.all([
      fetchPlannedMealsRemote({
        startDate,
        days: HOME_PLANNED_ITEM_WINDOW_DAYS,
        includeDeleted: false,
      }),
      AsyncStorage.getItem(getHomeNextActionDismissalsKey(uid)),
    ]);
  } catch {
    return {
      candidateId: "planned-meal:window",
      sourceDomain: "planned_meal",
      state: "no_action",
      priorityBucket: PLANNED_ITEM_PRIORITY_OFFSET,
      reasonCode: "source_unavailable",
    };
  }

  const dismissals = parseStoredDismissals(dismissalsRaw);
  const nowTimestamp = toTimestamp(now) ?? Date.now();
  const candidate = response.items
    .filter(isHomeActionablePlannedItem)
    .sort(comparePlannedItems)
    .map((item) => buildPlannedMealAction(item, nowDate))
    .find(
      (item): item is HomeNextActionCandidate =>
        item !== null &&
        !isDismissalActive(
          dismissals,
          item.candidateId,
          item.sourceVersion,
          nowTimestamp,
        ),
    );

  if (!candidate) {
    return {
      candidateId: "planned-meal:window",
      sourceDomain: "planned_meal",
      state: "no_action",
      priorityBucket: PLANNED_ITEM_PRIORITY_OFFSET,
      reasonCode: "inputs_insufficient",
    };
  }

  return candidate;
}

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
