"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { lintExample, resolvePlaygroundConfig } = require("../playground/browser-api");

test("resolvePlaygroundConfig returns the recommended rules", () => {
  const config = resolvePlaygroundConfig("recommended");

  assert.equal(config.rules.indentation[0], "error");
  assert.equal(config.rules["mustache-spacing"], "error");
  assert.deepEqual(config.ignore, []);
});

test("resolvePlaygroundConfig resolves inherited Fenrir rules", () => {
  const config = resolvePlaygroundConfig("fenrir");

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
