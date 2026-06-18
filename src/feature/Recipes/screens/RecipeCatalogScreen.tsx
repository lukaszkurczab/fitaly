import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import {
  Button,
  FormScreenShell,
  InfoBlock,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import EmptyState from "@/components/EmptyState";
import type { RootStackParamList } from "@/navigation/navigate";
import { fetchRecipeCatalogRemote } from "@/services/recipes/recipeCatalogApi";
import type {
  RecipeCatalogFilterResponse,
  RecipeCatalogFilterResult,
  RecipeCatalogRequest,
} from "@/types/recipes";
import { useTheme } from "@/theme/useTheme";

type RecipeCatalogNavigation = StackNavigationProp<
  RootStackParamList,
  "RecipeCatalog"
>;

type RecipeCatalogScreenProps = {
  navigation: RecipeCatalogNavigation;
};

type CatalogState =
  | { status: "loading"; data: RecipeCatalogFilterResponse | null; error: null }
  | { status: "ready"; data: RecipeCatalogFilterResponse; error: null }
  | { status: "error"; data: RecipeCatalogFilterResponse | null; error: Error };

function formatMacro(value: number, unit: string): string {
  return `${Math.round(value)}${unit}`;
}

function formatReasonCount(count: number): string {
  return String(Math.max(0, count));
}

export default function RecipeCatalogScreen({
  navigation,
}: RecipeCatalogScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [showHidden, setShowHidden] = useState(false);
  const [revealUnknown, setRevealUnknown] = useState(false);
  const [state, setState] = useState<CatalogState>({
    status: "loading",
    data: null,
    error: null,
  });
  const requestIdRef = useRef(0);

  const request = useMemo<RecipeCatalogRequest>(
    () => ({
      showHidden,
      revealUnknown,
    }),
    [showHidden, revealUnknown],
  );

  const loadCatalog = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));

    try {
      const data = await fetchRecipeCatalogRemote(request);
      if (requestIdRef.current !== requestId) {
        return;
      }
      setState({ status: "ready", data, error: null });
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      const nextError = error instanceof Error ? error : new Error(String(error));
      setState((current) => ({
        status: "error",
        data: current.data,
        error: nextError,
      }));
    }
  }, [request]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const data = state.data;
  const isLoading = state.status === "loading" && !data;
  const isRefreshing = state.status === "loading" && !!data;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Profile");
  };

  return (
    <FormScreenShell
      testID="recipe-catalog-screen"
      title={t("recipeCatalog.title", { defaultValue: "Recipes" })}
      intro={t("recipeCatalog.intro", {
        defaultValue:
          "Browse curated recipes filtered from your profile. Unknown flags stay visible as warnings.",
      })}
      onBack={handleBack}
      trailingAction={{
        icon: "refresh",
        accessibilityLabel: t("recipeCatalog.refresh", {
          defaultValue: "Refresh recipes",
        }),
        onPress: () => {
          void loadCatalog();
        },
        testID: "recipe-catalog-refresh-button",
        disabled: isRefreshing,
      }}
    >
      <View style={styles.controls}>
        <Button
          label={
            showHidden
              ? t("recipeCatalog.hideExcluded", {
                  defaultValue: "Hide excluded",
                })
              : t("recipeCatalog.showExcluded", {
                  defaultValue: "Show excluded",
                })
          }
          variant={showHidden ? "secondary" : "ghost"}
          fullWidth={false}
          testID="recipe-catalog-show-hidden-toggle"
          onPress={() => setShowHidden((current) => !current)}
        />
        <Button
          label={
            revealUnknown
              ? t("recipeCatalog.hideUnknown", {
                  defaultValue: "Hide unknown",
                })
              : t("recipeCatalog.revealUnknown", {
                  defaultValue: "Reveal unknown",
                })
          }
          variant={revealUnknown ? "secondary" : "ghost"}
          fullWidth={false}
          testID="recipe-catalog-reveal-unknown-toggle"
          onPress={() => setRevealUnknown((current) => !current)}
        />
      </View>

      {state.status === "error" ? (
        <InfoBlock
          testID="recipe-catalog-error"
          tone="error"
          title={t("recipeCatalog.errorTitle", {
            defaultValue: "Recipes could not load",
          })}
          body={t("recipeCatalog.errorBody", {
            defaultValue:
              "Try refreshing. Existing meal history and Review remain unchanged.",
          })}
          icon={<AppIcon name="info" size={18} color={theme.error.text} />}
        />
      ) : null}

      {data ? <CatalogSummary data={data} /> : null}

      {isLoading ? (
        <View style={styles.loading} testID="recipe-catalog-loading">
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.loadingText}>
            {t("recipeCatalog.loading", { defaultValue: "Loading recipes" })}
          </Text>
        </View>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon="saved-items"
          title={
            data.emptyCatalog
              ? t("recipeCatalog.emptyCatalogTitle", {
                  defaultValue: "Recipe catalog is empty",
                })
              : t("recipeCatalog.noVisibleTitle", {
                  defaultValue: "No visible recipes",
                })
          }
          subtitle={
            data.emptyCatalog
              ? t("recipeCatalog.emptyCatalogBody", {
                  defaultValue:
                    "Curated recipes have not been loaded for this account yet.",
                })
              : t("recipeCatalog.noVisibleBody", {
                  defaultValue:
                    "Try revealing unknown recipes or showing excluded results.",
                })
          }
        />
      ) : (
        <View style={styles.list} testID="recipe-catalog-list">
          {data?.items.map((item) => (
            <RecipeRow key={item.recipe.recipeId} item={item} />
          ))}
        </View>
      )}
    </FormScreenShell>
  );
}

function CatalogSummary({ data }: { data: RecipeCatalogFilterResponse }) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hasIgnoredContext =
    data.queryEcho.ignoredChronicDiseases.length > 0 ||
    data.queryEcho.ignoredAllergiesOtherPresent ||
    data.queryEcho.ignoredLifestylePresent;

  return (
    <View style={styles.summary} testID="recipe-catalog-summary">
      <Text style={styles.summaryTitle}>
        {t("recipeCatalog.summaryTitle", {
          defaultValue: "Catalog status",
        })}
      </Text>
      <View style={styles.summaryGrid}>
        <SummaryPill
          label={t("recipeCatalog.visibleCount", { defaultValue: "Visible" })}
          value={formatReasonCount(data.visibleCount)}
        />
        <SummaryPill
          label={t("recipeCatalog.hiddenCount", { defaultValue: "Excluded" })}
          value={formatReasonCount(data.hiddenHardExclusionCount)}
        />
        <SummaryPill
          label={t("recipeCatalog.unknownCount", { defaultValue: "Unknown" })}
          value={formatReasonCount(data.unknownRevealRequiredCount)}
        />
      </View>
      {data.lowResults ? (
        <Text style={styles.warningText} testID="recipe-catalog-low-results">
          {t("recipeCatalog.lowResults", {
            defaultValue:
              "There are only a few visible matches. You can reveal unknown or excluded recipes.",
          })}
        </Text>
      ) : null}
      {hasIgnoredContext ? (
        <Text style={styles.mutedText} testID="recipe-catalog-ignored-context">
          {t("recipeCatalog.ignoredContext", {
            defaultValue:
              "Chronic diseases, allergy free text, and lifestyle notes are shown as context only and do not decide eligibility.",
          })}
        </Text>
      ) : null}
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function RecipeRow({ item }: { item: RecipeCatalogFilterResult }) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { recipe } = item;
  const nutrition = recipe.nutritionSnapshot;
  const isUnknown = item.status === "unknown_reveal_required";
  const isExcluded = item.status === "hidden_hard_exclusion";

  return (
    <View
      style={styles.recipeCard}
      testID={`recipe-catalog-item-${recipe.recipeId}`}
    >
      <View style={styles.recipeHeader}>
        <View style={styles.recipeTitleWrap}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          <Text style={styles.recipeMeta}>
            {t("recipeCatalog.recipeMeta", {
              defaultValue: "{{servings}} servings • {{time}} min",
              servings: recipe.servings,
              time: recipe.prepTimeMin + recipe.cookTimeMin,
            })}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            isExcluded
              ? styles.statusExcluded
              : isUnknown
                ? styles.statusUnknown
                : styles.statusVisible,
          ]}
        >
          <Text style={styles.statusText}>
            {isExcluded
              ? t("recipeCatalog.statusExcluded", { defaultValue: "Excluded" })
              : isUnknown
                ? t("recipeCatalog.statusUnknown", { defaultValue: "Unknown" })
                : t("recipeCatalog.statusVisible", { defaultValue: "Visible" })}
          </Text>
        </View>
      </View>

      {recipe.description ? (
        <Text style={styles.recipeDescription}>{recipe.description}</Text>
      ) : null}

      <View style={styles.macroRow}>
        <Text style={styles.macroText}>
          {formatMacro(nutrition.kcal, " kcal")}
        </Text>
        <Text style={styles.macroText}>
          {formatMacro(nutrition.proteinGrams, "g P")}
        </Text>
        <Text style={styles.macroText}>
          {formatMacro(nutrition.carbsGrams, "g C")}
        </Text>
        <Text style={styles.macroText}>
          {formatMacro(nutrition.fatGrams, "g F")}
        </Text>
      </View>

      {item.hardExclusionReasons.length > 0 ? (
        <Text
          style={styles.reasonText}
          testID={`recipe-catalog-hard-${recipe.recipeId}`}
        >
          {t("recipeCatalog.hardReasons", {
            defaultValue: "Excluded by explicit catalog flags.",
          })}
        </Text>
      ) : null}

      {item.unknownReasons.length > 0 ? (
        <Text
          style={styles.warningText}
          testID={`recipe-catalog-unknown-${recipe.recipeId}`}
        >
          {t("recipeCatalog.unknownReasons", {
            defaultValue:
              "Some allergen or dietary flags are unknown. This is not marked safe.",
          })}
        </Text>
      ) : null}

      {item.softPreferenceStatus !== "not_applicable" ? (
        <Text style={styles.mutedText}>
          {t("recipeCatalog.softPreference", {
            defaultValue:
              "Preference match: {{status}}",
            status: item.softPreferenceStatus,
          })}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    controls: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
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
    summary: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surfaceAlt,
    },
    summaryTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    summaryPill: {
      minWidth: 88,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.rounded.sm,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    summaryValue: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    summaryLabel: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    recipeCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    recipeHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    recipeTitleWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    recipeTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    recipeMeta: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    recipeDescription: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.rounded.sm,
      borderWidth: StyleSheet.hairlineWidth,
    },
    statusVisible: {
      backgroundColor: theme.success.surface,
      borderColor: theme.success.main,
    },
    statusUnknown: {
      backgroundColor: theme.warning.surface,
      borderColor: theme.warning.main,
    },
    statusExcluded: {
      backgroundColor: theme.error.surface,
      borderColor: theme.error.main,
    },
    statusText: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.medium,
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
    reasonText: {
      color: theme.error.text,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    warningText: {
      color: theme.warning.text,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    mutedText: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
  });
