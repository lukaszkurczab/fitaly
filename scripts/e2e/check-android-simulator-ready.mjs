#!/usr/bin/env node
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const timeoutMs = Number.parseInt(process.env.E2E_ANDROID_PREFLIGHT_TIMEOUT_MS ?? "10000", 10);
const jsonOutput = process.argv.includes("--json");

function pathEntries() {
  return (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
}

function candidatesFor(binaryName) {
  const candidates = [];
  for (const dir of pathEntries()) {
    candidates.push(path.join(dir, binaryName));
  }

  const sdkRoots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
  for (const sdkRoot of sdkRoots) {
    candidates.push(path.join(sdkRoot, "platform-tools", binaryName));
    candidates.push(path.join(sdkRoot, "emulator", binaryName));
  }

  if (binaryName === "maestro") {
    candidates.push(path.join(os.homedir(), ".maestro", "bin", "maestro"));
  }

  return candidates;
}

function resolveBinary(binaryName) {
  for (const candidate of candidatesFor(binaryName)) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function runCommand(command, args) {
  if (!command) {
    return {
      status: null,
      stdout: "",
      stderr: "command not found",
      timedOut: false,
    };
  }

  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: Number.isFinite(timeoutMs) ? timeoutMs : 10000,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: Boolean(result.error && result.error.code === "ETIMEDOUT"),
  };
}

function parseAdbDevices(output) {
  const devices = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("List of devices")) continue;
    const [id, state] = trimmed.split(/\s+/);
    if (!id || !state) continue;
    devices.push({
      id,
      state,
      isEmulator: id.startsWith("emulator-"),
    });
  }
  return devices;
}

function parseAvds(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const adbPath = resolveBinary("adb");
const emulatorPath = resolveBinary("emulator");
const maestroPath = resolveBinary("maestro");

const adbResult = runCommand(adbPath, ["devices"]);
const emulatorResult = runCommand(emulatorPath, ["-list-avds"]);

const adbDevices = adbResult.status === 0 ? parseAdbDevices(adbResult.stdout) : [];
const bootedEmulators = adbDevices.filter((device) => device.isEmulator && device.state === "device");
const ignoredPhysicalDevices = adbDevices.filter((device) => !device.isEmulator);
const avds = emulatorResult.status === 0 ? parseAvds(emulatorResult.stdout) : [];

const failures = [];
if (!adbPath) failures.push("adb was not found in PATH, ANDROID_HOME, or ANDROID_SDK_ROOT.");
if (!emulatorPath) failures.push("Android emulator binary was not found in PATH, ANDROID_HOME, or ANDROID_SDK_ROOT.");
if (!maestroPath) failures.push("Maestro CLI was not found in PATH or ~/.maestro/bin.");
if (adbResult.status !== 0) failures.push("adb devices did not complete successfully.");
if (emulatorResult.status !== 0) failures.push("emulator -list-avds did not complete successfully.");
if (bootedEmulators.length === 0) failures.push("No booted Android emulator is attached through adb.");
if (avds.length === 0) failures.push("No configured Android Virtual Device was reported by emulator -list-avds.");

const report = {
  status: failures.length === 0 ? "ready" : "not_ready",
  checks: {
    adb: {
      path: adbPath,
      status: adbResult.status,
      timedOut: adbResult.timedOut,
    },
    emulator: {
      path: emulatorPath,
      status: emulatorResult.status,
      timedOut: emulatorResult.timedOut,
    },
    maestro: {
      path: maestroPath,
      status: maestroPath ? "found" : "missing",
    },
  },
  androidTargets: {
    bootedEmulators,
    configuredAvds: avds,
    ignoredPhysicalDevices,
  },
  policy: {
    acceptsPhysicalDevices: false,
    reason: "Owner instructed this hardening pass to skip physical-device validation and use simulators only.",
  },
  failures,
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`[android-preflight] status=${report.status}`);
  console.log(`[android-preflight] adb=${adbPath ?? "missing"} status=${String(adbResult.status)}`);
  console.log(`[android-preflight] emulator=${emulatorPath ?? "missing"} status=${String(emulatorResult.status)}`);
  console.log(`[android-preflight] maestro=${maestroPath ?? "missing"}`);
  console.log(`[android-preflight] booted_emulators=${bootedEmulators.map((device) => device.id).join(",") || "none"}`);
  console.log(`[android-preflight] configured_avds=${avds.join(",") || "none"}`);
  if (ignoredPhysicalDevices.length > 0) {
    console.log(
      `[android-preflight] ignored_physical_devices=${ignoredPhysicalDevices
        .map((device) => `${device.id}:${device.state}`)
        .join(",")}`,
    );
  }
  for (const failure of failures) {
    console.log(`[android-preflight] blocker=${failure}`);
  }
}

process.exit(failures.length === 0 ? 0 : 2);
