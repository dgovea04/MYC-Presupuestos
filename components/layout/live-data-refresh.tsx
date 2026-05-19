"use client";

import { startTransition, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAppDataChangeEventName, getAppDataChangeStorageKey, type AppDataChangePayload } from "@/lib/client/live-updates";

const LIVE_REFRESH_DEBOUNCE_MS = 180;

export function LiveDataRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const lastHandledAtRef = useRef(0);
  const lastRefreshAtRef = useRef(0);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<AppDataChangePayload | null>(null);

  useEffect(() => {
    function clearRefreshTimeout() {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    }

    function flushRefresh() {
      const payload = pendingPayloadRef.current;
      if (!payload) return;
      if (payload.occurredAt <= lastRefreshAtRef.current) return;

      pendingPayloadRef.current = null;
      lastRefreshAtRef.current = payload.occurredAt;

      startTransition(() => {
        router.refresh();
      });
    }

    function scheduleRefresh() {
      clearRefreshTimeout();
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        flushRefresh();
      }, LIVE_REFRESH_DEBOUNCE_MS);
    }

    function maybeRefresh(payload: AppDataChangePayload | null, options?: { immediate?: boolean; isLocalEvent?: boolean }) {
      if (!payload) return;
      if (payload.occurredAt <= lastHandledAtRef.current) return;
      if (!payload.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return;
      if (options?.isLocalEvent && payload.locallyHandledPaths?.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
        lastHandledAtRef.current = payload.occurredAt;
        return;
      }

      lastHandledAtRef.current = payload.occurredAt;
      pendingPayloadRef.current = payload;

      if (document.visibilityState !== "visible" && !options?.immediate) {
        return;
      }

      if (options?.immediate) {
        clearRefreshTimeout();
        flushRefresh();
        return;
      }

      scheduleRefresh();
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
      maybeRefresh((event as CustomEvent<AppDataChangePayload>).detail, { isLocalEvent: true });
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== getAppDataChangeStorageKey() || !event.newValue) return;

      try {
        maybeRefresh(JSON.parse(event.newValue) as AppDataChangePayload);
      } catch {}
    }

    function handleVisibilityOrFocus() {
      if (document.visibilityState !== "visible") return;
      maybeRefresh(readStoragePayload(), { immediate: true });
    }

    window.addEventListener(getAppDataChangeEventName(), handleCustomEvent as EventListener);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pageshow", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    handleVisibilityOrFocus();

    return () => {
      clearRefreshTimeout();
      window.removeEventListener(getAppDataChangeEventName(), handleCustomEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pageshow", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [pathname, router]);

  return null;
}
