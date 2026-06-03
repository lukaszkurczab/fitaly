import type { Meal, Nutrients } from "@/types";
import { buildNutritionDayBucket } from "@/services/meals/nutritionDaySelectors";
import {
  addDaysToDayKey,
  buildRecentDayKeyRange,
  clampDayKeyRangeToWindow,
  dayKeyToDate,
  enumerateDayKeys,
  normalizeDayKeyRange,
  type DayKeyRange,
} from "@/services/meals/dayKeyRange";
import type {
  MetricKey,
  RangeKey,
  StatisticsRangeAverages,
  StatisticsRangeComparison,
  StatisticsRangeState,
} from "@/feature/Statistics/types";

const METRIC_KEYS: MetricKey[] = ["kcal", "protein", "carbs", "fat"];

const ZERO_NUTRIENTS: Nutrients = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export type BuildStatisticsRangeStateParams = {
  meals: Meal[];
  activeRange: RangeKey;
  todayDayKey: string;
  customRange?: DayKeyRange | null;
  accessWindowDays?: number;
};

function cloneZeroNutrients(): Nutrients {
  return { ...ZERO_NUTRIENTS };
}

function addNutrients(total: Nutrients, next: Nutrients): Nutrients {
  return {
    kcal: total.kcal + (Number(next.kcal) || 0),
    protein: total.protein + (Number(next.protein) || 0),
    carbs: total.carbs + (Number(next.carbs) || 0),
    fat: total.fat + (Number(next.fat) || 0),
  };
}

function divideNutrients(total: Nutrients, divisor: number): Nutrients {
  const safeDivisor = Math.max(1, divisor);
  return {
    kcal: Math.round(total.kcal / safeDivisor),
    protein: Math.round(total.protein / safeDivisor),
    carbs: Math.round(total.carbs / safeDivisor),
    fat: Math.round(total.fat / safeDivisor),
  };
}

function formatLabel(dayKey: string, totalDays: number): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;

  return date.toLocaleDateString(undefined, {
    weekday: totalDays <= 7 ? "short" : undefined,
    month: totalDays > 7 ? "short" : undefined,
    day: totalDays > 7 ? "numeric" : undefined,
  });
}

function buildRequestedRange(
  params: BuildStatisticsRangeStateParams,
): DayKeyRange | null {
  if (params.activeRange === "7d") {
    return buildRecentDayKeyRange(7, params.todayDayKey);
  }

  if (params.activeRange === "30d") {
    return buildRecentDayKeyRange(30, params.todayDayKey);
  }

  if (!params.customRange) return null;
  return normalizeDayKeyRange(params.customRange);
}

function aggregateStatisticsRange(params: {
  meals: Meal[];
  range: DayKeyRange;
}): Pick<
  StatisticsRangeState,
  "dayKeys" | "labels" | "buckets" | "seriesByMetric" | "totals" | "averages"
> {
  const dayKeys = enumerateDayKeys(params.range);
  const buckets = dayKeys.map((dayKey) =>
    buildNutritionDayBucket(params.meals, dayKey),
  );
  const labels = dayKeys.map((dayKey) => formatLabel(dayKey, dayKeys.length));

  const seriesByMetric = METRIC_KEYS.reduce<Record<MetricKey, number[]>>(
    (series, metric) => {
      series[metric] = buckets.map((bucket) => Number(bucket.totals[metric]) || 0);
      return series;
    },
    {
      kcal: [],
      protein: [],
      carbs: [],
      fat: [],
    },
  );

  const totals = buckets.reduce<Nutrients>(
    (sum, bucket) => addNutrients(sum, bucket.totals),
    cloneZeroNutrients(),
  );
  const loggedDaysCount = buckets.filter((bucket) => bucket.mealCount > 0).length;
  const averages: StatisticsRangeAverages = {
    rangeDays: divideNutrients(totals, dayKeys.length),
    loggedDays:
      loggedDaysCount > 0
        ? divideNutrients(totals, loggedDaysCount)
        : cloneZeroNutrients(),
    rangeDaysCount: dayKeys.length,
    loggedDaysCount,
  };

  return {
    dayKeys,
    labels,
    buckets,
    seriesByMetric,
    totals,
    averages,
  };
}

function buildPreviousRange(
  range: DayKeyRange,
  dayCount: number,
): DayKeyRange | null {
  if (dayCount <= 0) return null;

  const previousEndDayKey = addDaysToDayKey(range.startDayKey, -1);
  if (!previousEndDayKey) return null;

  const previousStartDayKey = addDaysToDayKey(previousEndDayKey, -dayCount + 1);
  if (!previousStartDayKey) return null;

  return {
    startDayKey: previousStartDayKey,
    endDayKey: previousEndDayKey,
  };
}

function canCompareWithinAccessWindow(params: {
  previousRange: DayKeyRange;
  accessWindowDays?: number;
  todayDayKey: string;
}): boolean {
  if (!params.accessWindowDays || params.accessWindowDays <= 0) return true;

  const windowRange = buildRecentDayKeyRange(
    params.accessWindowDays,
    params.todayDayKey,
  );
  if (!windowRange) return true;

  return (
    params.previousRange.startDayKey >= windowRange.startDayKey &&
    params.previousRange.endDayKey <= windowRange.endDayKey
  );
}

function buildRangeComparison(params: {
  meals: Meal[];
  currentRange: DayKeyRange;
  currentAverages: StatisticsRangeAverages;
  currentDayCount: number;
  accessWindowDays?: number;
  todayDayKey: string;
}): StatisticsRangeComparison {
  const previousRange = buildPreviousRange(
    params.currentRange,
    params.currentDayCount,
  );

  if (
    !previousRange ||
    !canCompareWithinAccessWindow({
      previousRange,
      accessWindowDays: params.accessWindowDays,
      todayDayKey: params.todayDayKey,
    })
  ) {
    return {
      previousRange: null,
      previousAverages: null,
      kcalAverageDelta: null,
      kcalAverageDeltaPercent: null,
      hasPreviousEntries: false,
    };
  }

  const previous = aggregateStatisticsRange({
    meals: params.meals,
    range: previousRange,
  });
  const hasPreviousEntries = previous.averages.loggedDaysCount > 0;
  const previousKcalAverage = previous.averages.rangeDays.kcal;
  const kcalAverageDelta = hasPreviousEntries
    ? params.currentAverages.rangeDays.kcal - previousKcalAverage
    : null;
  const kcalAverageDeltaPercent =
    kcalAverageDelta !== null && previousKcalAverage > 0
      ? Math.round((kcalAverageDelta / previousKcalAverage) * 100)
      : null;

  return {
    previousRange,
    previousAverages: previous.averages,
    kcalAverageDelta,
    kcalAverageDeltaPercent,
    hasPreviousEntries,
  };
}

export function clampStatisticsRangeToFreeWindow(params: {
  range: DayKeyRange;
  accessWindowDays?: number;
  todayDayKey: string;
}): DayKeyRange | null {
  return clampDayKeyRangeToWindow(
    params.range,
    params.accessWindowDays,
    params.todayDayKey,
  );
}

function clampDayKeyRangeToToday(
  range: DayKeyRange,
  todayDayKey: string,
): DayKeyRange | null {
  const normalized = normalizeDayKeyRange(range);
  if (!normalized) return null;

  if (normalized.endDayKey <= todayDayKey) {
    return normalized;
  }

  if (normalized.startDayKey > todayDayKey) {
    return {
      startDayKey: todayDayKey,
      endDayKey: todayDayKey,
    };
  }

  return {
    startDayKey: normalized.startDayKey,
    endDayKey: todayDayKey,
  };
}

export function buildStatisticsRangeState(
  params: BuildStatisticsRangeStateParams,
): StatisticsRangeState {
  const requestedRange =
    buildRequestedRange(params) ?? {
      startDayKey: params.todayDayKey,
      endDayKey: params.todayDayKey,
    };
  const todayClampedRange =
    clampDayKeyRangeToToday(requestedRange, params.todayDayKey) ?? requestedRange;
  const effectiveRange =
    clampStatisticsRangeToFreeWindow({
      range: todayClampedRange,
      accessWindowDays: params.accessWindowDays,
      todayDayKey: params.todayDayKey,
    }) ?? todayClampedRange;
  const aggregate = aggregateStatisticsRange({
    meals: params.meals,
    range: effectiveRange,
  });
  const comparison = buildRangeComparison({
    meals: params.meals,
    currentRange: effectiveRange,
    currentAverages: aggregate.averages,
    currentDayCount: aggregate.dayKeys.length,
    accessWindowDays: params.accessWindowDays,
    todayDayKey: params.todayDayKey,
  });

  return {
    activeRange: params.activeRange,
    requestedRange,
    effectiveRange,
    ...aggregate,
    comparison,
  };
}
