import { useEffect, useMemo, useState } from "react";
import { useMeals } from "@/hooks/useMeals";
import {
  formatMealDayKey,
  isCanonicalMealDayKey,
} from "@/services/meals/mealMetadata";
import {
  buildRecentDayKeyRange,
  dayKeyToDate,
  normalizeDayKeyRange,
  type DayKeyRange,
} from "@/services/meals/dayKeyRange";
import {
  buildStatisticsRangeState,
} from "@/feature/Statistics/services/statisticsRangeSelectors";
import type {
  DateRange,
  MetricKey,
  RangeKey,
  StatisticsEmptyKind,
} from "@/feature/Statistics/types";
import { startOfDay } from "@/utils/accessWindow";

const normalizeRange = (range: DateRange): DateRange => {
  const start = startOfDay(range.start);
  const end = startOfDay(range.end);
  if (start <= end) return { start, end };
  return { start: end, end: start };
};

const getTodayDayKey = (): string => formatMealDayKey(new Date()) ?? "1970-01-01";

const dayKeyRangeToDateRange = (range: DayKeyRange): DateRange => {
  const start = dayKeyToDate(range.startDayKey);
  const end = dayKeyToDate(range.endDayKey);

  return normalizeRange({
    start: start ?? new Date(),
    end: end ?? start ?? new Date(),
  });
};

const dateRangeToDayKeyRange = (range: DateRange): DayKeyRange | null => {
  const normalized = normalizeRange(range);
  const startDayKey = formatMealDayKey(normalized.start);
  const endDayKey = formatMealDayKey(normalized.end);
  if (!isCanonicalMealDayKey(startDayKey) || !isCanonicalMealDayKey(endDayKey)) {
    return null;
  }

  return normalizeDayKeyRange({ startDayKey, endDayKey });
};

export function useStatisticsState(params: {
  uid: string;
  calorieTarget: number | null;
  accessWindowDays?: number;
}) {
  const { meals, loading: loadingMeals } = useMeals(params.uid);
  const todayDayKey = getTodayDayKey();

  const [active, setActive] = useState<RangeKey>("7d");
  const [customRange, setCustomRangeState] = useState<DateRange>(() => {
    const recentRange = buildRecentDayKeyRange(7, getTodayDayKey());
    return recentRange
      ? dayKeyRangeToDateRange(recentRange)
      : normalizeRange({ start: new Date(), end: new Date() });
  });
  const [metric, setMetric] = useState<MetricKey>("kcal");

  const setCustomRange = (range: DateRange) => {
    setCustomRangeState(normalizeRange(range));
  };

  useEffect(() => {
    setCustomRangeState((prev) => normalizeRange(prev));
  }, [todayDayKey]);

  const customDayKeyRange = useMemo(
    () => dateRangeToDayKeyRange(customRange),
    [customRange],
  );

  const rangeState = useMemo(
    () =>
      buildStatisticsRangeState({
        meals,
        activeRange: active,
        todayDayKey,
        customRange: customDayKeyRange,
        accessWindowDays: params.accessWindowDays,
      }),
    [active, customDayKeyRange, meals, params.accessWindowDays, todayDayKey],
  );

  const selectedRange = useMemo(
    () => dayKeyRangeToDateRange(rangeState.requestedRange),
    [rangeState.requestedRange],
  );
  const effectiveRange = useMemo(
    () => dayKeyRangeToDateRange(rangeState.effectiveRange),
    [rangeState.effectiveRange],
  );
  const days = rangeState.dayKeys.length;
  const hasEntriesInRange = rangeState.averages.loggedDaysCount > 0;
  const hasAnyMeals = meals.length > 0;
  const isWindowLimited =
    !!params.accessWindowDays &&
    rangeState.requestedRange.startDayKey < rangeState.effectiveRange.startDayKey;
  const emptyKind: StatisticsEmptyKind =
    !loadingMeals && !hasAnyMeals
      ? "no_history"
      : !loadingMeals && hasAnyMeals && !hasEntriesInRange
        ? isWindowLimited
          ? "limited_by_free_window"
          : "no_entries_in_range"
        : "none";

  const hasTotals =
    rangeState.totals.kcal > 0 ||
    rangeState.totals.protein > 0 ||
    rangeState.totals.carbs > 0 ||
    rangeState.totals.fat > 0;
  const calorieTarget =
    params.calorieTarget && params.calorieTarget > 0
      ? Math.round(params.calorieTarget)
      : null;
  const calorieGoalProgress =
    calorieTarget !== null
      ? Math.round((rangeState.averages.rangeDays.kcal / calorieTarget) * 100)
      : null;

  return {
    active,
    setActive,
    customRange,
    setCustomRange,
    metric,
    setMetric,
    loadingMeals,
    selectedRange,
    effectiveRange,
    days,
    emptyKind,
    hasAnyMeals,
    hasEntriesInRange,
    labels: rangeState.labels,
    seriesByMetric: rangeState.seriesByMetric,
    selectedSeries: rangeState.seriesByMetric[metric],
    totals: rangeState.totals,
    hasTotals,
    avgKcal: rangeState.averages.rangeDays.kcal,
    avgProtein: rangeState.averages.rangeDays.protein,
    avgCarbs: rangeState.averages.rangeDays.carbs,
    avgFat: rangeState.averages.rangeDays.fat,
    avgLoggedProtein: rangeState.averages.loggedDays.protein,
    avgLoggedCarbs: rangeState.averages.loggedDays.carbs,
    avgLoggedFat: rangeState.averages.loggedDays.fat,
    loggedDaysCount: rangeState.averages.loggedDaysCount,
    rangeDaysCount: rangeState.averages.rangeDaysCount,
    calorieTarget,
    calorieGoalProgress,
    calorieComparison: rangeState.comparison,
    isWindowLimited,
  };
}
