import Constants from "expo-constants";

type E2EExtra = {
  e2e?: boolean;
  e2eMockChatReply?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as E2EExtra;

const E2E_ENABLED = extra.e2e === true;

export function isE2EModeEnabled(): boolean {
  return E2E_ENABLED;
}

export function getE2EMockChatReply(): string | null {
  if (!E2E_ENABLED) return null;
  const reply = extra.e2eMockChatReply?.trim();
  return reply ? reply : null;
}
