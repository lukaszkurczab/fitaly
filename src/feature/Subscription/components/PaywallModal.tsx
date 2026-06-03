import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import AppIcon from "@/components/AppIcon";

const DARK_PRIMARY_CTA_LABEL = "#10150E";

type Props = {
  visible: boolean;
  busy?: boolean;
  busyAction?: "restore" | "purchase" | "manage" | null;
  priceText: string;
  onClose: () => void;
  onSubscribe: () => void;
  onRestore: () => void;
  onReturnToOffer?: () => void;
  restoreFeedback?: {
    tone: "success" | "info" | "neutral" | "warning" | "error";
    title: string;
    message: string;
    restoreState?: "no-purchase" | "confirmation-pending";
  } | null;
  termsUrl?: string;
  privacyUrl?: string;
};

const PAYWALL_BENEFITS = [
  {
    key: "aiCredits800",
    titleKey: "paywall.benefitTitle_aiCredits800",
    priority: true,
    support: true,
  },
  {
    key: "photoAnalysisIncluded",
    titleKey: "manageSubscription.benefit_photoAnalysisIncluded",
    priority: true,
    support: false,
  },
  {
    key: "fullHistoryAccess",
    titleKey: "manageSubscription.benefit_fullHistoryAccess",
    priority: true,
    support: false,
  },
  {
    key: "fullCloudBackup",
    titleKey: "manageSubscription.benefit_fullCloudBackup",
    priority: false,
    support: false,
  },
  {
    key: "earlyAccess",
    titleKey: "manageSubscription.benefit_earlyAccess",
    priority: false,
    support: false,
  },
] as const;

export const PaywallModal: React.FC<Props> = ({
  visible,
  busy,
  busyAction,
  priceText,
  onClose,
  onSubscribe,
  onRestore,
  onReturnToOffer,
  restoreFeedback,
  termsUrl,
  privacyUrl,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("profile");
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"purchase" | "restore">("purchase");
  const restoreBusy = !!busy && busyAction === "restore";
  const purchaseBusy = !!busy && busyAction !== "restore";
  const showRestore = mode === "restore";
  const restoreFooterBottomPadding = Math.max(
    insets.bottom,
    theme.spacing.lg,
  );
  const restoreContentPaddingBottom =
    theme.spacing.display + theme.spacing.display + restoreFooterBottomPadding;
  const restoreStatus =
    restoreBusy
      ? "loading"
      : restoreFeedback?.tone === "success"
        ? "success"
        : restoreFeedback?.restoreState === "no-purchase"
          ? "no-purchase"
          : restoreFeedback?.restoreState === "confirmation-pending"
            ? "confirmation-pending"
            : restoreFeedback?.tone === "info" || restoreFeedback?.tone === "warning"
              ? "confirmation-pending"
              : restoreFeedback?.tone === "error"
                ? "error"
                : "initial";
  const restoreNeedsRetry =
    restoreStatus === "error"
    || restoreStatus === "no-purchase"
    || restoreStatus === "confirmation-pending";
  const restoreUsesNeutralTone = restoreStatus === "no-purchase";
  const restoreUsesInfoTone = restoreStatus === "confirmation-pending";
  const storeName =
    Platform.OS === "ios"
      ? t("manageSubscription.store.appStore", {
          defaultValue: "App Store",
        })
      : t("manageSubscription.store.googlePlay", {
          defaultValue: "Google Play",
        });

  useEffect(() => {
    if (!visible) {
      setMode("purchase");
    }
  }, [visible]);

  useEffect(() => {
    if (visible && (restoreBusy || restoreFeedback)) {
      setMode("restore");
    }
  }, [restoreBusy, restoreFeedback, visible]);

  const restoreTitle =
    restoreStatus === "loading"
      ? t("manageSubscription.restoreCheckingTitle", {
          defaultValue: "Checking purchases...",
        })
      : restoreStatus === "success"
        ? (restoreFeedback?.title
          ?? t("manageSubscription.restoreSuccessTitle", {
            defaultValue: "Purchases restored",
          }))
        : restoreStatus === "no-purchase"
          ? (restoreFeedback?.title
            ?? t("manageSubscription.restoreNoPurchaseFoundTitle", {
              defaultValue: "No active subscription found",
            }))
          : restoreStatus === "confirmation-pending"
            ? (restoreFeedback?.title
              ?? t("manageSubscription.activationPendingTitle", {
                defaultValue: "Subscription activation in progress",
              }))
          : restoreStatus === "error"
            ? (restoreFeedback?.title
              ?? t("manageSubscription.restoreFailedTitle", {
                defaultValue: "Restore failed",
              }))
            : t("manageSubscription.restoreModalTitle", {
                defaultValue: "Restore purchases",
              });
  const restoreBody =
    restoreStatus === "loading"
      ? t("manageSubscription.restoreCheckingBody", {
          defaultValue:
            "We are checking the store account linked to this device and will refresh Premium only after the entitlement is confirmed.",
        })
      : restoreStatus === "success"
        ? (restoreFeedback?.message
          ?? t("manageSubscription.restoreSuccess", {
            defaultValue: "Purchases restored and premium is active.",
          }))
        : restoreStatus === "no-purchase"
          ? (restoreFeedback?.message
            ?? t("manageSubscription.restoreNoPurchaseFound", {
              defaultValue:
                "We could not find an active Premium subscription for this store account. You can try again or return to the Premium offer.",
            }))
          : restoreStatus === "confirmation-pending"
            ? (restoreFeedback?.message
              ?? t("manageSubscription.activationPendingBody", {
                defaultValue:
                  "The purchase was confirmed. We will refresh access shortly, or you can try restoring purchases.",
              }))
          : restoreStatus === "error"
            ? (restoreFeedback?.message
              ?? t("manageSubscription.restoreFailed", {
                defaultValue: "Check your connection and try again.",
              }))
            : t("manageSubscription.restoreModalBody", {
                defaultValue:
                  "Use this if you already purchased Premium. This checks your store account and then confirms access with Fitaly before showing Premium.",
              });
  const restoreIcon =
    restoreStatus === "success"
      ? "check"
      : restoreStatus === "error"
        ? "close"
      : restoreStatus === "loading"
        ? "refresh"
        : restoreStatus === "confirmation-pending"
          ? "info"
          : "history";
  const restoreToneStyle =
    restoreStatus === "success"
      ? styles.restoreHeroSuccess
      : restoreStatus === "error"
        ? styles.restoreHeroError
        : restoreUsesInfoTone
          ? styles.restoreHeroInfo
        : restoreUsesNeutralTone
          ? styles.restoreHeroNeutral
          : null;

  return (
    <Modal
      testID="paywall-modal"
      visible={visible}
      fullScreen
      onClose={busy || showRestore ? undefined : onClose}
      closeOnBackdropPress={!busy && !showRestore}
      title={
        showRestore
          ? restoreStatus === "confirmation-pending"
            ? t("manageSubscription.activationPendingSheetTitle", {
                defaultValue: "Premium activation",
              })
            : t("manageSubscription.restoreModalTitle", {
                defaultValue: "Restore purchases",
              })
          : t("paywall.title", { defaultValue: "Premium Monthly" })
      }
      contentPaddingBottom={
        showRestore ? restoreContentPaddingBottom : theme.spacing.display
      }
      overlayStyle={styles.modalBackdrop}
      containerStyle={[
        styles.modalSheet,
        showRestore ? styles.restoreModalSheet : null,
      ]}
      footerStyle={
        showRestore ? styles.restoreModalFooter : styles.modalFooter
      }
      closeButtonTestID={showRestore ? undefined : "paywall-close-button"}
      closeButtonSize={44}
      closeButtonBackgroundColor={theme.surfaceElevated}
      closeButtonIconColor={theme.textSecondary}
      closeButtonContainerStyle={styles.closeButton}
      footer={
        showRestore ? (
          <View
            style={[
              styles.ctaFooter,
              styles.restoreCtaFooter,
              { paddingBottom: restoreFooterBottomPadding },
            ]}
            testID="paywall-restore-footer"
          >
            {restoreStatus === "success" ? (
              <Button
                label={t("manageSubscription.restoreDoneCta", {
                  defaultValue: "Done",
                })}
                onPress={onClose}
                disabled={!!busy}
                textStyle={styles.primaryCtaLabel}
                testID="paywall-restore-done-button"
              />
            ) : (
              <>
                <Button
                  label={
                    restoreNeedsRetry
                      ? t("manageSubscription.restoreRetryCta", {
                          defaultValue: "Try again",
                        })
                      : t("manageSubscription.restorePurchases", {
                          defaultValue: "Restore purchases",
                        })
                  }
                  onPress={onRestore}
                  loading={restoreBusy}
                  disabled={!!busy}
                  textStyle={styles.primaryCtaLabel}
                  testID="paywall-restore-button"
                />

                <TouchableOpacity
                  testID="paywall-restore-back-button"
                  onPress={() => {
                    onReturnToOffer?.();
                    setMode("purchase");
                  }}
                  disabled={!!busy}
                  activeOpacity={0.7}
                  style={styles.restoreButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("manageSubscription.restoreBackToOffer", {
                    defaultValue: "Back to Premium offer",
                  })}
                >
                  <Text style={styles.restoreText}>
                    {t("manageSubscription.restoreBackToOffer", {
                      defaultValue: "Back to Premium offer",
                    })}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View
            style={[styles.ctaFooter, styles.purchaseCtaFooter]}
            testID="paywall-cta-footer"
          >
            <View style={styles.footerLegal}>
              <Text
                style={styles.footerDisclosure}
                testID="paywall-footer-disclosure"
              >
                {t("paywall.footerDisclosure", {
                  storeName,
                  defaultValue:
                    "Payment at confirmation. Subscription renews automatically; manage or cancel in {{storeName}} settings.",
                })}
              </Text>

              {!!termsUrl && !!privacyUrl && (
                <View style={styles.footerLinksRow}>
                  <TouchableOpacity
                    testID="paywall-footer-terms-button"
                    onPress={() => Linking.openURL(termsUrl)}
                    activeOpacity={0.7}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t("termsOfService", {
                      defaultValue: "Terms of Service",
                    })}
                  >
                    <Text style={styles.footerLinkText}>
                      {t("termsOfService", { defaultValue: "Terms of Service" })}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.footerLinkSeparator}>·</Text>

                  <TouchableOpacity
                    testID="paywall-footer-privacy-button"
                    onPress={() => Linking.openURL(privacyUrl)}
                    activeOpacity={0.7}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t("privacyPolicy", {
                      defaultValue: "Privacy Policy",
                    })}
                  >
                    <Text style={styles.footerLinkText}>
                      {t("privacyPolicy", { defaultValue: "Privacy Policy" })}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Button
              label={t("paywall.subscribe", { defaultValue: "Subscribe" })}
              onPress={onSubscribe}
              loading={purchaseBusy}
              disabled={!!busy}
              textStyle={styles.primaryCtaLabel}
              testID="paywall-subscribe-button"
            />

            <TouchableOpacity
              testID="paywall-open-restore-button"
              onPress={() => setMode("restore")}
              disabled={busy}
              activeOpacity={0.7}
              style={styles.restoreButton}
              accessibilityRole="button"
              accessibilityLabel={t("manageSubscription.restorePurchases", {
                defaultValue: "Restore Purchases",
              })}
            >
              <Text style={styles.restoreText}>
                {t("paywall.restoreEntry", {
                  defaultValue: "Already subscribed? Restore purchases",
                })}
              </Text>
            </TouchableOpacity>
          </View>
        )
      }
    >
      {showRestore ? (
        <View
          style={[styles.restoreHero, restoreToneStyle]}
          testID={`paywall-restore-state-${restoreStatus}`}
        >
          <View style={styles.restoreIcon}>
            <AppIcon
              name={restoreIcon}
              size={24}
              color={
                restoreStatus === "success"
                  ? theme.success.text
                  : restoreStatus === "error"
                    ? theme.error.text
                    : restoreUsesInfoTone
                      ? theme.info.text
                    : restoreUsesNeutralTone
                      ? theme.textSecondary
                      : theme.primaryStrong
              }
              rotation={restoreStatus === "loading" ? "45deg" : undefined}
            />
          </View>
          <Text style={styles.restoreTitle}>{restoreTitle}</Text>
          <Text style={styles.restoreBody}>{restoreBody}</Text>
          <View style={styles.restoreChecks}>
            <View style={styles.restoreCheckRow}>
              <AppIcon name="check" size={14} color={theme.primaryStrong} />
              <Text style={styles.restoreCheckText}>
                {t("manageSubscription.restoreCheckStore", {
                  defaultValue: "Checks previous App Store or Google Play purchases.",
                })}
              </Text>
            </View>
            <View style={styles.restoreCheckRow}>
              <AppIcon name="check" size={14} color={theme.primaryStrong} />
              <Text style={styles.restoreCheckText}>
                {t("manageSubscription.restoreCheckConfirmation", {
                  defaultValue:
                    "Premium appears only after Fitaly confirms active access.",
                })}
              </Text>
            </View>
          </View>
        </View>
      ) : (
      <>
        <View style={styles.offerHeader}>
        <View style={styles.heroIcon}>
          <AppIcon name="sparkles" size={24} color={theme.accentWarm} />
        </View>
        <View style={styles.offerCopy}>
          <Text style={styles.heroEyebrow}>{t("paywall.heroEyebrow")}</Text>
          <Text style={styles.heroTitle}>{t("paywall.hero_title")}</Text>
          <Text style={styles.heroSubtitle}>{t("paywall.hero_subtitle")}</Text>
        </View>
      </View>

      <View style={[styles.planCard, styles.planCardSelected]}>
        <View style={styles.planTopRow}>
          <Text style={styles.planLabel}>
            {t("paywall.planLabel", { defaultValue: "Monthly plan" })}
          </Text>
          <View
            style={styles.planStatusMark}
            testID="paywall-plan-status-mark"
          >
            <AppIcon name="check" size={14} color={theme.primaryStrong} />
          </View>
        </View>
        <Text style={styles.planPrice}>{priceText}</Text>

        <View style={styles.planMetaPill}>
          <AppIcon name="star" size={14} color={theme.primaryStrong} />
          <Text style={styles.planMetaText}>
            {t("paywall.planIncludedCredits", {
              defaultValue: "800 AI Credits for chat, photos, and text",
            })}
          </Text>
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

        <View style={styles.benefitList}>
          {PAYWALL_BENEFITS.map(({ key, titleKey, priority, support }) => (
            <View key={key} style={styles.benefitRow}>
              <View
                style={[
                  styles.benefitIcon,
                  priority ? styles.benefitIconPriority : null,
                ]}
              >
                <AppIcon name="check" size={12} color={theme.primaryStrong} />
              </View>
              <View style={styles.benefitCopy}>
                <Text
                  style={[
                    styles.benefitText,
                    priority ? styles.benefitTextPriority : null,
                  ]}
                  numberOfLines={2}
                >
                  {t(titleKey)}
                </Text>
                {support ? (
                  <Text style={styles.benefitSupport} numberOfLines={1}>
                    {t(`paywall.benefitSupport_${key}`)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legalBlock} testID="paywall-legal-block">
        <Text style={styles.legalTitle}>
          {t("paywall.legalTitle", {
            defaultValue: "Subscription terms",
          })}
        </Text>
        <Text style={styles.disclaimer}>
          {t("paywall.disclaimer", {
            storeName,
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
              <Text style={styles.legalLinkText}>
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
              <Text style={styles.legalLinkText}>
                {t("privacyPolicy", { defaultValue: "Privacy Policy" })}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      </>
      )}
    </Modal>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    modalBackdrop: {
      backgroundColor: theme.isDark
        ? "rgba(8, 11, 8, 0.48)"
        : "rgba(47, 49, 43, 0.32)",
    },
    modalSheet: {
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.18)"
        : "rgba(207, 197, 184, 0.9)",
      borderRadius: theme.rounded.xxl,
      backgroundColor: theme.surfaceElevated,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    modalFooter: {
      marginTop: "auto",
    },
    restoreModalSheet: {
      paddingBottom: 0,
    },
    restoreModalFooter: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      marginTop: 0,
    },
    closeButton: {
      right: theme.spacing.lg,
      top: theme.spacing.lg,
    },
    ctaFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.isDark
        ? "rgba(166, 189, 160, 0.2)"
        : "rgba(207, 197, 184, 0.72)",
      backgroundColor: theme.surfaceElevated,
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.md,
    },
    purchaseCtaFooter: {
      gap: theme.spacing.xxs,
      paddingTop: theme.spacing.sm,
    },
    restoreCtaFooter: {
      paddingHorizontal: theme.spacing.xl,
      borderBottomLeftRadius: theme.rounded.xxl,
      borderBottomRightRadius: theme.rounded.xxl,
    },
    footerLegal: {
      gap: theme.spacing.xxs,
      alignItems: "center",
      alignSelf: "stretch",
      borderWidth: theme.isDark ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.14)"
        : "transparent",
      borderRadius: theme.rounded.sm,
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.035)"
        : "transparent",
      paddingHorizontal: theme.isDark ? theme.spacing.sm : 0,
      paddingVertical: theme.spacing.xxs,
    },
    footerDisclosure: {
      color: theme.isDark ? "#BDB6AC" : theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
    },
    footerLinksRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
      columnGap: theme.spacing.xs,
    },
    footerLinkText: {
      color: theme.isDark ? "#B3C9AD" : theme.link,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    footerLinkSeparator: {
      color: theme.isDark ? "#918C84" : theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    offerHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.isDark ? "#253427" : theme.success.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.16)"
        : theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    offerCopy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    heroEyebrow: {
      color: theme.accentWarmStrong,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
      textTransform: "uppercase",
    },
    heroTitle: {
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
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
      minHeight: 44,
      paddingVertical: theme.spacing.xs,
      alignItems: "center",
      justifyContent: "center",
    },
    restoreText: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    primaryCtaLabel: {
      color: theme.isDark ? DARK_PRIMARY_CTA_LABEL : theme.button.primary.text,
    },
    disclaimer: {
      color: theme.isDark ? "#BDB6AC" : theme.textTertiary,
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
    legalLinkText: {
      color: theme.isDark ? "#B3C9AD" : theme.link,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    restoreHero: {
      alignItems: "center",
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.18)"
        : theme.borderSoft,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.isDark ? "#1F271F" : theme.surfaceAlt,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
    },
    restoreHeroSuccess: {
      borderColor: theme.success.main,
      backgroundColor: theme.isDark ? "#203023" : theme.success.surface,
    },
    restoreHeroInfo: {
      borderColor: theme.info.main,
      backgroundColor: theme.info.surface,
    },
    restoreHeroNeutral: {
      borderColor: theme.isDark ? "rgba(166, 189, 160, 0.18)" : theme.borderSoft,
      backgroundColor: theme.isDark ? "#1F271F" : theme.surfaceAlt,
    },
    restoreHeroError: {
      borderColor: theme.error.border,
      backgroundColor: theme.error.surface,
    },
    restoreIcon: {
      width: 52,
      height: 52,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
    },
    restoreTitle: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.bold,
      textAlign: "center",
    },
    restoreBody: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
    },
    restoreChecks: {
      alignSelf: "stretch",
      gap: theme.spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderSoft,
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.md,
    },
    restoreCheckRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
    },
    restoreCheckText: {
      flex: 1,
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    benefits: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    benefitsTitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
      marginBottom: theme.spacing.xxs,
      textTransform: "uppercase",
    },
    benefitList: {
      gap: theme.spacing.xxs,
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 1,
      gap: theme.spacing.sm,
    },
    benefitIcon: {
      width: 18,
      height: 18,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.035)"
        : theme.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      marginTop: 1,
    },
    benefitIconPriority: {
      backgroundColor: theme.isDark ? "#213325" : theme.success.surface,
    },
    benefitCopy: {
      flex: 1,
    },
    benefitText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      flex: 1,
    },
    benefitTextPriority: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    benefitSupport: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    planCard: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.lg,
      padding: theme.spacing.xs,
      backgroundColor: theme.surfaceAlt,
      gap: theme.spacing.xs,
    },
    planTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    planCardSelected: {
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.62)"
        : theme.primary,
      backgroundColor: theme.isDark ? "#1F2B21" : "#EAF0E6",
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
    planMetaPill: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.14)"
        : theme.borderSoft,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.045)"
        : theme.surfaceElevated,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    planMetaText: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
      flex: 1,
    },
    planStatusMark: {
      width: theme.spacing.lg,
      height: theme.spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.rounded.full,
      borderWidth: 1,
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.58)"
        : theme.primary,
      backgroundColor: theme.isDark ? "#20261F" : theme.surfaceElevated,
    },
    legalBlock: {
      borderWidth: theme.isDark ? StyleSheet.hairlineWidth : 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.12)"
        : "transparent",
      borderTopColor: theme.isDark
        ? "rgba(166, 189, 160, 0.18)"
        : theme.borderSoft,
      borderRadius: theme.isDark ? theme.rounded.md : 0,
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.025)"
        : "transparent",
      gap: theme.spacing.xxs,
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      paddingHorizontal: theme.isDark ? theme.spacing.sm : 0,
      paddingBottom: theme.isDark ? theme.spacing.sm : 0,
    },
    legalTitle: {
      color: theme.isDark ? theme.textSecondary : theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.semiBold,
      textTransform: "uppercase",
    },
  });
