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
      contentPaddingBottom={theme.spacing.sm}
      footer={
        <View style={styles.ctaFooter}>
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
        </View>
      }
    >
      <View style={styles.offerHeader}>
        <View style={styles.heroIcon}>
          <AppIcon name="sparkles" size={24} color={theme.accentWarm} />
        </View>
        <View style={styles.offerCopy}>
          <Text style={styles.heroTitle}>{t("paywall.hero_title")}</Text>
          <Text style={styles.heroSubtitle}>{t("paywall.hero_subtitle")}</Text>
        </View>
      </View>

      <View style={[styles.planCard, styles.planCardSelected]}>
        <View style={styles.planHeaderRow}>
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

        <View style={styles.planMetaRow}>
          <View style={styles.planMetaPill}>
            <AppIcon name="star" size={14} color={theme.primaryStrong} />
            <Text style={styles.planMetaText}>
              {t("paywall.planIncludedCredits", {
                defaultValue: "800 AI Credits included",
              })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.benefits}>
        <Text style={styles.benefitsTitle}>
          {t("paywall.includedTitle", {
            defaultValue: t("manageSubscription.premiumBenefits", {
              defaultValue: "Included in Premium",
            }),
          })}
        </Text>

        <View style={styles.benefitGrid}>
          {BENEFITS.map((key) => (
            <View key={key} style={styles.benefitTile}>
              <View style={styles.benefitIcon}>
                <AppIcon name="check" size={12} color={theme.primaryStrong} />
              </View>
              <Text style={styles.benefitText} numberOfLines={3}>
                {t(`manageSubscription.benefit_${key}`)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legalBlock}>
        <Text style={styles.legalTitle}>
          {t("paywall.legalTitle", {
            defaultValue: "Subscription terms",
          })}
        </Text>
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
    ctaFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderSoft,
      gap: theme.spacing.xxs,
      paddingTop: theme.spacing.md,
    },
    offerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.success.surface,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    offerCopy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    heroTitle: {
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.text,
    },
    heroSubtitle: {
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
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
      fontFamily: theme.typography.fontFamily.regular,
    },
    linksRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xxs,
    },
    benefits: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    benefitsTitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
      marginBottom: theme.spacing.xxs,
      textTransform: "uppercase",
    },
    benefitGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    benefitTile: {
      flexBasis: "47%",
      flexGrow: 1,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: theme.spacing.xxs,
      gap: theme.spacing.xs,
    },
    benefitIcon: {
      width: 20,
      height: 20,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    benefitText: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      flex: 1,
    },
    planCard: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.lg,
      padding: theme.spacing.sm,
      backgroundColor: theme.surfaceAlt,
      gap: theme.spacing.sm,
      ...theme.depth.raised,
    },
    planHeaderRow: {
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
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.bold,
    },
    planMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    planMetaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    planMetaText: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    selectedPill: {
      width: theme.spacing.xl,
      height: theme.spacing.xl,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    legalBlock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderSoft,
      gap: theme.spacing.xxs,
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    legalTitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
  });
