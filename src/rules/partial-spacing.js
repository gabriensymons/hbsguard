"use strict";

const { extractTagPadding } = require("../tokens");

const CHECKED_TYPES = new Set(["partial", "partial-block-open"]);

module.exports = {
  meta: {
    defaultOptions: {
      beforeClose: "allow",
    },
  },
  create(context) {
    const options = {
      ...this.meta.defaultOptions,
      ...(context.options || {}),
    };

    return {
      Template({ tokens }) {
        for (const token of tokens) {
          if (!CHECKED_TYPES.has(token.type)) {
            continue;
          }

          const padding = extractTagPadding(token);
          const body = padding.body;
          const markerLength = body.startsWith("#>") ? 2 : 1;
          const spacing = body.slice(markerLength).match(/^\s*/u)[0];

          if (spacing !== " ") {
            context.report({
              line: token.start.line,
              column: token.start.column,
              message: "Expected exactly one space after the partial marker.",
            });
            continue;
          }

          if (!token.content.includes("\n") && hasInvalidClosingPadding(padding.trailing.length, options)) {
            context.report({
              line: token.start.line,
              column: token.start.column,
              message: getClosingPaddingMessage(options),
            });
          }
        }
      },
    };
  },
};

function hasInvalidClosingPadding(trailingWidth, options) {
  if (options.beforeClose === "never") {
    return trailingWidth !== 0;
  }

  return trailingWidth > 1;
}

function getClosingPaddingMessage(options) {
  if (options.beforeClose === "never") {
    return "Expected no space before the closing braces in a partial tag.";
  }

  return "Expected at most one space before the closing braces in a partial tag.";
}
