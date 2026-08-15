"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { runCli: runCliInProcess } = require("../src/cli");

const BIN_PATH = path.resolve(__dirname, "..", "bin", "hbsguard.js");

test("CLI emits stylish output and exits nonzero for lint errors", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  extends: ['recommended']",
        "};",
        "",
      ].join("\n"),
      "templates/bad.hbs": "{{>foo}}\n",
    },
    t
  );
  const result = runCli(["templates/**/*.hbs"], workspace);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /templates\/bad\.hbs/u);
  assert.match(result.stdout, /partial-spacing/u);
  assert.match(
    result.stdout,
    /Files:     1 with problems, 0 clean, 1 checked\nProblems:  1 error, 0 warnings\nTime:      \d+\.\d{2} s\n$/u
  );
  assert.doesNotMatch(result.stdout, /\u001b\[/u);
});

test("CLI reports injectable elapsed time for a clean run", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": "module.exports = { rules: {} };\n",
      "templates/clean.hbs": "{{value}}\n",
    },
    t
  );
  const result = runCliCaptured(["templates/**/*.hbs"], workspace, t, {
    timestamps: [1000, 2180],
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    [
      "Files:     1 clean, 1 checked",
      "Problems:  0 errors, 0 warnings",
      "Time:      1.18 s",
      "",
    ].join("\n")
  );
});

test("CLI enables standard ANSI colors for interactive TTY output", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  rules: {",
        "    'no-trailing-spaces': 'error',",
        "    'eol-last': 'warn'",
        "  }",
        "};",
        "",
      ].join("\n"),
      "templates/problem.hbs": "value  ",
      "templates/clean.hbs": "{{value}}\n",
    },
    t
  );
  const result = runCliCaptured(["templates/**/*.hbs"], workspace, t, {
    isTTY: true,
    timestamps: [1000, 2234],
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /\u001b\[31merror\u001b\[39m/u);
  assert.match(result.stdout, /\u001b\[33mwarning\u001b\[39m/u);
  assert.match(result.stdout, /\u001b\[1mFiles:\u001b\[22m/u);
  assert.match(
    result.stdout,
    /\u001b\[1m\u001b\[31m1 with problems\u001b\[39m\u001b\[22m/u
  );
  assert.match(result.stdout, /\u001b\[1m\u001b\[32m1 clean\u001b\[39m\u001b\[22m/u);
  assert.match(result.stdout, /\u001b\[39m\u001b\[22m, 2 checked/u);
  assert.doesNotMatch(result.stdout, /\u001b\[1m2 checked/u);
  assert.match(
    result.stdout,
    /\u001b\[1mProblems:\u001b\[22m  \u001b\[1m\u001b\[31m1 error\u001b\[39m\u001b\[22m, \u001b\[1m\u001b\[33m1 warning\u001b\[39m\u001b\[22m/u
  );
  assert.match(
    result.stdout,
    /\u001b\[1mTime:\u001b\[22m      \u001b\[1m\u001b\[32m1\.23 s\u001b\[39m\u001b\[22m\n$/u
  );
});

test("CLI respects NO_COLOR for interactive TTY output", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  rules: {",
        "    'eol-last': 'warn'",
        "  }",
        "};",
        "",
      ].join("\n"),
      "templates/warning.hbs": "value",
    },
    t
  );
  const result = runCliCaptured(["templates/**/*.hbs"], workspace, t, {
    env: { NO_COLOR: "" },
    isTTY: true,
    timestamps: [1000, 2234],
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /\u001b\[/u);
  assert.match(result.stdout, /Problems:  0 errors, 1 warning/u);
  assert.match(result.stdout, /Time:      1\.23 s\n$/u);
});

test("CLI applies recommended rules when no config file exists", (t) => {
  const workspace = createWorkspace(
    {
      "templates/bad.hbs": "{{>foo}}\n",
    },
    t
  );
  const result = runCli(["templates/**/*.hbs", "--format", "stylish"], workspace);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /templates\/bad\.hbs/u);
  assert.match(result.stdout, /partial-spacing/u);
});

test("CLI emits JSON output when requested", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  extends: ['recommended']",
        "};",
        "",
      ].join("\n"),
      "templates/bad.hbs": "{{>foo}}\n",
    },
    t
  );
  const result = runCli(["templates/**/*.hbs", "--format", "json"], workspace);

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.length, 1);
  assert.equal(payload[0].messages[0].ruleId, "partial-spacing");
  assert.equal(result.stdout, `${JSON.stringify(payload, null, 2)}\n`);
  assert.doesNotMatch(result.stdout, /Files:|Problems:|Time:/u);
});

test("CLI honors config ignore patterns", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  extends: ['recommended'],",
        "  ignore: ['ignored/**']",
        "};",
        "",
      ].join("\n"),
      "ignored/bad.hbs": "{{>foo}}\n",
      "templates/good.hbs": "{{value}}\n",
    },
    t
  );
  const result = runCli(["**/*.hbs"], workspace);

  assert.equal(result.status, 0);
  assert.match(
    result.stdout,
    /^Files:     1 clean, 1 checked\nProblems:  0 errors, 0 warnings\nTime:      \d+\.\d{2} s\n$/u
  );
  assert.doesNotMatch(result.stdout, /ignored|skipped|\u001b\[/u);
});

test("CLI reports zero checked files when input patterns match nothing", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": "module.exports = { rules: {} };\n",
    },
    t
  );
  const result = runCli(["missing/**/*.hbs"], workspace);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(
    result.stdout,
    /^Files:     0 clean, 0 checked\nProblems:  0 errors, 0 warnings\nTime:      \d+\.\d{2} s\n$/u
  );
});

test("CLI fails when warnings exceed --max-warnings", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  rules: {",
        "    'eol-last': 'warn'",
        "  }",
        "};",
        "",
      ].join("\n"),
      "templates/warn.hbs": "value",
    },
    t
  );
  const result = runCli(["templates/**/*.hbs", "--max-warnings", "0"], workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /exceeds the configured maximum/u);
  assert.match(result.stdout, /eol-last/u);
});

test("CLI quiet mode suppresses warnings in formatter output", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  rules: {",
        "    'no-trailing-spaces': 'error',",
        "    'eol-last': 'warn'",
        "  }",
        "};",
        "",
      ].join("\n"),
      "templates/mixed.hbs": "value  ",
    },
    t
  );
  const result = runCli(["templates/**/*.hbs", "--quiet"], workspace);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /no-trailing-spaces/u);
  assert.doesNotMatch(result.stdout, /eol-last/u);
  assert.match(
    result.stdout,
    /Files:     1 with problems, 0 clean, 1 checked\nProblems:  1 error, 0 warnings\nTime:      \d+\.\d{2} s\n$/u
  );
});

test("CLI quiet mode treats warning-only files as clean in the visible summary", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  rules: {",
        "    'eol-last': 'warn'",
        "  }",
        "};",
        "",
      ].join("\n"),
      "templates/warning.hbs": "value",
    },
    t
  );
  const result = runCli(["templates/**/*.hbs", "--quiet"], workspace);
  const limitedResult = runCli(
    ["templates/**/*.hbs", "--quiet", "--max-warnings", "0"],
    workspace
  );

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(
    result.stdout,
    /^Files:     1 clean, 1 checked\nProblems:  0 errors, 0 warnings\nTime:      \d+\.\d{2} s\n$/u
  );
  assert.doesNotMatch(result.stdout, /eol-last/u);
  assert.equal(limitedResult.status, 1);
  assert.match(limitedResult.stderr, /exceeds the configured maximum/u);
  assert.match(
    limitedResult.stdout,
    /^Files:     1 clean, 1 checked\nProblems:  0 errors, 0 warnings\nTime:      \d+\.\d{2} s\n$/u
  );
});

test("CLI exits nonzero on parse errors", (t) => {
  const workspace = createWorkspace(
    {
      "hbsguard.config.cjs": [
        "module.exports = {",
        "  extends: ['recommended']",
        "};",
        "",
      ].join("\n"),
      "templates/broken.hbs": "{{#with foo[bar]}}\n{{/with}}\n",
    },
    t
  );
  const result = runCli(["templates/**/*.hbs"], workspace);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /parse-error/u);
  assert.match(result.stdout, /Unexpected token 'INVALID'\./u);
  assert.doesNotMatch(result.stdout, /CLOSE_RAW_BLOCK/u);
  assert.match(result.stdout, /\{\{#with foo\[bar\]\}\}/u);
  assert.match(result.stdout, /\n\s+\|\s+ {8}\^/u);
  assert.match(
    result.stdout,
    /parse-error[\s\S]*Files:     1 with problems, 0 clean, 1 checked\nProblems:  2 errors, 0 warnings\nTime:      \d+\.\d{2} s\n$/u
  );
});

function createWorkspace(files, t) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hbsguard-cli-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }

  return workspace;
}

function runCliCaptured(args, cwd, t, options = {}) {
  const timestamps = options.timestamps || [0, 0];
  let timestampIndex = 0;
  let stdout = "";
  let stderr = "";
  const previousExitCode = process.exitCode;

  t.after(() => {
    process.exitCode = previousExitCode;
  });

  const exitCode = runCliInProcess(
    args,
    {
      stdout: {
        isTTY: options.isTTY === true,
        write: (chunk) => (stdout += chunk),
      },
      stderr: { write: (chunk) => (stderr += chunk) },
    },
    {
      cwd,
      env: options.env || {},
      now: () => timestamps[timestampIndex++],
    }
  );

  return { exitCode, stderr, stdout };
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd,
    encoding: "utf8",
  });
}
