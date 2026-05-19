import { isE2EModeEnabled } from "@/services/e2e/config";

const ON = typeof __DEV__ !== "undefined" && __DEV__;

export type DebugLogger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
  child: (subscope: string) => DebugLogger;
};

export function debugScope(scope: string): DebugLogger {
  const p = `[${scope}]`;
  const base = {
    log: (...args: unknown[]) => {
      if (ON) console.log(p, ...args);
    },
    warn: (...args: unknown[]) => console.warn(p, ...args),
    error: (...args: unknown[]) => {
      if (isE2EModeEnabled()) {
        console.log(p, ...args);
        return;
      }
      console.error(p, ...args);
    },
    time: (label: string) => {
      if (ON) console.time(`${p} ${label}`);
    },
    timeEnd: (label: string) => {
      if (ON) console.timeEnd(`${p} ${label}`);
    },
  };
  return {
    ...base,
    child: (subscope: string) => debugScope(`${scope}:${subscope}`),
  };
}

export const Sync = debugScope("Sync");
