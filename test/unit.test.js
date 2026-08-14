"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { loadConfig } = require("../src/config");
const { formatResults } = require("../src/formatters");
const {
  createGlobMatcher,
  getGlobMatchPath,
  getPatternBaseDirectory,
  resolveLintFiles,
} = require("../src/files");
const { lintFiles, lintText } = require("../src/linter");

const REPO_ROOT = path.resolve(__dirname, "..");
const RECOMMENDED_RULES = {
  indentation: ["error", { size: 2, blockDepth: true }],
  "mustache-spacing": "error",
  "partial-spacing": "error",
  "no-trailing-spaces": "error",
  "eol-last": "error",
  "linebreak-style": ["error", "unix"],
  "no-invalid-bracket-path": "error",
};

test("loadConfig applies the recommended preset when no config file exists", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-config-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  const loaded = loadConfig({ cwd: workspace });

  assert.deepEqual(loaded.config, {
    extends: [],
    ignore: [],
    rules: RECOMMENDED_RULES,
  });
  assert.equal(loaded.configFilePath, null);
  assert.equal(loaded.rootDir, workspace);
});

test("loadConfig applies the recommended preset from hbsguard.config.cjs", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-config-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  fs.writeFileSync(
    path.join(workspace, "hbsguard.config.cjs"),
    [
      "module.exports = {",
      "  extends: ['recommended'],",
      "  ignore: ['build/**'],",
      "  rules: {",
      "    'eol-last': 'warn'",
      "  }",
      "};",
      "",
    ].join("\n")
  );

  const loaded = loadConfig({ cwd: workspace });

  assert.equal(loaded.config.rules["mustache-spacing"], "error");
  assert.equal(loaded.config.rules["eol-last"], "warn");
  assert.deepEqual(loaded.config.ignore, ["build/**"]);
});

test("loadConfig applies the custom preset with project-specific semantic checks", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-config-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  fs.writeFileSync(
    path.join(workspace, "hbsguard.config.cjs"),
    [
      "module.exports = {",
      "  extends: ['custom']",
      "};",
      "",
    ].join("\n")
  );

  const loaded = loadConfig({ cwd: workspace });

  assert.equal(loaded.config.rules.indentation, "off");
  assert.equal(loaded.config.rules["no-bare-builtin-block-helpers"], "error");
  assert.equal(loaded.config.rules["mustache-spacing"], "error");
  assert.deepEqual(loaded.config.ignore, [".runtime-cache/**"]);
});

test("custom preset ignores .runtime-cache during file discovery", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-custom-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  fs.writeFileSync(
    path.join(workspace, "hbsguard.config.cjs"),
    [
      "module.exports = {",
      "  extends: ['custom']",
      "};",
      "",
    ].join("\n")
  );
  fs.mkdirSync(path.join(workspace, ".runtime-cache"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "templates"), { recursive: true });
  fs.writeFileSync(path.join(workspace, ".runtime-cache", "ignored.hbs"), "{{>foo}}\n");
  fs.writeFileSync(path.join(workspace, "templates", "tracked.hbs"), "{{>foo}}\n");

  const loaded = loadConfig({ cwd: workspace });
  const results = lintFiles(["**/*.hbs"], {
    cwd: workspace,
    config: loaded.config,
  });

  assert.equal(results.length, 1);
  assert.match(results[0].filePath, /templates\/tracked\.hbs$/u);
  assert.deepEqual(
    results[0].messages.map((message) => message.ruleId),
    ["partial-spacing"]
  );
});

test("absolute glob base directories preserve filesystem roots", () => {
  assert.equal(getPatternBaseDirectory("/**/*.hbs", "/workspace", path.posix), "/");
  assert.equal(
    getPatternBaseDirectory("C:\\**\\*.hbs", "C:\\workspace", path.win32),
    "C:\\"
  );
});

test("Windows root-relative absolute globs match drive-qualified candidates", () => {
  const pattern = "\\**\\*.hbs";
  const candidate = "C:\\templates\\nested\\matched.hbs";
  const matchPath = getGlobMatchPath(pattern, candidate, "C:\\workspace", path.win32);
  const matcher = createGlobMatcher(pattern, path.win32);

  assert.equal(matchPath, "/templates/nested/matched.hbs");
  assert.equal(matcher(matchPath), true);
});

test("Windows drive-qualified absolute globs match drive letters case-insensitively", () => {
  const pattern = "C:\\templates\\**\\*.hbs";
  const candidate = "c:\\templates\\nested\\matched.hbs";
  const matchPath = getGlobMatchPath(pattern, candidate, "C:\\workspace", path.win32);
  const matcher = createGlobMatcher(pattern, path.win32);

  assert.equal(matcher(matchPath), true);
});

test("Windows UNC-share absolute globs match UNC candidates", () => {
  const pattern = "\\\\server\\share\\**\\*.hbs";
  const candidate = "\\\\server\\share\\nested\\matched.hbs";
  const matchPath = getGlobMatchPath(pattern, candidate, "C:\\workspace", path.win32);
  const matcher = createGlobMatcher(pattern, path.win32);

  assert.equal(matchPath, "//server/share/nested/matched.hbs");
  assert.equal(matcher(matchPath), true);
});

test("Windows absolute globs normalize lexical dot segments before matching", () => {
  const cases = [
    {
      pattern: "C:\\workspace\\.\\templates\\**\\*.hbs",
      candidate: "C:\\workspace\\templates\\nested\\matched.hbs",
      expectedBase: "C:\\workspace\\templates",
    },
    {
      pattern: "C:/workspace/other/../templates/**/*.hbs",
      candidate: "C:\\workspace\\templates\\nested\\matched.hbs",
      expectedBase: "C:\\workspace\\templates",
    },
    {
      pattern: "C:\\workspace/other\\..\\templates/**/*.hbs",
      candidate: "C:\\workspace\\templates\\nested\\matched.hbs",
      expectedBase: "C:\\workspace\\templates",
    },
    {
      pattern: "/other/../templates/**/*.hbs",
      candidate: "C:\\templates\\nested\\matched.hbs",
      expectedBase: "C:\\templates",
    },
    {
      pattern: "//server/share/other/../templates/**/*.hbs",
      candidate: "\\\\server\\share\\templates\\nested\\matched.hbs",
      expectedBase: "\\\\server\\share\\templates",
    },
    {
      pattern: "C:\\workspace\\other\\..\\templates\\**\\*.hbs",
      candidate: "C:\\workspace\\templates\\nested\\matched.hbs",
      expectedBase: "C:\\workspace\\templates",
    },
    {
      pattern: "\\other\\..\\templates\\**\\*.hbs",
      candidate: "C:\\templates\\nested\\matched.hbs",
      expectedBase: "C:\\templates",
    },
    {
      pattern: "\\\\server\\share\\other\\..\\templates\\**\\*.hbs",
      candidate: "\\\\server\\share\\templates\\nested\\matched.hbs",
      expectedBase: "\\\\server\\share\\templates",
    },
  ];

  for (const { pattern, candidate, expectedBase } of cases) {
    const matchPath = getGlobMatchPath(pattern, candidate, "C:\\workspace", path.win32);
    const matcher = createGlobMatcher(pattern, path.win32);

    assert.equal(getPatternBaseDirectory(pattern, "C:\\workspace", path.win32), expectedBase);
    assert.equal(matcher(matchPath), true);
  }
});

test("absolute glob patterns discover matching files", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-files-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  fs.mkdirSync(path.join(workspace, "templates", "nested"), { recursive: true });
  fs.writeFileSync(path.join(workspace, "templates", "nested", "matched.hbs"), "{{value}}\n");
  fs.writeFileSync(path.join(workspace, "templates", "nested", "skipped.txt"), "not a template\n");

  const results = lintFiles([path.join(workspace, "templates", "**", "*.hbs")], {
    cwd: workspace,
    config: createConfig({}),
  });

  assert.deepEqual(
    results.map((result) => result.filePath),
    [path.join(workspace, "templates", "nested", "matched.hbs")]
  );
});

test("POSIX absolute globs normalize lexical dot segments before matching", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-files-"));
  const target = path.join(root, "target");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(target, "nested"), { recursive: true });
  fs.writeFileSync(path.join(target, "nested", "matched.hbs"), "{{value}}\n");

  const expectedFiles = [path.join(target, "nested", "matched.hbs")];

  assert.deepEqual(resolveLintFiles([`${root}/./target/**/*.hbs`], { cwd: root }), expectedFiles);
  assert.deepEqual(
    resolveLintFiles([`${root}/unused/../target/**/*.hbs`], { cwd: root }),
    expectedFiles
  );
});

test("absolute glob patterns respect relative ignore patterns", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-files-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  fs.mkdirSync(path.join(workspace, "templates", "ignored"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "templates", "included"), { recursive: true });
  fs.writeFileSync(path.join(workspace, "templates", "ignored", "bad.hbs"), "{{>bad}}\n");
  fs.writeFileSync(path.join(workspace, "templates", "included", "good.hbs"), "{{value}}\n");

  const results = lintFiles([path.join(workspace, "templates", "**", "*.hbs")], {
    cwd: workspace,
    config: {
      ignore: ["templates/ignored/**"],
      rules: {},
    },
  });

  assert.deepEqual(
    results.map((result) => result.filePath),
    [path.join(workspace, "templates", "included", "good.hbs")]
  );
});

test("absolute globs outside cwd anchor ignores to the glob base", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-files-"));
  const cwd = path.join(root, "caller");
  const target = path.join(root, "target");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(cwd);
  fs.mkdirSync(path.join(target, "ignored"), { recursive: true });
  fs.mkdirSync(path.join(target, "node_modules", "pkg"), { recursive: true });
  fs.mkdirSync(path.join(target, "templates"), { recursive: true });
  fs.writeFileSync(path.join(target, "ignored", "skip.hbs"), "ignored\n");
  fs.writeFileSync(path.join(target, "node_modules", "pkg", "dep.hbs"), "dependency\n");
  fs.writeFileSync(path.join(target, "templates", "keep.hbs"), "included\n");

  const files = resolveLintFiles([path.join(target, "**", "*.hbs")], {
    cwd,
    ignore: ["ignored/**"],
  });

  assert.deepEqual(files, [path.join(target, "templates", "keep.hbs")]);
});

test("direct directories outside cwd anchor ignores to the directory", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-files-"));
  const cwd = path.join(root, "caller");
  const target = path.join(root, "target");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(cwd);
  fs.mkdirSync(path.join(target, "ignored"), { recursive: true });
  fs.mkdirSync(path.join(target, "node_modules", "pkg"), { recursive: true });
  fs.mkdirSync(path.join(target, "templates"), { recursive: true });
  fs.writeFileSync(path.join(target, "ignored", "skip.hbs"), "ignored\n");
  fs.writeFileSync(path.join(target, "node_modules", "pkg", "dep.hbs"), "dependency\n");
  fs.writeFileSync(path.join(target, "templates", "keep.hbs"), "included\n");

  const files = resolveLintFiles([target], {
    cwd,
    ignore: ["ignored/**"],
  });

  assert.deepEqual(files, [path.join(target, "templates", "keep.hbs")]);
});

test("JSON formatting preserves full parse-error diagnostics byte-for-byte", () => {
  const diagnostic =
    "Parse error on line 1: Expecting 'ID', 'STRING', got 'INVALID'";
  const results = [createFormatterResult({ ruleId: "parse-error", message: diagnostic })];
  const output = formatResults(results, "json", {
    elapsedMs: 1234,
    useColor: true,
  });

  assert.equal(output, JSON.stringify(results, null, 2));
  assert.equal(JSON.parse(output)[0].messages[0].message, diagnostic);
});

test("stylish formatting reports aligned file, problem, and elapsed-time totals", () => {
  const results = [
    createFormatterFile("/workspace/mixed.hbs", [
      createFormatterMessage(2, "first error"),
      createFormatterMessage(1, "first warning"),
    ]),
    createFormatterFile("/workspace/warning.hbs", [
      createFormatterMessage(1, "second warning"),
    ]),
    createFormatterFile("/workspace/clean.hbs"),
  ];

  const output = formatResults(results, "stylish", {
    cwd: "/workspace",
    elapsedMs: 1234,
  });

  assert.equal(
    getStylishSummary(output),
    [
      "Files:     2 with problems, 1 clean, 3 checked",
      "Problems:  1 error, 2 warnings",
      "Time:      1.23 s",
    ].join("\n")
  );
});

test("stylish formatting colors complete active count-label groups", () => {
  const results = [
    createFormatterFile("/workspace/mixed.hbs", [
      createFormatterMessage(2, "first error"),
      createFormatterMessage(2, "second error"),
      createFormatterMessage(1, "first warning"),
      createFormatterMessage(1, "second warning"),
      createFormatterMessage(1, "third warning"),
    ]),
    createFormatterFile("/workspace/clean.hbs"),
  ];

  const output = formatResults(results, "stylish", {
    cwd: "/workspace",
    elapsedMs: 1234,
    useColor: true,
  });

  assert.match(output, /\u001b\[31merror\u001b\[39m/u);
  assert.match(output, /\u001b\[33mwarning\u001b\[39m/u);
  assert.equal(
    getStylishSummary(output),
    [
      "\u001b[1mFiles:\u001b[22m     \u001b[31m1 with problems\u001b[39m, \u001b[1m\u001b[32m1 clean\u001b[39m\u001b[22m, 2 checked",
      "\u001b[1mProblems:\u001b[22m  \u001b[1m\u001b[31m2 errors\u001b[39m\u001b[22m, \u001b[1m\u001b[33m3 warnings\u001b[39m\u001b[22m",
      "\u001b[1mTime:\u001b[22m      \u001b[1m\u001b[32m1.23 s\u001b[39m\u001b[22m",
    ].join("\n")
  );
});

test("stylish formatting leaves zero problem groups and checked totals plain", () => {
  const output = formatResults(
    [createFormatterFile("/workspace/clean.hbs")],
    "stylish",
    { cwd: "/workspace", elapsedMs: 1180, useColor: true }
  );

  assert.equal(
    output,
    [
      "\u001b[1mFiles:\u001b[22m     \u001b[1m\u001b[32m1 clean\u001b[39m\u001b[22m, 1 checked",
      "\u001b[1mProblems:\u001b[22m  0 errors, 0 warnings",
      "\u001b[1mTime:\u001b[22m      \u001b[1m\u001b[32m1.18 s\u001b[39m\u001b[22m",
    ].join("\n")
  );
});

test("stylish formatting uses singular and plural diagnostic labels", () => {
  const cases = [
    {
      messages: [createFormatterMessage(2, "error")],
      problems: "1 error, 0 warnings",
    },
    {
      messages: [createFormatterMessage(1, "warning")],
      problems: "0 errors, 1 warning",
    },
    {
      messages: [
        createFormatterMessage(2, "first error"),
        createFormatterMessage(2, "second error"),
        createFormatterMessage(1, "first warning"),
        createFormatterMessage(1, "second warning"),
      ],
      problems: "2 errors, 2 warnings",
    },
  ];

  for (const { messages, problems } of cases) {
    const output = formatResults(
      [createFormatterFile("/workspace/problem.hbs", messages)],
      "stylish",
      { cwd: "/workspace", elapsedMs: 10 }
    );

    assert.equal(
      getStylishSummary(output),
      [
        "Files:     1 with problems, 0 clean, 1 checked",
        `Problems:  ${problems}`,
        "Time:      0.01 s",
      ].join("\n")
    );
  }
});

test("stylish formatting reports clean and zero-match runs", () => {
  const cleanOutput = formatResults(
    [createFormatterFile("/workspace/clean.hbs")],
    "stylish",
    { cwd: "/workspace", elapsedMs: 1180 }
  );
  const noMatchOutput = formatResults([], "stylish", {
    cwd: "/workspace",
    elapsedMs: 5,
  });

  assert.equal(
    cleanOutput,
    [
      "Files:     1 clean, 1 checked",
      "Problems:  0 errors, 0 warnings",
      "Time:      1.18 s",
    ].join("\n")
  );
  assert.equal(
    noMatchOutput,
    [
      "Files:     0 clean, 0 checked",
      "Problems:  0 errors, 0 warnings",
      "Time:      0.01 s",
    ].join("\n")
  );
});

test("stylish formatting preserves non-parse messages exactly", () => {
  const diagnostic = "Keep this message, got text and punctuation exactly.";
  const output = formatResults(
    [createFormatterResult({ ruleId: "custom-rule", message: diagnostic })],
    "stylish",
    { cwd: "/workspace" }
  );

  assert.match(output, new RegExp(`  ${escapeRegExp(diagnostic)}  custom-rule`, "u"));
});

test("stylish parse errors handle unexpected end of input", () => {
  const output = formatResults(
    [
      createFormatterResult({
        ruleId: "parse-error",
        message: "Parse error on line 1: Unexpected end of input",
      }),
    ],
    "stylish",
    { cwd: "/workspace" }
  );

  assert.match(output, /  Unexpected end of input  parse-error/u);
  assert.doesNotMatch(output, /Parse error on line 1:/u);
});

test("stylish formatting preserves unrecognized parse-error messages", () => {
  const diagnostic = "Parser failed unexpectedly.";
  const output = formatResults(
    [createFormatterResult({ ruleId: "parse-error", message: diagnostic })],
    "stylish",
    { cwd: "/workspace" }
  );

  assert.match(output, new RegExp(`  ${escapeRegExp(diagnostic)}  parse-error`, "u"));
});

test("public regression fixtures lint clean under the recommended rules", () => {
  const results = lintFiles(["test/fixtures/templates/**/*.hbs"], {
    cwd: REPO_ROOT,
    config: createConfig(RECOMMENDED_RULES),
  });

  assert.equal(results.length, 6);
  assert.deepEqual(
    results.flatMap((result) => result.messages),
    []
  );
});

test("parse errors and invalid bracket paths report stable locations", () => {
  const result = lintText("{{#with foo[bar]}}\n{{/with}}\n", {
    filePath: "broken.hbs",
    config: createConfig(RECOMMENDED_RULES),
  });

  assert.deepEqual(
    result.messages.map((message) => ({
      ruleId: message.ruleId,
      line: message.line,
      column: message.column,
      source: message.source,
    })),
    [
      {
        ruleId: "parse-error",
        line: 1,
        column: 9,
        source: "{{#with foo[bar]}}",
      },
      {
        ruleId: "no-invalid-bracket-path",
        line: 1,
        column: 12,
        source: undefined,
      },
    ]
  );
});

test("no-invalid-bracket-path ignores bracket text inside string literals", () => {
  const result = lintText('{{helper "foo[bar]" single=\'baz[qux]\'}}\n', {
    filePath: "strings.hbs",
    config: createConfig({ "no-invalid-bracket-path": "error" }),
  });

  assert.deepEqual(result.messages, []);
});

test("mustache-spacing ignores escaped Handlebars expressions", () => {
  const result = lintText("\\{{ value}}\n", {
    filePath: "escaped.hbs",
    config: createConfig({ "mustache-spacing": "error" }),
  });

  assert.deepEqual(result.messages, []);
});

test("mustache-spacing checks expressions preceded by multiple backslashes", () => {
  const result = lintText("\\\\{{ value}}\n", {
    filePath: "backslashes.hbs",
    config: createConfig({ "mustache-spacing": "error" }),
  });

  assert.deepEqual(
    result.messages.map(({ ruleId }) => ruleId),
    ["mustache-spacing"]
  );
});

test("mustache-spacing allows balanced styles and rejects asymmetric padding", () => {
  assert.deepEqual(
    lintText("{{value}}\n{{ value }}\n", {
      filePath: "valid.hbs",
      config: createConfig({ "mustache-spacing": "error" }),
    }).messages,
    []
  );

  const invalid = lintText("{{ value}}\n", {
    filePath: "invalid.hbs",
    config: createConfig({ "mustache-spacing": "error" }),
  });

  assert.deepEqual(
    invalid.messages.map((message) => ({
      ruleId: message.ruleId,
      line: message.line,
      column: message.column,
    })),
    [{ ruleId: "mustache-spacing", line: 1, column: 1 }]
  );
});

test("mustache-spacing can require padded mustaches as an opt-in style", () => {
  const result = lintText("{{title}}\n{{ title}}\n", {
    filePath: "mustache-style.hbs",
    config: createConfig({
      "mustache-spacing": ["error", { style: "always" }],
    }),
  });

  assert.deepEqual(
    result.messages.map((message) => ({
      ruleId: message.ruleId,
      line: message.line,
      column: message.column,
    })),
    [
      { ruleId: "mustache-spacing", line: 1, column: 1 },
      { ruleId: "mustache-spacing", line: 2, column: 1 },
    ]
  );
});

test("partial-spacing requires a separator after the partial marker", () => {
  const result = lintText("{{>foo}}\n", {
    filePath: "partial.hbs",
    config: createConfig({ "partial-spacing": "error" }),
  });

  assert.deepEqual(
    result.messages.map((message) => ({
      ruleId: message.ruleId,
      line: message.line,
      column: message.column,
    })),
    [{ ruleId: "partial-spacing", line: 1, column: 1 }]
  );
});

test("partial-spacing can require no space before the closing braces as an opt-in style", () => {
  const result = lintText("{{> foo }}\n", {
    filePath: "partial-style.hbs",
    config: createConfig({
      "partial-spacing": ["error", { beforeClose: "never" }],
    }),
  });

  assert.deepEqual(
    result.messages.map((message) => ({
      ruleId: message.ruleId,
      line: message.line,
      column: message.column,
    })),
    [{ ruleId: "partial-spacing", line: 1, column: 1 }]
  );
});

test("indentation uses Handlebars block depth", () => {
  const result = lintText("{{#if value}}\n<div>\n{{/if}}\n", {
    filePath: "indentation.hbs",
    config: createConfig({
      indentation: ["error", { size: 2, blockDepth: true }],
    }),
  });

  assert.deepEqual(
    result.messages.map((message) => ({
      ruleId: message.ruleId,
      line: message.line,
      column: message.column,
    })),
    [{ ruleId: "indentation", line: 2, column: 1 }]
  );
});

test("line-oriented rules report exact locations", () => {
  const trailingSpaces = lintText("x  \n", {
    filePath: "trailing.hbs",
    config: createConfig({ "no-trailing-spaces": "error" }),
  });
  const eolLast = lintText("x", {
    filePath: "eol.hbs",
    config: createConfig({ "eol-last": "error" }),
  });
  const linebreakStyle = lintText("x\r\ny\r\n", {
    filePath: "linebreaks.hbs",
    config: createConfig({ "linebreak-style": ["error", "unix"] }),
  });

  assert.deepEqual(
    trailingSpaces.messages.map(({ ruleId, line, column }) => ({ ruleId, line, column })),
    [{ ruleId: "no-trailing-spaces", line: 1, column: 2 }]
  );
  assert.deepEqual(
    eolLast.messages.map(({ ruleId, line, column }) => ({ ruleId, line, column })),
    [{ ruleId: "eol-last", line: 1, column: 2 }]
  );
  assert.deepEqual(
    linebreakStyle.messages.map(({ ruleId, line, column }) => ({ ruleId, line, column })),
    [
      { ruleId: "linebreak-style", line: 1, column: 2 },
      { ruleId: "linebreak-style", line: 2, column: 2 },
    ]
  );
});

test("no-bare-builtin-block-helpers flags inline use of built-in block helpers", () => {
  const result = lintText("{{if foo}}\n", {
    filePath: "builtin-helper.hbs",
    config: createConfig({
      "no-bare-builtin-block-helpers": "error",
    }),
  });

  assert.deepEqual(
    result.messages.map((message) => ({
      ruleId: message.ruleId,
      line: message.line,
      column: message.column,
    })),
    [{ ruleId: "no-bare-builtin-block-helpers", line: 1, column: 1 }]
  );
});

function createFormatterResult({ ruleId, message }) {
  return {
    filePath: "/workspace/template.hbs",
    messages: [
      {
        ruleId,
        severity: 2,
        line: 1,
        column: 1,
        message,
        source: "{{broken}}",
      },
    ],
    errorCount: 1,
    warningCount: 0,
  };
}

function createFormatterFile(filePath, messages = []) {
  return {
    filePath,
    messages,
    errorCount: messages.filter(({ severity }) => severity === 2).length,
    warningCount: messages.filter(({ severity }) => severity === 1).length,
  };
}

function createFormatterMessage(severity, message) {
  return {
    ruleId: "test-rule",
    severity,
    line: 1,
    column: 1,
    message,
  };
}

function getStylishSummary(output) {
  return output.split("\n").slice(-3).join("\n");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function createConfig(rules) {
  return {
    ignore: [],
    rules,
  };
}
