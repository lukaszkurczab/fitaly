#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const suitesPath = path.join(__dirname, "suites.json");

const releaseRelevantSuites = [
  "smoke",
  "auth",
  "add-meal",
  "home-history-statistics",
  "ai-chat",
  "premium-billing",
  "notifications-retention",
  "share",
  "platform-layout",
  "release-gate",
  "full-review",
];

const forbiddenAcceptancePathPattern = /(^|\/)(visual-audit|repair-loop)(\/|$)/;
const quotedScalarPattern = /^(["'])(?:\\.|(?!\1).)+\1\s*(?:#.*)?$/;
const assertionCommandPattern = /^(\s*)-?\s*(assertVisible|assertNotVisible|extendedWaitUntil)\s*:\s*(.*)$/;
const extendedWaitUntilDottedPattern =
  /^(\s*)-?\s*extendedWaitUntil\.(visible|notVisible)\s*:\s*(["'])(?:\\.|(?!\3).)+\3\s*(?:#.*)?$/;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function indentation(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function isBlankOrComment(line) {
  return /^\s*(#.*)?$/.test(line);
}

function isQuotedScalar(value) {
  return quotedScalarPattern.test(value.trim());
}

function flag(finding, findings) {
  findings.push(finding);
}

function scanFlow(relativePath, ownerSuites) {
  const absolutePath = path.join(rootDir, relativePath);
  const contents = readFileSync(absolutePath, "utf8");
  const lines = contents.split(/\r?\n/);
  const findings = [];
  const activeBlocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    const indent = indentation(line);
    const trimmed = line.trim();

    if (!isBlankOrComment(line)) {
      while (
        activeBlocks.length > 0 &&
        indent <= activeBlocks[activeBlocks.length - 1].indent
      ) {
        activeBlocks.pop();
      }
    }

    const commandMatch = line.match(assertionCommandPattern);
    if (commandMatch) {
      const [, indentText, command, rawValue] = commandMatch;
      const commandIndent = indentText.length;

      if (command === "assertVisible" || command === "assertNotVisible") {
        if (isQuotedScalar(rawValue)) {
          flag(
            {
              path: relativePath,
              line: lineNumber,
              suites: ownerSuites,
              reason: `${command} uses a quoted exact-text scalar`,
            },
            findings,
          );
        }

        if (/\btext\s*:\s*["']/.test(rawValue)) {
          flag(
            {
              path: relativePath,
              line: lineNumber,
              suites: ownerSuites,
              reason: `${command} maps to a quoted exact text value`,
            },
            findings,
          );
        }
      }

      if (
        command === "extendedWaitUntil" &&
        /\b(?:visible|notVisible)\s*:\s*["']/.test(rawValue)
      ) {
        flag(
          {
            path: relativePath,
            line: lineNumber,
            suites: ownerSuites,
            reason: "extendedWaitUntil waits on a quoted exact-text scalar",
          },
          findings,
        );
      }

      activeBlocks.push({
        command,
        indent: commandIndent,
      });
      continue;
    }

    if (extendedWaitUntilDottedPattern.test(line)) {
      flag(
        {
          path: relativePath,
          line: lineNumber,
          suites: ownerSuites,
          reason: "extendedWaitUntil.visible/notVisible uses quoted exact text",
        },
        findings,
      );
    }

    for (const block of activeBlocks) {
      if (block.command === "assertVisible" || block.command === "assertNotVisible") {
        if (/^\s*text\s*:\s*["']/.test(line)) {
          flag(
            {
              path: relativePath,
              line: lineNumber,
              suites: ownerSuites,
              reason: `${block.command} contains nested quoted text`,
            },
            findings,
          );
        }
        continue;
      }

      if (block.command === "extendedWaitUntil") {
        if (/^\s*(visible|notVisible)\s*:\s*["']/.test(line)) {
          flag(
            {
              path: relativePath,
              line: lineNumber,
              suites: ownerSuites,
              reason: "extendedWaitUntil visible/notVisible uses quoted exact text",
            },
            findings,
          );
        }

        if (/^\s*text\s*:\s*["']/.test(line)) {
          flag(
            {
              path: relativePath,
              line: lineNumber,
              suites: ownerSuites,
              reason: "extendedWaitUntil contains nested quoted text",
            },
            findings,
          );
        }
      }
    }
  }

  return findings;
}

const suites = readJson(suitesPath);
const errors = [];
const flowOwners = new Map();

for (const suiteName of releaseRelevantSuites) {
  const flows = suites[suiteName];
  if (!Array.isArray(flows)) {
    errors.push(`Release-relevant suite "${suiteName}" must be an array in scripts/e2e/suites.json.`);
    continue;
  }

  for (const flow of flows) {
    const owners = flowOwners.get(flow) || [];
    owners.push(suiteName);
    flowOwners.set(flow, owners);
  }
}

for (const [flow, owners] of flowOwners.entries()) {
  if (forbiddenAcceptancePathPattern.test(flow)) {
    errors.push(
      `Release-relevant suites [${owners.join(", ")}] must not use visual-audit or repair-loop acceptance: ${flow}`,
    );
  }

  const absoluteFlowPath = path.join(rootDir, flow);
  if (!existsSync(absoluteFlowPath)) {
    errors.push(`Release-relevant suites [${owners.join(", ")}] reference a missing flow: ${flow}`);
  }
}

const findings = [];

if (errors.length === 0) {
  for (const [flow, owners] of flowOwners.entries()) {
    findings.push(...scanFlow(flow, owners));
  }
}

if (errors.length > 0 || findings.length > 0) {
  console.error("[e2e:dynamic-text] CH-08-004 dynamic text assertion validation failed:");

  for (const error of errors) {
    console.error(`  - ${error}`);
  }

  for (const finding of findings) {
    console.error(
      `  - ${finding.path}:${finding.line} [${finding.suites.join(", ")}] ${finding.reason}`,
    );
  }

  process.exit(1);
}

console.log(
  `[e2e:dynamic-text] CH-08-004 validated ${releaseRelevantSuites.length} release-relevant suite(s) and ${flowOwners.size} unique Maestro flow(s).`,
);
console.log(
  "[e2e:dynamic-text] Static gate only; it prevents exact text acceptance assertions in scanned release-relevant Maestro files but does not prove semantic dynamic-response correctness.",
);
