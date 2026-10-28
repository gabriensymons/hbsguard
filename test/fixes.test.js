"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const Handlebars = require("handlebars");
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
    ["mustache-spacing", "{{ value}}", "{{value}}"],
    ["partial-spacing", "{{>p}}", "{{> p}}"],
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
  settings.config.rules["no-bare-builtin-block-helpers"] = "error";
  const fixed = fixText("{{if x}}  ", settings);
  assert.equal(fixed.output, "{{if x}}\n");
  assert.deepEqual(fixed.result.messages.map((m) => m.ruleId), ["no-bare-builtin-block-helpers"]);
});

function spacingOptions(style = "consistent", beforeClose = "allow") {
  return { config: { rules: {
    "mustache-spacing": ["error", { style }],
    "partial-spacing": ["error", { beforeClose }],
  } } };
}

test("mustache spacing repairs only invalid padding with the selected style", () => {
  for (const [style, source, output] of [
    ["consistent", "{{ value}} {{value }} {{  value\t}} {{ value }} {{value}}", "{{value}} {{value}} {{value}} {{ value }} {{value}}"],
    ["always", "{{value}} {{{value}}} {{~value~}}", "{{ value }} {{{ value }}} {{~ value ~}}"],
    ["never", "{{ value }} {{{ value }}} {{~ value ~}}", "{{value}} {{{value}}} {{~value~}}"],
    ["consistent", "{{#if x }}A{{else if y }}B{{else }}C{{/if }}", "{{#if x}}A{{else if y}}B{{else}}C{{/if}}"],
    ["consistent", "{{#[normal] }}A{{/[normal] }}", "{{#[normal]}}A{{/[normal]}}"],
    ["never", "{{^if x }}A{{^ }}B{{/if }} {{&value }}", "{{^if x}}A{{^}}B{{/if}} {{&value}}"],
    ["always", "{{#if x}}A{{else if y}}B{{else}}C{{/if}} {{&value}}", "{{#if x}}A{{ else if y }}B{{ else }}C{{/if}} {{&value}}"],
    ["consistent", "\ufeff😀{{ value}} {{ other}}", "\ufeff😀{{value}} {{other}}"],
  ]) {
    const settings = spacingOptions(style);
    const fixed = fixText(source, settings);
    assert.equal(fixed.output, output, `${style}: ${source}`);
    assert.deepEqual(fixed.result, lintText(output, settings));
    assert.equal(fixText(output, settings).changed, false);
  }
  const manual = "{{#if x}}A{{^}}B{{/if}} {{&value}} {{~{value}~}}";
  const settings = spacingOptions("always");
  assert.equal(fixText(manual, settings).output, manual);
  assert.equal(fixText(manual, settings).result.errorCount, 5);
});

test("partial spacing handles blocks, dynamic names, trim markers, and closing options", () => {
  for (const [beforeClose, source, output] of [
    ["allow", "{{>p}} {{>\t p  }} {{> p }}", "{{> p}} {{> p }} {{> p }}"],
    ["never", "{{>p  }} {{~>\tp \t~}}", "{{> p}} {{~> p~}}"],
    ["allow", "{{#>p  }}X{{/p}}", "{{#> p }}X{{/p}}"],
    ["allow", "{{#>[normal]  }}X{{/[normal] }}", "{{#> [normal] }}X{{/[normal]}}"],
    ["never", '{{>  (lookup names "selected")  }}', '{{> (lookup names "selected")}}'],
    ["allow", '{{>p title="hello world"  }}', '{{> p title="hello world" }}'],
  ]) {
    const settings = spacingOptions("consistent", beforeClose);
    const fixed = fixText(source, settings);
    assert.equal(fixed.output, output);
    assert.deepEqual(fixed.result.messages, []);
    assert.equal(fixText(output, settings).changed, false);
  }
});

test("ambiguous scanner boundaries and literal content remain manual", () => {
  for (const source of [
    '{{helper "x  }} value"}}',
    '{{helper "}} {{ value}} {{>p}}"}}',
    "{{helper [x  }} y]}}",
    "{{helper [x  }} y]=value}}",
    "{{#[a  }} ]}}X{{/[a  }} ] }}",
    "{{#[x }} {{else }}]}}X{{/[x }} {{else }}]}}",
    "{{#[x }} {{  /z]}}A{{/[x }} {{  /z] }}",
    "{{#[x }} {{ /z]}}A{{/[x }} {{ /z] }}",
    "{{#>[x }} {{ /z]}}A{{/[x }} {{ /z] }}",
    '{{#> "x }} {{ /z" }}A{{/[x }} {{ /z] }}',
    "{{#if x}}{{else }}{{/if}}",
    "{{{{raw}}}}{{ value}}{{>p}}{{{{/raw}}}}",
    "{{!-- {{ value}} {{>p}} --}}",
    "\\{{ value}}",
    "{{{value}~}}",
    '{{#*inline "p"}}{{{{raw}}}}{{else }}{{{{/raw}}}}{{/inline}}',
    '{{#*inline "p"}}{{helper "}} {{else }}"}}{{/inline}}',
  ]) {
    for (const style of ["consistent", "always", "never"]) {
      const settings = spacingOptions(style);
      const original = lintText(source, settings);
      assert(!original.messages.some((message) => message.ruleId === "parse-error"), source);
      assert.deepEqual(fixText(source, settings), { output: source, changed: false, result: original });
    }
  }
});

test("spacing fixes preserve line breaks and leave multiline closing padding alone", () => {
  for (const [source, output] of [
    ["{{helper\n x }}", "{{helper\n x }}"],
    ["{{\rvalue}}", "{{\rvalue}}"],
    ["{{\u2028value}}", "{{\u2028value}}"],
    ["  {{>\n p}}\nZ", "  {{>\n p}}\nZ"],
    ["{{>\r\n p}}", "{{>\r\n p}}"],
    ["{{>\r p}}", "{{>\r p}}"],
    ["{{>\u2028p}}", "{{>\u2028p}}"],
    ["{{#>\n p}}X{{/p}}", "{{#>\n p}}X{{/p}}"],
    ["{{>  p\n x  }}", "{{> p\n x  }}"],
    ["{{> p\n x  }}", "{{> p\n x  }}"],
  ]) {
    const settings = spacingOptions("consistent", "never");
    const fixed = fixText(source, settings);
    assert.equal(fixed.output, output);
    assert.equal(fixText(output, settings).changed, false);
  }
});

test("spacing fixes preserve rendering, including standalone and trimmed partials", () => {
  const handlebars = Handlebars.create();
  handlebars.registerHelper("echo", (value) => value);
  handlebars.registerHelper("raw", (options) => options.fn());
  handlebars.registerPartial("p", "P\nQ\n");
  handlebars.registerPartial("layout", "L[{{> @partial-block}}]\n");
  const data = { value: "<value>", x: true, y: false, names: { selected: "p" } };
  for (const source of [
    "😀{{ value}} {{{ value}}} {{~ value~}}",
    "{{#if x }}A{{else if y }}B{{else }}C{{/if }}",
    "{{^if y }}A{{^ }}B{{/if }} {{&value }}",
    '  {{>  (lookup names "selected")  }}\nZ',
    "  {{>p  }}\nZ",
    "  {{~>p  ~}}\nZ",
    "  {{#>layout  }}\nX\n  {{/layout }}\nZ",
    "  {{>  p\n }}\nZ",
    '  {{echo "}} {{ value}} {{>p}}"}}\n',
    "{{{{raw}}}}{{ value}}{{>p}}{{{{/raw}}}}",
  ]) {
    for (const style of ["consistent", "always", "never"]) {
      for (const beforeClose of ["allow", "never"]) {
        const settings = spacingOptions(style, beforeClose);
        const fixed = fixText(source, settings);
        for (const compileOptions of [{}, { ignoreStandalone: true }, { preventIndent: true }]) {
          assert.equal(handlebars.compile(fixed.output, compileOptions)(data),
            handlebars.compile(source, compileOptions)(data), `${style}/${beforeClose}: ${source}`);
        }
        assert.equal(fixText(fixed.output, settings).changed, false);
      }
    }
  }
});

test("spacing composes with existing whitespace fixes without depending on rule order", () => {
  const source = "\ufeff😀{{ value}}  \r\n{{>p  }}  \r\n{{>  p\r\n x}}";
  for (const linebreakStyle of ["unix", "windows"]) {
    const settings = options(linebreakStyle);
    Object.assign(settings.config.rules, spacingOptions().config.rules);
    const output = linebreakStyle === "unix"
      ? "\ufeff😀{{value}}\n{{> p }}\n{{> p\n x}}\n"
      : "\ufeff😀{{value}}  \r\n{{> p }}  \r\n{{> p\r\n x}}\r\n";
    const fixed = fixText(source, settings);
    assert.equal(fixed.output, output);
    assert.deepEqual(fixed.result.messages, []);
    assert.equal(fixText(output, settings).changed, false);
    assert.deepEqual(fixText(source, {
      ...settings, config: { rules: Object.fromEntries(Object.entries(settings.config.rules).toReversed()) },
    }), fixed);
  }
  const sourceWithParseError = "{{ value}} {{>p}} {{#if x}}";
  const settings = spacingOptions();
  assert.deepEqual(fixText(sourceWithParseError, settings), {
    output: sourceWithParseError, changed: false, result: lintText(sourceWithParseError, settings),
  });
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
