import { getPlatformRuntime } from "@/lib/platform/runtime";

export function getPlatformCapabilities() {
  const runtime = getPlatformRuntime();
  return {
    runtime,
    supportsNativeNotifications: runtime === "desktop",
    supportsLocalFileOpen: runtime === "desktop",
    supportsLargeFileBridge: runtime === "desktop",
  } as const;
}
