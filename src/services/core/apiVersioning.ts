import { getRuntimeConfig } from "@/services/core/runtimeConfig";

const DEFAULT_API_VERSION = "v1";
const API_VERSION_PREFIXES = ["/api/v1", "/api/v2"] as const;

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function hasApiVersionPrefix(path: string): boolean {
  return API_VERSION_PREFIXES.some(
    (prefix) =>
      path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
  );
}

function replaceApiVersionPrefix(path: string, nextPrefix: string): string {
  for (const prefix of API_VERSION_PREFIXES) {
    if (path === prefix) {
      return nextPrefix;
    }

    if (path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) {
      return `${nextPrefix}${path.slice(prefix.length)}`;
    }
  }

  return `${nextPrefix}${path}`;
}

// Changing API_VERSION affects only callers that still rely on withVersion().
export const API_VERSION =
  getRuntimeConfig().apiVersion.trim() || DEFAULT_API_VERSION;

export function withVersion(path: string): string {
  const normalizedPath = normalizePath(path);
  const versionPrefix = `/api/${API_VERSION}`;

  if (hasApiVersionPrefix(normalizedPath)) {
    return normalizedPath;
  }

  return `${versionPrefix}${normalizedPath}`;
}

export function withV2(path: string): string {
  return replaceApiVersionPrefix(normalizePath(path), "/api/v2");
}
