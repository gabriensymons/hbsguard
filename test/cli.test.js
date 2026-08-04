"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

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
  assert.equal(result.stdout, "");
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

function runCli(args, cwd) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd,
    encoding: "utf8",
  });
}
