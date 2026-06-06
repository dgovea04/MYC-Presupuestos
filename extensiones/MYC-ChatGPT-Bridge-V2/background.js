const DEFAULT_SETTINGS = {
  autoSend: false,
  requireJson: true,
  targetChatGPTTabId: null,
  status: "idle",
  lastError: null,
  lastResponse: null,
  pendingManualRequestId: null,
  queue: []
};

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function setState(patch) {
  await chrome.storage.local.set(patch);
  broadcastState();
}

async function broadcastState() {
  const state = await getState();

  chrome.runtime.sendMessage({
    type: "BRIDGE_STATE",
    payload: state
  }).catch(() => {});

  const tabs = await chrome.tabs.query({
    url: ["http://localhost/*", "http://127.0.0.1/*"]
  });

  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, {
      type: "BRIDGE_STATE",
      payload: state
    }).catch(() => {});
  }
}

async function findChatGPTTab() {
  const state = await getState();

  if (state.targetChatGPTTabId) {
    try {
      const existing = await chrome.tabs.get(state.targetChatGPTTabId);
      if (existing && existing.url && existing.url.startsWith("https://chatgpt.com")) {
        return existing;
      }
    } catch {}
  }

  const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
  if (!tabs.length) return null;

  await chrome.storage.local.set({ targetChatGPTTabId: tabs[0].id });
  return tabs[0];
}

async function ensureChatGPTContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "MYC_BRIDGE_PING" });
    return;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["chatgpt-content.js"]
      });
      await chrome.tabs.sendMessage(tabId, { type: "MYC_BRIDGE_PING" });
    } catch {
      throw new Error(
        "No se pudo conectar con la pestaña de ChatGPT. Recarga https://chatgpt.com/ y vuelve a intentarlo."
      );
    }
  }
}

function normalizePromptPayload(payload) {
  const requestId = payload?.requestId || `myc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    requestId,
    jsonPrompt: payload?.jsonPrompt ?? payload,
    metadata: {
      source: payload?.metadata?.source || "localhost",
      createdAt: new Date().toISOString(),
      ...payload?.metadata
    }
  };
}

async function sendNextPrompt() {
  const state = await getState();

  if (state.status === "processing" || state.status === "waiting_manual_copy") return;
  if (!state.queue.length) {
    await setState({ status: "idle" });
    return;
  }

  const chatTab = await findChatGPTTab();
  if (!chatTab) {
    await setState({
      status: "error",
      lastError: "No hay una pestaña abierta en https://chatgpt.com/"
    });
    return;
  }

  const [next, ...rest] = state.queue;

  await setState({
    status: "processing",
    queue: rest,
    lastError: null
  });

  try {
    await ensureChatGPTContentScript(chatTab.id);

    await chrome.tabs.sendMessage(chatTab.id, {
      type: "MYC_INSERT_PROMPT_IN_CHATGPT",
      payload: {
        ...next,
        settings: {
          autoSend: state.autoSend,
          requireJson: state.requireJson
        }
      }
    });
  } catch (error) {
    await setState({
      status: "error",
      lastError: `No se pudo enviar a ChatGPT: ${error.message}`
    });
  }
}

async function enqueuePrompt(payload) {
  const normalized = normalizePromptPayload(payload);
  const state = await getState();

  await setState({
    queue: [...state.queue, normalized],
    status: state.status === "processing" || state.status === "waiting_manual_copy" ? state.status : "queued",
    lastError: null
  });

  await sendNextPrompt();

  return normalized.requestId;
}

async function sendResponseToLocalhost(payload) {
  const tabs = await chrome.tabs.query({
    url: ["http://localhost/*", "http://127.0.0.1/*"]
  });

  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, {
      type: "MYC_CHATGPT_RESPONSE",
      payload
    }).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...current });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.targetChatGPTTabId === tabId) {
    await setState({ targetChatGPTTabId: null });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "MYC_PROMPT_FROM_LOCALHOST") {
      const requestId = await enqueuePrompt(message.payload);
      sendResponse({ ok: true, requestId });
      return;
    }

    if (message.type === "MYC_CHATGPT_RESPONSE_READY") {
      const payload = {
        ...message.payload,
        receivedAt: new Date().toISOString()
      };

      await setState({
        status: "completed",
        lastResponse: payload,
        pendingManualRequestId: null,
        lastError: payload?.jsonValid === false ? "La respuesta no parece JSON válido." : null
      });

      await sendResponseToLocalhost(payload);

      setTimeout(() => {
        sendNextPrompt();
      }, 500);

      sendResponse({ ok: true });
      return;
    }

    if (message.type === "MYC_CHATGPT_MANUAL_PROMPT_INSERTED") {
      await setState({
        status: "waiting_manual_copy",
        pendingManualRequestId: message.payload?.requestId || null,
        lastError: null
      });

      sendResponse({ ok: true });
      return;
    }

    if (message.type === "MYC_CHATGPT_CLIPBOARD_RESPONSE") {
      const payload = {
        ...message.payload,
        receivedAt: new Date().toISOString()
      };

      await setState({
        status: "completed",
        lastResponse: payload,
        pendingManualRequestId: null,
        lastError: null
      });

      await sendResponseToLocalhost(payload);

      setTimeout(() => {
        sendNextPrompt();
      }, 500);

      sendResponse({ ok: true });
      return;
    }

    if (message.type === "MYC_GET_STATE") {
      sendResponse({ ok: true, state: await getState() });
      return;
    }

    if (message.type === "MYC_UPDATE_SETTINGS") {
      await setState(message.payload || {});
      sendResponse({ ok: true, state: await getState() });
      return;
    }

    if (message.type === "MYC_CLEAR_QUEUE") {
      await setState({ queue: [], status: "idle", lastError: null });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "MYC_SET_TARGET_TAB") {
      await setState({ targetChatGPTTabId: sender?.tab?.id || null });
      sendResponse({ ok: true });
      return;
    }
  })();

  return true;
});
