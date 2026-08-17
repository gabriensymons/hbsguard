"use strict";

const path = require("node:path");

const { formatResults } = require("../src/formatters");

const PROBLEM_FILE_COUNT = 406;
const CLEAN_FILE_COUNT = 508;
const ERROR_COUNT = 797;
const ELAPSED_MS = 2050;
const previewRoot = path.resolve("/preview");
const extraErrorCount = ERROR_COUNT - PROBLEM_FILE_COUNT;
const results = [];

for (let index = 0; index < PROBLEM_FILE_COUNT; index += 1) {
  const fileErrorCount = index < extraErrorCount ? 2 : 1;
  const messages = Array.from({ length: fileErrorCount }, (_, messageIndex) => ({
    ruleId: "preview-error",
    severity: 2,
    line: messageIndex + 1,
    column: 1,
    message: "Representative preview error.",
  }));

  results.push({
    filePath: path.join(previewRoot, "problems", `${index + 1}.hbs`),
    messages,
    errorCount: messages.length,
    warningCount: 0,
  });
}

for (let index = 0; index < CLEAN_FILE_COUNT; index += 1) {
  results.push({
    filePath: path.join(previewRoot, "clean", `${index + 1}.hbs`),
    messages: [],
    errorCount: 0,
    warningCount: 0,
  });
}

const output = formatResults(results, "stylish", {
  cwd: previewRoot,
  elapsedMs: ELAPSED_MS,
  useColor: process.stdout.isTTY === true && !Object.hasOwn(process.env, "NO_COLOR"),
});
const summary = output.split("\n").slice(-3).join("\n");

process.stdout.write(`${summary}\n`);
