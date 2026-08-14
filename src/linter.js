"use strict";

const fs = require("node:fs");

const { resolveLintFiles } = require("./files");
const { lintText } = require("./lint-text");

function lintFiles(patterns, options = {}) {
  const config = options.config || { ignore: [], rules: {} };
  const cwd = options.cwd || process.cwd();
  const filePaths = resolveLintFiles(patterns, {
    cwd,
    ignore: config.ignore,
  });

  return filePaths.map((filePath) => {
    const text = fs.readFileSync(filePath, "utf8");

    return lintText(text, {
      config,
      filePath,
    });
  });
}

module.exports = {
  lintFiles,
  lintText,
};
