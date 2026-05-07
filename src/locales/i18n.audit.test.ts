import fs from "fs";
import path from "path";

type FlatMap = Record<string, string>;

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const LOCALES_ROOT = path.join(SOURCE_ROOT, "locales");
const EN_LOCALES = path.join(LOCALES_ROOT, "en");
const PL_LOCALES = path.join(LOCALES_ROOT, "pl");

function flattenObject(value: unknown, prefix = "", out: FlatMap = {}): FlatMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return out;
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      flattenObject(nested, nextKey, out);
      continue;
    }
    out[nextKey] = String(nested);
  }

  return out;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readLocaleMap(dirPath: string): Record<string, FlatMap> {
  const map: Record<string, FlatMap> = {};
  const files = fs.readdirSync(dirPath).filter((file) => file.endsWith(".json"));
  for (const file of files) {
    const namespace = file.replace(/\.json$/u, "");
    map[namespace] = flattenObject(readJson(path.join(dirPath, file)));
  }
  return map;
}

function listSourceFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (!/\.(ts|tsx)$/u.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/u.test(entry.name)) continue;
    files.push(fullPath);
  }

  return files;
}

function inferDefaultNamespace(source: string): string | null {
  const match = source.match(/\buseTranslation\(\s*([^)]*)\)/u);
  if (!match) return null;

  const argument = match[1]?.trim() || "";
  if (argument.startsWith("[")) {
    const firstNamespace = argument.match(/['"`]([a-zA-Z0-9_-]+)['"`]/u);
    return firstNamespace?.[1] ?? null;
  }

  const namespace = argument.match(/['"`]([a-zA-Z0-9_-]+)['"`]/u);
  return namespace?.[1] ?? null;
}

function hasLocaleKey(
  locales: Record<string, Record<string, FlatMap>>,
  ns: string,
  key: string,
): boolean {
  return Boolean(locales.en[ns]?.[key] !== undefined && locales.pl[ns]?.[key] !== undefined);
}

function hasPluralLocaleKey(
  locales: Record<string, Record<string, FlatMap>>,
  ns: string,
  key: string,
): boolean {
  const variants = ["one", "few", "many", "other"];
  return variants.some((suffix) => hasLocaleKey(locales, ns, `${key}_${suffix}`));
}

describe("i18n locale audit", () => {
  const locales = {
    en: readLocaleMap(EN_LOCALES),
    pl: readLocaleMap(PL_LOCALES),
  };

  it("keeps namespace files aligned between en and pl", () => {
    const enNamespaces = Object.keys(locales.en).sort();
    const plNamespaces = Object.keys(locales.pl).sort();
    expect(plNamespaces).toEqual(enNamespaces);
  });

  it("keeps key parity between en and pl in every namespace", () => {
    for (const namespace of Object.keys(locales.en)) {
      const enKeys = Object.keys(locales.en[namespace] || {}).sort();
      const plKeys = Object.keys(locales.pl[namespace] || {}).sort();
      expect(plKeys).toEqual(enKeys);
    }
  });

  it("does not leave known English/technical leakage in pl copy", () => {
    const banned = [
      /Data & AI clarity/iu,
      /\brecent consistency\b/iu,
      /\binsight\b/iu,
      /\bendpoint\b/iu,
      /\bdevelopmentu\b/iu,
      /\bbackup\b/iu,
      /\bchat\b/iu,
    ];
    const skipNamespaces = new Set(["privacy", "terms"]);
    const offenders: string[] = [];

    for (const [namespace, keyMap] of Object.entries(locales.pl)) {
      if (skipNamespaces.has(namespace)) continue;

      for (const [key, value] of Object.entries(keyMap)) {
        if (/^https?:\/\//iu.test(value)) continue;
        for (const pattern of banned) {
          if (pattern.test(value)) {
            offenders.push(`${namespace}.${key}: ${value}`);
            break;
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("ensures deterministic defaultValue fallbacks map to existing locale keys", () => {
    const sourceFiles = listSourceFiles(SOURCE_ROOT);
    const missing: Array<{ file: string; ns: string; key: string }> = [];

    for (const filePath of sourceFiles) {
      const source = fs.readFileSync(filePath, "utf8");
      const defaultNamespace = inferDefaultNamespace(source);

      const optionsFallbackRegex =
        /\bt\(\s*(['"`])([^'"`]+)\1\s*,\s*\{([\s\S]{0,320}?)defaultValue\s*:/gu;

      for (const match of source.matchAll(optionsFallbackRegex)) {
        const rawKey = match[2] || "";
        const optionsSnippet = match[3] || "";
        if (!rawKey || rawKey.includes("${")) continue;

        let ns = "";
        let key = rawKey;
        if (rawKey.includes(":")) {
          const segments = rawKey.split(":");
          if (segments.length !== 2) continue;
          [ns, key] = segments;
        } else {
          const nsMatch = optionsSnippet.match(/\bns\s*:\s*['"`]([a-zA-Z0-9_-]+)['"`]/u);
          ns = nsMatch?.[1] ?? defaultNamespace ?? "";
        }

        if (!ns || !key || key.includes("${")) continue;

        const hasKey = hasLocaleKey(locales, ns, key);
        const usesCount = /\bcount\s*:/u.test(optionsSnippet);
        const hasPluralKey = usesCount && hasPluralLocaleKey(locales, ns, key);

        if (!hasKey && !hasPluralKey) {
          missing.push({
            file: path.relative(PROJECT_ROOT, filePath),
            ns,
            key,
          });
        }
      }

      const secondArgFallbackRegex =
        /\bt\(\s*(['"`])([a-zA-Z0-9_.-]+):([a-zA-Z0-9_.-]+)\1\s*,\s*(['"`])/gu;

      for (const match of source.matchAll(secondArgFallbackRegex)) {
        const ns = match[2] || "";
        const key = match[3] || "";
        if (!hasLocaleKey(locales, ns, key)) {
          missing.push({
            file: path.relative(PROJECT_ROOT, filePath),
            ns,
            key,
          });
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
