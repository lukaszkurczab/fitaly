import { useTranslation } from "react-i18next";
import type { MealAddEditSubmitIntent } from "@/feature/Meals/feature/MapMealAddScreens";
import { BottomActionBar } from "@/components/BottomActionBar";
import { useTheme } from "@/theme/useTheme";

type MealDetailsFooterProps = {
  reviewSubmitLabel?: string;
  submitIntent: MealAddEditSubmitIntent;
  footerBottomInset?: number;
  keyboardInset?: number;
  disabled?: boolean;
  onSecondaryAction: () => void;
  onSubmit: () => void;
};

export default function MealDetailsFooter({
  reviewSubmitLabel,
  submitIntent,
  footerBottomInset = 0,
  keyboardInset = 0,
  disabled = false,
  onSecondaryAction,
  onSubmit,
}: MealDetailsFooterProps) {
  const { t } = useTranslation(["meals", "common"]);
  const theme = useTheme();
  const isReviewEdit = submitIntent === "goBack";

  return (
    <BottomActionBar
      bottomInset={footerBottomInset}
      keyboardInset={keyboardInset}
      compact={keyboardInset > 0}
      horizontalPadding={theme.spacing.screenPaddingWide}
      horizontalBleed={theme.spacing.screenPaddingWide}
      secondaryAction={{
        testID: "meal-details-form-secondary-button",
        label: isReviewEdit
          ? t("cancel", { ns: "common", defaultValue: "Cancel" })
          : t("camera_change_method_short", {
              ns: "meals",
              defaultValue: "Change method",
            }),
        compactLabel: isReviewEdit
          ? t("cancel", { ns: "common", defaultValue: "Cancel" })
          : t("change_method_compact", {
              ns: "meals",
              defaultValue: "Change",
            }),
        onPress: onSecondaryAction,
        variant: "secondary",
      }}
      primaryAction={{
        testID: "meal-details-form-submit-button",
        label:
          reviewSubmitLabel ??
          (isReviewEdit
            ? t("review_meal_edit_done", {
                ns: "meals",
                defaultValue: "Back to review",
              })
            : t("review_meal_edit_prepare_summary", {
                ns: "meals",
                defaultValue: "Go to review",
              })),
        compactLabel:
          reviewSubmitLabel ??
          (isReviewEdit
            ? t("review_meal_edit_done_compact", {
                ns: "meals",
                defaultValue: "Done",
              })
            : t("review_meal_edit_summary_compact", {
                ns: "meals",
                defaultValue: "Summary",
              })),
        onPress: onSubmit,
        disabled,
      }}
    />
  );
}
