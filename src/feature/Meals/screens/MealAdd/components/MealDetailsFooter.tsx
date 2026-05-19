import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components";
import { useTheme } from "@/theme/useTheme";

type MealDetailsFooterProps = {
  reviewSubmitLabel?: string;
  footerBottomInset?: number;
  onSubmit: () => void;
};

export default function MealDetailsFooter({
  reviewSubmitLabel,
  footerBottomInset = 0,
  onSubmit,
}: MealDetailsFooterProps) {
  const theme = useTheme();
  const { t } = useTranslation(["meals", "common"]);
  const styles = createStyles(theme);

  return (
    <View style={[styles.footer, { paddingBottom: footerBottomInset }]}>
      <Button
        testID="meal-details-form-submit-button"
        label={
          reviewSubmitLabel ??
          t("review_meal_edit_done", {
            ns: "meals",
            defaultValue: "Back to review",
          })
        }
        onPress={onSubmit}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: theme.spacing.md,
      gap: theme.spacing.xs,
      backgroundColor: theme.background,
    },
  });
