"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { lintExample } = require("../playground/browser-api");
const { EXAMPLES } = require("../playground/examples");

test("every Playground example demonstrates its advertised rule", () => {
  assert.ok(EXAMPLES.length >= 8);

  for (const example of EXAMPLES) {
    const result = lintExample(example.source, {
      preset: example.preset,
      filePath: example.fileName,
    });
    const ruleIds = result.messages.map((message) => message.ruleId);

    if (example.expectedRule === null) {
      assert.deepEqual(ruleIds, [], `${example.id} should start with no diagnostics`);
      continue;
    }

    assert.ok(
      ruleIds.includes(example.expectedRule),
      `${example.id} should demonstrate ${example.expectedRule}; got ${ruleIds.join(", ")}`
    );
  }
});

test("Playground includes an empty configuration example", () => {
  const example = EXAMPLES.find(({ id }) => id === "empty-config");

  assert.ok(example);
  assert.equal(example.preset, "empty");
  assert.equal(example.expectedRule, null);
});
