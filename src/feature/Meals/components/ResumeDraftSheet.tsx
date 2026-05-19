import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import type { Meal } from "@/types/meal";
import { MealThumbnail } from "@/feature/Meals/components/MealThumbnail";
import { Button } from "@/components/Button";
import { formatMealRelativeTime } from "@/feature/Meals/utils/formatMealRelativeTime";

type ResumeDraftSheetProps = {
  meal: Meal | null;
  onResume: () => void;
  onDiscard: () => void;
  onClose: () => void;
};

export function ResumeDraftSheet({
  meal,
  onResume,
  onDiscard,
  onClose,
}: ResumeDraftSheetProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation(["meals"]);

  if (!meal) {
    return null;
  }

  const startedAgo = formatMealRelativeTime(
    meal.updatedAt || meal.createdAt,
    i18n.language,
  );

  return (
    <View
      pointerEvents="box-none"
      style={styles.overlay}
      testID="resume-draft-sheet"
    >
      <Pressable
        testID="resume-draft-close-button"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.scrim}
        accessibilityLabel={t("close", { ns: "common", defaultValue: "Close" })}
      />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.titleStack}>
          <Text style={styles.title}>
            {t("resume_draft_sheet_title", "Resume draft?")}
          </Text>
          <Text style={styles.message}>
            {t(
              "resume_draft_sheet_message",
              "Pick up where you left off, or discard it and start fresh.",
            )}
          </Text>
        </View>

        <View style={styles.previewCard}>
          <MealThumbnail
            meal={meal}
            size={56}
            borderRadius={18}
            placeholderLabel={t("saved_list_no_photo", "No\nphoto")}
          />

          <View style={styles.previewCopy}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {t("resume_draft_sheet_badge", "Draft")}
              </Text>
            </View>
            <Text numberOfLines={2} style={styles.previewTitle}>
              {meal.name || t("meal", { ns: "home", defaultValue: "Meal" })}
            </Text>
            <Text numberOfLines={1} style={styles.previewMeta}>
              {startedAgo
                ? t("resume_draft_sheet_started", {
                    time: startedAgo,
                    defaultValue: "Started {{time}}",
                  })
                : t("resume_draft_sheet_recent", "Started recently")}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            testID="resume-draft-resume-button"
            label={t("resume_draft_sheet_resume", "Resume")}
            onPress={onResume}
          />
          <Button
            testID="resume-draft-discard-button"
            label={t("resume_draft_sheet_discard", "Discard")}
            variant="secondary"
            onPress={onDiscard}
            style={styles.discardButton}
            textStyle={styles.discardButtonText}
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(47, 49, 43, 0.12)",
    },
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      borderColor: "rgba(207, 197, 184, 0.35)",
      backgroundColor: theme.surface,
      paddingTop: 12,
      paddingHorizontal: 24,
      paddingBottom: 22,
      gap: 16,
    },
    handle: {
      width: 49,
      height: 4,
      borderRadius: theme.rounded.full,
      alignSelf: "center",
      backgroundColor: "#C4BDAD",
    },
    titleStack: {
      gap: 8,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 24,
      lineHeight: 28,
    },
    message: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    previewCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 96,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(79, 104, 75, 0.18)",
      backgroundColor: "#FEFBF4",
    },
    previewCopy: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    pill: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.rounded.full,
      backgroundColor: "rgba(237, 242, 235, 0.75)",
    },
    pillText: {
      color: "rgba(111, 138, 105, 0.9)",
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: 10,
      lineHeight: 12,
    },
    previewTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 17,
      lineHeight: 22,
    },
    previewMeta: {
      color: theme.primarySoft,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 12,
      lineHeight: 16,
    },
    actions: {
      gap: 12,
    },
    discardButton: {
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderColor: "rgba(207, 197, 184, 0.45)",
    },
    discardButtonText: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: 15,
      lineHeight: 20,
    },
  });
