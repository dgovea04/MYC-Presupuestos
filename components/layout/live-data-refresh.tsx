"use client";

import { startTransition, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAppDataChangeEventName, getAppDataChangeStorageKey, type AppDataChangePayload } from "@/lib/client/live-updates";

export function LiveDataRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const lastHandledAtRef = useRef(0);

  useEffect(() => {
    function maybeRefresh(payload: AppDataChangePayload | null) {
      if (!payload) return;
      if (payload.occurredAt <= lastHandledAtRef.current) return;
      if (!payload.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return;

      lastHandledAtRef.current = payload.occurredAt;
      startTransition(() => {
        router.refresh();
      });
    }

    function readStoragePayload() {
      try {
        const raw = localStorage.getItem(getAppDataChangeStorageKey());
        return raw ? (JSON.parse(raw) as AppDataChangePayload) : null;
      } catch {
        return null;
      }
    }

    function handleCustomEvent(event: Event) {
      maybeRefresh((event as CustomEvent<AppDataChangePayload>).detail);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== getAppDataChangeStorageKey() || !event.newValue) return;

      try {
        maybeRefresh(JSON.parse(event.newValue) as AppDataChangePayload);
      } catch {}
    }

    function handleVisibilityOrFocus() {
      maybeRefresh(readStoragePayload());
    }

    window.addEventListener(getAppDataChangeEventName(), handleCustomEvent as EventListener);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pageshow", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    handleVisibilityOrFocus();

    return () => {
      window.removeEventListener(getAppDataChangeEventName(), handleCustomEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pageshow", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [pathname, router]);

  return null;
}
