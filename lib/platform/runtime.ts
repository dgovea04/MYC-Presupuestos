export type PlatformRuntime = "web" | "desktop";

export function getPlatformRuntime(): PlatformRuntime {
  return process.env.NEXT_PUBLIC_PLATFORM_RUNTIME === "desktop" ? "desktop" : "web";
}
