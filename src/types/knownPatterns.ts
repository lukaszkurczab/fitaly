export const KNOWN_PATTERN_CANDIDATE_TYPES = [
  "repeated_meal_snapshot",
] as const;

export const KNOWN_PATTERN_CANDIDATE_STATES = [
  "candidate",
  "shown",
  "declined",
  "edited",
  "expired",
  "unavailable",
  "suppressed",
  "converted_to_review",
] as const;

export const KNOWN_PATTERN_CONFIDENCE_BUCKETS = ["medium", "high"] as const;
export const KNOWN_PATTERN_COUNT_BUCKETS = ["3_4", "5_plus"] as const;
export const KNOWN_PATTERN_SOURCE_TYPES = ["meal_snapshot"] as const;
export const KNOWN_PATTERN_REASON_CODES = [
  "repeated_meal_recent_distinct_days",
] as const;
export const KNOWN_PATTERN_SUGGESTED_ACTIONS = [
  "open_review_draft",
] as const;
export const KNOWN_PATTERN_CONTROL_ACTIONS = ["shown", "declined"] as const;

export type KnownPatternCandidateType =
  (typeof KNOWN_PATTERN_CANDIDATE_TYPES)[number];
export type KnownPatternCandidateState =
  (typeof KNOWN_PATTERN_CANDIDATE_STATES)[number];
export type KnownPatternConfidenceBucket =
  (typeof KNOWN_PATTERN_CONFIDENCE_BUCKETS)[number];
export type KnownPatternCountBucket =
  (typeof KNOWN_PATTERN_COUNT_BUCKETS)[number];
export type KnownPatternSourceType =
  (typeof KNOWN_PATTERN_SOURCE_TYPES)[number];
export type KnownPatternReasonCode =
  (typeof KNOWN_PATTERN_REASON_CODES)[number];
export type KnownPatternSuggestedAction =
  (typeof KNOWN_PATTERN_SUGGESTED_ACTIONS)[number];
export type KnownPatternControlAction =
  (typeof KNOWN_PATTERN_CONTROL_ACTIONS)[number];

export type KnownPatternSourceRef = {
  sourceType: KnownPatternSourceType;
  sourceHash: string;
};

export type KnownPatternExplanation = {
  key: "knownPattern.explanation.repeatedMealSnapshot";
  reasonCode: KnownPatternReasonCode;
};

export type KnownPatternCandidate = {
  candidateId: string;
  candidateType: KnownPatternCandidateType;
  subjectKeyHash: string;
  state: KnownPatternCandidateState;
  confidenceBucket: KnownPatternConfidenceBucket;
  sourceCountBucket: KnownPatternCountBucket;
  distinctDayCountBucket: KnownPatternCountBucket;
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt: string;
  sourceRefs: KnownPatternSourceRef[];
  explanation: KnownPatternExplanation;
  suggestedAction: KnownPatternSuggestedAction;
  createdByRuleVersion: string;
};

export type KnownPatternCandidateQueryEcho = {
  ruleVersion: string;
  minSourceCount: number;
  minDistinctDays: number;
  maxHistoryItems: number;
  returnedCandidates: number;
};

export type KnownPatternCandidatesResponse = {
  items: KnownPatternCandidate[];
  queryEcho: KnownPatternCandidateQueryEcho;
};

export type KnownPatternCandidatesRequest = {
  limit?: number;
};

export type KnownPatternCandidateControl = {
  controlId: string;
  candidateId: string;
  subjectKeyHash: string;
  state: KnownPatternControlAction;
  createdByRuleVersion: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type KnownPatternCandidateControlRequest = {
  clientMutationId: string;
  subjectKeyHash: string;
  createdByRuleVersion: string;
  action: KnownPatternControlAction;
};

export type KnownPatternCandidateControlResponse = {
  control: KnownPatternCandidateControl;
  updated: boolean;
};

export type KnownPatternReviewDraftRequest = {
  clientMutationId: string;
  subjectKeyHash: string;
  createdByRuleVersion: string;
};

export type KnownPatternReviewDraftIngredient = {
  id: string;
  name: string;
  amount: number;
  unit?: "g" | "ml";
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type KnownPatternReviewDraft = {
  name: string | null;
  type: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  ingredients: KnownPatternReviewDraftIngredient[];
  totals: {
    protein: number;
    fat: number;
    carbs: number;
    kcal: number;
  };
  notes: null;
  tags: string[];
};

export type KnownPatternReviewDraftResponse = {
  draft: KnownPatternReviewDraft;
  control: KnownPatternCandidateControl;
  updated: boolean;
};
