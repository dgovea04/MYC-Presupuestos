export function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return { configured: false, authorized: false };
  }

  const querySecret = new URL(request.url).searchParams.get("secret");
  const authorization = request.headers.get("Authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  return {
    configured: true,
    authorized: bearerToken === secret || querySecret === secret,
  };
}
