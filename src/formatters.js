"use strict";

const fs = require("node:fs");
const path = require("node:path");

function formatResults(results, format, options = {}) {
  if (format === "json") {
    return JSON.stringify(results, null, 2);
  }

  return formatStylish(results, options.cwd || process.cwd());
}

function formatStylish(results, cwd) {
  const lines = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const result of results) {
    if (result.messages.length === 0) {
      continue;
    }

    errorCount += result.errorCount;
    warningCount += result.warningCount;

    lines.push(path.relative(cwd, result.filePath) || result.filePath);

    for (const message of result.messages) {
      const severity = message.severity === 2 ? "error" : "warning";
      const displayMessage = formatMessage(message);

      lines.push(
        `  ${message.line}:${message.column}  ${severity}  ${displayMessage}  ${message.ruleId}`
      );

      const contextLines = formatSourceContext(result, message);

      if (contextLines.length > 0) {
        lines.push(...contextLines);
      }
    }

    lines.push("");
  }

  if (lines.length === 0) {
    return "";
  }

  const problemCount = errorCount + warningCount;
  const problemLabel = problemCount === 1 ? "problem" : "problems";
  const errorLabel = errorCount === 1 ? "error" : "errors";
  const warningLabel = warningCount === 1 ? "warning" : "warnings";

  lines.push(
    `✖ ${problemCount} ${problemLabel} (${errorCount} ${errorLabel}, ${warningCount} ${warningLabel})`
  );

  return lines.join("\n");
}

function formatMessage(message) {
  if (message.ruleId !== "parse-error") {
    return message.message;
  }

  const unexpectedToken = message.message.match(/,\s*got\s+(.+)$/u);

  if (unexpectedToken) {
    return `Unexpected token ${unexpectedToken[1].replace(/\.$/u, "")}.`;
  }

  return message.message.replace(/^Parse error on line \d+:\s*/u, "");
}

function formatSourceContext(result, message) {
  if (message.ruleId !== "parse-error") {
    return [];
  }

  const sourceLine = getSourceLine(result, message);

  if (!sourceLine) {
    return [];
  }

  const rendered = renderSourceSnippet(sourceLine, message.column);

  return [
    `  ${String(message.line).padStart(rendered.gutterWidth, " ")} | ${rendered.line}`,
    `  ${" ".repeat(rendered.gutterWidth)} | ${" ".repeat(rendered.caretColumn - 1)}^`,
  ];
}

function getSourceLine(result, message) {
  if (typeof message.source === "string" && message.source.length > 0) {
    return message.source;
  }

  if (!result.filePath || !fs.existsSync(result.filePath)) {
    return "";
  }

  const line = fs
    .readFileSync(result.filePath, "utf8")
    .split("\n")
    [message.line - 1];

  return line || "";
}

function renderSourceSnippet(sourceLine, column) {
  const maxWidth = 100;
  const safeColumn = Math.max(1, column);

  if (sourceLine.length <= maxWidth) {
    return {
      gutterWidth: 2,
      line: sourceLine,
      caretColumn: safeColumn,
    };
  }

  const contextBefore = 30;
  let start = Math.max(0, safeColumn - contextBefore - 1);
  let end = Math.min(sourceLine.length, start + maxWidth);

  if (end === sourceLine.length) {
    start = Math.max(0, end - maxWidth);
  }

  const prefix = start > 0 ? "..." : "";
  const suffix = end < sourceLine.length ? "..." : "";
  const line = `${prefix}${sourceLine.slice(start, end)}${suffix}`;
  const caretColumn = safeColumn - start + prefix.length;

  return {
    gutterWidth: 2,
    line,
    caretColumn,
  };
}

module.exports = {
  formatResults,
};
