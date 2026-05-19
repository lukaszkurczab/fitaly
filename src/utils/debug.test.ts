import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

const loadDebugModule = (
  devValue: boolean | undefined,
  options?: { e2e?: boolean },
) => {
  jest.resetModules();
  (globalThis as { __DEV__?: boolean }).__DEV__ = devValue;
  jest.doMock("@/services/e2e/config", () => ({
    isE2EModeEnabled: () => options?.e2e === true,
  }));
  let mod: unknown;
  jest.isolateModules(() => {
    mod = jest.requireActual("@/utils/debug");
  });
  return mod as typeof import("@/utils/debug");
};

describe("debugScope", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "time").mockImplementation(() => undefined);
    jest.spyOn(console, "timeEnd").mockImplementation(() => undefined);
  });

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it("logs debug and timing entries in dev mode", () => {
    const { debugScope } = loadDebugModule(true);
    const logger = debugScope("Meals");

    logger.log("start", 1);
    logger.time("sync");
    logger.timeEnd("sync");

    expect(console.log).toHaveBeenCalledWith("[Meals]", "start", 1);
    expect(console.time).toHaveBeenCalledWith("[Meals] sync");
    expect(console.timeEnd).toHaveBeenCalledWith("[Meals] sync");
  });

  it("skips debug logs in non-dev mode but keeps warn/error", () => {
    const { debugScope } = loadDebugModule(false);
    const logger = debugScope("Meals");

    logger.log("start");
    logger.time("sync");
    logger.timeEnd("sync");
    logger.warn("warn");
    logger.error("error");

    expect(console.log).not.toHaveBeenCalled();
    expect(console.time).not.toHaveBeenCalled();
    expect(console.timeEnd).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("[Meals]", "warn");
    expect(console.error).toHaveBeenCalledWith("[Meals]", "error");
  });

  it("creates scoped child logger and exported Sync logger", () => {
    const { debugScope, Sync } = loadDebugModule(true);
    const child = debugScope("Parent").child("Child");

    child.warn("child-warning");
    Sync.error("sync-error");

    expect(console.warn).toHaveBeenCalledWith("[Parent:Child]", "child-warning");
    expect(console.error).toHaveBeenCalledWith("[Sync]", "sync-error");
  });

  it("routes debug errors to log in E2E mode to avoid blocking LogBox overlays", () => {
    const { debugScope } = loadDebugModule(true, { e2e: true });
    const logger = debugScope("Sync");

    logger.error("startup:failed");

    expect(console.log).toHaveBeenCalledWith("[Sync]", "startup:failed");
    expect(console.error).not.toHaveBeenCalled();
  });
});
