import { isE2EModeEnabled } from "@/services/e2e/config";

let currentE2EAuthToken: string | null = null;

export function setE2EAuthToken(token: string | null | undefined): void {
  const normalized = token?.trim() ?? "";
  currentE2EAuthToken = normalized || null;
}

export function getE2EAuthToken(): string | null {
  if (!isE2EModeEnabled()) return null;
  return currentE2EAuthToken;
}

export function __resetE2EAuthTokenForTests(): void {
  currentE2EAuthToken = null;
}
