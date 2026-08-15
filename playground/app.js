"use strict";

const { lintExample, resolvePlaygroundConfig } = require("./browser-api");
const { EXAMPLES } = require("./examples");
const { RULE_REFERENCE, toggleRuleOverride } = require("./rule-reference");
const { createSourceEditor, offsetFromLocation } = require("./source-editor");
const { getRuleTogglePresentation, resolveExamplePreset } = require("./app-state");

const elements = {
  availableRules: document.querySelector("#available-rules"),
  configEditor: document.querySelector("#config-editor"),
  configValidity: document.querySelector("#config-validity"),
  copyConfigButton: document.querySelector("#copy-config-button"),
  copyConfigLabel: document.querySelector("#copy-config-label"),
  diagnosticsList: document.querySelector("#diagnostics-list"),
  exampleSelect: document.querySelector("#example-select"),
  fileName: document.querySelector("#editor-heading"),
  presetSelect: document.querySelector("#preset-select"),
  resetButton: document.querySelector("#reset-button"),
  resolvedConfig: document.querySelector("#resolved-config-output"),
  sourceEditor: document.querySelector("#source-editor"),
  summary: document.querySelector("#summary"),
  themeToggle: document.querySelector("#theme-toggle"),
  themeToggleLabel: document.querySelector("#theme-toggle-label"),
};

let activeExample = EXAMPLES[0];
let copyResetTimer;
let editor;
let lintFrame;

function initialize() {
  populateExamples();
  populateAvailableRules();
  initializeTheme();
  editor = createSourceEditor({
    parent: elements.sourceEditor,
    initialValue: activeExample.source,
    onChange: scheduleLint,
  });
  bindEvents();
  loadExample(activeExample, { useExamplePreset: true });
}

function populateExamples() {
  for (const example of EXAMPLES) {
    const option = document.createElement("option");
    option.value = example.id;
    option.textContent = example.label;
    elements.exampleSelect.append(option);
  }
}

function populateAvailableRules() {
  for (const rule of RULE_REFERENCE) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "available-rule";
    button.dataset.ruleId = rule.id;
    button.setAttribute("aria-label", `Add ${rule.id} as a warning override`);
    button.addEventListener("click", () => toggleAvailableRule(rule.id));

    const content = document.createElement("span");
    content.className = "available-rule-content";

    const name = document.createElement("code");
    name.textContent = rule.id;

    const description = document.createElement("span");
    description.textContent = rule.description;

    const action = document.createElement("span");
    action.className = "available-rule-action";
    action.setAttribute("aria-hidden", "true");
    action.textContent = "+";

    content.append(name, description);
    button.append(content, action);
    elements.availableRules.append(button);
  }
}

function bindEvents() {
  elements.exampleSelect.addEventListener("change", () => {
    const nextExample = EXAMPLES.find((example) => example.id === elements.exampleSelect.value);

    if (nextExample) {
      loadExample(nextExample);
    }
  });

  elements.presetSelect.addEventListener("change", scheduleLint);
  elements.configEditor.addEventListener("input", scheduleLint);
  elements.copyConfigButton.addEventListener("click", copyResolvedConfig);
  elements.resetButton.addEventListener("click", () => loadExample(activeExample));
  elements.themeToggle.addEventListener("click", toggleTheme);
}

function loadExample(example, { useExamplePreset = false } = {}) {
  activeExample = example;
  elements.exampleSelect.value = example.id;
  elements.presetSelect.value = resolveExamplePreset({
    currentPreset: elements.presetSelect.value,
    examplePreset: example.preset,
    useExamplePreset,
  });
  editor.setValue(example.source);
  elements.configEditor.value = '{\n  "rules": {}\n}';
  elements.fileName.textContent = example.fileName;
  lintNow();
}

function scheduleLint() {
  window.cancelAnimationFrame(lintFrame);
  lintFrame = window.requestAnimationFrame(lintNow);
}

function lintNow() {
  let overrides;

  try {
    overrides = JSON.parse(elements.configEditor.value);
    setConfigValidity(true, "Valid JSON");
    updateAvailableRules(overrides);
  } catch (error) {
    setConfigValidity(false, "Invalid JSON");
    updateAvailableRules(null);
    renderConfigError(error.message);
    return;
  }

  try {
    const preset = elements.presetSelect.value;
    const result = lintExample(editor.getValue(), {
      preset,
      config: overrides,
      filePath: activeExample.fileName,
    });
    const resolved = resolvePlaygroundConfig(preset, overrides);

    elements.resolvedConfig.textContent = JSON.stringify(resolved, null, 2);
    renderDiagnostics(result);
  } catch (error) {
    setConfigValidity(false, "Invalid config");
    renderConfigError(error.message);
  }
}

function toggleAvailableRule(ruleId) {
  let nextConfig;

  try {
    const config = JSON.parse(elements.configEditor.value);
    nextConfig = toggleRuleOverride(config, ruleId);
  } catch {
    setConfigValidity(false, "Fix config first");
    elements.configEditor.focus();
    return;
  }

  elements.configEditor.value = JSON.stringify(nextConfig, null, 2);
  lintNow();
  elements.configEditor.focus();
}

function updateAvailableRules(config) {
  const overrides = config && config.rules && typeof config.rules === "object" ? config.rules : {};

  for (const button of elements.availableRules.querySelectorAll(".available-rule")) {
    const added = Object.prototype.hasOwnProperty.call(overrides, button.dataset.ruleId);
    const action = button.querySelector(".available-rule-action");

    button.classList.toggle("is-added", added);
    const presentation = getRuleTogglePresentation(button.dataset.ruleId, added);
    button.setAttribute("aria-label", presentation.label);
    action.textContent = presentation.mark;
  }
}

function renderDiagnostics(result) {
  elements.diagnosticsList.replaceChildren();
  renderSummary(result.errorCount, result.warningCount);

  if (result.messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state compact-empty-state";

    const content = document.createElement("div");
    const mark = document.createElement("span");
    mark.className = "empty-state-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "✓";

    const title = document.createElement("h3");
    title.textContent = "No problems found";

    const copy = document.createElement("p");
    copy.textContent = "This template passes every enabled rule.";

    content.append(mark, title, copy);
    empty.append(content);
    elements.diagnosticsList.append(empty);
    return;
  }

  for (const message of result.messages) {
    elements.diagnosticsList.append(createDiagnostic(message));
  }
}

function createDiagnostic(message) {
  const diagnostic = document.createElement("button");
  const severity = message.severity === 2 ? "error" : "warning";
  diagnostic.type = "button";
  diagnostic.className = `diagnostic ${severity}`;
  diagnostic.setAttribute(
    "aria-label",
    `${severity}: ${message.ruleId} at line ${message.line}, column ${message.column}. ${message.message}`
  );
  diagnostic.addEventListener("click", () => selectDiagnostic(message));

  const topLine = document.createElement("div");
  topLine.className = "diagnostic-topline";

  const mark = document.createElement("span");
  mark.className = "severity-mark";
  mark.setAttribute("aria-hidden", "true");

  const ruleName = document.createElement("span");
  ruleName.className = "rule-name";
  ruleName.textContent = message.ruleId;

  const location = document.createElement("span");
  location.className = "location";
  location.textContent = `${message.line}:${message.column}`;

  const copy = document.createElement("p");
  copy.className = "diagnostic-message";
  copy.textContent = message.message;

  topLine.append(mark, ruleName, location);
  diagnostic.append(topLine, copy);

  return diagnostic;
}

function selectDiagnostic(message) {
  const value = editor.getValue();
  const start = offsetFromLocation(value, message.line, message.column);

  editor.focus();
  editor.selectRange(start, Math.min(start + 1, value.replace(/\r\n?/gu, "\n").length), {
    scrollIntoView: true,
  });
}

function renderSummary(errorCount, warningCount) {
  elements.summary.replaceChildren();

  if (errorCount === 0 && warningCount === 0) {
    elements.summary.append(createSummaryPill("clean", "Clean"));
    return;
  }

  if (errorCount > 0) {
    elements.summary.append(
      createSummaryPill("errors", `${errorCount} error${errorCount === 1 ? "" : "s"}`)
    );
  }

  if (warningCount > 0) {
    elements.summary.append(
      createSummaryPill("warnings", `${warningCount} warning${warningCount === 1 ? "" : "s"}`)
    );
  }
}

function createSummaryPill(className, text) {
  const pill = document.createElement("span");
  pill.className = `summary-pill ${className}`;
  pill.textContent = text;
  return pill;
}

function renderConfigError(message) {
  elements.resolvedConfig.textContent = "Configuration unavailable until the JSON is valid.";
  elements.diagnosticsList.replaceChildren();
  elements.summary.replaceChildren(createSummaryPill("errors", "Config error"));

  const errorState = document.createElement("div");
  errorState.className = "empty-state compact-empty-state";

  const content = document.createElement("div");
  const mark = document.createElement("span");
  mark.className = "empty-state-mark";
  mark.classList.add("error-state-mark");
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "!";

  const title = document.createElement("h3");
  title.textContent = "Check your configuration";

  const copy = document.createElement("p");
  copy.textContent = message;

  content.append(mark, title, copy);
  errorState.append(content);
  elements.diagnosticsList.append(errorState);
}

function setConfigValidity(valid, label) {
  elements.configValidity.classList.toggle("is-invalid", !valid);
  elements.configValidity.textContent = label;
}

async function copyResolvedConfig() {
  const text = elements.resolvedConfig.textContent;

  if (!text || text.startsWith("Configuration unavailable")) {
    return;
  }

  let copied = false;

  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();

    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    } finally {
      textarea.remove();
    }
  }

  window.clearTimeout(copyResetTimer);

  if (!copied) {
    elements.copyConfigButton.classList.remove("is-copied");
    elements.copyConfigButton.setAttribute("aria-label", "Unable to copy resolved configuration");
    elements.copyConfigLabel.textContent = "Copy failed";

    copyResetTimer = window.setTimeout(resetCopyButton, 1600);
    return;
  }

  elements.copyConfigButton.classList.add("is-copied");
  elements.copyConfigButton.setAttribute("aria-label", "Resolved configuration copied");
  elements.copyConfigLabel.textContent = "Copied";

  copyResetTimer = window.setTimeout(resetCopyButton, 1600);
}

function resetCopyButton() {
  elements.copyConfigButton.classList.remove("is-copied");
  elements.copyConfigButton.setAttribute("aria-label", "Copy resolved configuration");
  elements.copyConfigLabel.textContent = "Copy";
}


function initializeTheme() {
  const storedTheme = readStoredTheme();
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(storedTheme || preferredTheme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  setTheme(current === "dark" ? "light" : "dark");
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeToggleLabel.textContent = theme === "dark" ? "Dark" : "Light";
  elements.themeToggle.setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`
  );
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#14110f" : "#f8f3ed";

  try {
    window.localStorage.setItem("hbsguard-playground-theme", theme);
  } catch {
    // Storage can be unavailable in private browsing; the theme still works for this page.
  }
}

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem("hbsguard-playground-theme");
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

initialize();
