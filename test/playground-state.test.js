"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getRuleTogglePresentation,
  resolveExamplePreset,
} = require("../playground/app-state");

test("initial example selects its advertised base configuration", () => {
  assert.equal(
    resolveExamplePreset({
      currentPreset: "recommended",
      examplePreset: "empty",
      useExamplePreset: true,
    }),
    "empty"
  );
});

test("available rule presentation exposes reversible add and remove actions", () => {
  assert.deepEqual(getRuleTogglePresentation("indentation", false), {
    label: "Add indentation as a warning override",
    mark: "+",
  });
  assert.deepEqual(getRuleTogglePresentation("indentation", true), {
    label: "Remove indentation from overrides",
    mark: "✓",
  });
});

test("switching examples preserves the selected base configuration", () => {
  assert.equal(
    resolveExamplePreset({
      currentPreset: "empty",
      examplePreset: "recommended",
      useExamplePreset: false,
    }),
    "empty"
  );
});
