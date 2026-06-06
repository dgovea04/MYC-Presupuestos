/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  onMYCBridgeResponse,
  onMYCBridgeState,
  sendToMYCChatGPTBridge,
  type MYCBridgeResponse,
  type MYCBridgeState,
} from "@/lib/ai/myc-bridge-client";

describe("MYC ChatGPT bridge client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches a browser event with a request id, JSON prompt, and metadata", () => {
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener("MYCBridgeSendPrompt", listener);

    const requestId = sendToMYCChatGPTBridge(
      {
        accion: "generar_apu",
        partida: "Concreto armado",
        unidad: "m3",
      },
      { source: "myc-presupuestos", action: "apu" },
    );

    expect(requestId).toMatch(/^myc-\d+-[a-z0-9]+$/);
    expect(listener).toHaveBeenCalledTimes(1);

    const event = listener.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).detail).toEqual({
      requestId,
      jsonPrompt: {
        accion: "generar_apu",
        partida: "Concreto armado",
        unidad: "m3",
      },
      metadata: { source: "myc-presupuestos", action: "apu" },
    });

    window.removeEventListener("MYCBridgeSendPrompt", listener);
  });

  it("subscribes and unsubscribes from bridge responses", () => {
    const callback = vi.fn<(response: MYCBridgeResponse) => void>();
    const unsubscribe = onMYCBridgeResponse(callback);
    const response: MYCBridgeResponse = {
      requestId: "myc-1",
      raw: "{\"answer\":\"ok\"}",
      jsonValid: true,
      json: { answer: "ok" },
    };

    window.dispatchEvent(new CustomEvent("MYCBridgeResponse", { detail: response }));
    unsubscribe();
    window.dispatchEvent(new CustomEvent("MYCBridgeResponse", { detail: response }));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(response);
  });

  it("subscribes to bridge state updates", () => {
    const callback = vi.fn<(state: MYCBridgeState) => void>();
    const unsubscribe = onMYCBridgeState(callback);
    const state: MYCBridgeState = {
      mode: "auto",
      queueLength: 1,
      hasChatGPTTab: true,
      lastError: null,
    };

    window.dispatchEvent(new CustomEvent("MYCBridgeState", { detail: state }));
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(state);
  });
});
