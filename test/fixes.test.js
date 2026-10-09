"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { applyFixes } = require("../src/fixes");
const { fixText, lintText } = require("../src/lint-text");
const rules = require("../src/rules");

function apply(source, fixes) {
  return applyFixes(source, fixes.map((fix) => ({ ruleId: "test", fix })), "test.hbs");
}

function options(style = "unix") {
  return {
    filePath: "test.hbs",
    config: { rules: {
      "no-trailing-spaces": "error",
      "eol-last": "error",
      "linebreak-style": ["error", style],
    } },
  };
}

test("range application sorts edits and allows endpoint insertions", () => {
  const fixes = [
    { range: [2, 4], text: "CD" },
    { range: [0, 2], text: "AB" },
    { range: [2, 2], text: ">" },
    { range: [0, 0], text: "<" },
  ];
  assert.equal(apply("abcd", fixes), "<AB>CD");
  assert.equal(apply("abcd", fixes.toReversed()), "<AB>CD");
  assert.equal(apply("x  ", [
    { range: [3, 3], text: "\n" },
    { range: [1, 3], text: "" },
  ]), "x\n");
  assert.equal(apply("😀  \n", [{ range: [2, 4], text: "" }]), "😀\n");
  assert.equal(apply("abc", []), "abc");
  assert.equal(apply("abc", [
    { range: [0, 1], text: "a" },
    { range: [0, 2], text: "AB" },
    { range: [0, 0], text: "" },
  ]), "ABc");
});

test("invalid replacements are rejected before no-op filtering", () => {
  const invalid = [
    null, [], {}, { range: [0, 1], text: 1 },
    ...[new Array(2), [, 1], [0, ,], [0], [0, 1, 2], [-1, 0], [2, 1], [0, 4], [4, 4], [0.5, 1],
      [NaN, 1], [0, Infinity], ["0", 1]].map((range) => ({ range, text: "" })),
  ];
  for (const fix of invalid) {
    assert.throws(() => apply("abc", [fix]), { code: "HBSGUARD_INVALID_FIX" });
  }
  for (const range of [[0, 1], [1, 2], [1, 1]]) {
    assert.throws(() => apply("😀", [{ range, text: "" }]), { code: "HBSGUARD_INVALID_FIX" });
  }
});

test("overlap rejection includes nested spans, duplicates, and insertion ties", () => {
  for (const ranges of [
    [[0, 2], [1, 3]], [[0, 3], [1, 2]], [[0, 3], [1, 1]],
    [[1, 1], [1, 1]], [[0, 2], [0, 2]],
  ]) {
    const fixes = ranges.map((range) => ({ range, text: "X" }));
    assert.throws(() => apply("abcd", fixes), { code: "HBSGUARD_OVERLAPPING_FIXES" });
    assert.throws(() => apply("abcd", fixes.toReversed()), { code: "HBSGUARD_OVERLAPPING_FIXES" });
  }
});

test("candidate combinations normalize endings and reach an idempotent result", () => {
  const cases = [
    ["x  \n", "unix", "x\n"], ["x  ", "unix", "x\n"],
    ["x  \r\n", "unix", "x\n"], ["x  \r\n", "windows", "x  \r\n"],
    ["x  \ny", "windows", "x\r\ny\r\n"],
    ["x\r\ny\nz", "unix", "x\ny\nz\n"],
    ["x\r\ny\nz", "windows", "x\r\ny\r\nz\r\n"],
    ["x\r", "unix", "x\n"], ["x\r", "windows", "x\r\n"],
    ["", "unix", ""], ["x\n\n", "unix", "x\n\n"],
    ["   ", "unix", "\n"], ["😀\t \n", "unix", "😀\n"],
    ["\ufeffx \r\n", "unix", "\ufeffx\n"],
    ['{{helper "x  \n"}}\n', "unix", '{{helper "x\n"}}\n'],
    ["<pre>x  \n</pre>\n", "unix", "<pre>x\n</pre>\n"],
    ["{{{{raw}}}}x  \n{{{{/raw}}}}\n", "unix", "{{{{raw}}}}x\n{{{{/raw}}}}\n"],
  ];
  for (const [input, style, expected] of cases) {
    const settings = options(style);
    const fixed = fixText(input, settings);
    assert.equal(fixed.output, expected);
    assert.equal(fixed.changed, input !== expected);
    assert.deepEqual(fixed.result, lintText(expected, settings));
    assert.deepEqual(fixText(expected, settings), { ...fixed, changed: false });
    const entries = Object.entries(settings.config.rules);
    for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      assert.deepEqual(fixText(input, {
        ...settings, config: { rules: Object.fromEntries(order.map((index) => entries[index])) },
      }), fixed);
    }
  }
});

test("each candidate obeys off, warn, and error without leaking fix metadata", () => {
  for (const [ruleId, input, output] of [
    ["no-trailing-spaces", "x  \n", "x\n"],
    ["eol-last", "x\r\ny", "x\r\ny\r\n"],
    ["linebreak-style", "x\r\n", "x\n"],
  ]) {
    for (const severity of ["off", "warn", "error"]) {
      const settings = { config: { rules: { [ruleId]: severity } } };
      const before = lintText(input, settings);
      const fixed = fixText(input, settings);
      assert.equal(fixed.output, severity === "off" ? input : output);
      assert.deepEqual(lintText(input, settings), before);
      assert(before.messages.every((message) => !Object.hasOwn(message, "fix")));
    }
  }
  const onlyEol = { config: { rules: { "eol-last": "error" } } };
  assert.equal(fixText("x\r\ny\nz", onlyEol).output, "x\r\ny\nz\r\n");
  assert.equal(fixText("x  ").output, "x  ");
  assert.throws(() => fixText(null), TypeError);
  assert.throws(() => fixText(1), TypeError);
});

test("original parse errors retain both parse and rule diagnostics", () => {
  const input = "{{#if x}}  ";
  const settings = options();
  const original = lintText(input, settings);
  assert(original.messages.some((m) => m.ruleId === "parse-error"));
  assert(original.messages.some((m) => m.ruleId === "no-trailing-spaces"));
  assert.deepEqual(fixText(input, settings), { output: input, changed: false, result: original });
});

test("unfixable findings remain after supported fixes", () => {
  const settings = options();
  settings.config.rules["mustache-spacing"] = "error";
  const fixed = fixText("{{ value}}  ", settings);
  assert.equal(fixed.output, "{{ value}}\n");
  assert.deepEqual(fixed.result.messages.map((m) => m.ruleId), ["mustache-spacing"]);
});

function mockReports(t, getFixes) {
  t.mock.method(rules["eol-last"], "create", (context) => ({
    Template({ sourceCode }) {
      for (const fix of getFixes(sourceCode.text)) {
        context.report({ line: 1, column: 1, message: "test fix", fix });
      }
    },
  }));
  return { filePath: "test.hbs", config: { rules: { "eol-last": "error" } } };
}

test("ordinary lint and parse-error input ignore malformed fix metadata", (t) => {
  const settings = mockReports(t, () => [null]);
  assert.equal(lintText("x", settings).messages[0].message, "test fix");
  assert.equal(fixText("{{#if x}}", settings).changed, false);
  assert.throws(() => fixText("x", settings), { code: "HBSGUARD_INVALID_FIX" });
});

test("fixes introducing parse errors reject the operation", (t) => {
  const settings = mockReports(t, (text) => [{ range: [0, text.length], text: "{{#if x}}" }]);
  assert.throws(() => fixText("x", settings), { code: "HBSGUARD_FIX_PARSE_ERROR" });
});

test("a conflict on a later pass rejects all proposed output", (t) => {
  const settings = mockReports(t, (text) => text === "a"
    ? [{ range: [0, 1], text: "b" }]
    : [{ range: [0, 1], text: "c" }, { range: [0, 1], text: "c" }]);
  assert.throws(() => fixText("a", settings), { code: "HBSGUARD_OVERLAPPING_FIXES" });
});

test("ten mutation passes can converge, but an eleventh is rejected", async (t) => {
  for (const limit of [10, 11]) {
    await t.test(`needs ${limit} passes`, (t) => {
      const settings = mockReports(t, (text) => text.length >= limit
        ? [] : [{ range: [text.length, text.length], text: "x" }]);
      if (limit === 10) {
        assert.equal(fixText("", settings).output, "x".repeat(10));
      } else {
        assert.throws(() => fixText("", settings), { code: "HBSGUARD_FIX_LIMIT" });
      }
    });
  }
});

test("oscillating fixes and long CR chains fail without an unbounded loop", (t) => {
  assert.throws(() => fixText(`x${"\r".repeat(11)}\n`, options()), { code: "HBSGUARD_FIX_LIMIT" });
  const settings = mockReports(t, (text) => [{ range: [0, 1], text: text === "a" ? "b" : "a" }]);
  assert.throws(() => fixText("a", settings), { code: "HBSGUARD_FIX_LIMIT" });
});

test("the package exports fixText without removing the existing API", () => {
  assert.deepEqual(Object.keys(require("../src")).sort(), [
    "fixText", "formatResults", "lintFiles", "lintText", "loadConfig",
  ]);
  assert.equal(require("../src").fixText, fixText);
});
