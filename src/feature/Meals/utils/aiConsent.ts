export function hasActiveMealAiConsent(aiConsent: unknown): boolean {
  if (!aiConsent || typeof aiConsent !== "object") {
    return false;
  }

  const candidate = aiConsent as {
    status?: unknown;
    grantedAt?: unknown;
    revokedAt?: unknown;
  };

  return (
    candidate.status === "granted" &&
    Boolean(candidate.grantedAt) &&
    candidate.revokedAt === null
  );
}
