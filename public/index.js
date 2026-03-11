const STORAGE_KEYS = {
  autoRun: "autoRun",
  autoSave: "autoSave",
  theme: "theme",
  scripts: "scripts",
};

const editor = ace.edit("col-code-text");
editor.session.setMode("ace/mode/javascript");
editor.setOptions({
  enableBasicAutocompletion: true,
  enableLiveAutocompletion: true,
  enableSnippets: true,
  fontSize: "14px",
  showPrintMargin: false,
});
editor.session.setUseWrapMode(true);

const themeList = [
  "chrome", "clouds", "crimson_editor", "dawn", "dreamweaver", "eclipse", "github",
  "iplastic", "katzenmilch", "kuroir", "solarized_light", "sqlserver", "textmate",
  "tomorrow", "xcode", "ambiance", "chaos", "clouds_midnight", "cobalt", "dracula",
  "gob", "gruvbox", "idle_fingers", "kr_theme", "merbivore", "merbivore_soft",
  "mono_industrial", "monokai", "pastel_on_dark", "solarized_dark", "terminal",
  "tomorrow_night", "tomorrow_night_blue", "tomorrow_night_bright",
  "tomorrow_night_eighties", "twilight", "vibrant_ink",
];

const resultArea = document.getElementById("col-result");
const saveButton = document.getElementById("saveButton");
const deleteButton = document.getElementById("deleteButton");
const runButton = document.getElementById("runButton");
const saveInput = document.getElementById("saveInput");
const createNewButton = document.getElementById("col-button-createNew");
const copyButton = document.getElementById("col-result-copy-button");
const resultTimeP = document.getElementById("col-result-time");
const executionStatus = document.getElementById("executionStatus");
const editorStatus = document.getElementById("editorStatus");
const settingButton = document.getElementById("settingButton");
const settingModal = document.getElementById("settingModal");
const modalCloseButton = document.getElementById("settingModalClose");
const displayTable = document.getElementById("display-table");
const scriptSearchInput = document.getElementById("scriptSearchInput");
const functionSearchInput = document.getElementById("functionSearchInput");
const autoRunCheckbox = document.getElementById("auto-run-checkbox");
const autoRunCheckboxModal = document.getElementById("auto-run-checkbox-modal");
const autoSaveCheckbox = document.getElementById("auto-save-checkbox");
const autoSaveCheckboxModal = document.getElementById("auto-save-checkbox-modal");
const modalDisplay = document.getElementById("modal-display");
const themeSelect = document.getElementById("theme-select");
const reloadSyncIcon = document.getElementById("reload-sync-icon");
const functionList = document.getElementById("col-button");
const authStatus = document.getElementById("authStatus");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");
const logoutButton = document.getElementById("logoutButton");

let changesDone = false;
let autoRun = readBoolean(STORAGE_KEYS.autoRun, true);
let autoSave = readBoolean(STORAGE_KEYS.autoSave, true);
let currentExecutionId = 0;
let isHydratingEditor = false;
let currentUser = null;
let currentFunctionId = null;
let functionRecords = [];

function readBoolean(key, fallback) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function starterTemplate() {
  return `async function main() {\n  return {\n    message: \"Hello from Function Reactor\",\n    now: new Date().toISOString(),\n  };\n}\n\nmain();`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateEditorStatus(message) {
  editorStatus.textContent = message;
}

function setExecutionState(label, variant = "") {
  executionStatus.textContent = label;
  executionStatus.className = `status-pill${variant ? ` ${variant}` : ""}`;
}

function formatResult(value) {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "function") return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function runUserCode(rawValue) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const wrappedCode = `"use strict";\n${rawValue}\n\nif (typeof main === \"function\") {\n  return await main();\n}`;
  return new AsyncFunction(wrappedCode)();
}

async function setValue(rawValue) {
  const executionId = ++currentExecutionId;
  const startedAt = performance.now();
  resultArea.textContent = "Running...";
  setExecutionState("Running");

  try {
    const value = await runUserCode(rawValue);
    if (executionId !== currentExecutionId) return;
    resultArea.textContent = formatResult(value);
    resultTimeP.textContent = `Executed in ${Math.round(performance.now() - startedAt)}ms`;
    setExecutionState("Success", "success");
  } catch (error) {
    if (executionId !== currentExecutionId) return;
    resultArea.textContent = error?.stack || error?.message || String(error);
    resultTimeP.textContent = `Failed after ${Math.round(performance.now() - startedAt)}ms`;
    setExecutionState("Error", "error");
  }
}

async function loadTextArea() {
  const value = editor.getSession().getValue();
  if (!value.trim()) {
    resultArea.textContent = "Add some code, then run it.";
    resultTimeP.textContent = "Not run yet";
    setExecutionState("Idle");
    return;
  }
  await setValue(value);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function getCurrentRecord() {
  return functionRecords.find((item) => String(item.id) === String(currentFunctionId)) || null;
}

function syncToggleInputs() {
  autoRunCheckbox.checked = autoRun;
  autoRunCheckboxModal.checked = autoRun;
  autoSaveCheckbox.checked = autoSave;
  autoSaveCheckboxModal.checked = autoSave;
  reloadSyncIcon.style.display = autoSave ? "inline-flex" : "none";
}

function setWorkspaceEnabled(enabled) {
  createNewButton.disabled = !enabled;
  saveButton.disabled = !enabled;
  deleteButton.disabled = !enabled;
  saveInput.disabled = !enabled;
  functionSearchInput.disabled = !enabled;
}

function renderFunctionList(filterText = "") {
  const normalized = filterText.trim().toLowerCase();
  functionList.innerHTML = "";

  if (!currentUser) {
    const emptyState = document.createElement("div");
    emptyState.className = "muted-text";
    emptyState.textContent = "Login to access saved functions.";
    functionList.appendChild(emptyState);
    return;
  }

  const matching = functionRecords.filter((item) => {
    if (!normalized) return true;
    return item.name.toLowerCase().includes(normalized);
  });

  if (matching.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "muted-text";
    emptyState.textContent = "No matching functions.";
    functionList.appendChild(emptyState);
    return;
  }

  matching.forEach((item) => {
    const button = document.createElement("button");
    button.className = `function-item${String(item.id) === String(currentFunctionId) ? " active" : ""}`;
    button.id = `func-${item.id}`;
    button.innerHTML = `<strong>${escapeHtml(item.name)}</strong><small>func-${item.id}</small>`;
    button.addEventListener("click", () => clickButtonEvent(item.id));
    functionList.appendChild(button);
  });
}

async function clickButtonEvent(id) {
  if (changesDone) {
    const proceed = confirm("You have unsaved changes. Continue without saving?");
    if (!proceed) return;
  }

  currentFunctionId = String(id);
  const item = getCurrentRecord();
  if (!item) return;

  isHydratingEditor = true;
  editor.setValue(item.code || "", -1);
  isHydratingEditor = false;

  saveInput.value = item.name;
  renderFunctionList(functionSearchInput.value);
  ChangesDoneFunction(false);
  await loadTextArea();
}

async function fetchFunctions() {
  const payload = await apiRequest("/api/functions", { method: "GET" });
  functionRecords = payload.functions || [];
}

async function createFunctionOnServer(name, code) {
  const payload = await apiRequest("/api/functions", {
    method: "POST",
    body: JSON.stringify({ name, code }),
  });
  return payload.function;
}

async function ensureAtLeastOneFunction() {
  if (!currentUser) return;
  if (functionRecords.length > 0) return;
  const created = await createFunctionOnServer("Getting Started", starterTemplate());
  functionRecords = [created];
}

async function saveButtonFunction(showStatus = true) {
  if (!currentUser || !currentFunctionId) return;

  const name = saveInput.value.trim() || "Untitled Function";
  const code = editor.getSession().getValue();

  const payload = await apiRequest(`/api/functions/${currentFunctionId}`, {
    method: "PUT",
    body: JSON.stringify({ name, code }),
  });

  const updated = payload.function;
  functionRecords = functionRecords.map((item) => (String(item.id) === String(updated.id) ? updated : item));
  renderFunctionList(functionSearchInput.value);
  ChangesDoneFunction(false);
  if (showStatus) updateEditorStatus(`Saved at ${new Date().toLocaleTimeString()}`);
}

const saveDebounce = debounce(async () => {
  try {
    await saveButtonFunction(false);
    spinReloadIcon(1200);
  } catch (error) {
    updateEditorStatus(error.message);
  }
}, 500);

async function createNewFunction() {
  if (!currentUser) return;
  const created = await createFunctionOnServer(`Function ${functionRecords.length + 1}`, starterTemplate());
  functionRecords.unshift(created);
  currentFunctionId = String(created.id);
  renderFunctionList(functionSearchInput.value);
  await clickButtonEvent(created.id);
  updateEditorStatus("Created a new function");
}

async function deleteCurrentFunction() {
  if (!currentUser || !currentFunctionId) return;

  const current = getCurrentRecord();
  if (!current) return;

  const confirmed = confirm(`Delete \"${current.name}\"?`);
  if (!confirmed) return;

  await apiRequest(`/api/functions/${currentFunctionId}`, { method: "DELETE" });
  functionRecords = functionRecords.filter((item) => String(item.id) !== String(currentFunctionId));

  if (functionRecords.length === 0) {
    const created = await createFunctionOnServer("Getting Started", starterTemplate());
    functionRecords = [created];
  }

  currentFunctionId = String(functionRecords[0].id);
  renderFunctionList(functionSearchInput.value);
  await clickButtonEvent(currentFunctionId);
  updateEditorStatus("Function deleted");
}

function prepareDeleteButton() {
  deleteButton.addEventListener("click", () => {
    deleteCurrentFunction().catch((error) => updateEditorStatus(error.message));
  });
}

function prepareCopyButton() {
  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(resultArea.textContent);
    const original = copyButton.innerHTML;
    copyButton.innerHTML = '<span class="material-symbols-outlined">check</span>Copied';
    setTimeout(() => {
      copyButton.innerHTML = original;
    }, 1100);
  });
}

function prepareEditorChangeHandling() {
  editor.session.on("change", async () => {
    if (isHydratingEditor || !currentUser) return;
    ChangesDoneFunction(true);
    updateEditorStatus("Unsaved changes");
    if (autoRun) await loadTextArea();
    if (autoSave) saveDebounce();
  });
}

function ChangesDoneFunction(changes = false) {
  changesDone = changes;
  saveButton.classList.toggle("secondary", !changesDone);
}

async function searchScript(searchInput = "") {
  displayTable.querySelector("tbody").innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";
  const params = new URLSearchParams({
    search: searchInput,
    limit: 30,
    fields: "name,latest,description,version",
  });

  const response = await fetch(`https://api.cdnjs.com/libraries?${params}`);
  const libraries = await response.json();
  const tableBody = document.createElement("tbody");

  libraries.results.forEach((lib) => {
    const row = document.createElement("tr");
    const scripts = JSON.parse(localStorage.getItem(STORAGE_KEYS.scripts) || "{}");
    const isInstalled = Boolean(scripts[lib.name]);

    row.innerHTML = `
      <td>${escapeHtml(lib.name)}</td>
      <td>${escapeHtml(lib.description || "")}</td>
      <td>${escapeHtml(lib.version || "")}</td>
      <td></td>
    `;

    const actionCell = row.lastElementChild;
    const addButton = document.createElement("button");
    addButton.className = `button ${isInstalled ? "danger" : "secondary"}`;
    addButton.textContent = isInstalled ? "Remove" : "Add";

    addButton.addEventListener("click", () => {
      const scriptsMap = JSON.parse(localStorage.getItem(STORAGE_KEYS.scripts) || "{}");
      if (!scriptsMap[lib.name]) {
        scriptsMap[lib.name] = lib.latest;
      } else {
        delete scriptsMap[lib.name];
      }
      localStorage.setItem(STORAGE_KEYS.scripts, JSON.stringify(scriptsMap));
      loadScriptFromLocalStorage();
      searchScript(scriptSearchInput.value);
    });

    actionCell.appendChild(addButton);
    tableBody.appendChild(row);
  });

  displayTable.querySelector("tbody").replaceWith(tableBody);
}

function appendScript(id, src) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.src = src;
  script.id = id;
  script.dataset.userScript = "true";
  document.head.appendChild(script);
}

function clearManagedScripts() {
  document.querySelectorAll("script[data-user-script='true']").forEach((script) => script.remove());
}

function loadScriptFromLocalStorage() {
  clearManagedScripts();
  const scripts = JSON.parse(localStorage.getItem(STORAGE_KEYS.scripts) || "{}");
  Object.entries(scripts).forEach(([key, value]) => appendScript(key, value));
}

function setupAutoRunCheckbox() {
  const handler = (checked) => {
    autoRun = checked;
    localStorage.setItem(STORAGE_KEYS.autoRun, JSON.stringify(autoRun));
    syncToggleInputs();
    updateEditorStatus(autoRun ? "Auto run enabled" : "Auto run disabled");
  };

  autoRunCheckbox.addEventListener("change", (e) => handler(e.target.checked));
  autoRunCheckboxModal.addEventListener("change", (e) => handler(e.target.checked));
}

function setupAutoSaveCheckbox() {
  const handler = (checked) => {
    autoSave = checked;
    localStorage.setItem(STORAGE_KEYS.autoSave, JSON.stringify(autoSave));
    syncToggleInputs();
    updateEditorStatus(autoSave ? "Auto save enabled" : "Auto save disabled");
  };

  autoSaveCheckbox.addEventListener("change", (e) => handler(e.target.checked));
  autoSaveCheckboxModal.addEventListener("change", (e) => handler(e.target.checked));
}

function setupModal() {
  settingButton.onclick = () => {
    settingModal.style.display = "block";
    searchScript();
    scriptSearchInput.focus();
  };

  modalCloseButton.onclick = () => {
    settingModal.style.display = "none";
  };

  window.addEventListener("click", (event) => {
    if (event.target === settingModal) {
      settingModal.style.display = "none";
    }
  });

  settingModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      settingModal.style.display = "none";
    }
  });

  scriptSearchInput.addEventListener("keyup", searchDebounce);
}

const searchDebounce = debounce(() => {
  searchScript(scriptSearchInput.value);
}, 350);

const functionFilterDebounce = debounce(() => {
  renderFunctionList(functionSearchInput.value);
}, 150);

function debounce(func, timeout = 500) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), timeout);
  };
}

function toggleModalSection(sectionId) {
  Array.from(modalDisplay.children).forEach((section) => {
    section.style.display = section.id === sectionId ? "block" : "none";
  });
}
window.toggleModalSection = toggleModalSection;

function populateThemes() {
  themeList.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = theme;
    themeSelect.appendChild(option);
  });

  const selectedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dracula";
  themeSelect.value = selectedTheme;
  editor.setTheme(`ace/theme/${selectedTheme}`);

  themeSelect.addEventListener("change", (e) => {
    editor.setTheme(`ace/theme/${e.target.value}`);
    localStorage.setItem(STORAGE_KEYS.theme, e.target.value);
  });
}

function spinReloadIcon(ms) {
  reloadSyncIcon.classList.add("spin");
  setTimeout(() => reloadSyncIcon.classList.remove("spin"), ms);
}

function updateAuthUI() {
  if (currentUser) {
    authStatus.textContent = `Logged in as ${currentUser.email}`;
    authEmailInput.disabled = true;
    authPasswordInput.disabled = true;
    loginButton.style.display = "none";
    registerButton.style.display = "none";
    logoutButton.style.display = "inline-flex";
  } else {
    authStatus.textContent = "Not logged in";
    authEmailInput.disabled = false;
    authPasswordInput.disabled = false;
    loginButton.style.display = "inline-flex";
    registerButton.style.display = "inline-flex";
    logoutButton.style.display = "none";
  }
}

async function refreshWorkspace() {
  if (!currentUser) {
    functionRecords = [];
    currentFunctionId = null;
    renderFunctionList(functionSearchInput.value);
    setWorkspaceEnabled(false);
    saveInput.value = "";
    isHydratingEditor = true;
    editor.setValue(starterTemplate(), -1);
    isHydratingEditor = false;
    ChangesDoneFunction(false);
    updateEditorStatus("Login to create and save persistent functions");
    await loadTextArea();
    return;
  }

  setWorkspaceEnabled(true);
  await fetchFunctions();
  await ensureAtLeastOneFunction();

  if (!functionRecords.some((item) => String(item.id) === String(currentFunctionId))) {
    currentFunctionId = String(functionRecords[0].id);
  }

  renderFunctionList(functionSearchInput.value);

  const current = getCurrentRecord();
  if (current) {
    isHydratingEditor = true;
    editor.setValue(current.code || "", -1);
    isHydratingEditor = false;
    saveInput.value = current.name;
  }

  ChangesDoneFunction(false);
  await loadTextArea();
  updateEditorStatus("Ready");
}

async function authenticate(mode) {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    updateEditorStatus("Email and password are required");
    return;
  }

  const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
  const payload = await apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  currentUser = payload.user;
  authPasswordInput.value = "";
  updateAuthUI();
  await refreshWorkspace();
}

async function loadCurrentUser() {
  const payload = await apiRequest("/api/auth/me", { method: "GET" });
  currentUser = payload.user;
  updateAuthUI();
}

function prepareAuth() {
  loginButton.addEventListener("click", async () => {
    try {
      await authenticate("login");
      updateEditorStatus("Logged in");
    } catch (error) {
      updateEditorStatus(error.message);
    }
  });

  registerButton.addEventListener("click", async () => {
    try {
      await authenticate("register");
      updateEditorStatus("Account created");
    } catch (error) {
      updateEditorStatus(error.message);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      currentUser = null;
      updateAuthUI();
      await refreshWorkspace();
      updateEditorStatus("Logged out");
    } catch (error) {
      updateEditorStatus(error.message);
    }
  });
}

function prepareButtons() {
  createNewButton.addEventListener("click", () => {
    createNewFunction().catch((error) => updateEditorStatus(error.message));
  });

  saveButton.addEventListener("click", () => {
    saveButtonFunction(true).catch((error) => updateEditorStatus(error.message));
  });

  runButton.addEventListener("click", loadTextArea);
  functionSearchInput.addEventListener("input", functionFilterDebounce);
}

async function initializeApp() {
  loadScriptFromLocalStorage();
  populateThemes();
  syncToggleInputs();
  prepareButtons();
  prepareDeleteButton();
  prepareCopyButton();
  prepareEditorChangeHandling();
  setupAutoRunCheckbox();
  setupAutoSaveCheckbox();
  setupModal();
  prepareAuth();

  Array.from(modalDisplay.children).forEach((section, index) => {
    section.style.display = index === 0 ? "block" : "none";
  });

  try {
    await loadCurrentUser();
  } catch {
    currentUser = null;
    updateAuthUI();
  }

  await refreshWorkspace();
}

initializeApp();
