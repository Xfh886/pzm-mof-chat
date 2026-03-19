const DEFAULT_BACKEND_URL = "http://localhost:8000";
const STORAGE_KEYS = {
  modelKey: "am_model_key",
  ccdcKey: "am_ccdc_key",
  backendUrl: "am_backend_url",
  storageMode: "am_storage_mode",
};

const modelKeyEl = document.getElementById("modelKey");
const ccdcKeyEl = document.getElementById("ccdcKey");
const modelKeyErrEl = document.getElementById("modelKeyErr");
const ccdcStatusEl = document.getElementById("ccdcStatus");
const noticeEl = document.getElementById("notice");
const btnContinue = document.getElementById("continueButton");
const btnClear = document.getElementById("clearButton");
const saveSessionEl = document.getElementById("saveSession");
const toggleModelKeyButton = document.getElementById("toggleModelKey");

hydrateFromStorage();
bindEvents();
refreshUI();

function bindEvents() {
  modelKeyEl.addEventListener("input", () => {
    modelKeyErrEl.textContent = "";
    setNotice("");
    refreshUI();
  });

  ccdcKeyEl.addEventListener("input", () => {
    setNotice("");
    updateCcdcBadge();
  });

  btnClear.addEventListener("click", clearForm);
  btnContinue.addEventListener("click", saveAndContinue);

  toggleModelKeyButton.addEventListener("click", () => {
    const isPassword = modelKeyEl.type === "password";
    modelKeyEl.type = isPassword ? "text" : "password";
    toggleModelKeyButton.textContent = isPassword ? "Hide" : "Show";
  });
}

function isProbablyKey(value) {
  return typeof value === "string" && value.trim().length >= 8;
}

function setNotice(message) {
  noticeEl.textContent = message || "";
}

function getStorage(mode) {
  return mode === "session" ? sessionStorage : localStorage;
}

function clearStoredCredentials() {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function refreshUI() {
  btnContinue.disabled = !isProbablyKey(modelKeyEl.value);
  updateCcdcBadge();
}

function clearForm() {
  modelKeyEl.value = "";
  ccdcKeyEl.value = "";
  modelKeyErrEl.textContent = "";
  setNotice("Cleared.");
  refreshUI();
}

function saveAndContinue() {
  const modelKey = modelKeyEl.value.trim();
  const ccdcKey = ccdcKeyEl.value.trim();
  const backendUrl = DEFAULT_BACKEND_URL;
  const storageMode = saveSessionEl.checked ? "session" : "local";

  if (!isProbablyKey(modelKey)) {
    modelKeyErrEl.textContent = "Model API key is required and must be at least 8 characters.";
    setNotice("Please fix the errors before continuing.");
    refreshUI();
    return;
  }

  clearStoredCredentials();

  const store = getStorage(storageMode);
  store.setItem(STORAGE_KEYS.modelKey, modelKey);
  store.setItem(STORAGE_KEYS.ccdcKey, ccdcKey);
  store.setItem(STORAGE_KEYS.backendUrl, backendUrl);
  store.setItem(STORAGE_KEYS.storageMode, storageMode);

  setNotice("Saved. Redirecting to chat...");
  window.location.href = "chat.html";
}

function hydrateFromStorage() {
  const storedMode =
    sessionStorage.getItem(STORAGE_KEYS.storageMode) ||
    localStorage.getItem(STORAGE_KEYS.storageMode) ||
    "session";
  const store = getStorage(storedMode);

  modelKeyEl.value = store.getItem(STORAGE_KEYS.modelKey) || "";
  ccdcKeyEl.value = store.getItem(STORAGE_KEYS.ccdcKey) || "";
  saveSessionEl.checked = storedMode !== "local";
}

function updateCcdcBadge() {
  const hasValue = ccdcKeyEl.value.trim().length > 0;
  ccdcStatusEl.textContent = hasValue ? "CCDC Enabled" : "CCDC Disabled";
  ccdcStatusEl.classList.toggle("is-enabled", hasValue);
  ccdcStatusEl.classList.toggle("is-disabled", !hasValue);
}
