"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildParserFile } = require("@lezer/generator");

const repoRoot = path.resolve(__dirname, "..");
const languageDir = path.join(repoRoot, "playground", "handlebars-language");
const grammarPath = path.join(languageDir, "syntax.grammar");
const source = fs.readFileSync(grammarPath, "utf8");
const generated = buildParserFile(source, {
  fileName: grammarPath,
  moduleStyle: "es",
});

writeIfChanged(path.join(languageDir, "parser.js"), generated.parser);
writeIfChanged(path.join(languageDir, "parser.terms.js"), generated.terms);

function writeIfChanged(filePath, content) {
  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== content) {
    fs.writeFileSync(filePath, content);
  }
}
