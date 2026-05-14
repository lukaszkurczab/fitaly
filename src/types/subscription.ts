export type SubscriptionState =
  | "premium_active"
  | "premium_trial"
  | "premium_grace"
  | "premium_pending_downgrade"
  | "premium_paused"
  | "premium_refunded"
  | "premium_expired"
  | "premium_pending_confirmation"
  | "free_active"
  | "free_expired"
  | "unknown";

export type Subscription = {
  state: SubscriptionState;
  renewDate?: string;
  endDate?: string;
  plan?: string;
  lastPayment?: string;
  lastPaymentAmount?: string;
  startDate?: string;
};
