"use strict";

const path = require("node:path");

const { formatResults } = require("../src/formatters");

const PROBLEM_FILE_COUNT = 398;
const CLEAN_FILE_COUNT = 531;
const ELAPSED_MS = 1900;
const RULE_COUNTS = [
  ["mustache-spacing", 429],
  ["no-trailing-spaces", 239],
  ["eol-last", 118],
];
const previewRoot = path.resolve("/preview");
const ruleIds = RULE_COUNTS.flatMap(([ruleId, count]) =>
  Array.from({ length: count }, () => ruleId)
);
const extraErrorCount = ruleIds.length - PROBLEM_FILE_COUNT;
const results = [];
let messageIndex = 0;

for (let index = 0; index < PROBLEM_FILE_COUNT; index += 1) {
  const fileErrorCount = index < extraErrorCount ? 2 : 1;
  const messages = Array.from({ length: fileErrorCount }, (_, lineIndex) => ({
    ruleId: ruleIds[messageIndex++],
    severity: 2,
    line: lineIndex + 1,
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
const lines = output.split("\n");
const summaryIndex = lines.findLastIndex((line) => line.includes("Files:"));
const summary = lines.slice(summaryIndex).join("\n");

process.stdout.write(`${summary}\n`);
