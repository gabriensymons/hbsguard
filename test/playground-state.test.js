"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getFixButtonPresentation,
  getRuleTogglePresentation,
  resolveExamplePreset,
} = require("../playground/app-state");
const { fixExample } = require("../playground/browser-api");

test("fix button follows actual fix availability, even when manual diagnostics remain", () => {
  const source = "{{#if x}}\n    {{ value}}  \n{{/if}}";
  const preview = fixExample(source);
  assert.deepEqual(getFixButtonPresentation({ canFix: preview.changed }), {
    label: "Apply whitespace fixes", disabled: false,
  });

  assert(preview.result.messages.some((message) => message.ruleId === "indentation"));
  assert(!preview.result.messages.some((message) => message.ruleId === "mustache-spacing"));
  const after = fixExample(preview.output);
  assert.deepEqual(getFixButtonPresentation({ canFix: after.changed, applied: true }), {
    label: "✓ Fixes applied", disabled: true,
  });
  assert.deepEqual(getFixButtonPresentation({ canFix: after.changed }), {
    label: "No automatic fixes", disabled: true,
  });

  const edited = fixExample(`${preview.output}more  `);
  assert.deepEqual(getFixButtonPresentation({ canFix: edited.changed }), {
    label: "Apply whitespace fixes", disabled: false,
  });
});

test("fix button recomputes eligibility for rule overrides and empty configurations", () => {
  const source = "x";
  const noRules = { preset: "empty" };
  const finalNewline = { preset: "empty", config: { rules: { "eol-last": "warn" } } };
  assert.equal(getFixButtonPresentation({ canFix: fixExample(source, noRules).changed }).disabled, true);
  assert.equal(getFixButtonPresentation({ canFix: fixExample(source, finalNewline).changed }).disabled, false);
  assert.equal(getFixButtonPresentation({ canFix: fixExample("{{#if x}} ").changed }).disabled, true);
});

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
