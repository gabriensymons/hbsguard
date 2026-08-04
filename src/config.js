"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { getPreset, hasPreset } = require("./presets");

function loadConfig(options = {}) {
  const cwd = options.cwd || process.cwd();
  const configFilePath = resolveConfigPath(cwd, options.configPath);

  if (!configFilePath) {
    return {
      config: resolveExtends(["recommended"], cwd, new Set()),
      configFilePath: null,
      rootDir: cwd,
    };
  }

  const config = resolveConfigFile(configFilePath, new Set());

  return {
    config,
    configFilePath,
    rootDir: path.dirname(configFilePath),
  };
}

function resolveConfigPath(cwd, configPath) {
  if (configPath) {
    return path.resolve(cwd, configPath);
  }

  const defaultPath = path.join(cwd, "hbsguard.config.cjs");

  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
}

function resolveConfigFile(filePath, seen) {
  const marker = `file:${filePath}`;

  if (seen.has(marker)) {
    throw new Error(`Circular config extends detected at "${filePath}".`);
  }

  seen.add(marker);

  const rawConfig = normalizeConfig(loadConfigModule(filePath));
  const mergedExtends = resolveExtends(rawConfig.extends, path.dirname(filePath), seen);

  seen.delete(marker);

  return mergeConfigs(mergedExtends, {
    ignore: rawConfig.ignore,
    rules: rawConfig.rules,
  });
}

function resolvePreset(name, seen) {
  const marker = `preset:${name}`;

  if (seen.has(marker)) {
    throw new Error(`Circular config extends detected at preset "${name}".`);
  }

  seen.add(marker);

  const preset = normalizeConfig(getPreset(name));
  const mergedExtends = resolveExtends(preset.extends, process.cwd(), seen);

  seen.delete(marker);

  return mergeConfigs(mergedExtends, {
    ignore: preset.ignore,
    rules: preset.rules,
  });
}

function resolveExtends(extendsEntries, baseDir, seen) {
  let merged = createEmptyConfig();

  for (const entry of extendsEntries) {
    let resolvedConfig;

    if (hasPreset(entry)) {
      resolvedConfig = resolvePreset(entry, seen);
    } else {
      resolvedConfig = resolveConfigFile(path.resolve(baseDir, entry), seen);
    }

    merged = mergeConfigs(merged, resolvedConfig);
  }

  return merged;
}

function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("hbsguard config must export an object.");
  }

  return {
    extends: Array.isArray(config.extends)
      ? [...config.extends]
      : config.extends
      ? [config.extends]
      : [],
    ignore: Array.isArray(config.ignore) ? [...config.ignore] : [],
    rules: config.rules && typeof config.rules === "object" ? { ...config.rules } : {},
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

function loadConfigModule(filePath) {
  delete require.cache[require.resolve(filePath)];
  return require(filePath);
}

module.exports = {
  loadConfig,
};
