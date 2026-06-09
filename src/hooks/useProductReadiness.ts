import { useMemo } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { useUserProfileContext } from "@/context/UserProfileContext";
import {
  resolveBootstrapState,
  shouldRenderProductStack,
  type AppBootstrapState,
} from "@/navigation/appNavigatorState";
import type { ReadinessStatus } from "@/types";

export type ProductReadinessStatus = AppBootstrapState | ReadinessStatus;

export type ProductReadiness = {
  isProductReady: boolean;
  canRenderProductStack: boolean;
  status: ProductReadinessStatus;
  uid: string | null;
  bootstrapState: AppBootstrapState;
};

export function useProductReadiness(): ProductReadiness {
  const { authLoading, isAuthenticated } = useAuthContext();
  const { userData, profileBootstrapState } = useUserProfileContext();

  return useMemo(() => {
    const bootstrapState = resolveBootstrapState({
      authLoading,
      isAuthenticated,
      profileBootstrapState,
    });
    const canRenderProductStack = shouldRenderProductStack(
      bootstrapState,
      userData?.profile.readiness.status,
    );
    const isProductReady = canRenderProductStack;

    return {
      isProductReady,
      canRenderProductStack,
      status: canRenderProductStack
        ? (userData?.profile.readiness.status ?? bootstrapState)
        : bootstrapState,
      uid: canRenderProductStack ? (userData?.uid ?? null) : null,
      bootstrapState,
    };
  }, [
    authLoading,
    isAuthenticated,
    profileBootstrapState,
    userData?.profile.readiness.status,
    userData?.uid,
  ]);
}

export function useIsProductReady(): boolean {
  return useProductReadiness().isProductReady;
}
