import fs from "fs";
import path from "path";

type FlatMap = Record<string, string>;

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const LOCALES_ROOT = path.join(SOURCE_ROOT, "locales");
const EN_LOCALES = path.join(LOCALES_ROOT, "en");
const PL_LOCALES = path.join(LOCALES_ROOT, "pl");
const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"] as const;
const REQUIRED_PLURAL_SUFFIXES = {
  en: ["one", "other"],
  pl: ["one", "few", "many", "other"],
} as const;

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

function splitPluralKey(key: string): { base: string; suffix: string } | null {
  for (const suffix of PLURAL_SUFFIXES) {
    const marker = `_${suffix}`;
    if (key.endsWith(marker)) {
      return {
        base: key.slice(0, -marker.length),
        suffix,
      };
    }
  }
  return null;
}

function normalizePluralKeys(keyMap: FlatMap): string[] {
  return Array.from(
    new Set(
      Object.keys(keyMap).map((key) => splitPluralKey(key)?.base ?? key),
    ),
  ).sort();
}

function listPluralGroupGaps(
  namespace: string,
  locale: keyof typeof REQUIRED_PLURAL_SUFFIXES,
  keyMap: FlatMap,
): string[] {
  const groups = new Map<string, Set<string>>();
  for (const key of Object.keys(keyMap)) {
    const pluralKey = splitPluralKey(key);
    if (!pluralKey) continue;

    const suffixes = groups.get(pluralKey.base) ?? new Set<string>();
    suffixes.add(pluralKey.suffix);
    groups.set(pluralKey.base, suffixes);
  }

  const gaps: string[] = [];
  for (const [base, suffixes] of groups) {
    for (const requiredSuffix of REQUIRED_PLURAL_SUFFIXES[locale]) {
      if (!suffixes.has(requiredSuffix)) {
        gaps.push(`${locale}.${namespace}.${base}_${requiredSuffix}`);
      }
    }
  }
  return gaps;
}

function hasLocalePluralGroup(
  localeMap: Record<string, FlatMap>,
  ns: string,
  key: string,
): boolean {
  return PLURAL_SUFFIXES.some(
    (suffix) => localeMap[ns]?.[`${key}_${suffix}`] !== undefined,
  );
}

function hasPluralLocaleKey(
  locales: Record<string, Record<string, FlatMap>>,
  ns: string,
  key: string,
): boolean {
  return (
    hasLocalePluralGroup(locales.en, ns, key) &&
    hasLocalePluralGroup(locales.pl, ns, key)
  );
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
    const pluralGaps: string[] = [];

    for (const namespace of Object.keys(locales.en)) {
      const enMap = locales.en[namespace] || {};
      const plMap = locales.pl[namespace] || {};
      const enKeys = normalizePluralKeys(enMap);
      const plKeys = normalizePluralKeys(plMap);
      expect(plKeys).toEqual(enKeys);

      pluralGaps.push(
        ...listPluralGroupGaps(namespace, "en", enMap),
        ...listPluralGroupGaps(namespace, "pl", plMap),
      );
    }

    expect(pluralGaps).toEqual([]);
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
        const usesCount = /\bcount\s*(?::|,)/u.test(optionsSnippet);
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
