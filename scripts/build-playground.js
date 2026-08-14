"use strict";

const fs = require("node:fs");
const path = require("node:path");

const esbuild = require("esbuild");

const repoRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(repoRoot, "playground");
const outputDir = path.join(repoRoot, "dist", "playground");

async function build() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const fileName of ["index.html", "styles.css"]) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(outputDir, fileName));
  }

  fs.cpSync(path.join(sourceDir, "assets"), path.join(outputDir, "assets"), {
    recursive: true,
  });

  await esbuild.build({
    entryPoints: [path.join(sourceDir, "app.js")],
    outfile: path.join(outputDir, "app.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    sourcemap: true,
    legalComments: "linked",
    logLevel: "info",
  });
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
