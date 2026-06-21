import { get, post, type RequestOptions } from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { requireRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import {
  KNOWN_PATTERN_CANDIDATE_STATES,
  KNOWN_PATTERN_CANDIDATE_TYPES,
  KNOWN_PATTERN_CONTROL_ACTIONS,
  KNOWN_PATTERN_CONFIDENCE_BUCKETS,
  KNOWN_PATTERN_COUNT_BUCKETS,
  KNOWN_PATTERN_REASON_CODES,
  KNOWN_PATTERN_SOURCE_TYPES,
  KNOWN_PATTERN_SUGGESTED_ACTIONS,
  type KnownPatternCandidate,
  type KnownPatternCandidateControl,
  type KnownPatternCandidateControlRequest,
  type KnownPatternCandidateControlResponse,
  type KnownPatternCandidateQueryEcho,
  type KnownPatternCandidatesRequest,
  type KnownPatternCandidatesResponse,
  type KnownPatternExplanation,
  type KnownPatternReviewDraft,
  type KnownPatternReviewDraftIngredient,
  type KnownPatternReviewDraftRequest,
  type KnownPatternReviewDraftResponse,
  type KnownPatternSourceRef,
} from "@/types/knownPatterns";

const KNOWN_PATTERN_CANDIDATES_ENDPOINT = withV2(
  "/users/me/known-patterns/candidates",
);
const INVALID_KNOWN_PATTERN_RESPONSE = "Invalid Known Pattern response.";

const CANDIDATE_KEYS = [
  "candidateId",
  "candidateType",
  "subjectKeyHash",
  "state",
  "confidenceBucket",
  "sourceCountBucket",
  "distinctDayCountBucket",
  "firstSeenAt",
  "lastSeenAt",
  "expiresAt",
  "sourceRefs",
  "explanation",
  "suggestedAction",
  "createdByRuleVersion",
] as const;

const SOURCE_REF_KEYS = ["sourceType", "sourceHash"] as const;
const EXPLANATION_KEYS = ["key", "reasonCode"] as const;
const CONTROL_KEYS = [
  "controlId",
  "candidateId",
  "subjectKeyHash",
  "state",
  "createdByRuleVersion",
  "expiresAt",
  "createdAt",
  "updatedAt",
] as const;
const CONTROL_RESPONSE_KEYS = ["control", "updated"] as const;
const REVIEW_DRAFT_INGREDIENT_KEYS = [
  "id",
  "name",
  "amount",
  "unit",
  "kcal",
  "protein",
  "fat",
  "carbs",
] as const;
const REVIEW_DRAFT_TOTALS_KEYS = ["protein", "fat", "carbs", "kcal"] as const;
const REVIEW_DRAFT_KEYS = [
  "name",
  "type",
  "ingredients",
  "totals",
  "notes",
  "tags",
] as const;
const REVIEW_DRAFT_RESPONSE_KEYS = ["draft", "control", "updated"] as const;
const QUERY_ECHO_KEYS = [
  "ruleVersion",
  "minSourceCount",
  "minDistinctDays",
  "maxHistoryItems",
  "returnedCandidates",
] as const;
const RESPONSE_KEYS = ["items", "queryEcho"] as const;
const HASH_RE = /^[a-f0-9]{12,64}$/;
const MIN_LIMIT = 1;
const MAX_LIMIT = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function requiredHash(value: unknown): string | null {
  const stringValue = requiredString(value);
  return stringValue && HASH_RE.test(stringValue) ? stringValue : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function positiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSourceRef(raw: unknown): KnownPatternSourceRef | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, SOURCE_REF_KEYS)) return null;
  const sourceType = isOneOf(raw.sourceType, KNOWN_PATTERN_SOURCE_TYPES)
    ? raw.sourceType
    : null;
  const sourceHash = requiredHash(raw.sourceHash);
  if (!sourceType || !sourceHash) return null;
  return { sourceType, sourceHash };
}

function normalizeExplanation(raw: unknown): KnownPatternExplanation | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, EXPLANATION_KEYS)) return null;
  const key =
    raw.key === "knownPattern.explanation.repeatedMealSnapshot"
      ? raw.key
      : null;
  const reasonCode = isOneOf(raw.reasonCode, KNOWN_PATTERN_REASON_CODES)
    ? raw.reasonCode
    : null;
  if (!key || !reasonCode) return null;
  return { key, reasonCode };
}

function normalizeCandidate(raw: unknown): KnownPatternCandidate | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, CANDIDATE_KEYS)) return null;

  const candidateId = requiredHash(raw.candidateId);
  const subjectKeyHash = requiredHash(raw.subjectKeyHash);
  const firstSeenAt = requiredString(raw.firstSeenAt);
  const lastSeenAt = requiredString(raw.lastSeenAt);
  const expiresAt = requiredString(raw.expiresAt);
  const createdByRuleVersion = requiredString(raw.createdByRuleVersion);
  const candidateType = isOneOf(
    raw.candidateType,
    KNOWN_PATTERN_CANDIDATE_TYPES,
  )
    ? raw.candidateType
    : null;
  const state = isOneOf(raw.state, KNOWN_PATTERN_CANDIDATE_STATES)
    ? raw.state
    : null;
  const confidenceBucket = isOneOf(
    raw.confidenceBucket,
    KNOWN_PATTERN_CONFIDENCE_BUCKETS,
  )
    ? raw.confidenceBucket
    : null;
  const sourceCountBucket = isOneOf(
    raw.sourceCountBucket,
    KNOWN_PATTERN_COUNT_BUCKETS,
  )
    ? raw.sourceCountBucket
    : null;
  const distinctDayCountBucket = isOneOf(
    raw.distinctDayCountBucket,
    KNOWN_PATTERN_COUNT_BUCKETS,
  )
    ? raw.distinctDayCountBucket
    : null;
  const suggestedAction = isOneOf(
    raw.suggestedAction,
    KNOWN_PATTERN_SUGGESTED_ACTIONS,
  )
    ? raw.suggestedAction
    : null;
  const sourceRefs = Array.isArray(raw.sourceRefs)
    ? raw.sourceRefs.map(normalizeSourceRef)
    : null;
  const explanation = normalizeExplanation(raw.explanation);

  if (
    !candidateId ||
    !candidateType ||
    !subjectKeyHash ||
    !state ||
    !confidenceBucket ||
    !sourceCountBucket ||
    !distinctDayCountBucket ||
    !firstSeenAt ||
    !lastSeenAt ||
    !expiresAt ||
    !sourceRefs ||
    sourceRefs.some((item) => item === null) ||
    sourceRefs.length === 0 ||
    sourceRefs.length > 5 ||
    !explanation ||
    !suggestedAction ||
    !createdByRuleVersion
  ) {
    return null;
  }

  return {
    candidateId,
    candidateType,
    subjectKeyHash,
    state,
    confidenceBucket,
    sourceCountBucket,
    distinctDayCountBucket,
    firstSeenAt,
    lastSeenAt,
    expiresAt,
    sourceRefs: sourceRefs as KnownPatternSourceRef[],
    explanation,
    suggestedAction,
    createdByRuleVersion,
  };
}

function normalizeControl(raw: unknown): KnownPatternCandidateControl | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, CONTROL_KEYS)) return null;

  const controlId = requiredHash(raw.controlId);
  const candidateId = requiredHash(raw.candidateId);
  const subjectKeyHash = requiredHash(raw.subjectKeyHash);
  const state = isOneOf(raw.state, KNOWN_PATTERN_CONTROL_ACTIONS)
    ? raw.state
    : null;
  const createdByRuleVersion = requiredString(raw.createdByRuleVersion);
  const expiresAt = requiredString(raw.expiresAt);
  const createdAt = requiredString(raw.createdAt);
  const updatedAt = requiredString(raw.updatedAt);
  if (
    !controlId ||
    !candidateId ||
    !subjectKeyHash ||
    !state ||
    !createdByRuleVersion ||
    !expiresAt ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    controlId,
    candidateId,
    subjectKeyHash,
    state,
    createdByRuleVersion,
    expiresAt,
    createdAt,
    updatedAt,
  };
}

function normalizeReviewDraftIngredient(
  raw: unknown,
): KnownPatternReviewDraftIngredient | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, REVIEW_DRAFT_INGREDIENT_KEYS)) {
    return null;
  }

  const id = requiredString(raw.id);
  const name = requiredString(raw.name);
  const amount = finiteNumber(raw.amount);
  const kcal = finiteNumber(raw.kcal);
  const protein = finiteNumber(raw.protein);
  const fat = finiteNumber(raw.fat);
  const carbs = finiteNumber(raw.carbs);
  if (
    !id ||
    !name ||
    amount === null ||
    kcal === null ||
    protein === null ||
    fat === null ||
    carbs === null
  ) {
    return null;
  }

  const unit = raw.unit === "g" || raw.unit === "ml" ? raw.unit : undefined;
  return { id, name, amount, unit, kcal, protein, fat, carbs };
}

function normalizeReviewDraft(raw: unknown): KnownPatternReviewDraft | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, REVIEW_DRAFT_KEYS)) return null;

  const name = raw.name === null ? null : requiredString(raw.name);
  const hasValidName = raw.name === null || name !== null;
  const mealType = isOneOf(raw.type, [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "other",
  ] as const)
    ? raw.type
    : null;
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.map(normalizeReviewDraftIngredient)
    : null;
  const totals =
    isRecord(raw.totals) && hasOnlyKeys(raw.totals, REVIEW_DRAFT_TOTALS_KEYS)
      ? {
          protein: finiteNumber(raw.totals.protein),
          fat: finiteNumber(raw.totals.fat),
          carbs: finiteNumber(raw.totals.carbs),
          kcal: finiteNumber(raw.totals.kcal),
        }
      : null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === "string")
    : null;

  if (
    !hasValidName ||
    !mealType ||
    !ingredients ||
    ingredients.some((item) => item === null) ||
    !totals ||
    totals.protein === null ||
    totals.fat === null ||
    totals.carbs === null ||
    totals.kcal === null ||
    raw.notes !== null ||
    !tags
  ) {
    return null;
  }

  return {
    name,
    type: mealType,
    ingredients: ingredients as KnownPatternReviewDraftIngredient[],
    totals: {
      protein: totals.protein,
      fat: totals.fat,
      carbs: totals.carbs,
      kcal: totals.kcal,
    },
    notes: null,
    tags,
  };
}

function normalizeQueryEcho(raw: unknown): KnownPatternCandidateQueryEcho | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, QUERY_ECHO_KEYS)) return null;

  const ruleVersion = requiredString(raw.ruleVersion);
  const minSourceCount = positiveInteger(raw.minSourceCount);
  const minDistinctDays = positiveInteger(raw.minDistinctDays);
  const maxHistoryItems = positiveInteger(raw.maxHistoryItems);
  const returnedCandidates = nonNegativeInteger(raw.returnedCandidates);

  if (
    !ruleVersion ||
    minSourceCount === null ||
    minDistinctDays === null ||
    maxHistoryItems === null ||
    returnedCandidates === null
  ) {
    return null;
  }

  return {
    ruleVersion,
    minSourceCount,
    minDistinctDays,
    maxHistoryItems,
    returnedCandidates,
  };
}

export function normalizeKnownPatternCandidatesResponse(
  raw: unknown,
): KnownPatternCandidatesResponse {
  if (!isRecord(raw) || !hasOnlyKeys(raw, RESPONSE_KEYS)) {
    throw new Error(INVALID_KNOWN_PATTERN_RESPONSE);
  }

  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeCandidate)
    : null;
  const queryEcho = normalizeQueryEcho(raw.queryEcho);
  if (!items || items.some((item) => item === null) || !queryEcho) {
    throw new Error(INVALID_KNOWN_PATTERN_RESPONSE);
  }

  return {
    items: items as KnownPatternCandidate[],
    queryEcho,
  };
}

export function normalizeKnownPatternCandidateControlResponse(
  raw: unknown,
): KnownPatternCandidateControlResponse {
  if (!isRecord(raw) || !hasOnlyKeys(raw, CONTROL_RESPONSE_KEYS)) {
    throw new Error(INVALID_KNOWN_PATTERN_RESPONSE);
  }

  const control = normalizeControl(raw.control);
  if (!control || typeof raw.updated !== "boolean") {
    throw new Error(INVALID_KNOWN_PATTERN_RESPONSE);
  }
  return { control, updated: raw.updated };
}

export function normalizeKnownPatternReviewDraftResponse(
  raw: unknown,
): KnownPatternReviewDraftResponse {
  if (!isRecord(raw) || !hasOnlyKeys(raw, REVIEW_DRAFT_RESPONSE_KEYS)) {
    throw new Error(INVALID_KNOWN_PATTERN_RESPONSE);
  }

  const draft = normalizeReviewDraft(raw.draft);
  const control = normalizeControl(raw.control);
  if (!draft || !control || typeof raw.updated !== "boolean") {
    throw new Error(INVALID_KNOWN_PATTERN_RESPONSE);
  }
  return { draft, control, updated: raw.updated };
}

function buildKnownPatternCandidatesPath(
  request: KnownPatternCandidatesRequest = {},
): string {
  const params = new URLSearchParams();
  if (request.limit !== undefined) {
    if (
      !Number.isInteger(request.limit) ||
      request.limit < MIN_LIMIT ||
      request.limit > MAX_LIMIT
    ) {
      throw new Error("Known Pattern candidate limit must be between 1 and 10.");
    }
    params.set("limit", String(request.limit));
  }
  const query = params.toString();
  return query
    ? `${KNOWN_PATTERN_CANDIDATES_ENDPOINT}?${query}`
    : KNOWN_PATTERN_CANDIDATES_ENDPOINT;
}

export async function fetchKnownPatternCandidatesRemote(
  request: KnownPatternCandidatesRequest = {},
  options?: RequestOptions,
): Promise<KnownPatternCandidatesResponse> {
  requireRuntimeFeatureEnabled("knownPatterns");
  return normalizeKnownPatternCandidatesResponse(
    await get(buildKnownPatternCandidatesPath(request), options),
  );
}

function buildKnownPatternCandidateActionPath(
  candidateId: string,
  action: "control" | "review-draft",
): string {
  const normalizedCandidateId = candidateId.trim();
  if (!HASH_RE.test(normalizedCandidateId)) {
    throw new Error("Known Pattern candidate id is invalid.");
  }
  return `${KNOWN_PATTERN_CANDIDATES_ENDPOINT}/${encodeURIComponent(
    normalizedCandidateId,
  )}/${action}`;
}

export async function markKnownPatternCandidateRemote(
  candidateId: string,
  request: KnownPatternCandidateControlRequest,
  options?: RequestOptions,
): Promise<KnownPatternCandidateControlResponse> {
  requireRuntimeFeatureEnabled("knownPatterns");
  return normalizeKnownPatternCandidateControlResponse(
    await post(buildKnownPatternCandidateActionPath(candidateId, "control"), request, {
      ...options,
      retryMode: options?.retryMode ?? "idempotent",
    }),
  );
}

export async function openKnownPatternReviewDraftRemote(
  candidateId: string,
  request: KnownPatternReviewDraftRequest,
  options?: RequestOptions,
): Promise<KnownPatternReviewDraftResponse> {
  requireRuntimeFeatureEnabled("knownPatterns");
  return normalizeKnownPatternReviewDraftResponse(
    await post(
      buildKnownPatternCandidateActionPath(candidateId, "review-draft"),
      request,
      {
        ...options,
        retryMode: options?.retryMode ?? "idempotent",
      },
    ),
  );
}
