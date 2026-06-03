import type { NutritionDayBucket } from "@/services/meals/nutritionDaySelectors";
import type { DayKeyRange } from "@/services/meals/dayKeyRange";
import type { Nutrients } from "@/types";

export type MetricKey = "kcal" | "protein" | "carbs" | "fat";

export type RangeKey = "7d" | "30d" | "custom";

export type DateRange = {
  start: Date;
  end: Date;
};

export type StatisticsRangeAverages = {
  rangeDays: Nutrients;
  loggedDays: Nutrients;
  rangeDaysCount: number;
  loggedDaysCount: number;
};

export type StatisticsRangeComparison = {
  previousRange: DayKeyRange | null;
  previousAverages: StatisticsRangeAverages | null;
  kcalAverageDelta: number | null;
  kcalAverageDeltaPercent: number | null;
  hasPreviousEntries: boolean;
};

export type StatisticsRangeState = {
  activeRange: RangeKey;
  requestedRange: DayKeyRange;
  effectiveRange: DayKeyRange;
  dayKeys: string[];
  labels: string[];
  buckets: NutritionDayBucket[];
  seriesByMetric: Record<MetricKey, number[]>;
  totals: Nutrients;
  averages: StatisticsRangeAverages;
  comparison: StatisticsRangeComparison;
};

export type StatisticsEmptyKind =
  | "none"
  | "no_history"
  | "no_entries_in_range"
  | "limited_by_free_window";
