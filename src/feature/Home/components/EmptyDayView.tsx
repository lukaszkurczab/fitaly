import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button } from "@/components/Button";
import { useTranslation } from "react-i18next";
import type { CoachEmptyReason } from "@/services/coach/coachTypes";

type CommonProps = {
  isToday: boolean;
  isOffline?: boolean;
  onAddMeal?: () => void;
  onOpenHistory?: () => void;
};

type PlainEmptyDayProps = {
  mode?: "plain";
  coachEmptyReason?: null;
};

type CoachAwareEmptyDayProps = {
  mode: "coach_aware";
  coachEmptyReason: CoachEmptyReason;
};

type Props = CommonProps & (PlainEmptyDayProps | CoachAwareEmptyDayProps);

export default function EmptyDayView({
  mode = "plain",
  isToday,
  isOffline = false,
  onAddMeal,
  onOpenHistory,
  coachEmptyReason = null,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");
  const isCoachAware = mode === "coach_aware";

  const coachAwareCopy = useMemo(() => {
    if (!isCoachAware || !coachEmptyReason) {
      return null;
    }

    return {
      title: t(`emptyDay.coachAware.${coachEmptyReason}.title`),
      body: t(`emptyDay.coachAware.${coachEmptyReason}.body`),
      whyTitle: t("emptyDay.coachAware.whyTitle", "Why am I seeing this?"),
      whyBody: t(`emptyDay.coachAware.${coachEmptyReason}.whyBody`),
    };
  }, [coachEmptyReason, isCoachAware, t]);

  const titleText = coachAwareCopy?.title ?? t("emptyDay.title");
  const subtitleText =
    coachAwareCopy?.body ??
    (isOffline
      ? isToday
        ? t("emptyDay.subtitle_offline_today")
        : t("emptyDay.subtitle_offline_past")
      : isToday
        ? t("emptyDay.subtitle_today")
        : null);

  return (
    <View style={styles.container} testID="home-empty-state">
      <Text style={styles.title}>{titleText}</Text>

      {subtitleText ? (
        <Text style={styles.subtitle}>{subtitleText}</Text>
      ) : null}

      {coachAwareCopy ? (
        <View style={styles.coachBox}>
          <Text style={styles.coachEyebrow}>{coachAwareCopy.whyTitle}</Text>
          <Text style={styles.coachText}>{coachAwareCopy.whyBody}</Text>
        </View>
      ) : null}

      {isToday && onAddMeal ? (
        <Button
          testID="home-empty-add-meal-button"
          label={t("emptyDay.addMeal")}
          onPress={onAddMeal}
        />
      ) : null}

      {!isToday && onOpenHistory ? (
        <Button
          testID="home-empty-open-history-button"
          variant="secondary"
          label={t("emptyDay.openHistory")}
          onPress={onOpenHistory}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surfaceElevated,
      padding: theme.spacing.lg,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      gap: theme.spacing.md,
      shadowColor: theme.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      fontFamily: theme.typography.fontFamily.bold,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      textAlign: "center",
    },
    coachBox: {
      alignSelf: "stretch",
      backgroundColor: theme.background,
      borderRadius: theme.rounded.md,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.border,
    },
    coachEyebrow: {
      color: theme.primary,
      fontSize: theme.typography.size.bodyS,
      fontFamily: theme.typography.fontFamily.bold,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    coachText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 20,
      textAlign: "left",
    },
  });
