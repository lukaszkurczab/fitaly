import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import type { CoachInsight } from "@/services/coach/coachTypes";
import {
  trackCoachInsightTapped,
  trackCoachInsightViewed,
} from "@/services/telemetry/telemetryInstrumentation";

type Props = {
  insight: CoachInsight;
  freshness?: "fresh" | "degraded" | "stale";
  onPressCta?: () => void;
  ctaTargetScreen?: Extract<
    keyof RootStackParamList,
    "MealAddMethod" | "Chat" | "HistoryList"
  >;
};

export default function CoachInsightCard({
  insight,
  freshness = "fresh",
  onPressCta,
  ctaTargetScreen,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");
  const [expanded, setExpanded] = useState(false);
  const lastTrackedInsightKeyRef = useRef<string | null>(null);

  const localizedTitle = t(`coachInsight.items.${insight.type}.title`, {
    defaultValue: insight.title,
  });
  const localizedBody = t(`coachInsight.items.${insight.type}.body`, {
    defaultValue: insight.body,
  });
  const localizedWhyBody = t(`coachInsight.items.${insight.type}.whyBody`, {
    defaultValue: insight.body,
  });
  const localizedCtaLabel =
    insight.actionType === "none"
      ? null
      : t(`coachInsight.cta.${insight.actionType}`, {
          defaultValue: insight.actionLabel ?? undefined,
        });

  const showCta =
    insight.actionType !== "none" &&
    typeof insight.actionLabel === "string" &&
    insight.actionLabel.trim().length > 0 &&
    typeof onPressCta === "function" &&
    !!ctaTargetScreen;

  useEffect(() => {
    const insightKey = `${insight.id}:${freshness}`;
    if (lastTrackedInsightKeyRef.current === insightKey) {
      return;
    }

    lastTrackedInsightKeyRef.current = insightKey;
    void trackCoachInsightViewed({
      insightType: insight.type,
      actionType: insight.actionType,
      freshness,
    });
  }, [freshness, insight.actionType, insight.id, insight.type]);

  const handleExpandToggle = () => {
    setExpanded((current) => {
      return !current;
    });
  };

  const handlePressCta = () => {
    if (!showCta || !ctaTargetScreen) {
      return;
    }

    if (insight.actionType === "none") {
      return;
    }

    void trackCoachInsightTapped({
      insightType: insight.type,
      actionType: insight.actionType,
      freshness,
    });
    onPressCta?.();
  };

  return (
    <View
      style={[
        styles.container,
        insight.isPositive ? styles.containerPositive : styles.containerNeutral,
      ]}
      testID="coach-insight-card"
    >
      <View style={styles.header}>
        <Text
          style={[
            styles.eyebrow,
            insight.isPositive ? styles.eyebrowPositive : null,
          ]}
        >
          {insight.isPositive
            ? t("coachInsight.positiveEyebrow", "Momentum")
            : t("coachInsight.defaultEyebrow", "Coach insight")}
        </Text>
        <Text style={styles.title}>{localizedTitle}</Text>
        <Text style={styles.body}>{localizedBody}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded
            ? t("coachInsight.hideWhy", "Hide why")
            : t("coachInsight.showWhy", "Why this insight")
        }
        onPress={handleExpandToggle}
        style={({ pressed }) => [
          styles.expander,
          pressed ? styles.expanderPressed : null,
        ]}
      >
        <Text style={styles.expanderText}>
          {expanded
            ? t("coachInsight.hideWhy", "Hide why")
            : t("coachInsight.showWhy", "Why this insight")}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonTitle}>
            {t("coachInsight.whyTitle", "Why am I seeing this?")}
          </Text>
          <Text style={styles.reasonText}>{localizedWhyBody}</Text>
        </View>
      ) : null}

      {showCta ? (
        <Button
          label={localizedCtaLabel ?? undefined}
          onPress={handlePressCta}
          testID="coach-insight-cta"
        />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      borderRadius: theme.rounded.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      borderWidth: 1,
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.72)"
        : "rgba(255, 253, 248, 0.68)",
    },
    containerNeutral: {
      borderColor: theme.border,
    },
    containerPositive: {
      borderColor: theme.success.surface,
    },
    header: {
      gap: theme.spacing.xs,
    },
    eyebrow: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      fontFamily: theme.typography.fontFamily.bold,
      textTransform: "uppercase",
      letterSpacing: 0,
    },
    eyebrowPositive: {
      color: theme.success.text,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      fontFamily: theme.typography.fontFamily.bold,
    },
    body: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: 22,
    },
    expander: {
      alignSelf: "flex-start",
    },
    expanderPressed: {
      opacity: 0.75,
    },
    expanderText: {
      color: theme.primary,
      fontSize: theme.typography.size.bodyS,
      fontFamily: theme.typography.fontFamily.bold,
    },
    reasonBox: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: theme.rounded.md,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.border,
    },
    reasonTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      fontFamily: theme.typography.fontFamily.bold,
    },
    reasonText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 20,
    },
  });
