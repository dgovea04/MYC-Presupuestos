const autoSend = document.getElementById("autoSend");
const requireJson = document.getElementById("requireJson");
const statusBadge = document.getElementById("statusBadge");
const queueCount = document.getElementById("queueCount");
const lastResponse = document.getElementById("lastResponse");
const errorBox = document.getElementById("errorBox");
const lastError = document.getElementById("lastError");
const clearQueue = document.getElementById("clearQueue");

function renderState(state) {
  autoSend.checked = Boolean(state.autoSend);
  requireJson.checked = Boolean(state.requireJson);

  statusBadge.textContent = state.status || "idle";
  statusBadge.className = `badge ${state.status || "idle"}`;

  queueCount.textContent = String(state.queue?.length || 0);

  if (state.lastResponse) {
    lastResponse.textContent = JSON.stringify(state.lastResponse, null, 2);
  } else {
    lastResponse.textContent = "Sin respuesta todavía.";
  }

  if (state.lastError) {
    errorBox.hidden = false;
    lastError.textContent = state.lastError;
  } else {
    errorBox.hidden = true;
    lastError.textContent = "";
  }
}

function updateSettings(patch) {
  chrome.runtime.sendMessage({
    type: "MYC_UPDATE_SETTINGS",
    payload: patch
  }, (response) => {
    if (response?.ok) renderState(response.state);
  });
}

chrome.runtime.sendMessage({ type: "MYC_GET_STATE" }, (response) => {
  if (response?.ok) renderState(response.state);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "BRIDGE_STATE") {
    renderState(message.payload);
  }
});

autoSend.addEventListener("change", () => {
  updateSettings({ autoSend: autoSend.checked });
});

requireJson.addEventListener("change", () => {
  updateSettings({ requireJson: requireJson.checked });
});

clearQueue.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "MYC_CLEAR_QUEUE" });
});
