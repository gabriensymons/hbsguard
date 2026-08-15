"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "dist", "playground");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

test("playground builds as a static site", () => {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });

  const build = spawnSync("npm", ["run", "build:playground"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });

  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  for (const relativePath of [
    "index.html",
    "styles.css",
    "app.js",
    "THIRD_PARTY_NOTICES.md",
    "assets/hbsguard-logo.svg",
    "assets/hbsguard-logo-dark.svg",
  ]) {
    assert.equal(
      fs.existsSync(path.join(OUTPUT_DIR, relativePath)),
      true,
      `${relativePath} should be emitted`
    );
  }

  const bundle = fs.readFileSync(path.join(OUTPUT_DIR, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(OUTPUT_DIR, "index.html"), "utf8");
  assert.doesNotMatch(bundle, /require\(["']node:/u);
  assert.match(html, /<div id="source-editor"><\/div>/u);
  assert.doesNotMatch(html, /id="source-editor"[^>]+aria-label/u);
  assert.doesNotMatch(html, /line-numbers|<textarea[^>]+id="source-editor"/u);

  for (const generatedFile of ["parser.js", "parser.terms.js"]) {
    assert.equal(
      fs.existsSync(
        path.join(REPO_ROOT, "playground", "handlebars-language", generatedFile)
      ),
      true,
      `${generatedFile} should be generated before the Playground bundle`
    );
  }

  const editorSource = ["source-editor.js", "source-editor-implementation.mjs"]
    .map((fileName) =>
      fs.readFileSync(path.join(REPO_ROOT, "playground", fileName), "utf8")
    )
    .join("\n");
  assert.doesNotMatch(editorSource, /basicSetup|require\(["']codemirror["']\)/u);
  assert.match(
    editorSource,
    /EditorView\.contentAttributes\.of\(\{[\s\S]*"aria-label": "Handlebars source editor"/u
  );

  const deployedNotices = fs.readFileSync(
    path.join(OUTPUT_DIR, "THIRD_PARTY_NOTICES.md"),
    "utf8"
  );
  const languageNotice = fs.readFileSync(
    path.join(REPO_ROOT, "playground", "handlebars-language", "NOTICE.md"),
    "utf8"
  );
  assert.ok(deployedNotices.startsWith(languageNotice));
  assert.match(languageNotice, /https:\/\/github\.com\/xiechao\/lang-handlebars/u);
  assert.doesNotMatch(languageNotice, /xiechao\/codemirror-lang-handlebars/u);

  for (const packageName of ["@codemirror/view", "@lezer/lr", "handlebars"]) {
    const packageDir = path.join(REPO_ROOT, "node_modules", ...packageName.split("/"));
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageDir, "package.json"), "utf8")
    );
    const license = fs.readFileSync(path.join(packageDir, "LICENSE"), "utf8").trim();
    assert.match(
      deployedNotices,
      new RegExp(`^## ${escapeRegExp(packageName)} ${escapeRegExp(packageJson.version)}$`, "mu")
    );
    assert.ok(deployedNotices.includes(license), `${packageName} license should be deployed`);
  }
});

test("mobile touch controls keep a 44px minimum height", () => {
  const css = fs.readFileSync(path.join(REPO_ROOT, "playground", "styles.css"), "utf8");
  assert.match(css, /\.copy-button\s*\{[^}]*min-height:\s*44px;/su);
});

test("status glyphs use optical alignment and semantic error colors", () => {
  const appSource = fs.readFileSync(path.join(REPO_ROOT, "playground", "app.js"), "utf8");
  const css = fs.readFileSync(path.join(REPO_ROOT, "playground", "styles.css"), "utf8");

  assert.match(appSource, /mark\.classList\.add\("error-state-mark"\)/u);
  assert.match(css, /\.error-state-mark\s*\{[^}]*color:\s*var\(--danger\);[^}]*background:\s*var\(--danger-soft\);/su);
  assert.match(css, /\.available-rule-action\s*\{[^}]*padding-top:\s*1px;/su);
  assert.match(css, /\.privacy-mark\s*\{[^}]*padding-top:\s*1px;/su);
});

test("CodeMirror gutter lines stay aligned with editor lines", () => {
  const css = fs.readFileSync(path.join(REPO_ROOT, "playground", "styles.css"), "utf8");
  assert.doesNotMatch(css, /#source-editor \.cm-gutters\s*\{[^}]*padding-top:/su);
});

test("CodeMirror and Lezer remain development-only dependencies", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
  );
  assert.deepEqual(Object.keys(packageJson.dependencies), ["handlebars"]);
  assert.equal(packageJson.devDependencies.codemirror, undefined);
  assert.equal(
    packageJson.devDependencies["@gentrace/codemirror-lang-handlebars"],
    undefined
  );
  for (const dependency of [
    "@codemirror/commands",
    "@codemirror/lang-html",
    "@codemirror/language",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/generator",
    "@lezer/highlight",
    "@lezer/lr",
  ]) {
    assert.equal(typeof packageJson.devDependencies[dependency], "string", dependency);
  }
});
