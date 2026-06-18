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
