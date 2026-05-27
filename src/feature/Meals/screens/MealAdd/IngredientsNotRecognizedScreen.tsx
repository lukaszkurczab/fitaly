import { useMemo, useState, useEffect } from "react";
import { View, StyleSheet, Text, Image } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import { Button, Layout, TextButton } from "@/components";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useAuthContext } from "@/context/AuthContext";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { GlobalActionButtons } from "@/components/GlobalActionButtons";
import AddMealFlowHeader from "@/feature/Meals/screens/MealAdd/components/AddMealFlowHeader";

const MAX_ATTEMPTS = 3;

export default function IngredientsNotRecognizedScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"IngredientsNotRecognized">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("meals");
  const { clearMeal } = useMealDraftContext();
  const { uid } = useAuthContext();

  const image = params?.image;
  const id = params?.id;
  const attempt = params?.attempt ?? 1;
  const reason = params?.reason ?? "not_recognized";
  const isAiUnavailable = reason === "ai_unavailable";
  const isOffline = reason === "offline";
  const isTimeout = reason === "timeout";

  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [image]);

  const handleRetake = () => {
    if (attempt < MAX_ATTEMPTS) {
      flow.goTo("CameraDefault", {
        id,
        attempt: attempt + 1,
      });
    } else {
      flow.replace("ReviewMeal", {});
    }
  };

  const handleManualEntry = () => {
    flow.replace("EditMealDetails", {});
  };

  const handleOpenProductDatabase = () => {
    navigation.replace("SavedMeals");
  };

  const handleOtherMethod = () => {
    if (uid) clearMeal(uid);
    navigation.navigate("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  };

  const handleCancel = () => {
    flow.goBack();
  };
  const handleCloseFlow = () => {
    if (uid) clearMeal(uid);
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home");
  };

  return (
    <Layout showNavigation={false} disableScroll>
      <View style={styles.container}>
        <AddMealFlowHeader
          progress={flow.progress}
          onBack={handleCancel}
          onClose={handleCloseFlow}
          containerStyle={styles.flowHeader}
          testID="ingredients-not-recognized-flow-header"
          backTestID="ingredients-not-recognized-back"
          closeTestID="ingredients-not-recognized-close"
        />
        <View style={styles.content}>
          {image && !imgError ? (
            <Image
              source={{ uri: image }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.image} />
          )}
          <Text style={styles.title}>
            {isOffline
              ? t("ai_offline_title", "You're offline")
              : isTimeout
                ? t("ai_timeout_title", "AI analysis timed out")
                : isAiUnavailable
                  ? t(
                      "ai_unavailable_title",
                      "AI analysis is currently unavailable",
                    )
                  : t(
                      "not_recognized_title",
                      "We couldn't recognize the ingredients",
                    )}
          </Text>
          <Text style={styles.subtitle}>
            {isOffline
              ? t(
                  "ai_offline_sub",
                  "Reconnect to the internet and try again, or add ingredients manually.",
                )
              : isTimeout
                ? t(
                    "ai_timeout_sub",
                    "The analysis took too long. Please try again in a moment.",
                  )
                : isAiUnavailable
                  ? t(
                      "ai_unavailable_sub",
                      "We couldn't connect to the AI analysis server. You can enter ingredients manually or use the product database.",
                    )
                  : attempt < MAX_ATTEMPTS
                    ? t("not_recognized_sub", "Try again or select other method")
                    : t(
                        "not_recognized_last",
                        "Please add the meal manually or try later.",
                      )}
          </Text>
          <View style={styles.spacer} />
          {isAiUnavailable ? (
            <>
              <GlobalActionButtons
                label={t("ai_unavailable_manual", "Enter ingredients manually")}
                onPress={handleManualEntry}
                secondaryLabel={t(
                  "ai_unavailable_product_db",
                  "Use product database",
                )}
                secondaryOnPress={handleOpenProductDatabase}
                containerStyle={styles.buttonSpacingNone}
              />
            </>
          ) : (
            attempt < MAX_ATTEMPTS && (
              <View style={styles.actionGroup}>
                <GlobalActionButtons
                  label={`${t("retake", "Retake photo")} (${attempt}/${MAX_ATTEMPTS})`}
                  onPress={handleRetake}
                  containerStyle={styles.buttonSpacingNone}
                />
                <TextButton
                  label={t("change_method", "Change add method")}
                  onPress={handleOtherMethod}
                  tone="link"
                />
              </View>
            )
          )}
          {!isAiUnavailable && attempt >= MAX_ATTEMPTS ? (
            <TextButton
              label={t("change_method", "Change add method")}
              onPress={handleOtherMethod}
              style={styles.buttonSpacing}
              tone="link"
            />
          ) : null}
          <Button
            variant="destructive"
            label={t("cancel", "Cancel")}
            onPress={handleCancel}
            style={styles.buttonSpacing}
          />
        </View>
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.background,
    },
    flowHeader: {
      width: "100%",
    },
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    image: {
      width: "100%",
      maxWidth: 520,
      aspectRatio: 4 / 3,
      height: undefined,
      borderRadius: theme.rounded.lg,
      marginBottom: theme.spacing.lg,
      backgroundColor: theme.border,
    },
    title: {
      fontSize: theme.typography.size.title,
      fontFamily: theme.typography.fontFamily.bold,
      textAlign: "center",
      color: theme.text,
    },
    subtitle: {
      fontSize: theme.typography.size.bodyL,
      textAlign: "center",
      marginTop: theme.spacing.sm,
      color: theme.textSecondary,
    },
    spacer: { height: theme.spacing.lg },
    actionGroup: {
      gap: theme.spacing.xs,
    },
    buttonSpacing: { marginTop: theme.spacing.sm },
    buttonSpacingNone: { marginTop: 0 },
  });
