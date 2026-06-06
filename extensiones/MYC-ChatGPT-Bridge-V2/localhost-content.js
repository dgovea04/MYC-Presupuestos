(function () {
  function emitToPage(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  window.addEventListener("EnviarPromptAExtension", (event) => {
    chrome.runtime.sendMessage({
      type: "MYC_PROMPT_FROM_LOCALHOST",
      payload: event.detail
    }, (response) => {
      emitToPage("MYCBridgePromptAccepted", response || { ok: false });
    });
  });

  window.addEventListener("MYCBridgeSendPrompt", (event) => {
    chrome.runtime.sendMessage({
      type: "MYC_PROMPT_FROM_LOCALHOST",
      payload: event.detail
    }, (response) => {
      emitToPage("MYCBridgePromptAccepted", response || { ok: false });
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MYC_CHATGPT_RESPONSE") {
      emitToPage("RespuestaDesdeChatGPT", message.payload);
      emitToPage("MYCBridgeResponse", message.payload);
    }

    if (message.type === "BRIDGE_STATE") {
      emitToPage("MYCBridgeState", message.payload);
    }
  });

  chrome.runtime.sendMessage({ type: "MYC_GET_STATE" }, (response) => {
    if (response?.ok) {
      emitToPage("MYCBridgeState", response.state);
    }
  });

  window.MYCChatGPTBridge = {
    send(jsonPrompt, metadata = {}) {
      const requestId = `myc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      window.dispatchEvent(new CustomEvent("MYCBridgeSendPrompt", {
        detail: {
          requestId,
          jsonPrompt,
          metadata
        }
      }));

      return requestId;
    }
  };
})();
