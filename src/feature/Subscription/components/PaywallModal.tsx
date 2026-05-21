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
      contentPaddingBottom={theme.spacing.lg}
    >
      <View style={styles.hero}>
        <AppIcon name="star" size={38} color={theme.chart.fat} />
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
          <View style={styles.planTextGroup}>
            <Text style={styles.planLabel}>
              {t("manageSubscription.plan_monthly", { defaultValue: "monthly" })}
            </Text>
            <Text style={styles.planPrice}>{priceText}</Text>
          </View>
          <View style={styles.selectedPill}>
            <AppIcon name="check" size={14} color={theme.primary} />
          </View>
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
    footer: { gap: theme.spacing.xxs },
    hero: {
      alignItems: "center",
      gap: theme.spacing.xxs,
      marginBottom: theme.spacing.md,
    },
    heroTitle: {
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
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
      paddingVertical: theme.spacing.xxs,
      alignItems: "center",
    },
    linkText: {
      color: theme.primary,
      fontSize: theme.typography.size.bodyS,
      fontFamily: theme.typography.fontFamily.bold,
    },
    disclaimer: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      textAlign: "center",
      marginTop: theme.spacing.xxs,
    },
    linksRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: theme.spacing.md,
    },
    benefits: { gap: theme.spacing.xxs },
    benefitsTitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
      marginBottom: theme.spacing.xxs,
      textTransform: "uppercase",
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
      paddingVertical: 2,
    },
    benefitText: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      flex: 1,
    },
    planSelector: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    planCard: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.lg,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.surfaceAlt,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    planCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.success.surface,
    },
    planTextGroup: {
      gap: theme.spacing.xxs,
      flex: 1,
    },
    planLabel: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
      textTransform: "uppercase",
    },
    planPrice: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      fontFamily: theme.typography.fontFamily.bold,
    },
    selectedPill: {
      width: theme.spacing.xl,
      height: theme.spacing.xl,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
  });
