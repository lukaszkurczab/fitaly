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
      userData?.readiness?.status,
    );
    const isProductReady =
      canRenderProductStack && userData?.readiness?.status === "ready";

    return {
      isProductReady,
      canRenderProductStack,
      status: canRenderProductStack
        ? (userData?.readiness?.status ?? bootstrapState)
        : bootstrapState,
      uid: isProductReady ? (userData?.uid ?? null) : null,
      bootstrapState,
    };
  }, [
    authLoading,
    isAuthenticated,
    profileBootstrapState,
    userData?.readiness?.status,
    userData?.uid,
  ]);
}

export function useIsProductReady(): boolean {
  return useProductReadiness().isProductReady;
}
