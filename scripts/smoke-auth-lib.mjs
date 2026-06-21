import crypto from "node:crypto";

const DEFAULT_FIREBASE_AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const EXACT_SHA_PATTERN = /^[0-9a-fA-F]{40}$/;

function getRequiredEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getSmokeApiBaseUrl() {
  return (process.env.SMOKE_API_BASE_URL || "https://fitaly-backend-smoke.up.railway.app").trim().replace(/\/$/, "");
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response for HTTP ${response.status}; response body redacted.`);
  }
}

export async function callPublicJson(pathname) {
  const baseUrl = getSmokeApiBaseUrl();
  const url = `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await parseJson(response);

  return {
    payload,
    response,
    url,
  };
}

export async function verifySmokeRuntimeBackendSha() {
  const expectedSha = getRequiredEnv("EXPECTED_BACKEND_COMMIT_SHA");
  if (!EXACT_SHA_PATTERN.test(expectedSha)) {
    throw new Error("EXPECTED_BACKEND_COMMIT_SHA must be an exact 40-character commit SHA.");
  }

  const result = await callPublicJson("/api/v1/version");
  if (!result.response.ok) {
    throw new Error(smokeResponseError("Smoke backend version check", result));
  }

  const actualSha = String(result.payload?.commitSha || "").trim();
  if (!actualSha) {
    throw new Error("Smoke backend version check failed: /api/v1/version did not return commitSha.");
  }
  if (actualSha !== expectedSha) {
    throw new Error(
      `Smoke backend version check failed: expected commitSha=${expectedSha} but got commitSha=${actualSha}.`,
    );
  }

  return {
    endpoint: smokeEndpoint(result.url),
    expectedCommitSha: expectedSha,
    commitSha: actualSha,
    status: result.response.status,
    verified: true,
  };
}

function structuredErrorCode(payload) {
  const candidates = [
    payload?.detail,
    payload?.code,
    payload?.error?.code,
    payload?.error?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^[A-Z0-9_:-]{2,80}$/.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function smokeUserRef(localId) {
  const value = String(localId || "").trim();
  if (!value) {
    return null;
  }

  const digest = crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
  return `smoke-user-${digest}`;
}

export function smokeEndpoint(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "unknown-endpoint";
  }
}

export function smokeResponseError(label, { response, url, payload, expectedStatus = null }) {
  const status = response?.status ?? "unknown";
  const endpoint = smokeEndpoint(url);
  const expected = expectedStatus ? ` expected=${expectedStatus}` : "";
  const code = structuredErrorCode(payload);
  const codeSuffix = code ? ` code=${code}` : "";

  return `${label} failed status=${status}${expected} endpoint=${endpoint}${codeSuffix}; response body redacted.`;
}

export async function signInSmokeUser({
  emailEnvName = "SMOKE_EXPORT_TEST_EMAIL",
  passwordEnvName = "SMOKE_EXPORT_TEST_PASSWORD",
} = {}) {
  const apiKey = getRequiredEnv("FIREBASE_WEB_API_KEY");
  const email = getRequiredEnv(emailEnvName);
  const password = getRequiredEnv(passwordEnvName);
  const authBaseUrl = (process.env.FIREBASE_AUTH_BASE_URL || DEFAULT_FIREBASE_AUTH_BASE_URL).trim();

  const response = await fetch(
    `${authBaseUrl}/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(smokeResponseError("Firebase sign-in", {
      response,
      url: `${authBaseUrl}/accounts:signInWithPassword`,
      payload,
    }));
  }

  const idToken = String(payload?.idToken || "").trim();
  if (!idToken) {
    throw new Error("Firebase sign-in succeeded but no idToken was returned.");
  }

  return {
    localId: String(payload?.localId || "").trim(),
    smokeUserRef: smokeUserRef(payload?.localId),
    idToken,
  };
}

export async function callAuthenticatedJson(
  pathname,
  {
    method = "GET",
    body = null,
    emailEnvName = "SMOKE_EXPORT_TEST_EMAIL",
    passwordEnvName = "SMOKE_EXPORT_TEST_PASSWORD",
  } = {},
) {
  const smokeApiBaseUrl = getSmokeApiBaseUrl();
  const { idToken, localId, smokeUserRef } = await signInSmokeUser({
    emailEnvName,
    passwordEnvName,
  });
  const url = `${smokeApiBaseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : null,
  });

  const payload = await parseJson(response);
  return {
    localId,
    method,
    payload,
    response,
    smokeUserRef,
    url,
  };
}
