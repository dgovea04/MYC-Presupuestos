(function () {
  if (window.__MYCChatGPTBridgeContentLoaded) {
    return;
  }

  window.__MYCChatGPTBridgeContentLoaded = true;
  let activeManualRequestId = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function parseJsonSafely(text) {
    if (!text) return { valid: false, data: null, error: "Respuesta vacía" };

    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      return { valid: true, data: JSON.parse(clean), error: null };
    } catch (firstError) {
      const firstBrace = clean.indexOf("{");
      const lastBrace = clean.lastIndexOf("}");

      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const maybeJson = clean.slice(firstBrace, lastBrace + 1);
        try {
          return { valid: true, data: JSON.parse(maybeJson), error: null };
        } catch (secondError) {
          return { valid: false, data: null, error: secondError.message };
        }
      }

      return { valid: false, data: null, error: firstError.message };
    }
  }

  async function waitForPromptBox() {
    for (let i = 0; i < 80; i++) {
      const selectors = [
        "#prompt-textarea",
        "div[contenteditable='true'][id='prompt-textarea']",
        "textarea",
        "div[contenteditable='true']"
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }

      await sleep(250);
    }

    throw new Error("No se encontró el campo de prompt en ChatGPT.");
  }

  function setTextInPromptBox(element, text) {
    element.focus();

    if (element.tagName === "TEXTAREA") {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);

    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text
    }));
  }

  function findSendButton() {
    const selectors = [
      "button[data-testid='send-button']",
      "button[aria-label='Send prompt']",
      "button[aria-label='Send message']",
      "button[aria-label*='Send']"
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && !button.disabled) return button;
    }

    const buttons = [...document.querySelectorAll("button")];
    return buttons.find((button) => {
      const label = (button.getAttribute("aria-label") || "").toLowerCase();
      return label.includes("send") && !button.disabled;
    });
  }

  function isGenerating() {
    const buttons = [...document.querySelectorAll("button")];

    return buttons.some((button) => {
      const label = (button.getAttribute("aria-label") || "").toLowerCase();
      const testId = (button.getAttribute("data-testid") || "").toLowerCase();

      return (
        label.includes("stop") ||
        label.includes("detener") ||
        testId.includes("stop")
      );
    });
  }

  async function waitUntilGenerationStarts() {
    for (let i = 0; i < 30; i++) {
      if (isGenerating()) return true;
      await sleep(300);
    }
    return false;
  }

  async function waitUntilGenerationEnds() {
    await waitUntilGenerationStarts();

    for (let i = 0; i < 240; i++) {
      if (!isGenerating()) {
        await sleep(800);
        return true;
      }
      await sleep(500);
    }

    return false;
  }

  function getLastAssistantText() {
    const assistantMessages = [
      ...document.querySelectorAll("[data-message-author-role='assistant']")
    ];

    const last = assistantMessages[assistantMessages.length - 1];
    if (!last) return "";

    const codeBlocks = [...last.querySelectorAll("code")];
    if (codeBlocks.length) {
      return codeBlocks[codeBlocks.length - 1].innerText.trim();
    }

    return last.innerText.trim();
  }

  function findAssistantMessageFromCopyButton(button) {
    return button.closest("[data-message-author-role='assistant']");
  }

  function isCopyResponseButton(target) {
    const button = target?.closest?.("button");
    if (!button) return false;

    const label = [
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
      button.getAttribute("data-testid"),
      button.innerText
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!label.includes("copy") && !label.includes("copiar")) {
      return false;
    }

    return Boolean(findAssistantMessageFromCopyButton(button) || getLastAssistantText());
  }

  async function readCopiedResponse(button) {
    await sleep(350);

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText && clipboardText.trim()) return clipboardText.trim();
    } catch {}

    const assistantMessage = findAssistantMessageFromCopyButton(button);
    if (assistantMessage?.innerText?.trim()) {
      return assistantMessage.innerText.trim();
    }

    return getLastAssistantText();
  }

  function getBridgeState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "MYC_GET_STATE" }, (response) => {
        resolve(response?.state || {});
      });
    });
  }

  async function getPendingManualRequestId() {
    if (activeManualRequestId) {
      return activeManualRequestId;
    }

    const state = await getBridgeState();
    return state?.pendingManualRequestId || null;
  }

  async function sendCopiedResponse(raw, requestId) {
    const parsed = parseJsonSafely(raw);

    chrome.runtime.sendMessage({
      type: "MYC_CHATGPT_CLIPBOARD_RESPONSE",
      payload: {
        requestId,
        raw,
        jsonValid: parsed.valid,
        json: parsed.data,
        parseError: parsed.error,
        mode: "manual-copy"
      }
    });

    activeManualRequestId = null;
  }

  function buildPrompt(jsonPrompt, settings) {
    const strictJson = settings?.requireJson !== false && jsonPrompt?.output?.format === "json_only";

    const rules = [
      "Eres un asistente experto en presupuestos de construcción en Perú, APU, metrados, costos, rendimientos y fórmula polinómica.",
      "Ejecuta la tarea indicada en el INPUT JSON.",
      strictJson
        ? "Responde únicamente con JSON válido."
        : "Responde de forma clara, estructurada y profesional.",
      "Cuando la salida sea JSON-only, no uses markdown, bloques de código ni texto antes o después del JSON.",
      "No modifiques automáticamente ningún presupuesto; entrega resultados y recomendaciones para revisión.",
      "No fabriques precios exactos. Si falta información, declárala como supuesto o dato requerido.",
      "Toda recomendación debe ser revisada por una persona antes de aplicarse."
    ].join("\n");

    return [
      rules,
      "",
      "INPUT JSON:",
      JSON.stringify(jsonPrompt, null, 2)
    ].join("\n");
  }

  async function processPrompt(payload) {
    const promptBox = await waitForPromptBox();
    const finalPrompt = buildPrompt(payload.jsonPrompt, payload.settings);

    setTextInPromptBox(promptBox, finalPrompt);

    if (!payload.settings?.autoSend) {
      activeManualRequestId = payload.requestId;
      chrome.runtime.sendMessage({
        type: "MYC_CHATGPT_MANUAL_PROMPT_INSERTED",
        payload: {
          requestId: payload.requestId,
          message: "Prompt insertado en ChatGPT. Revisa y envía manualmente."
        }
      });
      return;
    }

    const sendButton = findSendButton();

    if (!sendButton) {
      throw new Error("No se encontró el botón de enviar en ChatGPT.");
    }

    sendButton.click();

    await waitUntilGenerationEnds();

    const raw = getLastAssistantText();
    const parsed = parseJsonSafely(raw);

    chrome.runtime.sendMessage({
      type: "MYC_CHATGPT_RESPONSE_READY",
      payload: {
        requestId: payload.requestId,
        raw,
        jsonValid: parsed.valid,
        json: parsed.data,
        parseError: parsed.error,
        mode: "auto"
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "MYC_BRIDGE_PING") {
      sendResponse({ ok: true });
      return;
    }

    if (message.type !== "MYC_INSERT_PROMPT_IN_CHATGPT") return;

    processPrompt(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        chrome.runtime.sendMessage({
          type: "MYC_CHATGPT_RESPONSE_READY",
          payload: {
            requestId: message.payload?.requestId,
            raw: "",
            jsonValid: false,
            json: null,
            parseError: error.message,
            mode: "error"
          }
        });

        sendResponse({ ok: false, error: error.message });
      });

    return true;
  });

  document.addEventListener("click", (event) => {
    if (!isCopyResponseButton(event.target)) {
      return;
    }

    const button = event.target.closest("button");
    getPendingManualRequestId()
      .then((requestId) => {
        if (!requestId) {
          return null;
        }

        return readCopiedResponse(button).then((raw) => ({ raw, requestId }));
      })
      .then((result) => {
        if (!result?.raw) {
          return;
        }

        sendCopiedResponse(result.raw, result.requestId);
      })
      .catch((error) => {
        const requestId = activeManualRequestId;
        chrome.runtime.sendMessage({
          type: "MYC_CHATGPT_CLIPBOARD_RESPONSE",
          payload: {
            requestId,
            raw: "",
            jsonValid: false,
            json: null,
            parseError: error.message,
            mode: "manual-copy-error"
          }
        });
      });
  }, true);

  document.addEventListener("copy", () => {
    getPendingManualRequestId()
      .then((requestId) => {
        if (!requestId) {
          return null;
        }

        return readCopiedResponse(document.activeElement).then((raw) => ({ raw, requestId }));
      })
      .then((raw) => {
        if (raw?.raw) {
          sendCopiedResponse(raw.raw, raw.requestId);
        }
      })
      .catch((error) => {
        chrome.runtime.sendMessage({
          type: "MYC_CHATGPT_CLIPBOARD_RESPONSE",
          payload: {
            requestId: activeManualRequestId,
            raw: "",
            jsonValid: false,
            json: null,
            parseError: error.message,
            mode: "manual-copy-error"
          }
        });
      });
  }, true);

  chrome.runtime.sendMessage({ type: "MYC_SET_TARGET_TAB" }).catch(() => {});
})();
