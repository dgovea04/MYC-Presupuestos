/**
 * Single source of truth for the external image hosts that `next/image` is
 * permitted to optimize.
 *
 * Local images served from `/public/...` are already covered by the
 * `localPatterns /**` entry in `next.config.ts` and do NOT need to be listed
 * here. Only hosts that resolve to a third-party CDN — currently the Google
 * user-content host used for OAuth profile pictures — belong in this list.
 *
 * Any new external host (e.g. a CDN for company logos, catalog imagery, or
 * future OAuth providers) MUST be added to `IMAGE_REMOTE_PATTERNS` so that
 * both the Next.js image config and the runtime `isAllowedRemoteImageUrl`
 * validator share the same policy. The companion tests in
 * `lib/image-allowlist.test.ts` will fail until the host is documented here.
 *
 * IMPORTANT: Keep this module pure and side-effect-free. `next.config.ts`
 * evaluates the imported constants at config-load time, so any `process.env`
 * reads or similar side effects would run at startup rather than at request
 * time.
 */

export type ImageRemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  pathname: string;
};

export const IMAGE_REMOTE_PATTERNS: readonly ImageRemotePattern[] = [
  {
    protocol: "https",
    hostname: "lh3.googleusercontent.com",
    pathname: "/**",
  },
] as const;

export const IMAGE_REMOTE_HOSTNAMES: readonly string[] = IMAGE_REMOTE_PATTERNS.map(
  (pattern) => pattern.hostname,
);

/**
 * Mirrors the subset of Next.js pathname semantics we rely on. A trailing
 * `/**` matches its prefix (empty for root) and any nested path under it;
 * any other sequence is treated as an exact match.
 */
function globToPathnameRegExp(pathname: string): RegExp {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (pathname.endsWith("/**")) {
    const prefix = pathname.slice(0, -3);
    // /** at the root: pathname always starts with `/`, so any string matches.
    if (!prefix) {
      return /^.*$/;
    }
    return new RegExp(`^${escape(prefix)}(/.*)?$`);
  }

  return new RegExp(`^${escape(pathname)}$`);
}

/**
 * Validates that a URL is safe to hand to `next/image` based on the entries
 * in `IMAGE_REMOTE_PATTERNS`. Use this in any future endpoint or input flow
 * that accepts a user-supplied image URL (avatar, company logo, gallery,
 * etc.) so the policy stays in lockstep with the Next.js config.
 */
export function isAllowedRemoteImageUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const protocol: ImageRemotePattern["protocol"] | null =
    parsed.protocol === "https:" ? "https" : parsed.protocol === "http:" ? "http" : null;

  if (!protocol) {
    return false;
  }

  return IMAGE_REMOTE_PATTERNS.some((pattern) => {
    if (pattern.hostname !== parsed.hostname) {
      return false;
    }
    if (pattern.protocol !== protocol) {
      return false;
    }
    return globToPathnameRegExp(pattern.pathname).test(parsed.pathname);
  });
}
