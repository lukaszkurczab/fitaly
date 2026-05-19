import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
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
  SettingsRow,
  SettingsSection,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import { usePremiumContext } from "@/context/PremiumContext";
import { useAccessContext } from "@/context/AccessContext";
import { useAuthContext } from "@/context/AuthContext";
import { PaywallModal } from "@/feature/Subscription/components/PaywallModal";
import { useManageSubscriptionState } from "@/feature/Subscription/hooks/useManageSubscriptionState";
import { formatLocalDateTime } from "@/utils/formatLocalDateTime";

const BENEFITS = [
  "aiCredits800",
  "flexibleAiUsage",
  "photoAnalysisIncluded",
  "fullCloudBackup",
  "fullHistoryAccess",
  "earlyAccess",
] as const;

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
    headerStatus,
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
                        "The store entitlement is active, but backend credits are still being confirmed. Retry confirmation or restore purchases; credits will stay unavailable until the backend sync succeeds.",
                    })
                : state === "unknown"
                  ? t("manageSubscription.summaryUnknownBody", {
                      defaultValue:
                        "We could not confirm premium with billing and backend credits. Try again, restore purchases, or manage your store subscription.",
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

  const primaryCtaLabel = showConfirmationRetry
    ? t("manageSubscription.retryConfirmation", {
        defaultValue: "Retry confirmation",
      })
    : showRenew
      ? t("manageSubscription.renewSubscription")
      : showStart
        ? t("manageSubscription.startSubscription")
        : null;

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
    actionFeedback?.tone === "warning" &&
    (state === "premium_pending_confirmation" || state === "unknown")
      ? actionFeedback
      : null;
  const displayedSummaryTitle =
    confirmationWarningFeedback?.title ?? summaryTitle;
  const displayedSummaryBody =
    confirmationWarningFeedback?.message ?? summaryBody;
  const displayedSummaryTone =
    confirmationWarningFeedback?.tone ?? getSummaryTone(state);

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
            "Review your current membership, AI Credits tier, and subscription actions.",
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
          <InfoBlock
            title={displayedSummaryTitle}
            body={displayedSummaryBody}
            tone={displayedSummaryTone}
            icon={
              <AppIcon
                name={isPremiumComputed ? "star" : "info"}
                size={18}
                  color={
                    state === "premium_active"
                    || state === "premium_trial"
                      ? theme.success.text
                    : state === "premium_expired"
                      || state === "unknown"
                      || state === "premium_grace"
                      || state === "premium_pending_downgrade"
                      || state === "premium_paused"
                      || state === "premium_refunded"
                      ? theme.warning.text
                      : theme.textSecondary
                  }
                />
              }
          />

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

          {actionFeedback && !confirmationWarningFeedback ? (
            <InfoBlock
              testID={`manage-subscription-action-feedback-${actionFeedback.tone}`}
              title={actionFeedback.title}
              body={actionFeedback.message}
              tone={actionFeedback.tone}
              icon={
                <AppIcon
                  name={
                    actionFeedback.tone === "success"
                      ? "check"
                      : actionFeedback.tone === "warning"
                        ? "info"
                        : "close"
                  }
                  size={18}
                  color={
                    actionFeedback.tone === "success"
                      ? theme.success.text
                      : actionFeedback.tone === "warning"
                        ? theme.warning.text
                        : theme.error.text
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
                  "Credits require backend confirmation. No Premium credits are being shown until access-state and sync-tier return a Premium balance.",
              })}
              tone="warning"
              icon={<AppIcon name="info" size={18} color={theme.warning.text} />}
            />
          ) : null}

          {primaryCtaLabel ? (
            <View style={styles.primaryActionWrap}>
              <Button
                testID="manage-subscription-primary-button"
                label={primaryCtaLabel}
                onPress={() => {
                  clearActionFeedback();
                  if (showConfirmationRetry) {
                    void tryRefreshPremium();
                    return;
                  }
                  openPaywall();
                }}
                disabled={
                  busy || (!showConfirmationRetry && billingAvailability !== "ready")
                }
              />
            </View>
          ) : null}

          <SettingsSection
            title={t("manageSubscription.currentMembershipTitle", {
              defaultValue: "Current membership",
            })}
          >
            <SettingsRow
              testID="manage-subscription-status-row"
              valueTestID={`manage-subscription-status-value-${state}`}
              title={t("manageSubscription.yourSubscription")}
              value={headerStatus}
            />
            {showManageInStore ? (
              <SettingsRow
                title={t("manageSubscription.manageInStore", {
                  defaultValue: "Manage subscription in store",
                })}
                subtitle={t("manageSubscription.manageInStoreSubtitle", {
                  defaultValue:
                    "Open your store account settings to manage or cancel.",
                })}
                onPress={() => {
                  void tryOpenManage();
                }}
                loading={busy && busyAction === "manage"}
              />
            ) : null}
          </SettingsSection>

          <SettingsSection
            title={t("manageSubscription.aiCreditsSection", {
              defaultValue: "AI Credits",
            })}
          >
            <SettingsRow
              testID="manage-subscription-credits-balance-row"
              valueTestID={`manage-subscription-credits-balance-value-${
                credits?.balance ?? "missing"
              }`}
              title={t("manageSubscription.aiCreditsBalance", {
                defaultValue: "Balance",
              })}
              value={creditsLoading ? "..." : `${credits?.balance ?? "-"}`}
            />
            <SettingsRow
              testID="manage-subscription-credits-allocation-row"
              valueTestID={`manage-subscription-credits-allocation-value-${
                credits?.allocation ?? "missing"
              }`}
              title={t("manageSubscription.aiCreditsAllocation", {
                defaultValue: "Allocation",
              })}
              value={creditsLoading ? "..." : `${credits?.allocation ?? "-"}`}
            />
            <SettingsRow
              testID="manage-subscription-tier-row"
              valueTestID={`manage-subscription-tier-value-${
                credits?.tier ?? "missing"
              }`}
              title={t("manageSubscription.aiCreditsTier", {
                defaultValue: "Tier",
              })}
              value={
                creditsLoading
                  ? "..."
                  : credits?.tier === "premium"
                    ? t("manageSubscription.tierPremium", {
                        defaultValue: "Premium",
                      })
                    : credits?.tier === "free"
                      ? t("manageSubscription.tierFree", {
                          defaultValue: "Free",
                        })
                      : "-"
              }
            />
            <SettingsRow
              title={t("manageSubscription.aiCreditsRenewalDate", {
                defaultValue: "Renews on",
              })}
              value={
                creditsLoading
                  ? "..."
                  : credits?.periodEndAt
                    ? (formatLocalDateTime(credits.periodEndAt, {
                        locale: i18n?.language,
                      }) ?? t("manageSubscription.aiCreditsRenewalUnknown", {
                        defaultValue: "Unavailable",
                      }))
                    : t("manageSubscription.aiCreditsRenewalUnknown", {
                        defaultValue: "Unavailable",
                      })
              }
            />
          </SettingsSection>

          <SettingsSection
            title={t("manageSubscription.premiumBenefits", {
              defaultValue: "Premium benefits",
            })}
          >
            {BENEFITS.map((key) => (
              <SettingsRow
                key={key}
                title={t(`manageSubscription.benefit_${key}`)}
                subtitle={t(`manageSubscription.benefitDesc_${key}`)}
              />
            ))}
          </SettingsSection>

          <SettingsSection
            title={t("manageSubscription.actionsTitle", {
              defaultValue: "Subscription actions",
            })}
          >
            <SettingsRow
              testID="manage-subscription-restore-row"
              title={t("manageSubscription.restorePurchases", {
                defaultValue: "Restore purchases",
              })}
              subtitle={t("manageSubscription.restoreSubtitle", {
                defaultValue:
                  "Restore access if you already purchased premium on this account.",
              })}
              onPress={() => {
                void tryRestore();
              }}
              loading={busy && busyAction === "restore"}
            />

            <SettingsRow
              title={t("legalPrivacySectionTitle", {
                defaultValue: "Legal & privacy",
              })}
              subtitle={t("manageSubscription.legalHubSubtitle", {
                defaultValue:
                  "Privacy Policy, Terms of Service, and Data & AI clarity.",
              })}
              onPress={() => navigation.navigate("LegalPrivacyHub")}
            />

            {refundUrl ? (
              <SettingsRow
                title={t("manageSubscription.refundPolicy")}
                subtitle={t("manageSubscription.refundSubtitle", {
                  defaultValue: "Open the current store refund policy.",
                })}
                onPress={() => {
                  void tryOpenRefundPolicy();
                }}
              />
            ) : null}
          </SettingsSection>

        </View>
      </FormScreenShell>

      <PaywallModal
        visible={paywallVisible}
        busy={busy}
        priceText={priceText}
        onClose={closePaywall}
        onSubscribe={() => {
          void trySubscribe();
        }}
        onRestore={() => {
          void tryRestore();
        }}
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
    primaryActionWrap: {
      gap: theme.spacing.sm,
    },
  });
