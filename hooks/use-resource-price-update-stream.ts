"use client";

import { useEffect, useState } from "react";
import type { ResourcePriceRequestSummary, ResourcePriceStreamEvent } from "@/types/resource-pricing";

type StreamMode = "idle" | "sse" | "polling";

type UseResourcePriceUpdateStreamResult = {
  mode: StreamMode;
  event: ResourcePriceStreamEvent | null;
  request: ResourcePriceRequestSummary | null;
};

const terminalStatuses = new Set<ResourcePriceRequestSummary["status"]>([
  "PREVIEW_READY",
  "APPLIED",
  "REJECTED",
  "FAILED",
  "CANCELED",
]);

export function useResourcePriceUpdateStream(
  requestId: string | null,
  options: { enabled?: boolean } = {},
): UseResourcePriceUpdateStreamResult {
  const enabled = options.enabled ?? true;
  const [mode, setMode] = useState<StreamMode>("idle");
  const [event, setEvent] = useState<ResourcePriceStreamEvent | null>(null);
  const [request, setRequest] = useState<ResourcePriceRequestSummary | null>(null);

  useEffect(() => {
    if (!enabled || !requestId) {
      return;
    }

    let disposed = false;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;
    let source: EventSource | null = null;

    const readRequest = async () => {
      try {
        const response = await fetch(`/api/resources/price-updates/${requestId}`, { cache: "no-store" });
        if (!response.ok || disposed) return;
        const payload = (await response.json()) as { request?: ResourcePriceRequestSummary };
        if (payload.request) {
          setRequest(payload.request);
          if (terminalStatuses.has(payload.request.status)) {
            if (pollingTimer) clearInterval(pollingTimer);
            source?.close();
          }
        }
      } catch {
        // El estado persistido se conserva; el siguiente ciclo puede recuperarlo.
      }
    };

    const startPolling = () => {
      if (disposed || pollingTimer) return;
      setMode("polling");
      void readRequest();
      pollingTimer = setInterval(() => void readRequest(), 2500);
    };

    if (typeof EventSource === "undefined") {
      startPolling();
    } else {
      source = new EventSource(`/api/resources/price-updates/${requestId}/stream`);
      source.onmessage = (message) => {
        if (disposed) return;
        try {
          const nextEvent = JSON.parse(message.data) as ResourcePriceStreamEvent | { type: "connected" | "ping"; requestId: string };
          if (nextEvent.type === "connected" || nextEvent.type === "ping") return;
          const resourceEvent = nextEvent as ResourcePriceStreamEvent;
          setEvent(resourceEvent);
          if (resourceEvent.type === "preview.ready" || resourceEvent.type === "request.failed" || resourceEvent.type === "request.applied") {
            void readRequest();
          }
        } catch {
          startPolling();
        }
      };
      source.onerror = () => {
        source?.close();
        startPolling();
      };
      void readRequest();
    }

    return () => {
      disposed = true;
      source?.close();
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, [enabled, requestId]);

  const effectiveMode = mode === "idle" && typeof EventSource !== "undefined" ? "sse" : mode;

  return {
    mode: enabled && requestId ? effectiveMode : "idle",
    event: enabled && requestId ? event : null,
    request: enabled && requestId ? request : null,
  };
}
