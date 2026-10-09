"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { fixExample, lintExample, resolvePlaygroundConfig } = require("../playground/browser-api");
const { fixText } = require("../src/lint-text");

test("resolvePlaygroundConfig returns the recommended rules", () => {
  const config = resolvePlaygroundConfig("recommended");

  assert.equal(config.rules.indentation[0], "error");
  assert.equal(config.rules["mustache-spacing"], "error");
  assert.deepEqual(config.ignore, []);
});

test("resolvePlaygroundConfig resolves inherited custom rules", () => {
  const config = resolvePlaygroundConfig("custom");

  assert.equal(config.rules.indentation, "off");
  assert.equal(config.rules["mustache-spacing"], "error");
  assert.equal(config.rules["no-bare-builtin-block-helpers"], "error");
});

test("resolvePlaygroundConfig supports an empty Playground configuration", () => {
  assert.deepEqual(resolvePlaygroundConfig("empty"), {
    extends: [],
    ignore: [],
    rules: {},
  });
});

test("resolvePlaygroundConfig applies rule overrides without mutating presets", () => {
  const config = resolvePlaygroundConfig("recommended", {
    rules: {
      "eol-last": "warn",
    },
  });

  assert.equal(config.rules["eol-last"], "warn");
  assert.equal(resolvePlaygroundConfig("recommended").rules["eol-last"], "error");
});

test("resolvePlaygroundConfig rejects unknown presets", () => {
  assert.throws(
    () => resolvePlaygroundConfig("missing"),
    /Unknown preset "missing"\./u
  );
});

test("lintExample returns browser-friendly diagnostics", () => {
  const result = lintExample("{{title }}\n", {
    preset: "recommended",
    filePath: "example.hbs",
  });

  assert.equal(result.filePath, "example.hbs");
  assert.equal(result.errorCount, 1);
  assert.equal(result.messages[0].ruleId, "mustache-spacing");
  assert.equal(result.messages[0].line, 1);
});

test("playground fixes use the shared engine with the selected configuration", () => {
  for (const source of ["x  \r\ny", "<footer>{{copyright}}</footer>", "x\t \n"]) {
    const options = { preset: "recommended", filePath: "demo.hbs" };
    const fixed = fixExample(source, options);
    assert.deepEqual(fixed, fixText(source, {
      config: resolvePlaygroundConfig(options.preset), filePath: options.filePath,
    }));
    assert.equal(fixed.changed, true);
    assert.deepEqual(fixed.result, lintExample(fixed.output, options));
    assert.equal(fixExample(fixed.output, options).changed, false);
  }
});

test("playground fixes respect disabled rules, warning overrides, and Windows endings", () => {
  assert.equal(fixExample("x  ", { preset: "empty" }).output, "x  ");
  const options = {
    preset: "empty",
    config: { rules: {
      "eol-last": "warn", "linebreak-style": ["warn", "windows"],
      "no-trailing-spaces": "off",
    } },
  };
  assert.equal(fixExample("x  \ny", options).output, "x  \r\ny\r\n");
});

test("playground fixes preserve parse-error and unsupported input", () => {
  for (const source of ["{{#if x}}  ", "{{ value}}\n"]) {
    const original = lintExample(source);
    const fixed = fixExample(source);
    assert.equal(fixed.output, source);
    assert.equal(fixed.changed, false);
    assert.deepEqual(fixed.result, original);
  }
  assert.throws(() => fixExample("x", { preset: "missing" }), /Unknown preset/u);
  assert.throws(() => fixExample("x", { config: null }), /must be an object/u);
  assert.throws(() => fixExample(`x${"\r".repeat(11)}\n`), { code: "HBSGUARD_FIX_LIMIT" });
});
