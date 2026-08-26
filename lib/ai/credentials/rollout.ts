export function isScopedAiResolverEnabled() {
  return readBooleanFlag(process.env.AI_SCOPED_RESOLVER_ENABLED, process.env.NODE_ENV === "production");
}

export function isLegacyAiCredentialFallbackEnabled() {
  return readBooleanFlag(process.env.AI_LEGACY_CREDENTIAL_FALLBACK, true);
}

function readBooleanFlag(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}
