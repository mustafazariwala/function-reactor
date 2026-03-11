const STORAGE_KEYS = {
  currentFunction: "currentFunction",
  autoRun: "autoRun",
  autoSave: "autoSave",
  theme: "theme",
  scripts: "scripts",
};

const editor = ace.edit("col-code-text");
editor.session.setMode("ace/mode/javascript");
editor.setTheme(`ace/theme/${localStorage.getItem(STORAGE_KEYS.theme) || "dracula"}`);
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

let changesDone = false;
let autoRun = readBoolean(STORAGE_KEYS.autoRun, true);
let autoSave = readBoolean(STORAGE_KEYS.autoSave, true);
let currentExecutionId = 0;

function readBoolean(key, fallback) {
  const value = localStorage.getItem(key);
  return value === null ? fallback : JSON.parse(value);
}

function starterTemplate() {
  return `async function main() {\n  return {\n    message: \"Hello from Function Reactor\",\n    now: new Date().toISOString(),\n  };\n}\n\nmain();`;
}

function getFunctionKeys() {
  return Object.keys(localStorage)
    .filter((key) => /^func-\d+$/.test(key))
    .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
}

function getFunctionLabel(key) {
  return localStorage.getItem(`${key}-name`) || "Untitled Function";
}

function getCurrentFunction() {
  return localStorage.getItem(STORAGE_KEYS.currentFunction);
}

function setCurrentFunction(id) {
  localStorage.setItem(STORAGE_KEYS.currentFunction, id);
}

function syncToggleInputs() {
  autoRunCheckbox.checked = autoRun;
  autoRunCheckboxModal.checked = autoRun;
  autoSaveCheckbox.checked = autoSave;
  autoSaveCheckboxModal.checked = autoSave;
  reloadSyncIcon.style.display = autoSave ? "inline-flex" : "none";
}

function ensureAtLeastOneFunction() {
  if (getFunctionKeys().length > 0) return;
  const id = "func-1";
  localStorage.setItem(id, starterTemplate());
  localStorage.setItem(`${id}-name`, "Getting Started");
  setCurrentFunction(id);
}

function renderFunctionList(filterText = "") {
  const current = getCurrentFunction();
  const normalized = filterText.trim().toLowerCase();
  functionList.innerHTML = "";

  const matchingKeys = getFunctionKeys().filter((key) => {
    if (!normalized) return true;
    return getFunctionLabel(key).toLowerCase().includes(normalized);
  });

  if (matchingKeys.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "muted-text";
    emptyState.textContent = "No matching functions.";
    functionList.appendChild(emptyState);
    return;
  }

  matchingKeys.forEach((key) => {
    const button = document.createElement("button");
    button.className = `function-item${key === current ? " active" : ""}`;
    button.id = key;
    button.innerHTML = `<strong>${escapeHtml(getFunctionLabel(key))}</strong><small>${key}</small>`;
    button.addEventListener("click", () => clickButtonEvent(key));
    functionList.appendChild(button);
  });
}

async function clickButtonEvent(id) {
  if (changesDone) {
    const proceed = confirm("You have unsaved changes. Continue without saving?");
    if (!proceed) return;
  }

  setCurrentFunction(id);
  editor.setValue(localStorage.getItem(id) || "", -1);
  saveInput.value = getFunctionLabel(id);
  renderFunctionList(functionSearchInput.value);
  ChangesDoneFunction(false);
  await loadTextArea();
}

function updateEditorStatus(message) {
  editorStatus.textContent = message;
}

function setExecutionState(label, variant = "") {
  executionStatus.textContent = label;
  executionStatus.className = `status-pill${variant ? ` ${variant}` : ""}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatResult(value) {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "function") return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

async function runUserCode(rawValue) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const wrappedCode = `"use strict";\n${rawValue}\n\nif (typeof main === "function") {\n  return await main();\n}`;
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

const saveDebounce = debounce(() => {
  saveButtonFunction(false);
  spinReloadIcon(1200);
}, 500);

function saveButtonFunction(showStatus = true) {
  const currentFunction = getCurrentFunction();
  if (!currentFunction) return;

  const value = editor.getSession().getValue();
  localStorage.setItem(currentFunction, value);

  const input = saveInput.value.trim();
  localStorage.setItem(`${currentFunction}-name`, input || "Untitled Function");
  renderFunctionList(functionSearchInput.value);
  ChangesDoneFunction(false);
  if (showStatus) updateEditorStatus(`Saved at ${new Date().toLocaleTimeString()}`);
}

function createNewFunction() {
  const nextId = `func-${getLastNumberFromLocalStorage()}`;
  localStorage.setItem(nextId, starterTemplate());
  localStorage.setItem(`${nextId}-name`, `Function ${getLastNumberFromLocalStorage()}`);
  renderFunctionList(functionSearchInput.value);
  clickButtonEvent(nextId);
  updateEditorStatus("Created a new function");
}

function getLastNumberFromLocalStorage() {
  const keys = getFunctionKeys();
  if (keys.length === 0) return 1;
  return Number(keys[keys.length - 1].split("-")[1]) + 1;
}

function prepareDeleteButton() {
  deleteButton.addEventListener("click", () => {
    const currentFunction = getCurrentFunction();
    if (!currentFunction) return;

    const confirmed = confirm(`Delete \"${getFunctionLabel(currentFunction)}\"?`);
    if (!confirmed) return;

    localStorage.removeItem(currentFunction);
    localStorage.removeItem(`${currentFunction}-name`);
    ensureAtLeastOneFunction();
    const firstKey = getFunctionKeys()[0];
    setCurrentFunction(firstKey);
    renderFunctionList(functionSearchInput.value);
    clickButtonEvent(firstKey);
    updateEditorStatus("Function deleted");
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
    ChangesDoneFunction(true);
    updateEditorStatus("Unsaved changes");
    if (autoRun) {
      await loadTextArea();
    }
    if (autoSave) {
      saveDebounce();
    }
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
        appendScript(lib.name, lib.latest);
      } else {
        delete scriptsMap[lib.name];
        document.getElementById(lib.name)?.remove();
      }
      localStorage.setItem(STORAGE_KEYS.scripts, JSON.stringify(scriptsMap));
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
  document.head.appendChild(script);
}

function loadScriptFromLocalStorage() {
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
  themeSelect.value = localStorage.getItem(STORAGE_KEYS.theme) || "dracula";
  themeSelect.addEventListener("change", (e) => {
    editor.setTheme(`ace/theme/${e.target.value}`);
    localStorage.setItem(STORAGE_KEYS.theme, e.target.value);
  });
}

function spinReloadIcon(ms) {
  reloadSyncIcon.classList.add("spin");
  setTimeout(() => reloadSyncIcon.classList.remove("spin"), ms);
}

function prepareButtons() {
  createNewButton.addEventListener("click", createNewFunction);
  saveButton.addEventListener("click", () => saveButtonFunction(true));
  runButton.addEventListener("click", loadTextArea);
  functionSearchInput.addEventListener("input", functionFilterDebounce);
}

async function initializeApp() {
  loadScriptFromLocalStorage();
  ensureAtLeastOneFunction();
  populateThemes();
  syncToggleInputs();
  prepareButtons();
  prepareDeleteButton();
  prepareCopyButton();
  prepareEditorChangeHandling();
  setupAutoRunCheckbox();
  setupAutoSaveCheckbox();
  setupModal();

  Array.from(modalDisplay.children).forEach((section, index) => {
    section.style.display = index === 0 ? "block" : "none";
  });

  const currentFunction = getCurrentFunction() || getFunctionKeys()[0];
  setCurrentFunction(currentFunction);
  renderFunctionList();
  editor.setValue(localStorage.getItem(currentFunction) || starterTemplate(), -1);
  saveInput.value = getFunctionLabel(currentFunction);
  ChangesDoneFunction(false);
  await loadTextArea();
  updateEditorStatus("Ready");
}

initializeApp();