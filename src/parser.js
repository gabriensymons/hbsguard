"use strict";

const Handlebars = require("handlebars");

function parseTemplate(text) {
  try {
    return {
      ast: Handlebars.parse(text),
      error: null,
    };
  } catch (error) {
    return {
      ast: null,
      error: normalizeParseError(error),
    };
  }
}

function normalizeParseError(error) {
  const loc = error.loc || (error.hash && error.hash.loc);

  if (loc && loc.start) {
    return {
      message: summarizeParseError(error.message),
      line: loc.start.line,
      column: loc.start.column + 1,
    };
  }

  if (loc && typeof loc.first_line === "number") {
    return {
      message: summarizeParseError(error.message),
      line: loc.first_line,
      column: loc.first_column + 1,
    };
  }

  const fallback = parseLocationFromMessage(error.message);

  return {
    message: summarizeParseError(error.message),
    line: fallback.line,
    column: fallback.column,
  };
}

function summarizeParseError(message) {
  const lines = message.split("\n").filter(Boolean);

  if (lines.length <= 1) {
    return message;
  }

  return `${lines[0]} ${lines[lines.length - 1]}`;
}

function parseLocationFromMessage(message) {
  const lineMatch = message.match(/Parse error on line (\d+):/u);
  const lines = message.split("\n");
  const pointerLine = lines.find((line) => line.includes("^")) || "";

  return {
    line: lineMatch ? Number(lineMatch[1]) : 1,
    column: pointerLine.includes("^") ? pointerLine.indexOf("^") + 1 : 1,
  };
}

module.exports = {
  parseTemplate,
};
