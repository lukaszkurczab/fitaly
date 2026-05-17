import { useSyncExternalStore } from "react";
import {
  isSignupProfileBootstrapPending,
  subscribeSignupProfileBootstrap,
} from "@/services/session/signupProfileBootstrap";

export function useSignupProfileBootstrapPending(uid: string | null): boolean {
  return useSyncExternalStore(
    subscribeSignupProfileBootstrap,
    () => isSignupProfileBootstrapPending(uid),
    () => false,
  );
}
