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

  const result = await esbuild.build({
    entryPoints: [path.join(sourceDir, "app.js")],
    outfile: path.join(outputDir, "app.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    sourcemap: true,
    metafile: true,
    legalComments: "linked",
    logLevel: "info",
  });

  fs.writeFileSync(
    path.join(outputDir, "THIRD_PARTY_NOTICES.md"),
    renderThirdPartyNotices(result.metafile)
  );
}

function renderThirdPartyNotices(metafile) {
  const packageNames = new Set();
  for (const inputPath of Object.keys(metafile.inputs)) {
    const packageName = packageNameFromInput(inputPath);
    if (packageName) {
      packageNames.add(packageName);
    }
  }

  const languageNotice = fs
    .readFileSync(path.join(sourceDir, "handlebars-language", "NOTICE.md"), "utf8")
    .trimEnd();
  const sections = [...packageNames].sort().map((packageName) => {
    const packageDir = path.join(repoRoot, "node_modules", ...packageName.split("/"));
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageDir, "package.json"), "utf8")
    );
    const licensePath = ["LICENSE", "LICENSE.md"]
      .map((fileName) => path.join(packageDir, fileName))
      .find((filePath) => fs.existsSync(filePath));
    if (!licensePath) {
      throw new Error(`Bundled package ${packageName} does not include a license file.`);
    }

    const license = fs.readFileSync(licensePath, "utf8").trim();
    return `## ${packageName} ${packageJson.version}\n\n\`\`\`text\n${license}\n\`\`\``;
  });

  return `${languageNotice}\n\n# Bundled third-party packages\n\nThe deployed Playground bundle includes the following packages and license notices.\n\n${sections.join("\n\n")}\n`;
}

function packageNameFromInput(inputPath) {
  const normalized = inputPath.split(path.sep).join("/");
  const marker = "node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const parts = normalized.slice(markerIndex + marker.length).split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
