/**
 * Server-side gate for capabilities that require a process or service on the
 * user's machine (Ollama, SQL Server or sqlcmd).
 *
 * Never use NEXT_PUBLIC_* here: a public browser variable must not be able to
 * enable server-side access to local resources in a Vercel deployment.
 */
export function isLocalServerRuntimeEnabled() {
  const explicitFlag = process.env.MYC_ENABLE_LOCAL_SERVICES;

  if (explicitFlag === "true") return true;
  if (explicitFlag === "false") return false;

  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

/**
 * Client-side gate used only to decide which local controls are rendered. The
 * public mirror lets a future desktop shell keep its UI aligned with the
 * server-side opt-in without exposing server credentials.
 */
export function isLocalClientRuntimeEnabled() {
  const explicitFlag = process.env.NEXT_PUBLIC_ENABLE_LOCAL_SERVICES;

  if (explicitFlag === "true") return true;
  if (explicitFlag === "false") return false;

  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

/**
 * Backwards-compatible alias for server modules. New code should choose the
 * explicit server/client helper based on where it runs.
 */
export const isLocalRuntimeEnabled = isLocalServerRuntimeEnabled;
