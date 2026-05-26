import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, RangeSlider } from "@/components";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Calendar } from "@/components/Calendar";
import { Modal } from "@/components/Modal";
import { useTranslation } from "react-i18next";
import { Filters, FilterScope, useFilters } from "@/context/HistoryContext";
import {
  clampDateRangeToAccessWindow,
  endOfDay,
  getAccessWindowStartDate,
  normalizeDateRange,
  resolveDateRangeWithinAccessWindow,
  startOfDay,
} from "@/utils/accessWindow";

type Range = { start: Date; end: Date };
type FilterKey = "calories" | "protein" | "carbs" | "fat" | "date";
type DatePreset = "today" | "last7" | "month" | "custom";
type CaloriePreset = "under300" | "300-600" | "450-900" | "900+" | "custom";

const DEFAULTS = {
  calories: [0, 3000] as [number, number],
  protein: [0, 100] as [number, number],
  carbs: [0, 100] as [number, number],
  fat: [0, 100] as [number, number],
};

function isSameRange(
  left: { start: Date; end: Date },
  right: { start: Date; end: Date },
): boolean {
  return +startOfDay(left.start) === +startOfDay(right.start) &&
    +endOfDay(left.end) === +endOfDay(right.end);
}

function resolveDatePreset(range: Range): DatePreset {
  const today = new Date();
  const todayRange = { start: startOfDay(today), end: endOfDay(today) };

  const last7Start = startOfDay(new Date(today));
  last7Start.setDate(today.getDate() - 6);
  const last7Range = { start: last7Start, end: endOfDay(today) };

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthRange = { start: startOfDay(monthStart), end: endOfDay(today) };

  if (isSameRange(range, todayRange)) return "today";
  if (isSameRange(range, last7Range)) return "last7";
  if (isSameRange(range, monthRange)) return "month";
  return "custom";
}

function rangeForDatePreset(preset: Exclude<DatePreset, "custom">): Range {
  const today = new Date();

  if (preset === "today") {
    return { start: startOfDay(today), end: endOfDay(today) };
  }

  if (preset === "last7") {
    const start = startOfDay(new Date(today));
    start.setDate(today.getDate() - 6);
    return { start, end: endOfDay(today) };
  }

  return {
    start: startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: endOfDay(today),
  };
}

function resolveCaloriePreset(value: [number, number]): CaloriePreset {
  const [min, max] = value;
  if (min === 0 && max === 300) return "under300";
  if (min === 300 && max === 600) return "300-600";
  if (min === 450 && max === 900) return "450-900";
  if (min === 900 && max === 3000) return "900+";
  return "custom";
}

function rangeForCaloriePreset(preset: Exclude<CaloriePreset, "custom">): [number, number] {
  if (preset === "under300") return [0, 300];
  if (preset === "300-600") return [300, 600];
  if (preset === "450-900") return [450, 900];
  return [900, 3000];
}

function compactDateRangeLabel(range: Range, locale?: string): string {
  const formatter = new Intl.DateTimeFormat(locale || undefined, {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(range.start)} - ${formatter.format(range.end)}`;
}

type ChipButtonProps = {
  label: string;
  selected?: boolean;
  testID?: string;
  onPress: () => void;
};

function ChipButton({ label, selected = false, testID, onPress }: ChipButtonProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chipButton,
        selected ? styles.chipButtonSelected : styles.chipButtonDefault,
        pressed ? styles.chipButtonPressed : null,
      ]}
    >
      <Text
        style={[
          styles.chipButtonLabel,
          selected ? styles.chipButtonLabelSelected : styles.chipButtonLabelDefault,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const FilterPanel: React.FC<{
  scope: FilterScope;
  isPremium?: boolean;
  windowDays?: number;
  onUpgrade?: () => void;
}> = ({ scope, isPremium = false, windowDays }) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation(["history", "common"]);
  const accessWindowDays = isPremium ? undefined : windowDays;
  const {
    query,
    filters: ctxFilters,
    applyFilters,
    clearFilters,
  } = useFilters(scope);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";
  const maxSelectableDate = endOfDay(new Date());
  const minSelectableDate = getAccessWindowStartDate(accessWindowDays);
  const clampDateRange = (range: Range) =>
    clampDateRangeToAccessWindow(range, accessWindowDays);

  const initialRange: Range = useMemo(() => {
    return (
      resolveDateRangeWithinAccessWindow(ctxFilters?.dateRange, accessWindowDays) ??
      normalizeDateRange({ start: new Date(), end: new Date() })
    );
  }, [accessWindowDays, ctxFilters?.dateRange]);

  const [calories, setCalories] = useState<[number, number]>(
    (ctxFilters?.calories as [number, number]) ?? DEFAULTS.calories,
  );
  const [protein, setProtein] = useState<[number, number]>(
    (ctxFilters?.protein as [number, number]) ?? DEFAULTS.protein,
  );
  const [carbs, setCarbs] = useState<[number, number]>(
    (ctxFilters?.carbs as [number, number]) ?? DEFAULTS.carbs,
  );
  const [fat, setFat] = useState<[number, number]>(
    (ctxFilters?.fat as [number, number]) ?? DEFAULTS.fat,
  );
  const [dateRange, setDateRange] = useState<Range>(initialRange);
  const [active, setActive] = useState<FilterKey[]>([]);

  const [openCalendar, setOpenCalendar] = useState(false);
  const [focus, setFocus] = useState<"start" | "end">("start");
  const [localRange, setLocalRange] = useState<Range>(initialRange);
  const [openPicker, setOpenPicker] = useState(false);

  useEffect(() => {
    setDateRange(initialRange);
    setLocalRange(initialRange);
  }, [initialRange]);

  useEffect(() => {
    const nextActive: FilterKey[] = [];
    if (ctxFilters?.calories) nextActive.push("calories");
    if (ctxFilters?.protein) nextActive.push("protein");
    if (ctxFilters?.carbs) nextActive.push("carbs");
    if (ctxFilters?.fat) nextActive.push("fat");
    if (ctxFilters?.dateRange) nextActive.push("date");
    setActive(nextActive);
  }, [ctxFilters]);

  const addFilter = (key: FilterKey) =>
    setActive((prev) => (prev.includes(key) ? prev : [...prev, key]));

  const removeFilter = (key: FilterKey) =>
    setActive((prev) => prev.filter((value) => value !== key));

  const openCalendarModal = () => {
    setLocalRange(clampDateRange(dateRange));
    setFocus("start");
    setOpenCalendar(true);
  };

  const applyCalendar = () => {
    setDateRange(clampDateRange(localRange));
    addFilter("date");
    setOpenCalendar(false);
  };

  const buildPayload = (): Filters => {
    const payload: Filters = {};
    if (active.includes("calories")) payload.calories = calories;
    if (active.includes("protein")) payload.protein = protein;
    if (active.includes("carbs")) payload.carbs = carbs;
    if (active.includes("fat")) payload.fat = fat;
    if (active.includes("date")) payload.dateRange = clampDateRange(dateRange);
    return payload;
  };

  const apply = () => {
    applyFilters(buildPayload());
  };

  const clear = () => {
    setActive([]);
    setCalories(DEFAULTS.calories);
    setProtein(DEFAULTS.protein);
    setCarbs(DEFAULTS.carbs);
    setFat(DEFAULTS.fat);
    setDateRange(initialRange);
    clearFilters();
  };

  const summaryChips = useMemo(() => {
    return active.map((key) => {
      let label = "";

      if (key === "date") {
        const preset = resolveDatePreset(dateRange);
        label =
          preset === "today"
            ? t("history:presets.today", "Today")
            : preset === "last7"
              ? t("history:presets.last7", "Last 7 days")
              : preset === "month"
                ? t("history:presets.month", "This month")
                : compactDateRangeLabel(dateRange, i18n?.language);
      } else if (key === "calories") {
        const preset = resolveCaloriePreset(calories);
        label =
          preset === "under300"
            ? t("history:presets.under300", "Under 300")
            : preset === "300-600"
              ? t("history:presets.range300To600", "300-600")
              : preset === "450-900"
                ? t("history:presets.range450To900", "450-900 kcal")
                : preset === "900+"
                  ? t("history:presets.over900", "900+")
                  : `${calories[0]}-${calories[1]} kcal`;
      } else if (key === "protein") {
        label = `${t("history:filters.protein", "Protein")} ${protein[0]}-${protein[1]}g`;
      } else if (key === "carbs") {
        label = `${t("history:filters.carbs", "Carbs")} ${carbs[0]}-${carbs[1]}g`;
      } else {
        label = `${t("history:filters.fat", "Fat")} ${fat[0]}-${fat[1]}g`;
      }

      return (
        <Pressable
          key={key}
          onPress={() => removeFilter(key)}
          accessibilityRole="button"
          accessibilityLabel={t("history:actions.removeFilter", {
            defaultValue: `Remove ${label} filter`,
            label,
          })}
          style={styles.summaryChip}
        >
          <Text style={styles.summaryChipLabel}>{label}</Text>
          <Text style={styles.summaryChipIcon}>×</Text>
        </Pressable>
      );
    });
  }, [active, calories, carbs, dateRange, fat, i18n?.language, protein, styles, t]);

  const hasActive = active.length > 0;
  const selectedDatePreset = active.includes("date")
    ? resolveDatePreset(dateRange)
    : null;
  const monthPresetRange = rangeForDatePreset("month");
  const showMonthPreset =
    !minSelectableDate || monthPresetRange.start.getTime() >= minSelectableDate.getTime();
  const selectedCaloriePreset = active.includes("calories")
    ? resolveCaloriePreset(calories)
    : null;

  const macroFilterOptions: Array<{ key: FilterKey; label: string }> = [
    { key: "protein", label: t("history:filters.protein", "Protein") },
    { key: "carbs", label: t("history:filters.carbs", "Carbs") },
    { key: "fat", label: t("history:filters.fat", "Fat") },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSearchShell}>
          <Text style={styles.topSearchLabel}>
            {query.trim().length > 0
              ? query
              : t("history:searchPlaceholder", "Search meals...")}
          </Text>
        </View>

        {hasActive ? <View style={styles.summaryChipRail}>{summaryChips}</View> : null}

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {t("history:sheetTitle", "Filters")}
            </Text>
            <Pressable
              onPress={clear}
              accessibilityRole="button"
              accessibilityLabel={t("history:actions.reset", "Reset")}
            >
              <Text style={styles.resetLabel}>
                {t("history:actions.reset", "Reset")}
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {t("history:filters.date", "Date range")}
            </Text>
            <View style={styles.chipRow}>
              <ChipButton
                testID="history-filter-date-today"
                label={t("history:presets.today", "Today")}
                selected={selectedDatePreset === "today"}
                onPress={() => {
                  setDateRange(clampDateRange(rangeForDatePreset("today")));
                  addFilter("date");
                }}
              />
              <ChipButton
                label={t("history:presets.last7", "Last 7 days")}
                selected={selectedDatePreset === "last7"}
                onPress={() => {
                  setDateRange(clampDateRange(rangeForDatePreset("last7")));
                  addFilter("date");
                }}
              />
              {showMonthPreset ? (
                <ChipButton
                  label={t("history:presets.month", "This month")}
                  selected={selectedDatePreset === "month"}
                  onPress={() => {
                    setDateRange(clampDateRange(rangeForDatePreset("month")));
                    addFilter("date");
                  }}
                />
              ) : null}
              <ChipButton
                label={t("history:presets.custom", "Custom")}
                selected={selectedDatePreset === "custom"}
                onPress={openCalendarModal}
              />
            </View>

            {selectedDatePreset === "custom" && active.includes("date") ? (
              <DateRangePicker
                startDate={dateRange.start}
                endDate={dateRange.end}
                onOpen={openCalendarModal}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {t("history:filters.calories", "Calories")}
            </Text>
            <View style={styles.chipRow}>
              <ChipButton
                label={t("history:presets.under300", "Under 300")}
                selected={selectedCaloriePreset === "under300"}
                onPress={() => {
                  setCalories(rangeForCaloriePreset("under300"));
                  addFilter("calories");
                }}
              />
              <ChipButton
                testID="history-filter-calories-300-600"
                label={t("history:presets.range300To600", "300-600")}
                selected={selectedCaloriePreset === "300-600"}
                onPress={() => {
                  setCalories(rangeForCaloriePreset("300-600"));
                  addFilter("calories");
                }}
              />
              <ChipButton
                label={t("history:presets.range450To900", "450-900")}
                selected={selectedCaloriePreset === "450-900"}
                onPress={() => {
                  setCalories(rangeForCaloriePreset("450-900"));
                  addFilter("calories");
                }}
              />
              <ChipButton
                label={t("history:presets.over900", "900+")}
                selected={selectedCaloriePreset === "900+"}
                onPress={() => {
                  setCalories(rangeForCaloriePreset("900+"));
                  addFilter("calories");
                }}
              />
              <ChipButton
                label={t("history:presets.custom", "Custom")}
                selected={selectedCaloriePreset === "custom"}
                onPress={() => addFilter("calories")}
              />
            </View>

            {selectedCaloriePreset === "custom" && active.includes("calories") ? (
              <RangeSlider
                label={t("history:filters.calories", "Calories")}
                min={0}
                max={2000}
                step={10}
                value={calories}
                onChange={(next) => {
                  setCalories(next);
                  addFilter("calories");
                }}
              />
            ) : null}
          </View>

          {(active.includes("protein") ||
            active.includes("carbs") ||
            active.includes("fat")) ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {t("history:advancedTitle", "Advanced filters")}
              </Text>

              {active.includes("protein") ? (
                <RangeSlider
                  label={t("history:filters.protein", "Protein")}
                  min={0}
                  max={100}
                  step={1}
                  value={protein}
                  onChange={setProtein}
                />
              ) : null}

              {active.includes("carbs") ? (
                <RangeSlider
                  label={t("history:filters.carbs", "Carbs")}
                  min={0}
                  max={100}
                  step={1}
                  value={carbs}
                  onChange={setCarbs}
                />
              ) : null}

              {active.includes("fat") ? (
                <RangeSlider
                  label={t("history:filters.fat", "Fat")}
                  min={0}
                  max={100}
                  step={1}
                  value={fat}
                  onChange={setFat}
                />
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={styles.moreFiltersRow}
            onPress={() => setOpenPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t("history:actions.moreFilters", "More filters")}
          >
            <Text style={styles.moreFiltersLabel}>
              {t("history:actions.moreFilters", "More filters")}
            </Text>
          </Pressable>

          <Button
            testID="history-filter-show-results-button"
            label={t("history:actions.showResults", "Show results")}
            onPress={apply}
            style={styles.applyButton}
          />
        </View>
      </ScrollView>

      <Modal
        visible={openPicker}
        title={t("history:actions.moreFilters", "More filters")}
        onClose={() => setOpenPicker(false)}
        primaryAction={{
          label: t("history:actions.done", "Done"),
          onPress: () => setOpenPicker(false),
        }}
      >
        <View style={styles.modalList}>
          {macroFilterOptions.map(({ key, label }) => {
            const selected = active.includes(key);

            return (
              <Pressable
                key={key}
                onPress={() => {
                  if (selected) {
                    removeFilter(key);
                    return;
                  }
                  addFilter(key);
                }}
                style={[
                  styles.modalRow,
                  selected ? styles.modalRowSelected : styles.modalRowDefault,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  selected
                    ? t("history:actions.removeFilter", {
                        defaultValue: `Remove ${label} filter`,
                        label,
                      })
                    : t("history:actions.addFilter", {
                        defaultValue: `Add ${label} filter`,
                        label,
                      })
                }
              >
                <Text style={styles.modalRowLabel}>{label}</Text>
                <Text
                  style={[
                    styles.modalRowIcon,
                    selected ? styles.modalRowIconSelected : null,
                  ]}
                >
                  {selected ? "✓" : "+"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      <Modal
        visible={openCalendar}
        title={t("history:actions.selectDateRange", "Select date range")}
        onClose={() => setOpenCalendar(false)}
        primaryAction={{
          label: t("history:actions.save", "Save"),
          onPress: applyCalendar,
        }}
        secondaryAction={{
          label: t("history:actions.cancel", "Cancel"),
          onPress: () => setOpenCalendar(false),
        }}
      >
        <View style={styles.calendarWrap}>
          <Calendar
            startDate={localRange.start}
            endDate={localRange.end}
            focus={focus}
            onChangeRange={(next) => setLocalRange(next)}
            onToggleFocus={() =>
              setFocus((value) => (value === "start" ? "end" : "start"))
            }
            minDate={minSelectableDate}
            maxDate={maxSelectableDate}
          />
          <Text style={styles.calendarHint}>
            {t("history:customDateHint", "Choose a start and end date, then save.")}
          </Text>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sectionGapLarge,
      gap: theme.spacing.md,
    },
    topSearchShell: {
      minHeight: 44,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm + 2,
      opacity: 0.88,
    },
    topSearchLabel: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    summaryChipRail: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    summaryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs,
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.xs,
      paddingVertical: theme.spacing.xs - 1,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.success.surface,
    },
    summaryChipLabel: {
      color: theme.success.text,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    summaryChipIcon: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    sheet: {
      borderRadius: 26,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.lg,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.18 : 0.06,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: theme.isDark ? 0 : 2,
      gap: theme.spacing.lg,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.borderSoft,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sheetTitle: {
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    resetLabel: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    section: {
      gap: theme.spacing.sm,
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    chipButton: {
      minHeight: 26,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    chipButtonDefault: {
      backgroundColor: theme.surface,
      borderColor: theme.borderSoft,
    },
    chipButtonSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    chipButtonPressed: {
      opacity: 0.86,
    },
    chipButtonLabel: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: theme.typography.fontFamily.medium,
    },
    chipButtonLabelDefault: {
      color: theme.textSecondary,
    },
    chipButtonLabelSelected: {
      color: theme.textInverse,
    },
    moreFiltersRow: {
      minHeight: 44,
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
    },
    moreFiltersLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    applyButton: {
      marginTop: -theme.spacing.xs,
    },
    modalList: {
      gap: theme.spacing.sm,
    },
    modalRow: {
      minHeight: 52,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
    },
    modalRowDefault: {
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
    },
    modalRowSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.success.surface,
    },
    modalRowLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
    },
    modalRowIcon: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.bold,
    },
    modalRowIconSelected: {
      color: theme.primary,
    },
    calendarWrap: {
      gap: theme.spacing.md,
    },
    calendarHint: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
