/**
 * Helper opcional para tu app Next.js.
 * Puedes copiar este archivo a /lib/myc-bridge-client.ts o usarlo como referencia.
 */

export function sendToMYCChatGPTBridge(jsonPrompt, metadata = {}) {
  if (typeof window === "undefined") {
    throw new Error("MYC ChatGPT Bridge solo funciona en el navegador.");
  }

  const requestId = `myc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.dispatchEvent(
    new CustomEvent("MYCBridgeSendPrompt", {
      detail: {
        requestId,
        jsonPrompt,
        metadata
      }
    })
  );

  return requestId;
}

export function onMYCBridgeResponse(callback) {
  if (typeof window === "undefined") return () => {};

  const handler = (event) => callback(event.detail);

  window.addEventListener("MYCBridgeResponse", handler);

  return () => {
    window.removeEventListener("MYCBridgeResponse", handler);
  };
}

export function onMYCBridgeState(callback) {
  if (typeof window === "undefined") return () => {};

  const handler = (event) => callback(event.detail);

  window.addEventListener("MYCBridgeState", handler);

  return () => {
    window.removeEventListener("MYCBridgeState", handler);
  };
}
