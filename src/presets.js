"use strict";

const PRESETS = {
  recommended: {
    ignore: [],
    rules: {
      indentation: ["error", { size: 2, blockDepth: true }],
      "mustache-spacing": "error",
      "partial-spacing": "error",
      "no-trailing-spaces": "error",
      "eol-last": "error",
      "linebreak-style": ["error", "unix"],
      "no-invalid-bracket-path": "error",
    },
  },
  fenrir: {
    extends: ["recommended"],
    ignore: [".runtime-cache/**"],
    rules: {
      indentation: "off",
      "no-bare-builtin-block-helpers": "error",
    },
  },
};

function hasPreset(name) {
  return Object.prototype.hasOwnProperty.call(PRESETS, name);
}

function getPreset(name) {
  if (!hasPreset(name)) {
    throw new Error(`Unknown preset "${name}".`);
  }

  return PRESETS[name];
}

module.exports = {
  getPreset,
  hasPreset,
  PRESETS,
};
