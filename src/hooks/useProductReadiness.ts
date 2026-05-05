import { useMemo } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { useUserProfileContext } from "@/context/UserProfileContext";
import {
  resolveBootstrapState,
  shouldRenderProductStack,
  type AppBootstrapState,
} from "@/navigation/appNavigatorState";

export type ProductReadinessStatus =
  | "authLoading"
  | "unauthenticated"
  | "profileLoading"
  | "profileReady"
  | "profileMissing"
  | "offlineCached"
  | "bootstrapFailed"
  | "ready";

export type ProductReadiness = {
  isProductReady: boolean;
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
    const isProductReady = shouldRenderProductStack(
      bootstrapState,
      userData?.surveyComplited,
    );

    return {
      isProductReady,
      status: isProductReady ? "ready" : bootstrapState,
      uid: isProductReady ? (userData?.uid ?? null) : null,
      bootstrapState,
    };
  }, [
    authLoading,
    isAuthenticated,
    profileBootstrapState,
    userData?.surveyComplited,
    userData?.uid,
  ]);
}

export function useIsProductReady(): boolean {
  return useProductReadiness().isProductReady;
}
