"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ANSI_FOREGROUND = {
  green: "\u001b[32m",
  red: "\u001b[31m",
  reset: "\u001b[39m",
  yellow: "\u001b[33m",
};
const ANSI_INTENSITY = {
  bold: "\u001b[1m",
  reset: "\u001b[22m",
};

function formatResults(results, format, options = {}) {
  if (format === "json") {
    return JSON.stringify(results, null, 2);
  }

  return formatStylish(results, {
    cwd: options.cwd || process.cwd(),
    elapsedMs: options.elapsedMs || 0,
    useColor: options.useColor === true,
  });
}

function formatStylish(results, options) {
  const lines = [];
  let errorCount = 0;
  let warningCount = 0;
  let problemFileCount = 0;
  const ruleCounts = new Map();

  for (const result of results) {
    if (result.messages.length === 0) {
      continue;
    }

    problemFileCount += 1;
    errorCount += result.errorCount;
    warningCount += result.warningCount;

    lines.push(path.relative(options.cwd, result.filePath) || result.filePath);

    for (const message of result.messages) {
      ruleCounts.set(message.ruleId, (ruleCounts.get(message.ruleId) || 0) + 1);

      const severity = message.severity === 2 ? "error" : "warning";
      const coloredSeverity = colorize(
        severity,
        message.severity === 2 ? "red" : "yellow",
        options.useColor
      );
      const displayMessage = formatMessage(message);

      lines.push(
        `  ${message.line}:${message.column}  ${coloredSeverity}  ${displayMessage}  ${message.ruleId}`
      );

      const contextLines = formatSourceContext(result, message);

      if (contextLines.length > 0) {
        lines.push(...contextLines);
      }
    }

    lines.push("");
  }

  const errorLabel = errorCount === 1 ? "error" : "errors";
  const warningLabel = warningCount === 1 ? "warning" : "warnings";
  const cleanFileCount = results.length - problemFileCount;
  const fileParts = [];

  if (problemFileCount > 0) {
    fileParts.push(
      emphasizeStatus(`${problemFileCount} with problems`, "red", options.useColor)
    );
  }

  fileParts.push(
    emphasizeStatus(
      `${cleanFileCount} clean`,
      "green",
      options.useColor && cleanFileCount > 0
    ),
    `${results.length} checked`
  );

  lines.push(
    `${bold("Files:", options.useColor)}     ${fileParts.join(", ")}`,
    `${bold("Problems:", options.useColor)}  ${emphasizeStatus(
      `${errorCount} ${errorLabel}`,
      "red",
      options.useColor && errorCount > 0
    )}, ${emphasizeStatus(
      `${warningCount} ${warningLabel}`,
      "yellow",
      options.useColor && warningCount > 0
    )}`
  );

  if (ruleCounts.size > 0) {
    const sortedRuleCounts = [...ruleCounts.entries()].sort(
      ([firstRule, firstCount], [secondRule, secondCount]) =>
        secondCount - firstCount || String(firstRule).localeCompare(String(secondRule))
    );
    const countWidth = Math.max(
      ...sortedRuleCounts.map(([, count]) => String(count).length)
    );

    for (const [index, [ruleId, count]] of sortedRuleCounts.entries()) {
      const label = index === 0 ? `${bold("Rules:", options.useColor)}     ` : "           ";

      lines.push(`${label}${String(count).padStart(countWidth, " ")}  ${ruleId}`);
    }
  }

  lines.push(
    `${bold("Time:", options.useColor)}      ${emphasizeStatus(
      `${(options.elapsedMs / 1000).toFixed(2)} s`,
      "green",
      options.useColor
    )}`
  );

  return lines.join("\n");
}

function colorize(value, color, enabled) {
  if (!enabled) {
    return value;
  }

  return `${ANSI_FOREGROUND[color]}${value}${ANSI_FOREGROUND.reset}`;
}

function bold(value, enabled) {
  if (!enabled) {
    return value;
  }

  return `${ANSI_INTENSITY.bold}${value}${ANSI_INTENSITY.reset}`;
}

function emphasizeStatus(value, color, enabled) {
  return bold(colorize(value, color, enabled), enabled);
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
