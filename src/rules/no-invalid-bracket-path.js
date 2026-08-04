"use strict";

const { getTagContentInfo } = require("../tokens");

const CHECKED_TYPES = new Set([
  "mustache",
  "triple-stash",
  "block-open",
  "block-close",
  "else",
  "partial",
  "partial-block-open",
]);

const INVALID_BRACKET_PATH = /[A-Za-z0-9_@/-]+(?:\.[A-Za-z0-9_@/-]+)*\[[^\]\s}]+\]/gu;

module.exports = {
  meta: {
    defaultOptions: {},
  },
  create(context) {
    return {
      Template({ sourceCode, tokens }) {
        for (const token of tokens) {
          if (!CHECKED_TYPES.has(token.type)) {
            continue;
          }

          const contentInfo = getTagContentInfo(token);
          const searchableText = maskStringLiterals(contentInfo.text);
          INVALID_BRACKET_PATH.lastIndex = 0;
          let match;

          while ((match = INVALID_BRACKET_PATH.exec(searchableText)) !== null) {
            const bracketOffset = match[0].indexOf("[");
            const location = sourceCode.getLocFromIndex(
              token.startIndex +
                token.openDelimiter.length +
                contentInfo.offset +
                match.index +
                bracketOffset
            );

            context.report({
              line: location.line,
              column: location.column,
              message:
                'Expected bracket segments to use dot notation, like "foo.[bar]" instead of "foo[bar]".',
            });
          }
        }
      },
    };
  },
};

function maskStringLiterals(value) {
  let result = "";
  let quote = null;
  let escaped = false;

  for (const character of value) {
    if (quote !== null) {
      result += " ";

      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      result += " ";
      continue;
    }

    result += character;
  }

  return result;
}
