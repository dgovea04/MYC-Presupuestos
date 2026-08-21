export type AnalyticsEnvironment = {
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
  DEPLOYMENT_TARGET?: string;
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export function isExternalAnalyticsEnabled(environment: AnalyticsEnvironment = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  DEPLOYMENT_TARGET: process.env.DEPLOYMENT_TARGET,
}): boolean {
  const measurementId = environment.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const appUrl = environment.NEXT_PUBLIC_APP_URL?.trim();
  const deploymentTarget = environment.DEPLOYMENT_TARGET?.trim().toLowerCase();

  if (!measurementId || deploymentTarget !== "production" || !appUrl) {
    return false;
  }

  try {
    const parsed = new URL(appUrl);
    return parsed.protocol === "https:" && !LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
