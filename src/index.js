"use strict";

const { lintFiles, lintText } = require("./linter");
const { loadConfig } = require("./config");
const { formatResults } = require("./formatters");

module.exports = {
  formatResults,
  lintFiles,
  lintText,
  loadConfig,
};
