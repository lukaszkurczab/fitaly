import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Platform,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import AppIcon from "@/components/AppIcon";

type Props = {
  visible: boolean;
  busy?: boolean;
  priceText: string;
  onClose: () => void;
  onSubscribe: () => void;
  onRestore: () => void;
  termsUrl?: string;
  privacyUrl?: string;
};

const BENEFITS = [
  "aiCredits800",
  "flexibleAiUsage",
  "photoAnalysisIncluded",
  "fullCloudBackup",
  "fullHistoryAccess",
  "earlyAccess",
] as const;

export const PaywallModal: React.FC<Props> = ({
  visible,
  busy,
  priceText,
  onClose,
  onSubscribe,
  onRestore,
  termsUrl,
  privacyUrl,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("profile");

  return (
    <Modal
      testID="paywall-modal"
      visible={visible}
      fullScreen
      onClose={busy ? undefined : onClose}
      closeOnBackdropPress={!busy}
      title={t("paywall.title", { defaultValue: "Premium Monthly" })}
      contentPaddingBottom={0}
    >
      <View style={styles.hero}>
        <AppIcon name="star" size={48} color={theme.chart.fat} />
        <Text style={styles.heroTitle}>{t("paywall.hero_title")}</Text>
        <Text style={styles.heroSubtitle}>{t("paywall.hero_subtitle")}</Text>
      </View>

      <View style={styles.benefits}>
        <Text style={styles.benefitsTitle}>
          {t("manageSubscription.premiumBenefits")}
        </Text>

        {BENEFITS.map((key) => (
          <View key={key} style={styles.benefitRow}>
            <AppIcon name="check" size={18} color={theme.primary} />
            <Text style={styles.benefitText}>
              {t(`manageSubscription.benefit_${key}`)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.planSelector}>
        <View style={[styles.planCard, styles.planCardSelected]}>
          <Text style={styles.planLabel}>
            {t("manageSubscription.plan_monthly", { defaultValue: "monthly" })}
          </Text>
          <Text style={styles.planPrice}>{priceText}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label={t("paywall.subscribe", { defaultValue: "Subscribe" })}
          onPress={onSubscribe}
          loading={!!busy}
          disabled={!!busy}
          testID="paywall-subscribe-button"
        />

        <View style={styles.socialProof}>
          {[0, 1, 2, 3, 4].map((i) => (
            <AppIcon key={i} name="star" size={14} color={theme.chart.fat} />
          ))}
          <Text style={styles.socialProofText}>{t("paywall.social_proof")}</Text>
        </View>

        <TouchableOpacity
          testID="paywall-restore-button"
          onPress={onRestore}
          disabled={busy}
          activeOpacity={0.7}
          style={styles.restoreButton}
          accessibilityRole="button"
          accessibilityLabel={t("manageSubscription.restorePurchases", {
            defaultValue: "Restore Purchases",
          })}
        >
          <Text style={styles.linkText}>
            {t("manageSubscription.restorePurchases", {
              defaultValue: "Restore Purchases",
            })}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {t("paywall.disclaimer", {
            storeName:
              Platform.OS === "ios"
                ? t("manageSubscription.store.appStore", {
                    defaultValue: "App Store",
                  })
                : t("manageSubscription.store.googlePlay", {
                    defaultValue: "Google Play",
                  }),
            defaultValue:
              "Payment will be charged to your account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. You can manage and cancel subscriptions in your {{storeName}} account settings.",
          })}
        </Text>

        {!!termsUrl && !!privacyUrl && (
          <View style={styles.linksRow}>
            <TouchableOpacity
              testID="paywall-terms-button"
              onPress={() => Linking.openURL(termsUrl)}
              activeOpacity={0.7}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("termsOfService", { defaultValue: "Terms of Service" })}
            >
              <Text style={styles.linkText}>
                {t("termsOfService", { defaultValue: "Terms of Service" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="paywall-privacy-button"
              onPress={() => Linking.openURL(privacyUrl)}
              activeOpacity={0.7}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("privacyPolicy", { defaultValue: "Privacy Policy" })}
            >
              <Text style={styles.linkText}>
                {t("privacyPolicy", { defaultValue: "Privacy Policy" })}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    footer: { gap: theme.spacing.sm },
    hero: {
      alignItems: "center",
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
    },
    heroTitle: {
      fontSize: theme.typography.size.h1,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.text,
      textAlign: "center",
    },
    heroSubtitle: {
      fontSize: theme.typography.size.bodyS,
      color: theme.textSecondary,
      textAlign: "center",
    },
    restoreButton: {
      paddingVertical: theme.spacing.sm,
      alignItems: "center",
    },
    linkText: {
      color: theme.primary,
      fontSize: theme.typography.size.bodyS,
      fontFamily: theme.typography.fontFamily.bold,
    },
    disclaimer: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      textAlign: "center",
    },
    linksRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: theme.spacing.md,
    },
    benefits: { gap: theme.spacing.sm },
    benefitsTitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyL,
      fontFamily: theme.typography.fontFamily.bold,
      marginBottom: theme.spacing.xs,
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm + theme.spacing.xs,
    },
    benefitText: {
      color: theme.text,
      fontSize: theme.typography.size.bodyL,
      fontFamily: theme.typography.fontFamily.semiBold,
      flex: 1,
    },
    planSelector: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    planCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    planCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.surface,
    },
    planLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      fontFamily: theme.typography.fontFamily.bold,
      textAlign: "center",
    },
    planPrice: {
      color: theme.text,
      fontSize: theme.typography.size.bodyL,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    socialProof: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: theme.spacing.sm,
      justifyContent: "center",
    },
    socialProofText: {
      fontSize: theme.typography.size.bodyS,
      color: theme.textSecondary,
    },
  });
