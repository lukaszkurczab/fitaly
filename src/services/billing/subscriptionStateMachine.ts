import type { Subscription, SubscriptionState } from "@/types/subscription";

type EntitlementSource = "active" | "all" | "none";

type NormalizedEntitlement = {
  source: EntitlementSource;
  isActive: boolean;
  willRenew: boolean | null;
  periodType: string | null;
  latestPurchaseDate: string | null;
  originalPurchaseDate: string | null;
  expirationDate: string | null;
  unsubscribeDetectedAt: string | null;
  billingIssueDetectedAt: string | null;
  productIdentifier: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeEntitlement(customerInfo: unknown): NormalizedEntitlement {
  const info = asRecord(customerInfo);
  const entitlements = asRecord(info?.entitlements);
  const activeEntitlements = asRecord(entitlements?.active);
  const allEntitlements = asRecord(entitlements?.all);

  const activePremium = asRecord(activeEntitlements?.premium);
  const allPremium = asRecord(allEntitlements?.premium);
  const raw = activePremium ?? allPremium;

  if (!raw) {
    return {
      source: "none",
      isActive: false,
      willRenew: null,
      periodType: null,
      latestPurchaseDate: null,
      originalPurchaseDate: null,
      expirationDate: null,
      unsubscribeDetectedAt: null,
      billingIssueDetectedAt: null,
      productIdentifier: null,
    };
  }

  const source: EntitlementSource = activePremium ? "active" : "all";
  const activeFlag = asBoolean(raw.isActive);

  return {
    source,
    isActive: activeFlag ?? source === "active",
    willRenew: asBoolean(raw.willRenew),
    periodType: asString(raw.periodType),
    latestPurchaseDate: asString(raw.latestPurchaseDate),
    originalPurchaseDate: asString(raw.originalPurchaseDate),
    expirationDate: asString(raw.expirationDate),
    unsubscribeDetectedAt: asString(raw.unsubscribeDetectedAt),
    billingIssueDetectedAt: asString(raw.billingIssueDetectedAt),
    productIdentifier: asString(raw.productIdentifier),
  };
}

function resolveSubscriptionState(
  entitlement: NormalizedEntitlement,
): SubscriptionState {
  if (entitlement.source === "none") {
    return "free_active";
  }

  if (entitlement.isActive) {
    const periodType = (entitlement.periodType || "").toUpperCase();
    if (periodType === "TRIAL" || periodType === "INTRO") {
      return "premium_trial";
    }
    if (entitlement.billingIssueDetectedAt) {
      return "premium_grace";
    }
    if (entitlement.willRenew === false || entitlement.unsubscribeDetectedAt) {
      return "premium_pending_downgrade";
    }
    return "premium_active";
  }

  if (entitlement.billingIssueDetectedAt) {
    return "premium_paused";
  }

  const hasPremiumHistory = Boolean(
    entitlement.originalPurchaseDate
      || entitlement.latestPurchaseDate
      || entitlement.expirationDate
      || entitlement.periodType
      || entitlement.productIdentifier,
  );
  if (hasPremiumHistory) {
    if (
      entitlement.willRenew === false
      && !entitlement.unsubscribeDetectedAt
      && !entitlement.expirationDate
    ) {
      return "premium_refunded";
    }
    return "premium_expired";
  }

  return "free_active";
}

export function hasPremiumAccess(state: SubscriptionState | string): boolean {
  return (
    state === "premium_active"
    || state === "premium_trial"
    || state === "premium_grace"
    || state === "premium_pending_downgrade"
  );
}

export function mapPendingPremiumConfirmationToSubscription(): Subscription {
  return {
    state: "premium_pending_confirmation",
  };
}

export function mapPremiumToSubscription(premium: boolean): Subscription {
  return premium ? { state: "premium_active" } : { state: "free_active" };
}

export function mapUnknownSubscription(
): Subscription {
  return {
    state: "unknown",
  };
}

export function resolveSubscriptionFromRevenueCat(params: {
  customerInfo: unknown;
}): Subscription {
  const entitlement = normalizeEntitlement(params.customerInfo);
  const state = resolveSubscriptionState(entitlement);
  return {
    state,
    renewDate: entitlement.expirationDate ?? undefined,
    endDate: entitlement.expirationDate ?? undefined,
    startDate:
      entitlement.originalPurchaseDate
      || entitlement.latestPurchaseDate
      || undefined,
    plan: entitlement.productIdentifier ?? entitlement.periodType ?? undefined,
  };
}
