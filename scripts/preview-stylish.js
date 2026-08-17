"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const previews = [
  {
    title: "Clean fixture preview",
    scriptPath: path.join(repoRoot, "bin", "hbsguard.js"),
    args: ["test/fixtures/templates/**/*.hbs"],
  },
  {
    title: "Problem summary preview",
    scriptPath: path.join(repoRoot, "scripts", "preview-stylish-summary.js"),
    args: [],
  },
];

for (const [index, preview] of previews.entries()) {
  process.stdout.write(`=== ${preview.title} ===\n`);

  const result = spawnSync(process.execPath, [preview.scriptPath, ...preview.args], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (index < previews.length - 1) {
    process.stdout.write("\n");
  }
}
