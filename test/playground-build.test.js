"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "dist", "playground");

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
  assert.doesNotMatch(bundle, /require\(["']node:/u);
});
