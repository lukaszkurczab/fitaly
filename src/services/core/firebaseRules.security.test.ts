import { existsSync, readFileSync } from "fs";
import path from "path";

const backendRoot = process.env.BACKEND_REPO
  ? path.resolve(process.env.BACKEND_REPO)
  : path.resolve(__dirname, "../../../../fitaly-backend");
const firestoreRulesPath = path.join(backendRoot, "firestore.rules");
const storageRulesPath = path.join(backendRoot, "storage.rules");

const loadBackendRules = () => {
  const missingRulePaths = [
    firestoreRulesPath,
    storageRulesPath,
  ].filter((rulePath) => !existsSync(rulePath));

  if (missingRulePaths.length > 0) {
    throw new Error(
      [
        "Canonical backend Firebase rules are required for this mobile security test.",
        `Resolved backend repo: ${backendRoot}`,
        `Missing rules: ${missingRulePaths.join(", ")}`,
        "Set BACKEND_REPO to the fitaly-backend checkout or place fitaly-backend as a sibling checkout.",
      ].join("\n"),
    );
  }

  return {
    firestoreRules: readFileSync(firestoreRulesPath, "utf8"),
    storageRules: readFileSync(storageRulesPath, "utf8"),
  };
};

const { firestoreRules, storageRules } = loadBackendRules();

describe("backend Firebase rules security model v2", () => {
  it("locks billing writes and exposes owner-only reads on canonical billing paths", () => {
    expect(firestoreRules).toMatch(
      /match \/users\/\{userId\}\/billing\/main\/aiCredits\/current \{\s*allow read: if isOwner\(userId\);\s*allow write: if false;/m,
    );
    expect(firestoreRules).toMatch(
      /match \/users\/\{userId\}\/billing\/main\/aiCreditTransactions\/\{txId\} \{\s*allow read: if isOwner\(userId\);\s*allow write: if false;/m,
    );
  });

  it("uses user-owned feedback storage path and blocks legacy feedbacks path", () => {
    expect(storageRules).toMatch(
      /match \/feedback\/\{userId\}\/\{feedbackId\}\/\{filename\} \{\s*allow write: if isOwner\(userId\);\s*allow read: if isOwner\(userId\) \|\| isAdmin\(\);/m,
    );
    expect(storageRules).toMatch(
      /match \/feedbacks\/\{document=\*\*\} \{\s*allow read, write: if false;/m,
    );
    expect(firestoreRules).toMatch(
      /match \/feedbacks\/\{document=\*\*\} \{\s*allow read, write: if false;/m,
    );
  });

  it("explicitly denies legacy top-level credits and gateway log collections", () => {
    expect(firestoreRules).toMatch(
      /match \/ai_credits\/\{document=\*\*\} \{\s*allow read, write: if false;/m,
    );
    expect(firestoreRules).toMatch(
      /match \/ai_credit_transactions\/\{document=\*\*\} \{\s*allow read, write: if false;/m,
    );
    expect(firestoreRules).toMatch(
      /match \/ai_gateway_logs\/\{document=\*\*\} \{\s*allow read, write: if false;/m,
    );
  });

  it("keeps a deny-by-default fallback", () => {
    expect(firestoreRules).toMatch(
      /match \/\{document=\*\*\} \{\s*allow read, write: if false;/m,
    );
    expect(storageRules).toMatch(
      /match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;/m,
    );
  });
});
