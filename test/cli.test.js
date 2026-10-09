"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { runCli: runCliInProcess } = require("../src/cli");
const rules = require("../src/rules");

const BIN_PATH = path.resolve(__dirname, "..", "bin", "hbsguard.js");
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";
const SUMMARY_PREVIEW_PATH = path.resolve(
  __dirname,
  "..",
  "scripts",
  "preview-stylish-summary.js"
);

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
    /Files:     1 with problems, 0 clean, 1 checked\nProblems:  1 error, 0 warnings\nRules:     1  partial-spacing\nTime:      \d+\.\d{2} s\n$/u
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

test("stylish summary preview renders representative problem counts", () => {
  const result = spawnSync(process.execPath, [SUMMARY_PREVIEW_PATH], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "" },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    [
      "Files:     398 with problems, 531 clean, 929 checked",
      "Problems:  786 errors, 0 warnings",
      "Rules:     429  mustache-spacing",
      "           239  no-trailing-spaces",
      "           118  eol-last",
      "Time:      1.90 s",
      "",
    ].join("\n")
  );
});

test("npm preview:stylish shows clean and problem summaries", () => {
  const result = spawnSync(NPM_COMMAND, ["run", "preview:stylish", "--silent"], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "" },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const lines = result.stdout.trimEnd().split("\n");
  assert.deepEqual(lines.slice(0, 3), [
    "=== Clean fixture preview ===",
    "Files:     6 clean, 6 checked",
    "Problems:  0 errors, 0 warnings",
  ]);
  assert.match(lines[3], /^Time:      \d+\.\d{2} s$/u);
  assert.equal(lines[4], "");
  assert.deepEqual(lines.slice(5), [
    "=== Problem summary preview ===",
    "Files:     398 with problems, 531 clean, 929 checked",
    "Problems:  786 errors, 0 warnings",
    "Rules:     429  mustache-spacing",
    "           239  no-trailing-spaces",
    "           118  eol-last",
    "Time:      1.90 s",
  ]);
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
    /Files:     1 with problems, 0 clean, 1 checked\nProblems:  1 error, 0 warnings\nRules:     1  no-trailing-spaces\nTime:      \d+\.\d{2} s\n$/u
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
  assert.doesNotMatch(result.stdout, /eol-last|Rules:/u);
  assert.equal(limitedResult.status, 1);
  assert.match(limitedResult.stderr, /exceeds the configured maximum/u);
  assert.doesNotMatch(limitedResult.stdout, /Rules:/u);
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
    /parse-error[\s\S]*Files:     1 with problems, 0 clean, 1 checked\nProblems:  2 errors, 0 warnings\nRules:     1  no-invalid-bracket-path\n           1  parse-error\nTime:      \d+\.\d{2} s\n$/u
  );
});

const FIX_CONFIG = `module.exports = ${JSON.stringify({ rules: {
  "no-trailing-spaces": "error",
  "eol-last": "error",
  "linebreak-style": ["error", "unix"],
} })};\n`;

test("CLI fixes only with opt-in and never writes parse-error or unchanged files", (t) => {
  const workspace = createWorkspace({
    "hbsguard.config.cjs": FIX_CONFIG,
    "a.hbs": "\ufeffx  \r\n",
    "b.hbs": "{{#if x}}  ",
    "c.hbs": "clean\n",
  }, t);
  const paths = ["a.hbs", "b.hbs", "c.hbs"].map((name) => path.join(workspace, name));
  if (process.platform !== "win32") fs.chmodSync(paths[0], 0o640);
  const original = paths.map((file) => ({ bytes: fs.readFileSync(file), stat: fs.statSync(file) }));
  const dry = runCli(["*.hbs", "--format", "json"], workspace);
  assert.equal(dry.status, 1);
  paths.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), original[index].bytes));
  assert(JSON.parse(dry.stdout).flatMap((r) => r.messages).every((m) => !Object.hasOwn(m, "fix")));

  const fixed = runCli(["*.hbs", "--fix", "--format", "json"], workspace);
  assert.equal(fixed.status, 1);
  assert.equal(fixed.stderr, "");
  assert.equal(fs.readFileSync(paths[0], "utf8"), "\ufeffx\n");
  if (process.platform !== "win32") assert.equal(fs.statSync(paths[0]).mode & 0o777, 0o640);
  for (const index of [1, 2]) {
    assert.deepEqual(fs.readFileSync(paths[index]), original[index].bytes);
    assert.equal(fs.statSync(paths[index]).mtimeMs, original[index].stat.mtimeMs);
    assert.equal(fs.statSync(paths[index]).ino, original[index].stat.ino);
  }
  assert.deepEqual(JSON.parse(fixed.stdout)[0].messages, []);
  assert.deepEqual(JSON.parse(fixed.stdout)[1], JSON.parse(dry.stdout)[1]);
  const after = paths.map((file) => fs.statSync(file));
  const second = runCli(["*.hbs", "--fix", "--format", "json"], workspace);
  assert.equal(second.stdout, fixed.stdout);
  paths.forEach((file, index) => {
    assert.equal(fs.statSync(file).mtimeMs, after[index].mtimeMs);
    assert.equal(fs.statSync(file).ino, after[index].ino);
  });
  assert.deepEqual(fs.readdirSync(workspace).sort(), ["a.hbs", "b.hbs", "c.hbs", "hbsguard.config.cjs"]);
});

test("CLI fixes warnings despite quiet mode and evaluates the final warning count", (t) => {
  const workspace = createWorkspace({
    "hbsguard.config.cjs": "module.exports = { ignore: ['ignored/**'], rules: { 'eol-last': 'warn' } };\n",
    "templates/a.hbs": "x", "ignored/a.hbs": "x",
  }, t);
  const result = runCli(["**/*.hbs", "--fix", "--quiet", "--max-warnings", "0"], workspace);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /1 clean, 1 checked/u);
  assert.equal(fs.readFileSync(path.join(workspace, "templates/a.hbs"), "utf8"), "x\n");
  assert.equal(fs.readFileSync(path.join(workspace, "ignored/a.hbs"), "utf8"), "x");
  assert.match(runCli(["--help"], workspace).stdout, /--fix/u);
});

test("CLI reports remaining unfixable errors after saving supported fixes", (t) => {
  const workspace = createWorkspace({
    "hbsguard.config.cjs": "module.exports = { extends: ['recommended'] };\n",
    "a.hbs": "{{ value}}  ",
  }, t);
  const result = runCli(["a.hbs", "--fix", "--format", "json"], workspace);
  assert.equal(result.status, 1);
  assert.equal(fs.readFileSync(path.join(workspace, "a.hbs"), "utf8"), "{{ value}}\n");
  assert.deepEqual(JSON.parse(result.stdout)[0].messages.map((m) => m.ruleId), ["mustache-spacing"]);
});

test("CLI rejects unsafe inputs without changing bytes", async (t) => {
  for (const kind of ["encoding", "symlink", "hardlink", "nonregular"]) {
    await t.test(kind, (t) => {
      const workspace = createWorkspace({ "hbsguard.config.cjs": FIX_CONFIG, "a.hbs": "x  " }, t);
      const file = path.join(workspace, "a.hbs");
      if (kind === "encoding") fs.writeFileSync(file, Buffer.from([0xff, 0x20]));
      if (kind === "symlink" || kind === "hardlink") {
        const target = path.join(workspace, "target.hbs");
        fs.renameSync(file, target);
        try {
          if (kind === "symlink") fs.symlinkSync(target, file);
          else fs.linkSync(target, file);
        } catch (error) {
          if (error.code !== "EPERM") throw error;
          t.skip("Link creation is unavailable on this host.");
          return;
        }
      }
      if (kind === "nonregular") {
        const lstat = fs.lstatSync;
        t.mock.method(fs, "lstatSync", (...args) => {
          const stat = lstat(...args);
          if (args[0] === file) stat.isFile = () => false;
          return stat;
        });
      }
      const bytes = fs.readFileSync(file);
      const result = runCliCaptured(["a.hbs", "--fix"], workspace, t);
      assert.equal(result.exitCode, 2);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /a\.hbs/u);
      assert.deepEqual(fs.readFileSync(file), bytes);
      assert(!fs.readdirSync(workspace).some((name) => name.startsWith(".hbsguard-")));
    });
  }
});

test("CLI leaves originals intact on temporary write, mode, flush, or rename failure", async (t) => {
  for (const operation of ["writeFileSync", "fchmodSync", "fsyncSync", "renameSync"]) {
    await t.test(operation, (t) => {
      const workspace = createWorkspace({ "hbsguard.config.cjs": FIX_CONFIG, "a.hbs": "x  " }, t);
      t.mock.method(fs, operation, () => { throw new Error(`injected ${operation} failure`); });
      const result = runCliCaptured(["a.hbs", "--fix"], workspace, t);
      assert.equal(result.exitCode, 2);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, new RegExp(`injected ${operation} failure`, "u"));
      assert.equal(fs.readFileSync(path.join(workspace, "a.hbs"), "utf8"), "x  ");
      assert.deepEqual(fs.readdirSync(workspace).sort(), ["a.hbs", "hbsguard.config.cjs"]);
    });
  }
});

test("CLI handles temporary open/close failures without deleting someone else's file", async (t) => {
  for (const kind of ["open", "close"]) {
    await t.test(kind, (t) => {
      const workspace = createWorkspace({ "hbsguard.config.cjs": FIX_CONFIG, "a.hbs": "x " }, t);
      const open = fs.openSync;
      const close = fs.closeSync;
      let temporaryPath;
      let temporaryFd;
      t.mock.method(fs, "openSync", (file, flags, ...rest) => {
        if (flags === "wx") {
          temporaryPath = file;
          if (kind === "open") {
            fs.writeFileSync(file, "someone else's file");
            throw new Error("injected exclusive open failure");
          }
          temporaryFd = open(file, flags, ...rest);
          return temporaryFd;
        }
        return open(file, flags, ...rest);
      });
      t.mock.method(fs, "closeSync", (fd) => {
        close(fd);
        if (fd === temporaryFd) {
          temporaryFd = undefined;
          throw new Error("injected close failure");
        }
      });
      const result = runCliCaptured(["a.hbs", "--fix"], workspace, t);
      assert.equal(result.exitCode, 2);
      assert.equal(fs.readFileSync(path.join(workspace, "a.hbs"), "utf8"), "x ");
      if (kind === "open") assert.equal(fs.readFileSync(temporaryPath, "utf8"), "someone else's file");
      else assert.equal(fs.existsSync(temporaryPath), false);
    });
  }
});

test("CLI preserves concurrent content, identity, mode, and link changes", async (t) => {
  for (const kind of ["content", "identity", "mode", "hardlink"]) {
    await t.test(kind, (t) => {
      if (kind === "mode" && process.platform === "win32") {
        t.skip("POSIX mode bits are not available on Windows.");
        return;
      }
      const workspace = createWorkspace({ "hbsguard.config.cjs": FIX_CONFIG, "a.hbs": "x  " }, t);
      const file = path.join(workspace, "a.hbs");
      const sync = fs.fsyncSync;
      t.mock.method(fs, "fsyncSync", (fd) => {
        sync(fd);
        if (kind === "content") fs.writeFileSync(file, "external edit\n");
        if (kind === "identity") {
          const replacement = path.join(workspace, "external.hbs");
          fs.writeFileSync(replacement, "x  ");
          fs.renameSync(replacement, file);
        }
        if (kind === "mode") fs.chmodSync(file, 0o400);
        if (kind === "hardlink") fs.linkSync(file, path.join(workspace, "external.hbs"));
      });
      const result = runCliCaptured(["a.hbs", "--fix"], workspace, t);
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /changed|hard link/u);
      assert.equal(fs.readFileSync(file, "utf8"), kind === "content" ? "external edit\n" : "x  ");
      assert(!fs.readdirSync(workspace).some((name) => name.startsWith(".hbsguard-")));
    });
  }
});

test("CLI stops on a later write failure without rolling back earlier committed files", (t) => {
  const workspace = createWorkspace({
    "hbsguard.config.cjs": FIX_CONFIG, "a.hbs": "a ", "b.hbs": "b ", "c.hbs": "c ",
  }, t);
  const rename = fs.renameSync;
  t.mock.method(fs, "renameSync", (from, to) => {
    if (to.endsWith("b.hbs")) throw new Error("injected rename failure");
    return rename(from, to);
  });
  const result = runCliCaptured(["*.hbs", "--fix"], workspace, t);
  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /b\.hbs/u);
  for (const [name, expected] of [["a.hbs", "a\n"], ["b.hbs", "b "], ["c.hbs", "c "]]) {
    assert.equal(fs.readFileSync(path.join(workspace, name), "utf8"), expected);
  }
});

test("CLI reports cleanup failure without hiding the original write error", (t) => {
  const workspace = createWorkspace({ "hbsguard.config.cjs": FIX_CONFIG, "a.hbs": "x " }, t);
  t.mock.method(fs, "fsyncSync", () => { throw new Error("injected flush failure"); });
  t.mock.method(fs, "unlinkSync", () => { throw new Error("injected cleanup failure"); });
  const result = runCliCaptured(["a.hbs", "--fix"], workspace, t);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /flush failure.*cleanup failed.*cleanup failure/u);
  assert.equal(fs.readFileSync(path.join(workspace, "a.hbs"), "utf8"), "x ");
});

test("CLI rejects conflicting or parse-breaking fixes before writing", async (t) => {
  for (const kind of ["conflict", "parse"]) {
    await t.test(kind, (t) => {
      const workspace = createWorkspace({ "hbsguard.config.cjs": FIX_CONFIG, "a.hbs": "x " }, t);
      t.mock.method(rules["eol-last"], "create", (context) => ({ Template() {
        const report = { message: "test", fix: { range: [0, 2], text: kind === "parse" ? "{{#if x}}" : "y" } };
        context.report(report);
        if (kind === "conflict") context.report(report);
      } }));
      // Avoid an intentional conflict with the ordinary trailing-space report.
      fs.writeFileSync(path.join(workspace, "hbsguard.config.cjs"), "module.exports = { rules: { 'eol-last': 'error' } };\n");
      const result = runCliCaptured(["a.hbs", "--fix"], workspace, t);
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, kind === "parse" ? /introduced a parse error/u : /Overlapping fixes/u);
      assert.equal(fs.readFileSync(path.join(workspace, "a.hbs"), "utf8"), "x ");
    });
  }
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
