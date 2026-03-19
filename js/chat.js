const DEFAULT_BACKEND_URL = "http://localhost:8000";
const DEMO_RESPONSE_URL = "demo-response.txt";
const STREAM_LINE_DELAY_MS = 420;
const STORAGE_KEYS = {
  modelKey: "am_model_key",
  ccdcKey: "am_ccdc_key",
  backendUrl: "am_backend_url",
  storageMode: "am_storage_mode",
};

const chatMessagesEl = document.getElementById("chatMessages");
const chatFormEl = document.getElementById("chatForm");
const messageInputEl = document.getElementById("messageInput");
const sendBtnEl = document.getElementById("sendBtn");
const clearBtnEl = document.getElementById("clearBtn");
const backBtnEl = document.getElementById("backBtn");
const exportBtnEl = document.getElementById("exportBtn");
const statusTextEl = document.getElementById("statusText");
const stopBtnEl = document.getElementById("stopBtn");
const modelTextEl = document.getElementById("modelText");
const ccdcTextEl = document.getElementById("ccdcText");

let activeAbortController = null;

initChatPage();

function initChatPage() {
  const credentials = readCredentials();
  const hasModelKey = Boolean(credentials.modelKey);

  modelTextEl.textContent = hasModelKey ? maskKey(credentials.modelKey) : "Demo mode";
  ccdcTextEl.textContent = credentials.ccdcKey ? "Enabled" : hasModelKey ? "Disabled" : "Not needed";

  autoResizeTextarea();

  chatFormEl.addEventListener("submit", handleSendMessage);
  clearBtnEl.addEventListener("click", clearChatMessages);
  backBtnEl.addEventListener("click", goBackToLogin);
  exportBtnEl.addEventListener("click", exportChat);
  stopBtnEl.addEventListener("click", stopCurrentRequest);

  messageInputEl.addEventListener("input", autoResizeTextarea);
  messageInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatFormEl.requestSubmit();
    }
  });

  setLoadingState(false, hasModelKey ? "Ready" : "Demo mode ready.");
}

function getStorage(mode) {
  return mode === "session" ? sessionStorage : localStorage;
}

function readCredentials() {
  const mode =
    sessionStorage.getItem(STORAGE_KEYS.storageMode) ||
    localStorage.getItem(STORAGE_KEYS.storageMode) ||
    "session";
  const store = getStorage(mode);

  return {
    modelKey: store.getItem(STORAGE_KEYS.modelKey) || "",
    ccdcKey: store.getItem(STORAGE_KEYS.ccdcKey) || "",
    backendUrl: (store.getItem(STORAGE_KEYS.backendUrl) || DEFAULT_BACKEND_URL).replace(/\/+$/, ""),
  };
}

function maskKey(value) {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function handleSendMessage(event) {
  event.preventDefault();

  const userMessage = messageInputEl.value.trim();
  if (!userMessage || activeAbortController) {
    return;
  }

  appendMessage("user", userMessage);
  messageInputEl.value = "";
  autoResizeTextarea();
  setLoadingState(true);

  const assistantTextEl = appendMessage("assistant", "");
  let finalStatus = "Ready";
  activeAbortController = new AbortController();
  assistantTextEl.classList.add("is-streaming");

  try {
    const replyText = await getAssistantReply(userMessage, activeAbortController.signal);
    await streamAssistantReply(assistantTextEl, replyText, activeAbortController.signal);

    if (!assistantTextEl.textContent.trim()) {
      assistantTextEl.textContent = "No response received.";
    }

    finalStatus = "Reply completed.";
  } catch (error) {
    if (error.name === "AbortError") {
      if (!assistantTextEl.textContent.trim()) {
        assistantTextEl.textContent = "Request stopped.";
      }
      finalStatus = "Reply stopped.";
    } else {
      console.error("Chat request failed:", error);
      assistantTextEl.textContent = "Failed to get response from server.";
      finalStatus = "Response failed.";
    }
  } finally {
    assistantTextEl.classList.remove("is-streaming");
    activeAbortController = null;
    setLoadingState(false, finalStatus);
    scrollToBottom();
  }
}

async function getAssistantReply(message, signal) {
  const credentials = readCredentials();

  if (credentials.modelKey) {
    try {
      return await sendMessageToBackend(message, credentials, signal);
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }

      console.error("Backend failed, falling back to demo response:", error);
      statusTextEl.textContent = "Backend unavailable. Using demo response...";
    }
  }

  return loadDemoResponse(signal);
}

async function sendMessageToBackend(message, credentials, signal) {

  const response = await fetch(`${credentials.backendUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      model_api_key: credentials.modelKey,
      ccdc_api_key: credentials.ccdcKey,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();
  return data.reply || data.response || "";
}

async function loadDemoResponse(signal) {
  const response = await fetch(DEMO_RESPONSE_URL, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load demo response: ${response.status}`);
  }

  return response.text();
}

async function streamAssistantReply(textEl, fullText, signal) {
  const lines = String(fullText || "").replace(/\r\n/g, "\n").split("\n");
  textEl.textContent = "";

  for (let index = 0; index < lines.length; index += 1) {
    throwIfAborted(signal);

    if (index > 0) {
      textEl.textContent += "\n";
    }

    textEl.textContent += lines[index];
    statusTextEl.textContent = `Assistant is replying... ${index + 1}/${lines.length}`;
    scrollToBottom();

    if (index < lines.length - 1) {
      await delay(STREAM_LINE_DELAY_MS, signal);
    }
  }
}

function appendMessage(role, text) {
  const rowEl = document.createElement("div");
  rowEl.className = role === "user" ? "row row-user" : "row row-assistant";

  if (role === "assistant") {
    const avatarEl = document.createElement("div");
    avatarEl.className = "avatar";
    rowEl.appendChild(avatarEl);
  }

  const bubbleEl = document.createElement("div");
  bubbleEl.className = role === "user" ? "bubble bubble-user" : "bubble bubble-assistant";

  if (role === "assistant") {
    const toolbarEl = document.createElement("div");
    toolbarEl.className = "bubble-toolbar";

    const textEl = document.createElement("div");
    textEl.className = "bubble-meta";
    textEl.textContent = text;

    const copyBtnEl = document.createElement("button");
    copyBtnEl.className = "more-btn";
    copyBtnEl.type = "button";
    copyBtnEl.textContent = "Copy";
    copyBtnEl.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(textEl.textContent);
        statusTextEl.textContent = "Assistant message copied.";
      } catch (error) {
        console.error("Copy failed:", error);
        statusTextEl.textContent = "Copy failed.";
      }
    });

    toolbarEl.appendChild(textEl);
    toolbarEl.appendChild(copyBtnEl);
    bubbleEl.appendChild(toolbarEl);
    rowEl.appendChild(bubbleEl);
    chatMessagesEl.appendChild(rowEl);
    scrollToBottom();
    return textEl;
  }

  bubbleEl.textContent = text;
  rowEl.appendChild(bubbleEl);
  chatMessagesEl.appendChild(rowEl);
  scrollToBottom();
  return bubbleEl;
}

function setLoadingState(isLoading, statusText) {
  sendBtnEl.disabled = isLoading;
  messageInputEl.disabled = isLoading;
  clearBtnEl.disabled = isLoading;
  stopBtnEl.disabled = !isLoading;
  statusTextEl.textContent = statusText || (isLoading ? "Assistant is replying..." : "Ready");
}

function clearChatMessages() {
  chatMessagesEl.innerHTML = `
    <div class="row row-assistant">
      <div class="avatar"></div>
      <div class="bubble bubble-assistant">
        Chat cleared. Ask another question to replay the streaming demo.
      </div>
    </div>
  `;
  statusTextEl.textContent = "Chat cleared.";
}

function exportChat() {
  const transcript = Array.from(chatMessagesEl.querySelectorAll(".row"))
    .map((rowEl) => {
      const role = rowEl.classList.contains("row-user") ? "User" : "Assistant";
      const assistantTextEl = rowEl.querySelector(".bubble-meta");
      const userTextEl = rowEl.querySelector(".bubble");
      const text = (assistantTextEl?.textContent || userTextEl?.textContent || "").trim();
      return `${role}: ${text}`;
    })
    .join("\n\n");

  const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const linkEl = document.createElement("a");
  linkEl.href = url;
  linkEl.download = "chat-export.txt";
  linkEl.click();
  URL.revokeObjectURL(url);
  statusTextEl.textContent = "Chat exported.";
}

function stopCurrentRequest() {
  if (activeAbortController) {
    activeAbortController.abort();
  }
}

function goBackToLogin() {
  window.location.href = "index.html";
}

function scrollToBottom() {
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function autoResizeTextarea() {
  messageInputEl.style.height = "auto";
  messageInputEl.style.height = `${messageInputEl.scrollHeight}px`;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function delay(duration, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timerId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, duration);

    function onAbort() {
      cleanup();
      reject(createAbortError());
    }

    function cleanup() {
      window.clearTimeout(timerId);
      signal?.removeEventListener("abort", onAbort);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}
