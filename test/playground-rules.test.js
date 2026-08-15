"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const rules = require("../src/rules");
const {
  addRuleOverride,
  RULE_REFERENCE,
  toggleRuleOverride,
} = require("../playground/rule-reference");

test("Playground rule reference covers every hbsguard rule", () => {
  assert.deepEqual(
    RULE_REFERENCE.map(({ id }) => id).sort(),
    Object.keys(rules).sort()
  );

  for (const rule of RULE_REFERENCE) {
    assert.ok(rule.description.length > 0, `${rule.id} should have a description`);
  }
});

test("addRuleOverride adds a warning override without mutating the input", () => {
  const config = { rules: { "eol-last": "off" } };
  const updated = addRuleOverride(config, "mustache-spacing");

  assert.deepEqual(updated, {
    rules: {
      "eol-last": "off",
      "mustache-spacing": "warn",
    },
  });
  assert.deepEqual(config, { rules: { "eol-last": "off" } });
});

test("toggleRuleOverride removes an authored override without mutating other config", () => {
  const config = {
    extends: ["recommended"],
    rules: {
      indentation: ["error", 4],
      "mustache-spacing": "warn",
    },
  };

  assert.deepEqual(toggleRuleOverride(config, "indentation"), {
    extends: ["recommended"],
    rules: {
      "mustache-spacing": "warn",
    },
  });
  assert.deepEqual(config.rules.indentation, ["error", 4]);
});

test("addRuleOverride rejects unknown rules", () => {
  assert.throws(() => addRuleOverride({ rules: {} }, "missing"), /Unknown rule "missing"\./u);
});

test("addRuleOverride rejects invalid configuration shapes", () => {
  for (const config of [null, [], "invalid"]) {
    assert.throws(
      () => addRuleOverride(config, "indentation"),
      /Playground config must be an object\./u
    );
  }
});
