import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import {
  Button,
  FormScreenShell,
  InfoBlock,
  TextInput,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import EmptyState from "@/components/EmptyState";
import { useAuthContext } from "@/context/AuthContext";
import { useMealDraftContext } from "@/context/MealDraftContext";
import type { RootStackParamList } from "@/navigation/navigate";
import {
  createPlannedMealRemote,
  deletePlannedMealRemote,
  fetchPlannedMealsRemote,
  updatePlannedMealRemote,
} from "@/services/plannedMeals/plannedMealsApi";
import { useTheme } from "@/theme/useTheme";
import type {
  PlannedMealItem,
  PlannedMealNutritionField,
  PlannedMealStatus,
  PlannedMealTimeBucket,
} from "@/types/plannedMeals";
import {
  buildCreatePlannedMealRequest,
  buildDeletePlannedMealRequest,
  buildEditPlannedMealRequest,
  buildRescheduleNextDayRequest,
  buildReviewDraftFromPlannedMeal,
  clampPlanningDays,
  formatPlanningDateKey,
  isPlanningDateKey,
} from "@/feature/Planning/services/planningDraft";

type PlanningNavigation = StackNavigationProp<RootStackParamList, "Planning">;

type PlanningScreenProps = {
  navigation: PlanningNavigation;
};

type PlanningState =
  | { status: "loading"; items: PlannedMealItem[] | null; error: null }
  | { status: "ready"; items: PlannedMealItem[]; error: null }
  | { status: "error"; items: PlannedMealItem[] | null; error: Error };

type BusyAction = "create" | "edit" | "reschedule" | "delete" | "review";
type BusyState = { itemId: string | null; action: BusyAction } | null;
type TranslationFn = (
  key: string,
  options?: Record<string, unknown>,
) => string;

const TIME_BUCKETS: PlannedMealTimeBucket[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "any",
];

const TIME_BUCKET_ORDER: Record<PlannedMealTimeBucket, number> = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
  any: 5,
};

function sortPlannedItems(items: PlannedMealItem[]): PlannedMealItem[] {
  return [...items].sort((left, right) => {
    if (left.dateBucket !== right.dateBucket) {
      return left.dateBucket.localeCompare(right.dateBucket);
    }

    const leftOrder = TIME_BUCKET_ORDER[left.timeBucket ?? "any"];
    const rightOrder = TIME_BUCKET_ORDER[right.timeBucket ?? "any"];
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    return left.updatedAt.localeCompare(right.updatedAt);
  });
}

function visibleItems(items: PlannedMealItem[] | null): PlannedMealItem[] {
  return sortPlannedItems((items ?? []).filter((item) => item.status !== "deleted"));
}

function formatMacro(value: number, unit: string): string {
  return `${Math.round(value)}${unit}`;
}

function isReviewablePlanningStatus(status: PlannedMealStatus): boolean {
  return status === "planned" || status === "edited" || status === "rescheduled";
}

function nutritionFieldLabel(
  t: TranslationFn,
  field: PlannedMealNutritionField,
): string {
  return t(`planning.nutritionField.${field}`, { defaultValue: field });
}

function missingFieldLabels(
  t: TranslationFn,
  fields: PlannedMealNutritionField[],
): string {
  if (fields.length === 0) {
    return t("planning.nutritionField.nutrition", {
      defaultValue: "nutrition",
    });
  }

  return fields.map((field) => nutritionFieldLabel(t, field)).join(", ");
}

function reviewDraftNotesForItem(
  t: TranslationFn,
  item: PlannedMealItem,
): string[] {
  const estimate = item.nutritionEstimate;
  const estimateNote =
    estimate.state === "unknown"
      ? t("planning.reviewDraftUnknownEstimateNote", {
          defaultValue:
            "Nutrition estimate is unknown. Review nutrition before saving.",
        })
      : estimate.state === "partial"
        ? t("planning.reviewDraftPartialEstimateNote", {
            defaultValue:
              "Nutrition estimate is partial. Missing: {{fields}}. Review before saving.",
            fields: missingFieldLabels(t, estimate.missingFields),
          })
        : t("planning.reviewDraftKnownEstimateNote", {
            defaultValue:
              "Planned item uses a stored estimate. Review before saving.",
          });

  return [
    estimateNote,
    t("planning.reviewDraftHandoffNote", {
      defaultValue:
        "Converted from a planned item. Nothing is logged until Review is saved.",
    }),
  ];
}

function testIdSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "planned-meal";
}

function planningStatusLabel(t: TranslationFn, status: PlannedMealStatus): string {
  return t(`planning.status.${status}`, { defaultValue: status });
}

function blockedStatusBody(t: TranslationFn, status: PlannedMealStatus): string {
  if (status === "expired") {
    return t("planning.statusBlocked.expired", {
      defaultValue:
        "This planned item is expired. Create a fresh plan before Review.",
    });
  }

  if (status === "source_unavailable") {
    return t("planning.statusBlocked.source_unavailable", {
      defaultValue:
        "The source for this planned item is unavailable. Recreate it before Review.",
    });
  }

  if (status === "converted_to_review") {
    return t("planning.statusBlocked.converted_to_review", {
      defaultValue:
        "This planned item was already converted to Review. Create a new plan to review it again.",
    });
  }

  return t("planning.statusBlocked.default", {
    defaultValue:
      "This planned item is not ready for Review. Refresh or create a new plan.",
  });
}

export default function PlanningScreen({ navigation }: PlanningScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { uid } = useAuthContext();
  const { setMeal, saveDraft, removeDraft, setLastScreen } =
    useMealDraftContext();
  const [days, setDays] = useState<1 | 2 | 3>(3);
  const [startDate, setStartDate] = useState(() => formatPlanningDateKey());
  const [createName, setCreateName] = useState("");
  const [createDate, setCreateDate] = useState(() => formatPlanningDateKey());
  const [createTimeBucket, setCreateTimeBucket] =
    useState<PlannedMealTimeBucket>("any");
  const [state, setState] = useState<PlanningState>({
    status: "loading",
    items: null,
    error: null,
  });
  const [busy, setBusy] = useState<BusyState>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [reviewErrorId, setReviewErrorId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadPlanning = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setState((current) => ({
      status: "loading",
      items: current.items,
      error: null,
    }));

    try {
      const data = await fetchPlannedMealsRemote({
        startDate,
        days,
        includeDeleted: false,
      });
      if (requestIdRef.current !== requestId) return;
      setState({
        status: "ready",
        items: sortPlannedItems(data.items),
        error: null,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setState((current) => ({
        status: "error",
        items: current.items,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [days, startDate]);

  useEffect(() => {
    void loadPlanning();
  }, [loadPlanning]);

  const updateLocalItem = useCallback((item: PlannedMealItem) => {
    setState((current) => {
      if (!current.items) {
        return {
          status: "ready",
          items: item.status === "deleted" ? [] : [item],
          error: null,
        };
      }

      const withoutItem = current.items.filter(
        (candidate) => candidate.plannedMealId !== item.plannedMealId,
      );
      const nextItems =
        item.status === "deleted" ? withoutItem : [...withoutItem, item];

      if (current.status === "error") {
        return {
          status: "error",
          items: sortPlannedItems(nextItems),
          error: current.error,
        };
      }

      return {
        status: "ready",
        items: sortPlannedItems(nextItems),
        error: null,
      };
    });
  }, []);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Home");
  }, [navigation]);

  const handleSetDays = useCallback((value: number) => {
    setDays(clampPlanningDays(value));
  }, []);

  const handleCreate = useCallback(async () => {
    const name = createName.trim();
    if (!name || !isPlanningDateKey(createDate)) {
      setMutationError("createValidation");
      return;
    }

    setMutationError(null);
    setReviewErrorId(null);
    setBusy({ itemId: null, action: "create" });
    try {
      const response = await createPlannedMealRemote(
        buildCreatePlannedMealRequest({
          name,
          dateBucket: createDate,
          timeBucket: createTimeBucket,
        }),
      );
      updateLocalItem(response.item);
      setCreateName("");
    } catch {
      setMutationError("create");
    } finally {
      setBusy(null);
    }
  }, [createDate, createName, createTimeBucket, updateLocalItem]);

  const handleEdit = useCallback(
    async (
      item: PlannedMealItem,
      values: {
        name: string;
        dateBucket: string;
        timeBucket: PlannedMealTimeBucket;
      },
    ) => {
      if (!values.name.trim() || !isPlanningDateKey(values.dateBucket)) {
        setMutationError("editValidation");
        return;
      }

      setMutationError(null);
      setReviewErrorId(null);
      setBusy({ itemId: item.plannedMealId, action: "edit" });
      try {
        const response = await updatePlannedMealRemote(
          item.plannedMealId,
          buildEditPlannedMealRequest({
            item,
            name: values.name,
            dateBucket: values.dateBucket,
            timeBucket: values.timeBucket,
          }),
        );
        updateLocalItem(response.item);
      } catch {
        setMutationError("edit");
      } finally {
        setBusy(null);
      }
    },
    [updateLocalItem],
  );

  const handleRescheduleNextDay = useCallback(
    async (item: PlannedMealItem) => {
      setMutationError(null);
      setReviewErrorId(null);
      setBusy({ itemId: item.plannedMealId, action: "reschedule" });
      try {
        const response = await updatePlannedMealRemote(
          item.plannedMealId,
          buildRescheduleNextDayRequest(item),
        );
        updateLocalItem(response.item);
      } catch {
        setMutationError("reschedule");
      } finally {
        setBusy(null);
      }
    },
    [updateLocalItem],
  );

  const handleDelete = useCallback(
    async (item: PlannedMealItem) => {
      setMutationError(null);
      setReviewErrorId(null);
      setBusy({ itemId: item.plannedMealId, action: "delete" });
      try {
        const response = await deletePlannedMealRemote(
          item.plannedMealId,
          buildDeletePlannedMealRequest(item),
        );
        updateLocalItem(response.item);
      } catch {
        setMutationError("delete");
      } finally {
        setBusy(null);
      }
    },
    [updateLocalItem],
  );

  const handleStartReview = useCallback(
    async (item: PlannedMealItem) => {
      if (!uid) {
        setReviewErrorId(item.plannedMealId);
        return;
      }
      if (!isReviewablePlanningStatus(item.status)) {
        setReviewErrorId(item.plannedMealId);
        return;
      }

      const draft = buildReviewDraftFromPlannedMeal({
        item,
        uid,
        fallbackName: t("planning.unnamed", {
          defaultValue: "Planned meal",
        }),
        reviewNotes: reviewDraftNotesForItem(t, item),
      });
      let draftPersisted = false;
      setMutationError(null);
      setReviewErrorId(null);
      setBusy({ itemId: item.plannedMealId, action: "review" });
      try {
        await saveDraft(uid, draft);
        draftPersisted = true;
        await setLastScreen(uid, "ReviewMeal");
        setMeal(draft);
        navigation.navigate("AddMeal", { start: "ReviewMeal" });
      } catch {
        if (draftPersisted) {
          await removeDraft(uid).catch(() => undefined);
        }
        setReviewErrorId(item.plannedMealId);
      } finally {
        setBusy(null);
      }
    },
    [navigation, removeDraft, saveDraft, setLastScreen, setMeal, t, uid],
  );

  const items = visibleItems(state.items);
  const isLoading = state.status === "loading" && !state.items;
  const isRefreshing = state.status === "loading" && !!state.items;
  const createBusy = busy?.action === "create";

  return (
    <FormScreenShell
      testID="planning-screen"
      title={t("planning.title", { defaultValue: "Planning" })}
      intro={t("planning.intro", {
        defaultValue:
          "Plan the next one to three days. Planned items stay separate from logged meals.",
      })}
      onBack={handleBack}
      trailingAction={{
        icon: "refresh",
        accessibilityLabel: t("planning.refresh", {
          defaultValue: "Refresh planning",
        }),
        onPress: () => {
          void loadPlanning();
        },
        testID: "planning-refresh-button",
        disabled: isRefreshing,
      }}
    >
      <InfoBlock
        testID="planning-boundary"
        tone="info"
        title={t("planning.boundaryTitle", {
          defaultValue: "Plan first, log later",
        })}
        body={t("planning.boundaryBody", {
          defaultValue:
            "Review creates a local draft only. Nothing is logged until you save it in Review.",
        })}
        icon={<AppIcon name="info" size={18} color={theme.info.text} />}
      />

      <View style={styles.section} testID="planning-create-form">
        <Text style={styles.sectionTitle}>
          {t("planning.createTitle", { defaultValue: "Add planned item" })}
        </Text>
        <TextInput
          label={t("planning.nameLabel", { defaultValue: "Meal name" })}
          placeholder={t("planning.namePlaceholder", {
            defaultValue: "Planned meal",
          })}
          value={createName}
          onChangeText={setCreateName}
          testID="planning-create-name"
          autoCapitalize="sentences"
        />
        <TextInput
          label={t("planning.dateLabel", { defaultValue: "Date" })}
          helperText={t("planning.dateHelper", {
            defaultValue: "Use YYYY-MM-DD.",
          })}
          value={createDate}
          onChangeText={setCreateDate}
          testID="planning-create-date"
        />
        <TimeBucketPicker
          value={createTimeBucket}
          onChange={setCreateTimeBucket}
          testIDPrefix="planning-create-time"
        />
        <Button
          label={t("planning.createCta", { defaultValue: "Create plan" })}
          onPress={handleCreate}
          loading={createBusy}
          disabled={createBusy}
          testID="planning-create-button"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("planning.windowTitle", { defaultValue: "Planning window" })}
        </Text>
        <View style={styles.inlineControls}>
          {[1, 2, 3].map((value) => (
            <Button
              key={value}
              label={t(`planning.days${value}`, {
                defaultValue: value === 1 ? "1 day" : `${value} days`,
              })}
              variant={days === value ? "secondary" : "ghost"}
              fullWidth={false}
              onPress={() => handleSetDays(value)}
              testID={`planning-days-${value}`}
            />
          ))}
        </View>
        <TextInput
          label={t("planning.startDateLabel", {
            defaultValue: "Window start",
          })}
          helperText={t("planning.dateHelper", {
            defaultValue: "Use YYYY-MM-DD.",
          })}
          value={startDate}
          onChangeText={setStartDate}
          testID="planning-start-date"
        />
      </View>

      {state.status === "error" ? (
        <InfoBlock
          testID="planning-load-error"
          tone="error"
          title={t("planning.errorTitle", {
            defaultValue: "Planning could not load",
          })}
          body={t("planning.errorBody", {
            defaultValue:
              "Try refreshing. Planned items and meal history stay unchanged.",
          })}
          icon={<AppIcon name="info" size={18} color={theme.error.text} />}
        />
      ) : null}

      {mutationError ? (
        <InfoBlock
          testID="planning-mutation-error"
          tone="error"
          title={t("planning.mutationErrorTitle", {
            defaultValue: "Planning change was not saved",
          })}
          body={mutationErrorBody(t, mutationError)}
          icon={<AppIcon name="info" size={18} color={theme.error.text} />}
        />
      ) : null}

      {reviewErrorId ? (
        <InfoBlock
          testID="planning-review-error"
          tone="error"
          title={t("planning.reviewErrorTitle", {
            defaultValue: "Review could not start",
          })}
          body={
            uid
              ? t("planning.reviewErrorBody", {
                  defaultValue:
                    "Try again. The planned item was not logged.",
                })
              : t("planning.reviewAuthErrorBody", {
                  defaultValue:
                    "Sign in again before reviewing this plan. Nothing was logged.",
                })
          }
          icon={<AppIcon name="info" size={18} color={theme.error.text} />}
        />
      ) : null}

      {isLoading ? (
        <View style={styles.loading} testID="planning-loading">
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.loadingText}>
            {t("planning.loading", { defaultValue: "Loading planning" })}
          </Text>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="saved-items"
          title={t("planning.emptyTitle", {
            defaultValue: "No planned meals yet",
          })}
          subtitle={t("planning.emptyBody", {
            defaultValue:
              "Create a manual planned item to prepare Review without logging a meal.",
          })}
        />
      ) : (
        <View style={styles.list} testID="planning-list">
          {items.map((item) => (
            <PlanningItemRow
              key={item.plannedMealId}
              item={item}
              busy={busy}
              canReview={!!uid}
              onEdit={handleEdit}
              onRescheduleNextDay={handleRescheduleNextDay}
              onDelete={handleDelete}
              onStartReview={handleStartReview}
            />
          ))}
        </View>
      )}
    </FormScreenShell>
  );
}

function mutationErrorBody(
  t: TranslationFn,
  error: string,
): string {
  if (error === "createValidation" || error === "editValidation") {
    return t("planning.validationErrorBody", {
      defaultValue: "Use a name and a valid YYYY-MM-DD date.",
    });
  }

  if (error === "reschedule") {
    return t("planning.rescheduleErrorBody", {
      defaultValue:
        "The item may have changed elsewhere. Refresh and try again.",
    });
  }

  if (error === "delete") {
    return t("planning.deleteErrorBody", {
      defaultValue:
        "The item was not deleted. Refresh if the version changed.",
    });
  }

  return t("planning.saveErrorBody", {
    defaultValue:
      "The plan was not changed. Meal history and Review stay unchanged.",
  });
}

function TimeBucketPicker({
  value,
  onChange,
  testIDPrefix,
}: {
  value: PlannedMealTimeBucket;
  onChange: (value: PlannedMealTimeBucket) => void;
  testIDPrefix: string;
}) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.timePicker}>
      <Text style={styles.fieldLabel}>
        {t("planning.timeLabel", { defaultValue: "Time" })}
      </Text>
      <View style={styles.inlineControls}>
        {TIME_BUCKETS.map((bucket) => (
          <Button
            key={bucket}
            label={t(`planning.timeBucket.${bucket}`, {
              defaultValue: bucket,
            })}
            variant={bucket === value ? "secondary" : "ghost"}
            fullWidth={false}
            onPress={() => onChange(bucket)}
            testID={`${testIDPrefix}-${bucket}`}
          />
        ))}
      </View>
    </View>
  );
}

function PlanningItemRow({
  item,
  busy,
  canReview,
  onEdit,
  onRescheduleNextDay,
  onDelete,
  onStartReview,
}: {
  item: PlannedMealItem;
  busy: BusyState;
  canReview: boolean;
  onEdit: (
    item: PlannedMealItem,
    values: {
      name: string;
      dateBucket: string;
      timeBucket: PlannedMealTimeBucket;
    },
  ) => void;
  onRescheduleNextDay: (item: PlannedMealItem) => void;
  onDelete: (item: PlannedMealItem) => void;
  onStartReview: (item: PlannedMealItem) => void;
}) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [name, setName] = useState(item.draftSnapshot.name ?? "");
  const [dateBucket, setDateBucket] = useState(item.dateBucket);
  const [timeBucket, setTimeBucket] = useState<PlannedMealTimeBucket>(
    item.timeBucket ?? "any",
  );
  const itemBusy = busy?.itemId === item.plannedMealId ? busy.action : null;
  const title = item.draftSnapshot.name?.trim() || t("planning.unnamed", {
    defaultValue: "Planned meal",
  });
  const estimate = item.nutritionEstimate;
  const totals = estimate.totals;
  const titleSlug = testIdSlug(title);
  const isReviewable = isReviewablePlanningStatus(item.status);

  useEffect(() => {
    setName(item.draftSnapshot.name ?? "");
    setDateBucket(item.dateBucket);
    setTimeBucket(item.timeBucket ?? "any");
  }, [item.dateBucket, item.draftSnapshot.name, item.timeBucket, item.version]);

  return (
    <View style={styles.itemCard} testID={`planning-item-${item.plannedMealId}`}>
      <View style={styles.itemHeader}>
        <View style={styles.itemTitleWrap}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemMeta}>
            {t("planning.itemMeta", {
              defaultValue: "{{date}} • {{time}} • v{{version}}",
              date: item.dateBucket,
              time: t(`planning.timeBucket.${item.timeBucket ?? "any"}`, {
                defaultValue: item.timeBucket ?? "any",
              }),
              version: item.version,
            })}
          </Text>
        </View>
        <EstimateBadge item={item} />
      </View>

      {!isReviewable ? (
        <View
          style={styles.statusBlock}
          testID={`planning-status-${item.status}-${item.plannedMealId}`}
        >
          <Text style={styles.statusTitle}>
            {planningStatusLabel(t, item.status)}
          </Text>
          <Text style={styles.statusBody}>{blockedStatusBody(t, item.status)}</Text>
        </View>
      ) : null}

      {totals ? (
        <View style={styles.macroRow}>
          <Text style={styles.macroText}>
            {formatMacro(totals.kcal, " kcal")}
          </Text>
          <Text style={styles.macroText}>{formatMacro(totals.protein, "g P")}</Text>
          <Text style={styles.macroText}>{formatMacro(totals.carbs, "g C")}</Text>
          <Text style={styles.macroText}>{formatMacro(totals.fat, "g F")}</Text>
        </View>
      ) : (
        <Text
          style={styles.warningText}
          testID={`planning-estimate-missing-${item.plannedMealId}`}
        >
          {t("planning.noTotals", {
            defaultValue: "No nutrition totals are available yet.",
          })}
        </Text>
      )}

      {estimate.state !== "known" ? (
        <Text
          style={styles.warningText}
          testID={`planning-estimate-warning-${item.plannedMealId}`}
        >
          {estimate.state === "unknown"
            ? t("planning.unknownEstimateBody", {
                defaultValue:
                  "Nutrition estimate is unknown and needs confirmation in Review.",
              })
            : t("planning.partialEstimateBody", {
                defaultValue:
                  "Nutrition estimate is partial. Missing: {{fields}}.",
                fields: missingFieldLabels(t, estimate.missingFields),
              })}
        </Text>
      ) : null}

      <View style={styles.editGrid}>
        <TextInput
          label={t("planning.nameLabel", { defaultValue: "Meal name" })}
          value={name}
          onChangeText={setName}
          testID={`planning-edit-name-${item.plannedMealId}`}
          autoCapitalize="sentences"
        />
        <TextInput
          label={t("planning.dateLabel", { defaultValue: "Date" })}
          value={dateBucket}
          onChangeText={setDateBucket}
          testID={`planning-edit-date-${item.plannedMealId}`}
        />
        <TimeBucketPicker
          value={timeBucket}
          onChange={setTimeBucket}
          testIDPrefix={`planning-edit-time-${item.plannedMealId}`}
        />
      </View>

      <View style={styles.actionGrid}>
        <Button
          label={t("planning.saveEditCta", { defaultValue: "Save changes" })}
          variant="secondary"
          onPress={() => onEdit(item, { name, dateBucket, timeBucket })}
          loading={itemBusy === "edit"}
          disabled={!!itemBusy || !isReviewable}
          testID={`planning-save-${item.plannedMealId}`}
        />
        <Button
          label={t("planning.rescheduleCta", {
            defaultValue: "Move to tomorrow",
          })}
          variant="ghost"
          onPress={() => onRescheduleNextDay(item)}
          loading={itemBusy === "reschedule"}
          disabled={!!itemBusy || !isReviewable}
          testID={`planning-reschedule-${item.plannedMealId}`}
        />
        <Button
          label={t("planning.reviewCta", { defaultValue: "Start Review" })}
          variant="primary"
          onPress={() => onStartReview(item)}
          loading={itemBusy === "review"}
          disabled={!canReview || !!itemBusy || !isReviewable}
          testID={`planning-review-name-${titleSlug}`}
        />
        <Button
          label={t("planning.deleteCta", { defaultValue: "Delete" })}
          variant="destructive"
          onPress={() => onDelete(item)}
          loading={itemBusy === "delete"}
          disabled={!!itemBusy}
          testID={`planning-delete-${item.plannedMealId}`}
        />
      </View>
    </View>
  );
}

function EstimateBadge({ item }: { item: PlannedMealItem }) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const state = item.nutritionEstimate.state;

  return (
    <View
      style={[
        styles.estimateBadge,
        state === "known"
          ? styles.estimateKnown
          : state === "partial"
            ? styles.estimatePartial
            : styles.estimateUnknown,
      ]}
      testID={`planning-estimate-${state}-${item.plannedMealId}`}
    >
      <Text style={styles.estimateText}>
        {state === "known"
          ? t("planning.estimateKnown", { defaultValue: "Known estimate" })
          : state === "partial"
            ? t("planning.estimatePartial", {
                defaultValue: "Partial estimate",
              })
            : t("planning.estimateUnknown", {
                defaultValue: "Unknown estimate",
              })}
      </Text>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    sectionTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    fieldLabel: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    inlineControls: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    timePicker: {
      gap: theme.spacing.xs,
    },
    loading: {
      minHeight: 180,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    loadingText: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    list: {
      gap: theme.spacing.md,
    },
    itemCard: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    itemTitleWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    itemTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    itemMeta: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    estimateBadge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.rounded.sm,
      borderWidth: StyleSheet.hairlineWidth,
    },
    estimateKnown: {
      backgroundColor: theme.success.surface,
      borderColor: theme.success.main,
    },
    estimatePartial: {
      backgroundColor: theme.warning.surface,
      borderColor: theme.warning.main,
    },
    estimateUnknown: {
      backgroundColor: theme.error.surface,
      borderColor: theme.error.main,
    },
    estimateText: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    statusBlock: {
      gap: theme.spacing.xxs,
      padding: theme.spacing.sm,
      borderRadius: theme.rounded.sm,
      backgroundColor: theme.warning.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.warning.main,
    },
    statusTitle: {
      color: theme.warning.text,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    statusBody: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    macroRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    macroText: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.rounded.sm,
      backgroundColor: theme.surfaceAlt,
    },
    warningText: {
      color: theme.warning.text,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    editGrid: {
      gap: theme.spacing.sm,
    },
    actionGrid: {
      gap: theme.spacing.sm,
    },
  });
