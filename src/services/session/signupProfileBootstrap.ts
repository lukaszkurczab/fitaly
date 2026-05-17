type SignupProfileBootstrapListener = () => void;

type SignupProfileBootstrapState = {
  id: number;
  uid: string | null;
};

export type SignupProfileBootstrapSession = {
  attachUid: (uid: string) => void;
  finish: () => void;
};

let nextSessionId = 0;
let currentSession: SignupProfileBootstrapState | null = null;
const listeners = new Set<SignupProfileBootstrapListener>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function beginSignupProfileBootstrap(): SignupProfileBootstrapSession {
  const id = ++nextSessionId;
  currentSession = { id, uid: null };
  emitChange();

  return {
    attachUid: (uid: string) => {
      if (currentSession?.id !== id) return;
      currentSession = { id, uid };
      emitChange();
    },
    finish: () => {
      if (currentSession?.id !== id) return;
      currentSession = null;
      emitChange();
    },
  };
}

export function isSignupProfileBootstrapPending(uid?: string | null): boolean {
  if (!currentSession) return false;
  if (!uid) return true;
  return currentSession.uid === null || currentSession.uid === uid;
}

export function subscribeSignupProfileBootstrap(
  listener: SignupProfileBootstrapListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function __resetSignupProfileBootstrapForTests(): void {
  currentSession = null;
  listeners.clear();
}
