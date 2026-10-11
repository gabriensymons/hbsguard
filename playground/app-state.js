"use strict";

function getRuleTogglePresentation(ruleId, added) {
  return added
    ? {
        label: `Remove ${ruleId} from overrides`,
        mark: "✓",
      }
    : {
        label: `Add ${ruleId} as a warning override`,
        mark: "+",
      };
}

function resolveExamplePreset({ currentPreset, examplePreset, useExamplePreset = false }) {
  return useExamplePreset ? examplePreset : currentPreset;
}

function getFixButtonPresentation({ canFix, applied = false }) {
  if (canFix) {
    return { label: "Apply whitespace fixes", disabled: false };
  }
  return { label: applied ? "✓ Fixes applied" : "No automatic fixes", disabled: true };
}

module.exports = {
  getFixButtonPresentation,
  getRuleTogglePresentation,
  resolveExamplePreset,
};
