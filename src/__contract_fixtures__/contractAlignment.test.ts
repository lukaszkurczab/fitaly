/**
 * Cross-repo contract alignment tests.
 *
 * These tests validate that the canonical JSON fixtures in
 * `src/__contract_fixtures__/` match the mobile TypeScript type
 * definitions.  Mirror fixtures live in the backend repo at
 * `tests/contract_fixtures/`.
 *
 * When a fixture changes, the corresponding test must break in
 * *both* repos to prevent silent drift.
 */

import * as fs from "fs";
import * as path from "path";

import type {
  MealType,
  MealSyncState,
  MealInputMethod,
  MealSource,
} from "@/types/meal";
import type { Ingredient } from "@/types";
import type { MealDocument } from "@/types/mealDocument";
import {
  FOOD_LIBRARY_BARCODE_RESULT_OWNERS,
  FOOD_LIBRARY_CURRENT_SAVED_MEAL_NAMES,
  FOOD_LIBRARY_DOMAIN_CONTRACTS,
  FOOD_LIBRARY_DOMAINS,
  FOOD_LIBRARY_LEGACY_MARKERS_NOT_CANONICAL,
  FOOD_LIBRARY_LOGGED_MEAL_FORBIDDEN_FIELDS,
  FOOD_LIBRARY_LOGGED_MEAL_OWNER,
  FOOD_LIBRARY_LOGGED_MEAL_SCHEMA,
  FOOD_LIBRARY_MEAL_TEMPLATE_FORBIDDEN_LOGGED_MEAL_FIELDS,
  INGREDIENT_PRODUCT_ALLERGEN_FLAGS,
  INGREDIENT_PRODUCT_BARCODE_MINIMAL_IDENTITY_FIELDS,
  INGREDIENT_PRODUCT_BARCODE_OPTIONAL_FIELDS,
  INGREDIENT_PRODUCT_CONFIDENCE_FIELDS,
  INGREDIENT_PRODUCT_CONFIDENCE_LEVELS,
  INGREDIENT_PRODUCT_DIETARY_FLAGS,
  INGREDIENT_PRODUCT_KINDS,
  INGREDIENT_PRODUCT_LIFECYCLE_STATES,
  INGREDIENT_PRODUCT_NUTRITION_BASES,
  INGREDIENT_PRODUCT_NUTRITION_OPTIONAL_FIELDS,
  INGREDIENT_PRODUCT_NUTRITION_REQUIRED_FIELDS,
  INGREDIENT_PRODUCT_OPTIONAL_FIELDS,
  INGREDIENT_PRODUCT_PROFILE_COMPATIBILITY_STATUSES,
  INGREDIENT_PRODUCT_RECORD_SCOPES,
  INGREDIENT_PRODUCT_REQUIRED_FIELDS,
  INGREDIENT_PRODUCT_SERVING_REQUIRED_FIELDS,
  INGREDIENT_PRODUCT_SERVING_SIZE_FIELDS,
  INGREDIENT_PRODUCT_SERVING_UNITS,
  INGREDIENT_PRODUCT_SOURCE_ATTRIBUTION_OPTIONAL_FIELDS,
  INGREDIENT_PRODUCT_SOURCE_ATTRIBUTION_REQUIRED_FIELDS,
  INGREDIENT_PRODUCT_SOURCE_TYPES,
  type FoodLibraryDomainsContract,
} from "@/types/foodLibrary";
import type {
  CoachActionType,
  CoachEmptyReason,
  CoachInsightType,
  CoachResponse,
  CoachSource,
} from "@/services/coach/coachTypes";
import type {
  ReminderDecision,
  ReminderDecisionType,
  ReminderKind,
  ReminderReasonCode,
} from "@/services/reminders/reminderTypes";
import type {
  NutritionState,
  NutritionTopRisk,
  NutritionCoachPriority,
} from "@/services/nutritionState/nutritionStateTypes";
import type {
  WeeklyReport,
  WeeklyReportInsightImportance,
  WeeklyReportInsightTone,
  WeeklyReportInsightType,
  WeeklyReportPriorityType,
  WeeklyReportStatus,
} from "@/services/weeklyReport/weeklyReportTypes";
import {
  COACH_ACTION_TYPES,
  COACH_EMPTY_REASONS,
  COACH_INSIGHT_TYPES,
  COACH_SOURCES,
  getCoachInsightId,
  getCoachInsightValidUntil,
} from "@/services/coach/coachContract";
import {
  REMINDER_DECISION_TYPES,
  REMINDER_KINDS,
  REMINDER_REASON_CODES,
  SEND_REMINDER_REASON_CODES,
  SUPPRESS_REMINDER_REASON_CODES,
  NOOP_REMINDER_REASON_CODES,
} from "@/services/reminders/reminderTypes";
import {
  WEEKLY_REPORT_INSIGHT_IMPORTANCE,
  WEEKLY_REPORT_INSIGHT_TONES,
  WEEKLY_REPORT_INSIGHT_TYPES,
  WEEKLY_REPORT_PRIORITY_TYPES,
  WEEKLY_REPORT_STATUSES,
  isWeeklyReportDayKey,
} from "@/services/weeklyReport/weeklyReportContract";
import {
  MEDIA_ASSET_DOMAIN_FORBIDDEN_LIFECYCLE_FIELDS,
  MEDIA_ASSET_DOMAIN_OWNED_FIELDS_BY_SURFACE,
  MEDIA_ASSET_DOMAIN_OWNER_BY_SURFACE,
  MEDIA_ASSET_LIFECYCLE_OWNED_FIELDS,
  MEDIA_ASSET_LIFECYCLE_OWNER,
  MEDIA_ASSET_STATES,
  MEDIA_ASSET_SURFACES,
  type MediaAssetSurface,
} from "@/services/media/assetLifecycle";
import {
  SMART_MEMORY_CANDIDATE_STATES,
  SMART_MEMORY_CENTER_STATES,
  SMART_MEMORY_CONFIDENCE_REASON_CODES,
  SMART_MEMORY_CONTRACT_NAME,
  SMART_MEMORY_PROJECTION_STATES,
  SMART_MEMORY_REVIEW_STATES,
  SMART_MEMORY_SCHEMA_VERSION,
  SMART_MEMORY_STATE_REASON_CODES,
  SMART_MEMORY_STATES,
  SMART_MEMORY_TYPES,
  SMART_MEMORY_USER_CONTROL_OPERATIONS,
  SMART_MEMORY_USER_VALUE_REASON_CODES,
  type SmartMemoryCoreContract,
} from "@/types/smartMemory";

const MEDIA_ASSET_DOMAIN_OWNED_URL_FIELDS_FORBIDDEN = [
  "avatarUrl",
  "attachmentUrl",
  "downloadUrl",
  "publicUrl",
  "resolvedDownloadUrl",
] as const;
const SAVED_MEAL_PHOTO_LIBRARY_BRIDGE_DOMAINS = [
  "MealTemplate",
  "Recipe",
] as const;
const SAVED_MEAL_PHOTO_LIBRARY_NON_MIGRATION_TARGETS = [
  {
    domain: "Ingredient/Product",
    boundaryMechanism: "excluded_from_saved_meal_photo_media_bridge",
    reason:
      "product_media_is_product_owned_not_derived_from_saved_meal_photo_asset",
  },
  {
    domain: "ShoppingList",
    boundaryMechanism: "excluded_from_saved_meal_photo_media_bridge",
    reason:
      "shopping_list_references_items_without_transforming_saved_meal_photo_assets",
  },
] as const;
const SAVED_MEAL_PHOTO_STABLE_MEDIA_IDENTITY = [
  "imageRef",
  "imageRef.storagePath",
] as const;
const SAVED_MEAL_PHOTO_LIBRARY_SCHEMA_FIELDS_FORBIDDEN = [
  "recipeLifecycleState",
  "productLifecycleState",
  "shoppingListLifecycleState",
  "recipeMediaLifecycle",
  "productMediaLifecycle",
  "shoppingListMediaLifecycle",
] as const;

const FIXTURES_DIR = path.join(__dirname);
const BACKEND_FIXTURES_DIR = path.resolve(
  __dirname,
  "../../../fitaly-backend/tests/contract_fixtures",
);

function loadFixture<T = unknown>(name: string): T {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
  return JSON.parse(raw) as T;
}

function collectObjectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, keys);
    }
    return keys;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      keys.add(key);
      collectObjectKeys(child, keys);
    }
  }

  return keys;
}

function expectExactKeys(value: Record<string, unknown>, expectedKeys: string[]): void {
  expect(Object.keys(value).sort()).toEqual([...expectedKeys].sort());
}

type EnumsFixture = {
  MealType: string[];
  MealSyncState: string[];
  MealInputMethod: string[];
  MealSource: string[];
  GatewayRejectReasons: string[];
  TopRisk: string[];
  CoachPriority: string[];
  AiTier: string[];
  ReminderDecisionType: string[];
  ReminderKind: string[];
  ReminderReasonCode: string[];
};

type SmartReminderTelemetryFixture = {
  eventNames: string[];
  propsByEvent: Record<string, string[]>;
  disallowedEventNames: string[];
};

type AiRejectionsFixture = {
  rejections: {
    consentRequired: {
      status: number;
      detail: {
        code: string;
        message: string;
        aiConsent: {
          required: boolean;
          scope: string;
        };
      };
    };
    mealAnalysisDisabled: {
      status: number;
      detail: {
        code: string;
        message: string;
        aiConsent?: unknown;
      };
    };
    mealAnalysisIdempotencyConflict: {
      status: number;
      detail: {
        code: string;
        message: string;
        aiConsent?: unknown;
      };
    };
    providerUnavailable: {
      status: number;
      detail: {
        code: string;
        message: string;
        aiConsent?: unknown;
      };
    };
    providerTimeout: {
      status: number;
      detail: {
        code: string;
        message: string;
        aiConsent?: unknown;
      };
    };
    creditsExhausted: {
      status: number;
      detail: {
        code: string;
        message: string;
        aiConsent?: unknown;
        credits: {
          userId: string;
          tier: string;
          balance: number;
          allocation: number;
          periodStartAt: string;
          periodEndAt: string;
          costs: {
            chat: number;
            textMeal: number;
            photo: number;
          };
          renewalAnchorSource?: string | null;
          revenueCatEntitlementId?: string | null;
          revenueCatExpirationAt?: string | null;
          lastRevenueCatEventId?: string | null;
        };
      };
    };
  };
};

type MediaAssetLifecycleFixture = {
  contract: "media_asset_lifecycle_v1";
  assetStates: string[];
  lifecycleOwner: string;
  assetLifecycleOwns: string[];
  surfaces: Record<
    MediaAssetSurface,
    {
      usesAssetStates: "assetStates";
      domainOwner: string;
      domainDocumentOwns: string[];
      domainDocumentMustNotOwn: string[];
      futureLibraryBridge?: {
        currentDomain: "saved_meal";
        stableMediaIdentity: string[];
        bridgesToDomains: string[];
        bridgeMechanism: string;
        requiresSeparateMediaMigration: boolean;
        nonMigrationTargets: {
          domain: string;
          boundaryMechanism: string;
          reason: string;
        }[];
        loggedMealMustRemainNarrow: boolean;
        currentSavedMealMustNotExpandWith: string[];
      };
    }
  >;
};

type BarcodeLookupFixture = {
  contract: "barcode_lookup_v1";
  route: {
    method: "GET";
    path: "/users/me/barcode/lookup";
    query: { barcode: string };
  };
  found: {
    kind: "found";
    name: string;
    ingredient: Ingredient;
  };
  errors: {
    invalid: {
      status: 400;
      detail: { code: "BARCODE_INVALID"; message: string };
    };
    not_found: {
      status: 404;
      detail: { code: "BARCODE_NOT_FOUND"; message: string };
    };
    timeout: {
      status: 504;
      detail: { code: "BARCODE_PROVIDER_TIMEOUT"; message: string };
    };
    provider_error: {
      status: 502;
      detail: { code: "BARCODE_PROVIDER_FAILURE"; message: string };
    };
  };
};

describe("Enum parity", () => {
  const enums = loadFixture<EnumsFixture>("enums.json");
  const MOBILE_MEAL_TYPES: MealType[] = [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "other",
  ];
  const MOBILE_SYNC_STATES: MealSyncState[] = [
    "synced",
    "pending",
    "conflict",
    "failed",
  ];
  const MOBILE_INPUT_METHODS: MealInputMethod[] = [
    "manual",
    "photo",
    "barcode",
    "text",
  ];
  const MOBILE_MEAL_SOURCES: NonNullable<MealSource>[] = [
    "ai",
    "manual",
    "saved",
  ];
  const MOBILE_TOP_RISKS: NutritionTopRisk[] = [
    "none",
    "under_logging",
    "low_protein_consistency",
    "high_unknown_meal_details",
    "calorie_under_target",
  ];
  const MOBILE_COACH_PRIORITIES: NutritionCoachPriority[] = [
    "maintain",
    "logging_foundation",
    "protein_consistency",
    "meal_detail_quality",
    "calorie_adherence",
  ];
  const MOBILE_AI_TIERS: Array<"free" | "premium"> = ["free", "premium"];
  const MOBILE_REMINDER_DECISION_TYPES: ReminderDecisionType[] = [
    ...REMINDER_DECISION_TYPES,
  ];
  const MOBILE_REMINDER_KINDS: ReminderKind[] = [...REMINDER_KINDS];
  const MOBILE_REMINDER_REASON_CODES: ReminderReasonCode[] = [
    ...REMINDER_REASON_CODES,
  ];

  const BACKEND_REJECT_REASONS = ["OFF_TOPIC", "TOO_SHORT"];

  test("MealType values match backend", () => {
    expect([...MOBILE_MEAL_TYPES].sort()).toEqual([...enums.MealType].sort());
  });

  test("MealSyncState values match backend", () => {
    expect([...MOBILE_SYNC_STATES].sort()).toEqual(
      [...enums.MealSyncState].sort(),
    );
  });

  test("MealInputMethod values match backend", () => {
    expect([...MOBILE_INPUT_METHODS].sort()).toEqual(
      [...enums.MealInputMethod].sort(),
    );
  });

  test("MealSource values match backend", () => {
    expect([...MOBILE_MEAL_SOURCES].sort()).toEqual(
      [...enums.MealSource].sort(),
    );
  });

  test("GatewayRejectReasons match backend", () => {
    expect([...BACKEND_REJECT_REASONS].sort()).toEqual(
      [...enums.GatewayRejectReasons].sort(),
    );
  });

  test("TopRisk values match backend", () => {
    expect([...MOBILE_TOP_RISKS].sort()).toEqual([...enums.TopRisk].sort());
  });

  test("CoachPriority values match backend", () => {
    expect([...MOBILE_COACH_PRIORITIES].sort()).toEqual(
      [...enums.CoachPriority].sort(),
    );
  });

  test("AiTier values match backend", () => {
    expect([...MOBILE_AI_TIERS].sort()).toEqual([...enums.AiTier].sort());
  });

  test("ReminderDecisionType values match backend", () => {
    expect([...MOBILE_REMINDER_DECISION_TYPES].sort()).toEqual(
      [...enums.ReminderDecisionType].sort(),
    );
  });

  test("ReminderKind values match backend", () => {
    expect([...MOBILE_REMINDER_KINDS].sort()).toEqual(
      [...enums.ReminderKind].sort(),
    );
  });

  test("ReminderReasonCode values match backend", () => {
    expect([...MOBILE_REMINDER_REASON_CODES].sort()).toEqual(
      [...enums.ReminderReasonCode].sort(),
    );
  });
});

describe("Meal item contract", () => {
  const meal = loadFixture<MealDocument>("meal_item.json");

  test("has all required fields", () => {
    expect(meal.id).toBe("meal-contract-1");
    expect(typeof meal.loggedAt).toBe("string");
    expect(meal.type).toBe("lunch");
    expect(Array.isArray(meal.ingredients)).toBe(true);
    expect(typeof meal.createdAt).toBe("string");
    expect(typeof meal.updatedAt).toBe("string");
    expect(meal.syncState).toBe("synced");
  });

  test("ingredient shape matches", () => {
    const ing = meal.ingredients[0];
    expect(ing).toBeDefined();
    expect(typeof ing.id).toBe("string");
    expect(typeof ing.name).toBe("string");
    expect(typeof ing.amount).toBe("number");
    expect(ing.unit).toBe("g");
    expect(typeof ing.kcal).toBe("number");
    expect(typeof ing.protein).toBe("number");
    expect(typeof ing.fat).toBe("number");
    expect(typeof ing.carbs).toBe("number");
  });

  test("optional Foundation Sprint fields present", () => {
    expect(meal.dayKey).toBe("2026-03-18");
    expect(meal.loggedAtLocalMin).toBe(780);
    expect(meal.tzOffsetMin).toBe(60);
    expect(meal.source).toBe("ai");
    expect(meal.inputMethod).toBe("photo");
    expect(meal.aiMeta).toBeDefined();
    expect(meal.aiMeta?.model).toBe("gpt-4o");
    expect(meal.aiMeta?.confidence).toBe(0.88);
    expect(meal.totals?.kcal).toBe(330.0);
    expect(meal.totals?.protein).toBe(62.0);
    expect(meal.imageRef?.imageId).toBe("img-001");
  });

  test("fixture type field is a valid MealType", () => {
    const VALID: MealType[] = [
      "breakfast",
      "lunch",
      "dinner",
      "snack",
      "other",
    ];
    expect(VALID).toContain(meal.type);
  });
});

describe("Nutrition state contract", () => {
  const state = loadFixture<NutritionState>("nutrition_state.json");

  test("top-level keys match NutritionState type", () => {
    const expectedKeys = [
      "computedAt",
      "dayKey",
      "targets",
      "consumed",
      "remaining",
      "overTarget",
      "quality",
      "habits",
      "streak",
      "ai",
      "meta",
    ];
    expect(Object.keys(state).sort()).toEqual(expectedKeys.sort());
  });

  test("targets / consumed / remaining shapes", () => {
    expect(typeof state.targets.kcal).toBe("number");
    expect(typeof state.consumed.protein).toBe("number");
    expect(typeof state.remaining.carbs).toBe("number");
    expect(typeof state.overTarget.kcal).toBe("number");
  });

  test("quality shape", () => {
    expect(typeof state.quality.mealsLogged).toBe("number");
    expect(typeof state.quality.missingNutritionMeals).toBe("number");
    expect(typeof state.quality.dataCompletenessScore).toBe("number");
  });

  test("habits summary shape", () => {
    expect(state.habits.available).toBe(true);
    expect(typeof state.habits.behavior.loggingDays7).toBe("number");
    expect(typeof state.habits.behavior.validLoggingDays7).toBe("number");
    expect(typeof state.habits.behavior.loggingConsistency28).toBe("number");
    expect(typeof state.habits.behavior.validLoggingConsistency28).toBe(
      "number",
    );
    expect(typeof state.habits.behavior.avgValidMealsPerValidLoggedDay14).toBe(
      "number",
    );
    expect(typeof state.habits.behavior.mealTypeCoverage14.coveredCount).toBe(
      "number",
    );
    expect(typeof state.habits.behavior.mealTypeFrequency14.lunch).toBe(
      "number",
    );
    expect(typeof state.habits.behavior.dayCoverage14.validLoggedDays).toBe(
      "number",
    );
    expect(typeof state.habits.behavior.proteinDaysHit14.ratio).toBe("number");
    expect(state.habits.behavior.timingPatterns14.available).toBe(true);
    expect(
      typeof state.habits.behavior.timingPatterns14.firstMealMedianHour,
    ).toBe("number");
    expect(
      typeof state.habits.dataQuality.daysUsingTimestampTimingFallback14,
    ).toBe("number");
  });

  test("streak summary shape", () => {
    expect(state.streak.available).toBe(true);
    expect(typeof state.streak.current).toBe("number");
    expect(typeof state.streak.lastDate).toBe("string");
  });

  test("AI summary shape", () => {
    expect(state.ai.available).toBe(true);
    expect(state.ai.tier).toBe("free");
    expect(typeof state.ai.balance).toBe("number");
    expect(typeof state.ai.costs.chat).toBe("number");
    expect(typeof state.ai.costs.photo).toBe("number");
    expect(state.meta.isDegraded).toBe(false);
    expect(state.meta.componentStatus.habits).toBe("ok");
  });
});

describe("Coach response contract", () => {
  const coach = loadFixture<CoachResponse>("coach_response.json");

  const MOBILE_COACH_INSIGHT_TYPES: CoachInsightType[] = COACH_INSIGHT_TYPES;
  const MOBILE_COACH_ACTION_TYPES: CoachActionType[] = COACH_ACTION_TYPES;
  const MOBILE_COACH_SOURCES: CoachSource[] = COACH_SOURCES;
  const MOBILE_COACH_EMPTY_REASONS: CoachEmptyReason[] = COACH_EMPTY_REASONS;

  test("top-level keys match CoachResponse type", () => {
    const expectedKeys = [
      "dayKey",
      "computedAt",
      "source",
      "insights",
      "topInsight",
      "meta",
    ];
    expect(Object.keys(coach).sort()).toEqual(expectedKeys.sort());
  });

  test("coach response shape", () => {
    expect(coach.dayKey).toBe("2026-03-18");
    expect(coach.computedAt).toBe("2026-03-18T12:00:00Z");
    expect(MOBILE_COACH_SOURCES).toContain(coach.source);
    expect(Array.isArray(coach.insights)).toBe(true);
    expect(coach.insights).toHaveLength(1);
    expect(coach.topInsight?.type).toBe("positive_momentum");
    expect(coach.meta.available).toBe(true);
    expect(coach.meta.emptyReason).toBeNull();
    expect(coach.meta.isDegraded).toBe(false);
  });

  test("coach insight enum values match mobile contract", () => {
    expect(MOBILE_COACH_INSIGHT_TYPES).toContain(coach.insights[0]?.type);
    expect(MOBILE_COACH_ACTION_TYPES).toContain(coach.insights[0]?.actionType);
  });

  test("coach empty reason values match mobile contract", () => {
    expect(MOBILE_COACH_EMPTY_REASONS).toContain("no_data");
    expect(MOBILE_COACH_EMPTY_REASONS).toContain("insufficient_data");
    expect(coach.meta.emptyReason).toBeNull();
  });

  test("canonical fixture matches runtime contract assumptions", () => {
    expect(coach.topInsight).not.toBeNull();
    expect(coach.insights).toHaveLength(1);
    expect(coach.insights[0]).toEqual(coach.topInsight);
    expect(coach.topInsight?.id).toBe(
      getCoachInsightId(coach.dayKey, coach.topInsight!.type),
    );
    expect(coach.topInsight?.validUntil).toBe(
      getCoachInsightValidUntil(coach.dayKey),
    );
    expect(coach.topInsight?.reasonCodes).toEqual([
      "streak_positive",
      "consistency_improving",
    ]);
  });
});

describe("Weekly report contract", () => {
  const report = loadFixture<WeeklyReport>("weekly_report.json");

  const MOBILE_WEEKLY_REPORT_STATUSES: WeeklyReportStatus[] =
    WEEKLY_REPORT_STATUSES;
  const MOBILE_WEEKLY_REPORT_INSIGHT_TYPES: WeeklyReportInsightType[] =
    WEEKLY_REPORT_INSIGHT_TYPES;
  const MOBILE_WEEKLY_REPORT_INSIGHT_IMPORTANCE: WeeklyReportInsightImportance[] =
    WEEKLY_REPORT_INSIGHT_IMPORTANCE;
  const MOBILE_WEEKLY_REPORT_INSIGHT_TONES: WeeklyReportInsightTone[] =
    WEEKLY_REPORT_INSIGHT_TONES;
  const MOBILE_WEEKLY_REPORT_PRIORITY_TYPES: WeeklyReportPriorityType[] =
    WEEKLY_REPORT_PRIORITY_TYPES;

  test("top-level keys match WeeklyReport type", () => {
    const expectedKeys = [
      "status",
      "period",
      "summary",
      "insights",
      "priorities",
    ];
    expect(Object.keys(report).sort()).toEqual(expectedKeys.sort());
  });

  test("period shape stays bounded", () => {
    expect(isWeeklyReportDayKey(report.period.startDay)).toBe(true);
    expect(isWeeklyReportDayKey(report.period.endDay)).toBe(true);
    expect(report.period.startDay).toBe("2026-03-09");
    expect(report.period.endDay).toBe("2026-03-15");
  });

  test("enum values match mobile weekly report contract", () => {
    expect(MOBILE_WEEKLY_REPORT_STATUSES).toContain(report.status);
    expect(report.insights.length).toBeLessThanOrEqual(4);
    expect(report.priorities.length).toBeLessThanOrEqual(2);

    for (const insight of report.insights) {
      expect(MOBILE_WEEKLY_REPORT_INSIGHT_TYPES).toContain(insight.type);
      expect(MOBILE_WEEKLY_REPORT_INSIGHT_IMPORTANCE).toContain(
        insight.importance,
      );
      expect(MOBILE_WEEKLY_REPORT_INSIGHT_TONES).toContain(insight.tone);
      expect(Array.isArray(insight.reasonCodes)).toBe(true);
    }

    for (const priority of report.priorities) {
      expect(MOBILE_WEEKLY_REPORT_PRIORITY_TYPES).toContain(priority.type);
      expect(Array.isArray(priority.reasonCodes)).toBe(true);
    }
  });

  test("ready fixture stays actionable and small", () => {
    expect(report.status).toBe("ready");
    expect(typeof report.summary).toBe("string");
    expect(report.summary).toContain("Logging stayed steady across the week.");
    expect(report.insights).toHaveLength(1);
    expect(report.priorities).toHaveLength(1);
    expect(report.insights[0]?.type).toBe("consistency");
    expect(report.priorities[0]?.type).toBe("maintain_consistency");
  });
});

describe("Reminder decision contract", () => {
  const sendReminder = loadFixture<ReminderDecision>("reminder_decision.json");
  const suppressReminder = loadFixture<ReminderDecision>(
    "reminder_decision_suppress.json",
  );
  const noopReminder = loadFixture<ReminderDecision>(
    "reminder_decision_noop.json",
  );

  test("top-level keys match ReminderDecision type", () => {
    const expectedKeys = [
      "dayKey",
      "computedAt",
      "decision",
      "kind",
      "reasonCodes",
      "scheduledAtUtc",
      "confidence",
      "validUntil",
    ];
    expect(Object.keys(sendReminder).sort()).toEqual(expectedKeys.sort());
    expect(Object.keys(suppressReminder).sort()).toEqual(expectedKeys.sort());
    expect(Object.keys(noopReminder).sort()).toEqual(expectedKeys.sort());
  });

  test("send reminder decision shape", () => {
    expect(sendReminder.dayKey).toBe("2026-03-18");
    expect(sendReminder.computedAt).toBe("2026-03-18T12:00:00Z");
    expect(REMINDER_DECISION_TYPES).toContain(sendReminder.decision);
    expect(REMINDER_KINDS).toContain(sendReminder.kind!);
    expect(Array.isArray(sendReminder.reasonCodes)).toBe(true);
    expect(sendReminder.reasonCodes).toEqual([
      "preferred_window_today",
      "day_partially_logged",
    ]);
    expect(sendReminder.scheduledAtUtc).toBe("2026-03-18T18:30:00Z");
    expect(sendReminder.confidence).toBe(0.84);
    expect(sendReminder.validUntil).toBe("2026-03-18T19:30:00Z");
  });

  test("suppress and noop semantics stay explicit", () => {
    expect(suppressReminder.decision).toBe("suppress");
    expect(suppressReminder.kind).toBeNull();
    expect(suppressReminder.scheduledAtUtc).toBeNull();
    expect(suppressReminder.reasonCodes).toEqual(["quiet_hours"]);

    expect(noopReminder.decision).toBe("noop");
    expect(noopReminder.kind).toBeNull();
    expect(noopReminder.scheduledAtUtc).toBeNull();
    expect(noopReminder.reasonCodes).toEqual(["insufficient_signal"]);
  });

  test("reason codes match mobile contract", () => {
    for (const reasonCode of [
      ...sendReminder.reasonCodes,
      ...suppressReminder.reasonCodes,
      ...noopReminder.reasonCodes,
    ]) {
      expect(REMINDER_REASON_CODES).toContain(reasonCode);
    }
  });

  test("send semantics stay explicit", () => {
    expect(sendReminder.decision).toBe("send");
    expect(sendReminder.kind).toBe("log_next_meal");
    expect(typeof sendReminder.scheduledAtUtc).toBe("string");
  });
});

describe("Smart reminder telemetry contract", () => {
  const fixture = loadFixture<SmartReminderTelemetryFixture>(
    "smart_reminder_telemetry.json",
  );

  const MOBILE_EVENT_NAMES = [
    "smart_reminder_suppressed",
    "smart_reminder_scheduled",
    "smart_reminder_noop",
    "smart_reminder_decision_failed",
    "smart_reminder_schedule_failed",
  ] as const;

  const MOBILE_PROPS_BY_EVENT = {
    smart_reminder_suppressed: [
      "decision",
      "suppressionReason",
      "confidenceBucket",
    ],
    smart_reminder_scheduled: [
      "reminderKind",
      "decision",
      "confidenceBucket",
      "scheduledWindow",
    ],
    smart_reminder_noop: ["decision", "noopReason", "confidenceBucket"],
    smart_reminder_decision_failed: ["failureReason"],
    smart_reminder_schedule_failed: [
      "reminderKind",
      "decision",
      "confidenceBucket",
      "failureReason",
    ],
  } as const;

  test("event names match backend fixture", () => {
    expect([...fixture.eventNames].sort()).toEqual(
      [...MOBILE_EVENT_NAMES].sort(),
    );
  });

  test("props match backend fixture", () => {
    expect(Object.keys(fixture.propsByEvent).sort()).toEqual(
      Object.keys(MOBILE_PROPS_BY_EVENT).sort(),
    );

    for (const [eventName, propNames] of Object.entries(
      MOBILE_PROPS_BY_EVENT,
    )) {
      expect([...fixture.propsByEvent[eventName]].sort()).toEqual(
        [...propNames].sort(),
      );
    }
  });

  test("disallowed smart reminder telemetry events stay disallowed on mobile", () => {
    expect(fixture.disallowedEventNames.sort()).toEqual(
      ["smart_reminder_decision_computed", "smart_reminder_opened"].sort(),
    );
  });
});

type ContractSnapshot = {
  _doc: string;
  _version: string;
  decisionTypes: string[];
  reminderKinds: string[];
  reasonCodes: {
    all: string[];
    send: string[];
    suppress: string[];
    noop: string[];
  };
  decisionShape: {
    requiredFields: string[];
    sendRequires: string[];
    suppressForbids: string[];
    noopForbids: string[];
  };
  telemetry: {
    allowedEvents: string[];
    disallowedEvents: string[];
    propsByEvent: Record<string, string[]>;
  };
};

describe("Smart Reminders v1 contract snapshot", () => {
  const contract = loadFixture<ContractSnapshot>(
    "smart_reminders_v1.contract.json",
  );

  test("snapshot is generated by backend exporter, not hand-edited", () => {
    expect(contract._doc).toContain("scripts/export_reminder_contract.py");
    expect(contract._doc).toContain("Canonical Smart Reminders v1 contract");
  });

  test("snapshot version is v1", () => {
    expect(contract._version).toBe("v1");
  });

  test("decision types match snapshot", () => {
    expect([...REMINDER_DECISION_TYPES].sort()).toEqual(
      [...contract.decisionTypes].sort(),
    );
  });

  test("reminder kinds match snapshot", () => {
    expect([...REMINDER_KINDS].sort()).toEqual(
      [...contract.reminderKinds].sort(),
    );
  });

  test("all reason codes match snapshot", () => {
    expect([...REMINDER_REASON_CODES].sort()).toEqual(
      [...contract.reasonCodes.all].sort(),
    );
  });

  test("send reason codes match snapshot", () => {
    expect([...SEND_REMINDER_REASON_CODES].sort()).toEqual(
      [...contract.reasonCodes.send].sort(),
    );
  });

  test("suppress reason codes match snapshot", () => {
    expect([...SUPPRESS_REMINDER_REASON_CODES].sort()).toEqual(
      [...contract.reasonCodes.suppress].sort(),
    );
  });

  test("noop reason codes match snapshot", () => {
    expect([...NOOP_REMINDER_REASON_CODES].sort()).toEqual(
      [...contract.reasonCodes.noop].sort(),
    );
  });

  test("reason code groups are exhaustive", () => {
    const grouped = [
      ...contract.reasonCodes.send,
      ...contract.reasonCodes.suppress,
      ...contract.reasonCodes.noop,
    ].sort();
    expect(grouped).toEqual([...contract.reasonCodes.all].sort());
  });

  test("decision shape required fields match ReminderDecision type", () => {
    const typeFields = [
      "dayKey",
      "computedAt",
      "decision",
      "kind",
      "reasonCodes",
      "scheduledAtUtc",
      "confidence",
      "validUntil",
    ].sort();
    expect([...contract.decisionShape.requiredFields].sort()).toEqual(
      typeFields,
    );
  });

  test("telemetry allowed events match snapshot", () => {
    const MOBILE_EVENT_NAMES = [
      "smart_reminder_suppressed",
      "smart_reminder_scheduled",
      "smart_reminder_noop",
      "smart_reminder_decision_failed",
      "smart_reminder_schedule_failed",
    ];
    expect([...MOBILE_EVENT_NAMES].sort()).toEqual(
      [...contract.telemetry.allowedEvents].sort(),
    );
  });

  test("telemetry disallowed events match snapshot", () => {
    expect([...contract.telemetry.disallowedEvents].sort()).toEqual(
      ["smart_reminder_decision_computed", "smart_reminder_opened"].sort(),
    );
  });

  test("telemetry props per event match snapshot", () => {
    const MOBILE_PROPS_BY_EVENT: Record<string, readonly string[]> = {
      smart_reminder_suppressed: [
        "decision",
        "suppressionReason",
        "confidenceBucket",
      ],
      smart_reminder_scheduled: [
        "reminderKind",
        "decision",
        "confidenceBucket",
        "scheduledWindow",
      ],
      smart_reminder_noop: ["decision", "noopReason", "confidenceBucket"],
      smart_reminder_decision_failed: ["failureReason"],
      smart_reminder_schedule_failed: [
        "reminderKind",
        "decision",
        "confidenceBucket",
        "failureReason",
      ],
    };

    for (const [eventName, props] of Object.entries(MOBILE_PROPS_BY_EVENT)) {
      expect([...contract.telemetry.propsByEvent[eventName]].sort()).toEqual(
        [...props].sort(),
      );
    }
  });
});

describe("Gateway reject contract", () => {
  const fixture = loadFixture<{ detail: Record<string, unknown> }>(
    "gateway_reject.json",
  );

  test("detail has required fields", () => {
    const { detail } = fixture;
    expect(detail.message).toBe("AI request blocked by gateway");
    expect(detail.code).toBe("AI_GATEWAY_BLOCKED");
    expect(typeof detail.reason).toBe("string");
    expect(typeof detail.score).toBe("number");
  });

  test("reason is in mobile GATEWAY_REJECT_REASONS", () => {
    const GATEWAY_REJECT_REASONS = new Set([
      "OFF_TOPIC",
      "ML_OFF_TOPIC",
      "TOO_SHORT",
    ]);
    expect(GATEWAY_REJECT_REASONS.has(fixture.detail.reason as string)).toBe(
      true,
    );
  });
});

describe("AI rejection contract", () => {
  const fixture = loadFixture<AiRejectionsFixture>("ai_rejections.json");

  test("global consent rejection uses the canonical code and consent scope", () => {
    const rejection = fixture.rejections.consentRequired;
    const { detail } = rejection;

    expect(rejection.status).toBe(403);
    expect(detail.code).toBe("AI_CONSENT_REQUIRED");
    expect(detail.code).not.toBe(["AI", "CHAT", "CONSENT", "REQUIRED"].join("_"));
    expect(detail.message).toBe("AI health data consent required.");
    expect(detail.aiConsent.required).toBe(true);
    expect(detail.aiConsent.scope).toBe("global_ai_health_data");
  });

  test("meal-analysis disabled rejection uses the canonical disabled code", () => {
    const rejection = fixture.rejections.mealAnalysisDisabled;
    const { detail } = rejection;

    expect(rejection.status).toBe(503);
    expect(detail.code).toBe("AI_MEAL_ANALYSIS_DISABLED");
    expect(detail.message).toBe("Meal analysis AI is temporarily disabled.");
    expect(detail.aiConsent).toBeUndefined();
  });

  test("meal-analysis idempotency conflict uses the canonical Add Meal code", () => {
    const rejection = fixture.rejections.mealAnalysisIdempotencyConflict;
    const { detail } = rejection;

    expect(rejection.status).toBe(409);
    expect(detail.code).toBe("AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT");
    expect(detail.message).toBe(
      "Meal analysis request is already in progress or completed.",
    );
    expect(detail.aiConsent).toBeUndefined();
  });

  test("provider unavailable rejection uses the canonical provider code", () => {
    const rejection = fixture.rejections.providerUnavailable;
    const { detail } = rejection;

    expect(rejection.status).toBe(503);
    expect(detail.code).toBe("AI_CHAT_PROVIDER_UNAVAILABLE");
    expect(detail.message).toBe("AI provider is temporarily unavailable.");
    expect(detail.message).not.toContain("OpenAI");
    expect(detail.aiConsent).toBeUndefined();
  });

  test("provider timeout rejection uses the canonical timeout code", () => {
    const rejection = fixture.rejections.providerTimeout;
    const { detail } = rejection;

    expect(rejection.status).toBe(504);
    expect(detail.code).toBe("AI_CHAT_TIMEOUT");
    expect(detail.message).toBe(
      "AI provider timed out before a response was generated.",
    );
    expect(detail.message).not.toContain("OpenAI");
    expect(detail.aiConsent).toBeUndefined();
  });

  test("credits exhausted rejection uses the canonical credits payload shape", () => {
    const rejection = fixture.rejections.creditsExhausted;
    const { detail } = rejection;
    const { credits } = detail;

    expect(rejection.status).toBe(402);
    expect(detail.code).toBe("AI_CREDITS_EXHAUSTED");
    expect(detail.message).toBe("AI credits exhausted.");
    expect(detail.aiConsent).toBeUndefined();
    expect(Object.keys(credits).sort()).toEqual(
      [
        "allocation",
        "balance",
        "costs",
        "lastRevenueCatEventId",
        "periodEndAt",
        "periodStartAt",
        "renewalAnchorSource",
        "revenueCatEntitlementId",
        "revenueCatExpirationAt",
        "tier",
        "userId",
      ].sort(),
    );
    expect(credits.userId).toBe("user-1");
    expect(credits.tier).toBe("free");
    expect(credits.balance).toBe(0);
    expect(credits.allocation).toBe(100);
    expect(credits.periodStartAt).toBe("2026-04-19T00:00:00Z");
    expect(credits.periodEndAt).toBe("2026-05-19T00:00:00Z");
    expect(credits.costs).toEqual({
      chat: 1,
      textMeal: 1,
      photo: 5,
    });
  });
});

describe("Media asset lifecycle contract", () => {
  const fixture = loadFixture<MediaAssetLifecycleFixture>(
    "media_asset_lifecycle_v1.json",
  );

  test("state vocabulary matches mobile constants exactly", () => {
    expect(fixture.assetStates).toEqual([...MEDIA_ASSET_STATES]);
  });

  test("release media surfaces match mobile constants exactly", () => {
    expect(Object.keys(fixture.surfaces).sort()).toEqual(
      [...MEDIA_ASSET_SURFACES].sort(),
    );
  });

  test("fixture declares one shared lifecycle owner and owned fields", () => {
    expect(fixture.lifecycleOwner).toBe(MEDIA_ASSET_LIFECYCLE_OWNER);
    expect(fixture.assetLifecycleOwns).toEqual([
      ...MEDIA_ASSET_LIFECYCLE_OWNED_FIELDS,
    ]);
    expect(fixture.assetLifecycleOwns).toEqual(
      expect.arrayContaining(["opId", "clientMutationId"]),
    );
  });

  test("every surface uses canonical states and explicit owner boundaries", () => {
    for (const surface of MEDIA_ASSET_SURFACES) {
      const contract = fixture.surfaces[surface];

      expect(contract.usesAssetStates).toBe("assetStates");
      expect(contract.domainOwner).toBe(
        MEDIA_ASSET_DOMAIN_OWNER_BY_SURFACE[surface],
      );
      expect(contract.domainDocumentOwns).toEqual([
        ...MEDIA_ASSET_DOMAIN_OWNED_FIELDS_BY_SURFACE[surface],
      ]);
      expect(contract.domainDocumentMustNotOwn).toEqual([
        ...MEDIA_ASSET_DOMAIN_FORBIDDEN_LIFECYCLE_FIELDS,
      ]);
      expect(contract.domainDocumentMustNotOwn).toEqual([
        ...fixture.assetLifecycleOwns,
      ]);
      expect(contract.domainDocumentOwns).not.toEqual(
        expect.arrayContaining([
          ...MEDIA_ASSET_DOMAIN_OWNED_URL_FIELDS_FORBIDDEN,
        ]),
      );
      for (const field of contract.domainDocumentOwns) {
        expect(field).not.toMatch(/(?:Url|URL)$/);
      }
    }
  });

  test("saved-meal photo media bridges to future library domains by stable imageRef identity", () => {
    const bridge = fixture.surfaces.saved_meal_photo.futureLibraryBridge;

    expect(bridge).toBeDefined();
    expect(bridge?.currentDomain).toBe("saved_meal");
    expect(bridge?.stableMediaIdentity).toEqual([
      ...SAVED_MEAL_PHOTO_STABLE_MEDIA_IDENTITY,
    ]);
    expect(bridge?.bridgesToDomains).toEqual([
      ...SAVED_MEAL_PHOTO_LIBRARY_BRIDGE_DOMAINS,
    ]);
    expect(bridge?.bridgeMechanism).toBe(
      "reuse_imageRef_storagePath_without_storage_rewrite",
    );
    expect(bridge?.requiresSeparateMediaMigration).toBe(false);
  });

  test("saved-meal bridge explicitly excludes product and shopping-list media migration targets", () => {
    const bridge = fixture.surfaces.saved_meal_photo.futureLibraryBridge;

    expect(bridge?.nonMigrationTargets).toEqual([
      ...SAVED_MEAL_PHOTO_LIBRARY_NON_MIGRATION_TARGETS,
    ]);
    expect(bridge?.bridgesToDomains).not.toEqual(
      expect.arrayContaining(["Ingredient/Product", "ShoppingList"]),
    );
  });

  test("saved-meal bridge does not widen logged Meal or current saved-meal documents", () => {
    const savedMealPhoto = fixture.surfaces.saved_meal_photo;
    const bridge = savedMealPhoto.futureLibraryBridge;

    expect(bridge?.loggedMealMustRemainNarrow).toBe(true);
    expect(savedMealPhoto.domainDocumentOwns).toEqual([
      "imageRef",
      "displayMetadata",
      "savedMealDomainMetadata",
    ]);
    expect(savedMealPhoto.domainDocumentOwns).not.toEqual(
      expect.arrayContaining([
        ...SAVED_MEAL_PHOTO_LIBRARY_SCHEMA_FIELDS_FORBIDDEN,
      ]),
    );
    expect(savedMealPhoto.domainDocumentMustNotOwn).toEqual([
      ...MEDIA_ASSET_DOMAIN_FORBIDDEN_LIFECYCLE_FIELDS,
    ]);
    expect(bridge?.currentSavedMealMustNotExpandWith).toEqual([
      ...SAVED_MEAL_PHOTO_LIBRARY_SCHEMA_FIELDS_FORBIDDEN,
    ]);
  });
});

describe("Food library domains contract", () => {
  const fixture = loadFixture<FoodLibraryDomainsContract>(
    "food_library_domains_v1.json",
  );

  test("fixture uses exact JSON keys at every contract level", () => {
    const rawFixture = loadFixture<Record<string, unknown>>(
      "food_library_domains_v1.json",
    );

    expectExactKeys(rawFixture, [
      "contract",
      "libraryDomains",
      "domainContracts",
      "ingredientProductRecordContract",
      "loggedMealBoundary",
      "currentSavedMealsBoundary",
      "barcodeBoundary",
    ]);
    expectExactKeys(rawFixture.loggedMealBoundary as Record<string, unknown>, [
      "owner",
      "schemaName",
      "mustRemainNarrow",
      "mustNotServeAsLibraryCatchAll",
      "mustNotGainFields",
      "rationale",
    ]);
    expectExactKeys(
      rawFixture.currentSavedMealsBoundary as Record<string, unknown>,
      [
        "currentNames",
        "isFinalLibraryFoundation",
        "laterTargetDomain",
        "compatibilityFallbackToOldShapeAccepted",
        "legacyMarkersNotCanonicalLibraryFoundation",
        "mustNotExpandWith",
        "rationale",
      ],
    );
    expectExactKeys(rawFixture.barcodeBoundary as Record<string, unknown>, [
      "resultOwnership",
      "addMealDraftSourceOnly",
      "createsFirstPartyProductCatalogInThisSlice",
      "mustNotWriteLibraryDomains",
      "rationale",
    ]);

    const domainContracts = rawFixture.domainContracts as Record<
      string,
      Record<string, unknown>
    >;
    expectExactKeys(domainContracts, [...FOOD_LIBRARY_DOMAINS]);
    for (const domain of FOOD_LIBRARY_DOMAINS) {
      expectExactKeys(domainContracts[domain], [
        "owner",
        "identityFields",
        "ownedFields",
      ]);
    }

    const productContract =
      rawFixture.ingredientProductRecordContract as Record<string, unknown>;
    expectExactKeys(productContract, [
      "recordKinds",
      "recordScopes",
      "lifecycleStates",
      "verifiedMeaning",
      "requiredFields",
      "optionalFields",
      "kindSpecificRequiredFields",
      "ownership",
      "sourceAttribution",
      "confidence",
      "nutritionPer100",
      "serving",
      "profileFlags",
      "barcodeIdentities",
      "localCacheBoundary",
    ]);
    expectExactKeys(productContract.ownership as Record<string, unknown>, [
      "scopeField",
      "ownerField",
      "userScopedScope",
      "userScopedRequiresOwnerUserId",
      "globalScopesMustNotUseOwnerUserId",
      "globalRecordsAreUserAccountData",
    ]);
    expectExactKeys(productContract.sourceAttribution as Record<string, unknown>, [
      "requiredFields",
      "optionalFields",
      "sourceTypes",
      "candidateOnlySourceTypes",
      "durableTruthRequiresNonAiSource",
    ]);
    expectExactKeys(productContract.confidence as Record<string, unknown>, [
      "requiredFields",
      "levels",
      "unknownMeansNotSafeToAssume",
    ]);
    expectExactKeys(productContract.nutritionPer100 as Record<string, unknown>, [
      "requiredFields",
      "optionalFields",
      "allowedBases",
      "missingNutritionPolicy",
      "runtimeAiMayBecomeDurableNutritionTruth",
    ]);
    expectExactKeys(productContract.profileFlags as Record<string, unknown>, [
      "requiredFields",
      "allowedDietaryFlags",
      "allowedAllergenFlags",
      "compatibilityStatuses",
      "missingProfilePolicy",
      "verifiedIsMedicalOrDietarySafetyClaim",
      "runtimeAiMayBecomeDurableProfileTruth",
    ]);
  });

  test("declares exact CH-06 library domains", () => {
    expect(fixture.contract).toBe("food_library_domains_v1");
    expect(fixture.libraryDomains).toEqual([...FOOD_LIBRARY_DOMAINS]);
    expect(fixture.libraryDomains).toEqual([
      "MealTemplate",
      "Recipe",
      "Ingredient/Product",
      "ShoppingList",
    ]);
  });

  test("declares exact field-level contracts for all library domains", () => {
    expect(Object.keys(fixture.domainContracts)).toEqual([...FOOD_LIBRARY_DOMAINS]);

    for (const domain of FOOD_LIBRARY_DOMAINS) {
      expect(fixture.domainContracts[domain].owner).toBe(
        FOOD_LIBRARY_DOMAIN_CONTRACTS[domain].owner,
      );
      expect(fixture.domainContracts[domain].identityFields).toEqual([
        ...FOOD_LIBRARY_DOMAIN_CONTRACTS[domain].identityFields,
      ]);
      expect(fixture.domainContracts[domain].ownedFields).toEqual([
        ...FOOD_LIBRARY_DOMAIN_CONTRACTS[domain].ownedFields,
      ]);
    }
  });

  test("defines exact Ingredient/Product foundation fields", () => {
    const productContract = fixture.ingredientProductRecordContract;

    expect(productContract.recordKinds).toEqual([...INGREDIENT_PRODUCT_KINDS]);
    expect(productContract.recordScopes).toEqual([
      ...INGREDIENT_PRODUCT_RECORD_SCOPES,
    ]);
    expect(productContract.lifecycleStates).toEqual([
      ...INGREDIENT_PRODUCT_LIFECYCLE_STATES,
    ]);
    expect(productContract.verifiedMeaning).toBe(
      "verified_for_fitaly_catalog_use_not_medical_or_dietary_safety_claim",
    );
    expect(productContract.requiredFields).toEqual([
      ...INGREDIENT_PRODUCT_REQUIRED_FIELDS,
    ]);
    expect(productContract.optionalFields).toEqual([
      ...INGREDIENT_PRODUCT_OPTIONAL_FIELDS,
    ]);
    expect(productContract.kindSpecificRequiredFields.generic_ingredient).toEqual([
      "ingredientName",
    ]);
    expect(productContract.kindSpecificRequiredFields.branded_product).toEqual([
      "brandName",
    ]);
    expect(productContract.ownership.scopeField).toBe("recordScope");
    expect(productContract.ownership.ownerField).toBe("ownerUserId");
    expect(productContract.ownership.userScopedScope).toBe("user_scoped");
    expect(productContract.ownership.userScopedRequiresOwnerUserId).toBe(true);
    expect(productContract.ownership.globalScopesMustNotUseOwnerUserId).toEqual([
      "global_seed",
      "global_internal",
    ]);
    expect(productContract.ownership.globalRecordsAreUserAccountData).toBe(false);
  });

  test("requires source confidence and blocks guessed durable truth", () => {
    const productContract = fixture.ingredientProductRecordContract;

    expect(productContract.sourceAttribution.sourceTypes).toEqual([
      ...INGREDIENT_PRODUCT_SOURCE_TYPES,
    ]);
    expect(productContract.sourceAttribution.requiredFields).toEqual([
      ...INGREDIENT_PRODUCT_SOURCE_ATTRIBUTION_REQUIRED_FIELDS,
    ]);
    expect(productContract.sourceAttribution.optionalFields).toEqual([
      ...INGREDIENT_PRODUCT_SOURCE_ATTRIBUTION_OPTIONAL_FIELDS,
    ]);
    expect(productContract.sourceAttribution.candidateOnlySourceTypes).toEqual([
      "barcode_identity",
      "runtime_ai_candidate",
    ]);
    expect(productContract.sourceAttribution.durableTruthRequiresNonAiSource).toBe(
      true,
    );
    expect(productContract.confidence.levels).toEqual([
      ...INGREDIENT_PRODUCT_CONFIDENCE_LEVELS,
    ]);
    expect(productContract.confidence.requiredFields).toEqual([
      ...INGREDIENT_PRODUCT_CONFIDENCE_FIELDS,
    ]);
    expect(productContract.confidence.unknownMeansNotSafeToAssume).toBe(true);
    expect(productContract.nutritionPer100.missingNutritionPolicy).toBe(
      "unknown_not_guessed",
    );
    expect(
      productContract.nutritionPer100.runtimeAiMayBecomeDurableNutritionTruth,
    ).toBe(false);
    expect(productContract.profileFlags.missingProfilePolicy).toBe(
      "unknown_not_guessed",
    );
    expect(
      productContract.profileFlags.runtimeAiMayBecomeDurableProfileTruth,
    ).toBe(false);
  });

  test("keeps nutrition serving profile cache and barcode boundaries explicit", () => {
    const productContract = fixture.ingredientProductRecordContract;

    expect(productContract.nutritionPer100.allowedBases).toEqual([
      ...INGREDIENT_PRODUCT_NUTRITION_BASES,
    ]);
    expect(productContract.nutritionPer100.requiredFields).toEqual([
      ...INGREDIENT_PRODUCT_NUTRITION_REQUIRED_FIELDS,
    ]);
    expect(productContract.nutritionPer100.optionalFields).toEqual([
      ...INGREDIENT_PRODUCT_NUTRITION_OPTIONAL_FIELDS,
    ]);
    expect(productContract.serving.allowedUnits).toEqual([
      ...INGREDIENT_PRODUCT_SERVING_UNITS,
    ]);
    expect(productContract.serving.requiredFields).toEqual([
      ...INGREDIENT_PRODUCT_SERVING_REQUIRED_FIELDS,
    ]);
    expect(productContract.serving.servingSizeFields).toEqual([
      ...INGREDIENT_PRODUCT_SERVING_SIZE_FIELDS,
    ]);
    expect(productContract.profileFlags.allowedDietaryFlags).toEqual([
      ...INGREDIENT_PRODUCT_DIETARY_FLAGS,
    ]);
    expect(productContract.profileFlags.allowedAllergenFlags).toEqual([
      ...INGREDIENT_PRODUCT_ALLERGEN_FLAGS,
    ]);
    expect(productContract.profileFlags.compatibilityStatuses).toEqual([
      ...INGREDIENT_PRODUCT_PROFILE_COMPATIBILITY_STATUSES,
    ]);
    expect(productContract.profileFlags.verifiedIsMedicalOrDietarySafetyClaim).toBe(
      false,
    );
    expect(productContract.barcodeIdentities.minimalIdentityFields).toEqual([
      ...INGREDIENT_PRODUCT_BARCODE_MINIMAL_IDENTITY_FIELDS,
    ]);
    expect(productContract.barcodeIdentities.optionalFields).toEqual([
      ...INGREDIENT_PRODUCT_BARCODE_OPTIONAL_FIELDS,
    ]);
    expect(productContract.barcodeIdentities.noCatalogWriteInThisSlice).toBe(true);
    expect(productContract.barcodeIdentities.noTopLevelAddMealBarcodePath).toBe(
      true,
    );
    expect(productContract.localCacheBoundary.representedAs).toBe(
      "projection_only",
    );
    expect(productContract.localCacheBoundary.localCacheIsTruth).toBe(false);
    expect(productContract.localCacheBoundary.mayPromoteToGlobalWithoutReview).toBe(
      false,
    );
  });

  test("MealTemplate excludes logged-meal-only persistence fields", () => {
    const templateContract = fixture.domainContracts.MealTemplate;
    const templateFields = new Set<string>([
      ...templateContract.identityFields,
      ...templateContract.ownedFields,
    ]);

    for (const field of FOOD_LIBRARY_MEAL_TEMPLATE_FORBIDDEN_LOGGED_MEAL_FIELDS) {
      expect(templateFields.has(field)).toBe(false);
    }
  });

  test("logged Meal remains narrow and not the library catch-all", () => {
    const boundary = fixture.loggedMealBoundary;

    expect(boundary.owner).toBe(FOOD_LIBRARY_LOGGED_MEAL_OWNER);
    expect(boundary.schemaName).toBe(FOOD_LIBRARY_LOGGED_MEAL_SCHEMA);
    expect(boundary.mustRemainNarrow).toBe(true);
    expect(boundary.mustNotServeAsLibraryCatchAll).toBe(true);
    expect(boundary.mustNotGainFields).toEqual([
      ...FOOD_LIBRARY_LOGGED_MEAL_FORBIDDEN_FIELDS,
    ]);
    expect(boundary.rationale).toContain("persisted eaten-meal schema");
  });

  test("current saved meals are explicitly not final library foundation", () => {
    const boundary = fixture.currentSavedMealsBoundary;

    expect(boundary.currentNames).toEqual([
      ...FOOD_LIBRARY_CURRENT_SAVED_MEAL_NAMES,
    ]);
    expect(boundary.isFinalLibraryFoundation).toBe(false);
    expect(boundary.laterTargetDomain).toBe("MealTemplate");
    expect(boundary.compatibilityFallbackToOldShapeAccepted).toBe(false);
    expect(boundary.legacyMarkersNotCanonicalLibraryFoundation).toEqual([
      ...FOOD_LIBRARY_LEGACY_MARKERS_NOT_CANONICAL,
    ]);
    expect(boundary.mustNotExpandWith).toEqual([
      ...FOOD_LIBRARY_LOGGED_MEAL_FORBIDDEN_FIELDS,
    ]);
  });

  test("barcode result stays backend-adapter and Add Meal draft owned", () => {
    const boundary = fixture.barcodeBoundary;

    expect(boundary.resultOwnership).toEqual([
      ...FOOD_LIBRARY_BARCODE_RESULT_OWNERS,
    ]);
    expect(boundary.addMealDraftSourceOnly).toBe(true);
    expect(boundary.createsFirstPartyProductCatalogInThisSlice).toBe(false);
    expect(boundary.mustNotWriteLibraryDomains).toEqual(["Ingredient/Product"]);
    expect(fixture.domainContracts["Ingredient/Product"].owner).toBe(
      "ingredient_product_library",
    );
  });

  test("existing logged meal fixture does not include library-only fields", () => {
    const meal = loadFixture<MealDocument>("meal_item.json");
    const mealKeys = collectObjectKeys(meal);

    for (const field of fixture.loggedMealBoundary.mustNotGainFields) {
      expect(mealKeys.has(field)).toBe(false);
    }
  });
});

describe("Smart Memory core contract", () => {
  const fixture = loadFixture<SmartMemoryCoreContract>(
    "smart_memory_core_v1.json",
  );

  test("fixture uses exact JSON keys at every contract level", () => {
    const rawFixture = loadFixture<Record<string, unknown>>(
      "smart_memory_core_v1.json",
    );

    expectExactKeys(rawFixture, [
      "contract",
      "schemaVersion",
      "memoryTypes",
      "memoryStates",
      "candidateStates",
      "reasonCodes",
      "userControlOperations",
      "offlineProjectionStates",
      "apiEndpoints",
      "apiResponseExamples",
      "stateTransitionExamples",
      "memoryCenter",
      "review",
      "privacyBoundary",
    ]);
    expectExactKeys(rawFixture.reasonCodes as Record<string, unknown>, [
      "stateReasonCodes",
      "confidenceReasonCodes",
      "userValueReasonCodes",
    ]);
    expectExactKeys(rawFixture.apiResponseExamples as Record<string, unknown>, [
      "emptyItemsPage",
      "itemsPage",
      "candidateResponse",
      "itemDeleteResponse",
      "settingsEnabledResponse",
      "settingsDisabledResponse",
    ]);

    const stateExamples = rawFixture.stateTransitionExamples as Array<
      Record<string, unknown>
    >;
    for (const example of stateExamples) {
      expectExactKeys(example, [
        "case",
        "memoryType",
        "backendState",
        "projectionState",
        "reviewState",
        "memoryItemId",
        "candidateId",
        "queuedOperation",
        "suggestionUse",
      ]);
    }
  });

  test("declares exact Smart Memory enums and schema version", () => {
    expect(fixture.contract).toBe(SMART_MEMORY_CONTRACT_NAME);
    expect(fixture.schemaVersion).toBe(SMART_MEMORY_SCHEMA_VERSION);
    expect(fixture.memoryTypes).toEqual([...SMART_MEMORY_TYPES]);
    expect(fixture.memoryStates).toEqual([...SMART_MEMORY_STATES]);
    expect(fixture.candidateStates).toEqual([...SMART_MEMORY_CANDIDATE_STATES]);
    expect(fixture.reasonCodes.stateReasonCodes).toEqual([
      ...SMART_MEMORY_STATE_REASON_CODES,
    ]);
    expect(fixture.reasonCodes.confidenceReasonCodes).toEqual([
      ...SMART_MEMORY_CONFIDENCE_REASON_CODES,
    ]);
    expect(fixture.reasonCodes.userValueReasonCodes).toEqual([
      ...SMART_MEMORY_USER_VALUE_REASON_CODES,
    ]);
    expect(fixture.userControlOperations).toEqual([
      ...SMART_MEMORY_USER_CONTROL_OPERATIONS,
    ]);
    expect(fixture.offlineProjectionStates).toEqual([
      ...SMART_MEMORY_PROJECTION_STATES,
    ]);
    expect(fixture.memoryCenter.states).toEqual([...SMART_MEMORY_CENTER_STATES]);
    expect(fixture.review.states).toEqual([...SMART_MEMORY_REVIEW_STATES]);
  });

  test("backend fixture is byte-identical", () => {
    const mobileFixture = fs.readFileSync(
      path.join(FIXTURES_DIR, "smart_memory_core_v1.json"),
    );
    const backendFixture = fs.readFileSync(
      path.join(BACKEND_FIXTURES_DIR, "smart_memory_core_v1.json"),
    );

    expect(mobileFixture.equals(backendFixture)).toBe(true);
  });

  test("covers all release states before services or UI consume memory", () => {
    const cases = new Set(fixture.stateTransitionExamples.map((item) => item.case));

    expect(cases).toEqual(new Set(SMART_MEMORY_PROJECTION_STATES));
    for (const example of fixture.stateTransitionExamples) {
      if (
        [
          "no_signal",
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
        ].includes(example.case)
      ) {
        expect(example.suggestionUse).toBe("blocked");
        expect(example.reviewState).not.toBe("used");
      }

      if (example.suggestionUse === "allowed") {
        expect(example.reviewState).toBe("used");
      }

      if (
        example.case.startsWith("queued_") ||
        ["pending_offline_candidate", "sync_failed", "conflicted"].includes(
          example.case,
        )
      ) {
        expect(example.queuedOperation).not.toBeNull();
      }
    }
  });

  test("API examples expose only backend-owned response shapes", () => {
    expect(fixture.apiResponseExamples.emptyItemsPage.items).toEqual([]);
    expect(
      fixture.apiResponseExamples.itemsPage.items.map((item) => item.state),
    ).toEqual(["active", "muted"]);
    expect(fixture.apiResponseExamples.candidateResponse.candidate.state).toBe(
      "candidate",
    );
    expect(fixture.apiResponseExamples.itemDeleteResponse.item.state).toBe(
      "deleted_suppressed",
    );
    expect(fixture.apiResponseExamples.itemDeleteResponse.item.subject).toEqual({});
    expect(fixture.apiResponseExamples.itemDeleteResponse.item.sourceRefs).toEqual(
      [],
    );
    expect(fixture.apiResponseExamples.settingsEnabledResponse.settings.enabled).toBe(
      true,
    );
    expect(
      fixture.apiResponseExamples.settingsDisabledResponse.settings.enabled,
    ).toBe(false);
  });

  test("keeps private and provider payloads out of the fixture", () => {
    const forbiddenKeys = [
      "rawPrompt",
      "rawResponse",
      "providerMessages",
      "fullPayload",
      "openaiPayload",
      "providerPayload",
      "telemetryPayload",
      "rawReviewDiff",
      "rawDiff",
      "mealSnapshot",
    ];

    const keys = collectObjectKeys(fixture);
    for (const forbiddenKey of forbiddenKeys) {
      expect(keys.has(forbiddenKey)).toBe(false);
    }
    expect(fixture.privacyBoundary).toEqual({
      excludesMealNarrativeText: true,
      excludesReviewDiffs: true,
      excludesProviderPayloads: true,
      excludesTelemetryPrivateIdentifiers: true,
      usesHashedSubjectAndSourceRefs: true,
    });
  });
});

describe("Barcode lookup contract", () => {
  const fixture = loadFixture<BarcodeLookupFixture>("barcode_lookup_v1.json");

  test("fixture uses exact JSON keys at every contract level", () => {
    const rawFixture = loadFixture<Record<string, unknown>>(
      "barcode_lookup_v1.json",
    );

    expectExactKeys(rawFixture, ["contract", "route", "found", "errors"]);
    expectExactKeys(rawFixture.route as Record<string, unknown>, [
      "method",
      "path",
      "query",
    ]);
    expectExactKeys(rawFixture.found as Record<string, unknown>, [
      "kind",
      "name",
      "ingredient",
    ]);
    expectExactKeys(
      (rawFixture.found as { ingredient: Record<string, unknown> }).ingredient,
      ["id", "name", "amount", "unit", "kcal", "protein", "fat", "carbs"],
    );
    expectExactKeys(rawFixture.errors as Record<string, unknown>, [
      "invalid",
      "not_found",
      "timeout",
      "provider_error",
    ]);
  });

  test("declares exact route and found response shape", () => {
    expect(fixture.contract).toBe("barcode_lookup_v1");
    expect(fixture.route).toEqual({
      method: "GET",
      path: "/users/me/barcode/lookup",
      query: { barcode: "5901234123457" },
    });
    expect(fixture.found).toEqual({
      kind: "found",
      name: "Greek yogurt",
      ingredient: {
        id: "5901234123457",
        name: "Greek yogurt",
        amount: 100,
        unit: "g",
        kcal: 120,
        protein: 12,
        fat: 4,
        carbs: 8,
      },
    });
  });

  test("declares exact backend error status and code mapping", () => {
    expect(fixture.errors).toEqual({
      invalid: {
        status: 400,
        detail: {
          code: "BARCODE_INVALID",
          message: "Barcode must be 8, 12, or 13 digits",
        },
      },
      not_found: {
        status: 404,
        detail: {
          code: "BARCODE_NOT_FOUND",
          message: "Barcode product not found",
        },
      },
      timeout: {
        status: 504,
        detail: {
          code: "BARCODE_PROVIDER_TIMEOUT",
          message: "Barcode provider timed out",
        },
      },
      provider_error: {
        status: 502,
        detail: {
          code: "BARCODE_PROVIDER_FAILURE",
          message: "Barcode provider unavailable",
        },
      },
    });
  });
});
