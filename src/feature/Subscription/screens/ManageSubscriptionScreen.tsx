import { useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  Button,
  FormScreenShell,
  FullScreenLoader,
  InfoBlock,
  Layout,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import { usePremiumContext } from "@/context/PremiumContext";
import { useAccessContext } from "@/context/AccessContext";
import { useAuthContext } from "@/context/AuthContext";
import { PaywallModal } from "@/feature/Subscription/components/PaywallModal";
import { useManageSubscriptionState } from "@/feature/Subscription/hooks/useManageSubscriptionState";
import { formatLocalDateTime } from "@/utils/formatLocalDateTime";

const DARK_PRIMARY_CTA_LABEL = "#10150E";

type ManageSubscriptionNavigation = StackNavigationProp<
  RootStackParamList,
  "ManageSubscription"
>;

type ManageSubscriptionScreenProps = {
  navigation: ManageSubscriptionNavigation;
};

function getSummaryTone(
  state: string,
): "success" | "warning" | "neutral" {
  if (state === "premium_active" || state === "premium_trial") return "success";
  if (
    state === "unknown"
    || state === "premium_expired"
    || state === "premium_grace"
    || state === "premium_pending_downgrade"
    || state === "premium_paused"
    || state === "premium_refunded"
  ) {
    return "warning";
  }
  return "neutral";
}

export default function ManageSubscriptionScreen({
  navigation,
}: ManageSubscriptionScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation(["profile", "common"]);
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false;
  const { uid } = useAuthContext();
  const { accessState, loading: creditsLoading } = useAccessContext();
  const credits = accessState?.credits ?? null;
  const {
    subscription,
    premiumIssueReason,
    refreshPremium,
    confirmPremiumEntitlement,
  } = usePremiumContext();

  const {
    busy,
    busyAction,
    paywallVisible,
    termsUrl,
    privacyUrl,
    refundUrl,
    priceText,
    state,
    showRenew,
    showStart,
    showConfirmationRetry,
    showManageInStore,
    isPremiumComputed,
    billingAvailability,
    actionFeedback,
    tryOpenManage,
    tryRefreshPremium,
    tryRestore,
    trySubscribe,
    tryOpenRefundPolicy,
    openPaywall,
    closePaywall,
    clearActionFeedback,
  } = useManageSubscriptionState({
    uid,
    subscriptionState: subscription?.state,
    refreshPremium,
    confirmPremiumEntitlement,
    t,
    premiumIssueReason,
  });

  const summaryTitle =
    state === "premium_trial"
      ? t("manageSubscription.summaryTrialTitle", {
          defaultValue: "Premium trial active",
        })
      : state === "premium_grace"
        ? t("manageSubscription.summaryGraceTitle", {
            defaultValue: "Premium in grace period",
          })
        : state === "premium_pending_downgrade"
          ? t("manageSubscription.summaryPendingDowngradeTitle", {
              defaultValue: "Premium ending soon",
            })
          : state === "premium_paused"
            ? t("manageSubscription.summaryPausedTitle", {
                defaultValue: "Premium paused",
              })
            : state === "premium_refunded"
              ? t("manageSubscription.summaryRefundedTitle", {
                  defaultValue: "Premium refunded",
                })
              : state === "premium_active"
                ? t("manageSubscription.summaryPremiumTitle", {
                    defaultValue: "Premium active",
                  })
                : state === "premium_pending_confirmation"
                  ? t("manageSubscription.summaryPendingConfirmationTitle", {
                      defaultValue: "Premium is being confirmed",
                    })
                : state === "unknown"
                  ? t("manageSubscription.summaryUnknownTitle", {
                      defaultValue: "Cannot confirm premium right now",
                    })
                  : state === "premium_expired"
                    ? t("manageSubscription.summaryExpiredTitle", {
                        defaultValue: "Premium expired",
                      })
                    : t("manageSubscription.summaryFreeTitle", {
                        defaultValue: "Free plan",
                      });

  const summaryBody =
    state === "premium_trial"
      ? t("manageSubscription.summaryTrialBody", {
          defaultValue:
            "Your trial is active. Premium features and premium AI Credits are currently available.",
        })
      : state === "premium_grace"
        ? t("manageSubscription.summaryGraceBody", {
            defaultValue:
              "Premium is active, but billing needs attention. Update payment details to avoid interruption.",
          })
        : state === "premium_pending_downgrade"
          ? t("manageSubscription.summaryPendingDowngradeBody", {
              defaultValue:
                "Premium remains active for now, but it is scheduled to end at the close of the current period.",
            })
          : state === "premium_paused"
            ? t("manageSubscription.summaryPausedBody", {
                defaultValue:
                  "Premium is currently paused due to a billing issue. Restore billing to reactivate full access.",
              })
            : state === "premium_refunded"
              ? t("manageSubscription.summaryRefundedBody", {
                  defaultValue:
                    "A recent premium purchase appears refunded. Start a new subscription to restore premium access.",
                })
              : state === "premium_active"
                ? t("manageSubscription.summaryPremiumBody", {
                    defaultValue:
                      "Your account currently has access to premium features and the premium AI Credits tier.",
                  })
                : state === "premium_pending_confirmation"
                  ? t("manageSubscription.summaryPendingConfirmationBody", {
                      defaultValue:
                        "The purchase was confirmed. We will refresh access shortly, or you can try restoring purchases.",
                    })
                : state === "unknown"
                  ? t("manageSubscription.summaryUnknownBody", {
                      defaultValue:
                        "We could not confirm Premium right now. Try again, restore purchases, or manage your store subscription.",
                    })
                  : state === "premium_expired"
                    ? t("manageSubscription.summaryExpiredBody", {
                        defaultValue:
                          "Your premium access is no longer active. You can renew when billing is available.",
                      })
                    : t("manageSubscription.summaryFreeBody", {
                        defaultValue:
                          "You’re currently on the free plan. Upgrade to unlock the premium AI Credits tier and additional account features.",
                      });

  const billingStatusMessage =
    billingAvailability === "disabled"
      ? t("manageSubscription.billingUnavailable", {
          defaultValue: "Billing is unavailable on this device.",
        })
      : billingAvailability === "not_ready"
        ? t("common:billingErrors.billingNotReady", {
            defaultValue:
              "Billing is not ready yet. Please try again in a moment.",
          })
        : null;
  const confirmationWarningFeedback =
    (actionFeedback?.tone === "warning" || actionFeedback?.tone === "info") &&
    (state === "premium_pending_confirmation" || state === "unknown")
      ? actionFeedback
      : null;
  const displayedSummaryTitle =
    confirmationWarningFeedback?.title ?? summaryTitle;
  const displayedSummaryBody =
    confirmationWarningFeedback?.message ?? summaryBody;
  const displayedSummaryTone =
    confirmationWarningFeedback?.tone ?? getSummaryTone(state);
  const statusDescription = showStart
    ? t("manageSubscription.freeValueBridge", {
        defaultValue:
          "Premium adds more AI Credits, photo analysis, full history, and cloud backup.",
      })
    : displayedSummaryBody;

  const creditsBalanceValue = creditsLoading ? "..." : `${credits?.balance ?? "-"}`;
  const creditsAllocationValue = creditsLoading
    ? "..."
    : `${credits?.allocation ?? "-"}`;
  const creditsTierLabel = creditsLoading
    ? "..."
    : credits?.tier === "premium"
      ? t("manageSubscription.tierPremium", {
          defaultValue: "Premium",
        })
      : credits?.tier === "free"
        ? t("manageSubscription.tierFree", {
            defaultValue: "Free",
          })
        : "-";
  const creditsRenewalText = creditsLoading
    ? "..."
    : credits?.periodEndAt
      ? (formatLocalDateTime(credits.periodEndAt, {
          locale: i18n?.language,
        }) ?? t("manageSubscription.aiCreditsRenewalUnknown", {
          defaultValue: "Unavailable",
        }))
      : t("manageSubscription.aiCreditsRenewalUnknown", {
          defaultValue: "Unavailable",
        });
  const statusPrimaryKind = showConfirmationRetry
    ? "retry"
    : showRenew
      ? "renew"
      : showStart
        ? "subscribe"
        : showManageInStore
          ? "manage"
          : null;
  const statusPrimaryLabel =
    statusPrimaryKind === "retry"
      ? t("manageSubscription.retryConfirmation", {
          defaultValue: "Retry confirmation",
        })
      : statusPrimaryKind === "renew"
        ? t("manageSubscription.renewSubscription")
        : statusPrimaryKind === "subscribe"
          ? t("manageSubscription.startSubscription")
          : statusPrimaryKind === "manage"
            ? t("manageSubscription.manageInStore", {
                defaultValue: "Manage subscription in store",
              })
            : null;
  const statusPrimaryDisabled =
    busy
    || ((statusPrimaryKind === "subscribe" || statusPrimaryKind === "renew")
      && billingAvailability !== "ready");
  const toneStyles =
    displayedSummaryTone === "success"
      ? {
          card: styles.statusCardSuccess,
          icon: styles.statusIconSuccess,
        }
      : displayedSummaryTone === "warning"
        ? {
            card: styles.statusCardWarning,
            icon: styles.statusIconWarning,
          }
        : {
            card: styles.statusCardNeutral,
            icon: styles.statusIconNeutral,
          };

  if (!subscription) {
    if (!isOnline) {
      return (
        <FormScreenShell
          testID="manage-subscription-screen"
          title={t("manageSubscription.title")}
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.navigate("Profile");
          }}
        >
          <View style={styles.content}>
            <InfoBlock
              title={t("manageSubscription.unavailableTitle", {
                defaultValue: "Subscription details unavailable",
              })}
              body={t("manageSubscription.unavailableOfflineDesc", {
                defaultValue:
                  "You're offline and subscription details are not available locally yet.",
              })}
              tone="warning"
              icon={<AppIcon name="wifi-off" size={18} color={theme.warning.text} />}
            />

            <Button
              testID="manage-subscription-retry-button"
              label={t("retry", { ns: "common" })}
              onPress={() => {
                void refreshPremium();
              }}
            />
          </View>
        </FormScreenShell>
      );
    }

    return (
      <Layout disableScroll showNavigation={false}>
        <FullScreenLoader />
      </Layout>
    );
  }

  return (
    <>
      <FormScreenShell
        testID="manage-subscription-screen"
        title={t("manageSubscription.title")}
        intro={t("manageSubscription.screenIntro", {
          defaultValue:
            "Your plan, AI Credits, and store actions in one place.",
        })}
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          navigation.navigate("Profile");
        }}
      >
        <View style={styles.content}>
          {!isOnline ? (
            <InfoBlock
              title={t("manageSubscription.offlineTitle", {
                defaultValue: "Offline",
              })}
              body={t("manageSubscription.offlineBody", {
                defaultValue:
                  "Subscription details shown here may be outdated until you reconnect.",
              })}
              tone="warning"
              icon={<AppIcon name="wifi-off" size={18} color={theme.warning.text} />}
            />
          ) : null}

          {billingStatusMessage && (showStart || showRenew) ? (
            <InfoBlock
              title={t("manageSubscription.billingStatusTitle", {
                defaultValue: "Billing unavailable",
              })}
              body={billingStatusMessage}
              tone="warning"
              icon={<AppIcon name="info" size={18} color={theme.warning.text} />}
            />
          ) : null}

          {actionFeedback &&
          actionFeedback.tone !== "success" &&
          !confirmationWarningFeedback ? (
            <InfoBlock
              testID={`manage-subscription-action-feedback-${
                actionFeedback.feedbackState ?? actionFeedback.tone
              }`}
              title={actionFeedback.title}
              body={actionFeedback.message}
              tone={actionFeedback.tone}
              icon={
                <AppIcon
                  name={actionFeedback.tone === "error" ? "close" : "info"}
                  size={18}
                  color={
                    actionFeedback.tone === "error"
                      ? theme.error.text
                      : actionFeedback.tone === "warning"
                        ? theme.warning.text
                        : actionFeedback.tone === "info"
                          ? theme.info.text
                          : theme.textSecondary
                  }
                />
              }
            />
          ) : null}

          {(state === "premium_pending_confirmation" || state === "unknown") &&
          !credits &&
          !creditsLoading &&
          !confirmationWarningFeedback ? (
            <InfoBlock
              title={t("manageSubscription.aiCreditsUnavailableTitle", {
                defaultValue: "AI Credits unavailable",
              })}
              body={t("manageSubscription.aiCreditsUnavailableBody", {
                defaultValue:
                  "Premium credits will appear after subscription access is confirmed. We are not showing Premium access until that check succeeds.",
              })}
              tone="warning"
              icon={<AppIcon name="info" size={18} color={theme.warning.text} />}
            />
          ) : null}

          <View
            testID="manage-subscription-status-row"
            style={[styles.statusCard, toneStyles.card]}
          >
            <View style={styles.statusHeader}>
              <View style={[styles.statusIcon, toneStyles.icon]}>
                <AppIcon
                  name={isPremiumComputed ? "star" : "info"}
                  size={20}
                  color={
                    displayedSummaryTone === "success"
                      ? theme.success.text
                      : displayedSummaryTone === "warning"
                        ? theme.warning.text
                        : theme.textSecondary
                  }
                />
              </View>

              <View style={styles.statusTitleWrap}>
                <Text style={styles.statusEyebrow}>
                  {t("manageSubscription.currentPlanEyebrow", {
                    defaultValue: "Current plan",
                  })}
                </Text>
                <Text
                  testID={`manage-subscription-status-value-${state}`}
                  style={styles.statusTitle}
                >
                  {displayedSummaryTitle}
                </Text>
              </View>
            </View>

            <Text style={styles.statusBody}>{statusDescription}</Text>

            {statusPrimaryLabel ? (
              <Button
                testID="manage-subscription-primary-button"
                label={statusPrimaryLabel}
                loading={
                  (statusPrimaryKind === "manage" && busyAction === "manage")
                  || (statusPrimaryKind === "retry" && busyAction === "manage")
                }
                textStyle={
                  !statusPrimaryDisabled && theme.isDark
                    ? styles.statusPrimaryCtaLabel
                    : undefined
                }
                onPress={() => {
                  clearActionFeedback();
                  if (statusPrimaryKind === "retry") {
                    void tryRefreshPremium();
                    return;
                  }
                  if (statusPrimaryKind === "manage") {
                    void tryOpenManage();
                    return;
                  }
                  openPaywall();
                }}
                disabled={statusPrimaryDisabled}
              />
            ) : null}
          </View>

          <View
            testID="manage-subscription-credits-balance-row"
            style={styles.creditsCard}
          >
            <View style={styles.creditsHeader}>
              <Text style={styles.creditsTitle}>
                {t("manageSubscription.aiCreditsSection", {
                  defaultValue: "AI Credits",
                })}
              </Text>
              <Text style={styles.creditsLabel}>
                {t("manageSubscription.aiCreditsAvailableNow", {
                  defaultValue: "Available now",
                })}
              </Text>
            </View>

            <View style={styles.creditsBalancePanel}>
              <View style={styles.creditsHeroRow}>
                <Text
                  testID={`manage-subscription-credits-balance-value-${
                    credits?.balance ?? "missing"
                  }`}
                  style={styles.creditsBalance}
                >
                  {creditsBalanceValue}
                </Text>
                <Text style={styles.creditsUnit}>
                  {t("manageSubscription.aiCreditsUnit", {
                    defaultValue: "AI Credits",
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.creditDetailGrid}>
              <View
                testID="manage-subscription-credits-allocation-row"
                style={styles.creditDetailTile}
              >
                <Text style={styles.metaLabel}>
                  {t("manageSubscription.aiCreditsAllocation", {
                    defaultValue: "Allocation",
                  })}
                </Text>
                <Text
                  testID={`manage-subscription-credits-allocation-value-${
                    credits?.allocation ?? "missing"
                  }`}
                  style={styles.metaValue}
                >
                  {creditsAllocationValue}
                </Text>
              </View>
              <View
                testID="manage-subscription-tier-row"
                style={styles.creditDetailTile}
              >
                <Text style={styles.metaLabel}>
                  {t("manageSubscription.aiCreditsTier", {
                    defaultValue: "Tier",
                  })}
                </Text>
                <Text
                  testID={`manage-subscription-tier-value-${
                    credits?.tier ?? "missing"
                  }`}
                  style={styles.metaValue}
                >
                  {creditsTierLabel}
                </Text>
              </View>
              <View style={[styles.creditDetailTile, styles.creditRenewalTile]}>
                <Text style={styles.metaLabel}>
                  {t("manageSubscription.aiCreditsRenewalDate", {
                    defaultValue: "Renews on",
                  })}
                </Text>
                <Text style={styles.metaValue}>{creditsRenewalText}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionSection}>
            <Text style={styles.actionSectionTitle} accessibilityRole="header">
              {t("manageSubscription.actionsTitle", {
                defaultValue: "Subscription actions",
              })}
            </Text>

            <View style={styles.actionCard}>
              {showManageInStore && statusPrimaryKind !== "manage" ? (
                <>
                  <ActionRow
                    testID="manage-subscription-manage-store-row"
                    icon={
                      <AppIcon name="card" size={18} color={theme.textSecondary} />
                    }
                    title={t("manageSubscription.manageInStore", {
                      defaultValue: "Manage subscription in store",
                    })}
                    subtitle={t("manageSubscription.manageInStoreSubtitle", {
                      defaultValue:
                        "Open your store account settings to manage or cancel.",
                    })}
                    loading={busy && busyAction === "manage"}
                    onPress={() => {
                      void tryOpenManage();
                    }}
                    styles={styles}
                    theme={theme}
                  />
                  <View style={styles.actionDivider} />
                </>
              ) : null}

              <ActionRow
                testID="manage-subscription-restore-row"
                icon={<AppIcon name="refresh" size={18} color={theme.textSecondary} />}
                title={t("manageSubscription.restorePurchases", {
                  defaultValue: "Restore purchases",
                })}
                subtitle={t("manageSubscription.restoreSubtitle", {
                  defaultValue:
                    "Restore access if you already purchased premium on this account.",
                })}
                loading={busy && busyAction === "restore"}
                onPress={() => {
                  void tryRestore();
                }}
                styles={styles}
                theme={theme}
              />

              <View style={styles.actionDivider} />

              <ActionRow
                testID="manage-subscription-legal-row"
                icon={<AppIcon name="lock" size={18} color={theme.textSecondary} />}
                title={t("legalPrivacySectionTitle", {
                  defaultValue: "Legal & privacy",
                })}
                subtitle={t("manageSubscription.legalHubSubtitle", {
                  defaultValue:
                    "Privacy Policy, Terms of Service, and Data & AI clarity.",
                })}
                onPress={() => navigation.navigate("LegalPrivacyHub")}
                styles={styles}
                theme={theme}
              />

              {refundUrl ? (
                <>
                  <View style={styles.actionDivider} />
                  <ActionRow
                    testID="manage-subscription-refund-row"
                    icon={
                      <AppIcon name="help" size={18} color={theme.textSecondary} />
                    }
                    title={t("manageSubscription.refundPolicy")}
                    subtitle={t("manageSubscription.refundSubtitle", {
                      defaultValue: "Open the current store refund policy.",
                    })}
                    onPress={() => {
                      void tryOpenRefundPolicy();
                    }}
                    styles={styles}
                    theme={theme}
                  />
                </>
              ) : null}
            </View>
          </View>
        </View>
      </FormScreenShell>

      <PaywallModal
        visible={paywallVisible}
        busy={busy}
        busyAction={busyAction}
        priceText={priceText}
        onClose={closePaywall}
        onSubscribe={() => {
          void trySubscribe();
        }}
        onRestore={() => {
          void tryRestore();
        }}
        onReturnToOffer={clearActionFeedback}
        restoreFeedback={
          actionFeedback?.source === "restore" ||
          actionFeedback?.feedbackState === "activation-pending"
            ? actionFeedback
            : null
        }
        termsUrl={termsUrl}
        privacyUrl={privacyUrl}
      />
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
    statusCard: {
      gap: theme.spacing.md,
      borderWidth: 1,
      borderRadius: theme.rounded.xl,
      padding: theme.spacing.cardPaddingLarge,
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.borderSoft,
    },
    statusCardSuccess: {
      borderColor: theme.isDark ? "#6F8F6A" : "#9CAD94",
      backgroundColor: theme.isDark ? "#1E321F" : theme.success.surface,
    },
    statusCardWarning: {
      borderColor: theme.isDark ? "#7A6240" : "#D7BE91",
      backgroundColor: theme.warning.surface,
    },
    statusCardNeutral: {
      borderColor: theme.isDark ? "#343B34" : "#DED3C3",
      backgroundColor: theme.isDark ? "#232923" : theme.surface,
    },
    statusHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    statusIcon: {
      width: 46,
      height: 46,
      borderRadius: theme.rounded.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.isDark ? "#1D231D" : "#F6EFE5",
    },
    statusIconSuccess: {
      backgroundColor: theme.isDark ? "#1B251B" : theme.surface,
    },
    statusIconWarning: {
      backgroundColor: theme.isDark ? "#261F17" : theme.surface,
    },
    statusIconNeutral: {
      backgroundColor: theme.isDark ? "#202620" : "#EFE7DA",
    },
    statusTitleWrap: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    statusEyebrow: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
    },
    statusTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
    },
    statusBody: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    metaLabel: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
    },
    metaValue: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    statusPrimaryCtaLabel: {
      color: DARK_PRIMARY_CTA_LABEL,
    },
    creditsCard: {
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.xl,
      padding: theme.spacing.cardPaddingLarge,
      backgroundColor: theme.surfaceElevated,
    },
    creditsHeader: {
      gap: theme.spacing.xxs,
    },
    creditsTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
    },
    creditsLabel: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    creditsBalancePanel: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark ? "#363F36" : "#E8DDCE",
      borderRadius: theme.rounded.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.isDark ? "#202720" : "#FBF6EE",
    },
    creditsHeroRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
    },
    creditsBalance: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.numericXL,
      lineHeight: theme.typography.lineHeight.numericXL,
    },
    creditsUnit: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    creditDetailGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    creditDetailTile: {
      flexBasis: "47%",
      flexGrow: 1,
      minWidth: 128,
      gap: theme.spacing.xxs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark ? "#333B33" : "#E8DDCE",
      borderRadius: theme.rounded.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.isDark ? "#202620" : "#F8F1E7",
    },
    creditRenewalTile: {
      flexBasis: "100%",
    },
    actionSection: {
      gap: theme.spacing.sm,
    },
    actionSectionTitle: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      paddingHorizontal: theme.spacing.xs,
    },
    actionCard: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surfaceElevated,
    },
    actionRow: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.cardPadding,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.rounded.lg,
    },
    actionRowPressed: {
      backgroundColor: theme.isDark ? "#2A312A" : "#F8F1E7",
    },
    actionRowDisabled: {
      opacity: 0.54,
    },
    actionIconWrap: {
      width: 38,
      height: 38,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.isDark ? "#1E241E" : "#F4EBDD",
    },
    actionCopy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    actionTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    actionSubtitle: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    actionAccessory: {
      width: 28,
      minHeight: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    actionDivider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: theme.spacing.cardPadding + 38 + theme.spacing.md,
      marginRight: theme.spacing.cardPadding,
      backgroundColor: theme.isDark ? "#303830" : "#E9DED0",
    },
  });

type ActionRowProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: ReturnType<typeof useTheme>;
  testID?: string;
  loading?: boolean;
};

function ActionRow({
  title,
  subtitle,
  icon,
  onPress,
  styles,
  theme,
  testID,
  loading = false,
}: ActionRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.actionRow,
        pressed && !loading ? styles.actionRowPressed : null,
        loading ? styles.actionRowDisabled : null,
      ]}
    >
      <View style={styles.actionIconWrap}>{icon}</View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.actionSubtitle} numberOfLines={3}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.actionAccessory}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <AppIcon
            name="chevron"
            rotation="180deg"
            size={22}
            color={theme.textSecondary}
          />
        )}
      </View>
    </Pressable>
  );
}
