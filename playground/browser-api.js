"use strict";

const { lintText } = require("../src/lint-text");
const { getPreset } = require("../src/presets");

function resolvePlaygroundConfig(presetName = "recommended", overrides = {}) {
  const preset =
    presetName === "empty" ? createEmptyConfig() : resolvePreset(presetName, new Set());

  return mergeConfigs(preset, normalizeOverrides(overrides));
}

function lintExample(text, options = {}) {
  const config = resolvePlaygroundConfig(options.preset, options.config);

  return lintText(text, {
    config,
    filePath: options.filePath || "playground.hbs",
  });
}

function resolvePreset(name, seen) {
  if (seen.has(name)) {
    throw new Error(`Circular preset extends detected at "${name}".`);
  }

  seen.add(name);

  const raw = getPreset(name);
  let resolved = createEmptyConfig();

  for (const parent of raw.extends || []) {
    resolved = mergeConfigs(resolved, resolvePreset(parent, seen));
  }

  seen.delete(name);

  return mergeConfigs(resolved, {
    ignore: Array.isArray(raw.ignore) ? raw.ignore : [],
    rules: raw.rules || {},
  });
}

function normalizeOverrides(overrides) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    throw new Error("Playground config must be an object.");
  }

  return {
    ignore: Array.isArray(overrides.ignore) ? overrides.ignore : [],
    rules:
      overrides.rules && typeof overrides.rules === "object" && !Array.isArray(overrides.rules)
        ? overrides.rules
        : {},
  };
}

function mergeConfigs(base, override) {
  return {
    extends: [],
    ignore: [...base.ignore, ...override.ignore],
    rules: {
      ...base.rules,
      ...override.rules,
    },
  };
}

function createEmptyConfig() {
  return {
    extends: [],
    ignore: [],
    rules: {},
  };
}

module.exports = {
  lintExample,
  resolvePlaygroundConfig,
};
