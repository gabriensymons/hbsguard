"use strict";

const { lintFiles, lintText } = require("./linter");
const { loadConfig } = require("./config");
const { formatResults } = require("./formatters");
const { fixText } = require("./lint-text");

module.exports = {
  formatResults,
  fixText,
  lintFiles,
  lintText,
  loadConfig,
};
