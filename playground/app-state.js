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

module.exports = {
  getRuleTogglePresentation,
  resolveExamplePreset,
};
