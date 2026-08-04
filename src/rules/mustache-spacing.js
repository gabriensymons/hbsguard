"use strict";

const { extractTagPadding } = require("../tokens");

const CHECKED_TYPES = new Set([
  "mustache",
  "triple-stash",
  "block-open",
  "block-close",
  "else",
]);

module.exports = {
  meta: {
    defaultOptions: {
      style: "consistent",
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

          if (token.content.includes("\n")) {
            continue;
          }

          const padding = extractTagPadding(token);
          const leadingWidth = padding.leading.length;
          const trailingWidth = padding.trailing.length;
          const isValid = isValidPadding(leadingWidth, trailingWidth, options.style);

          if (isValid) {
            continue;
          }

          context.report({
            line: token.start.line,
            column: token.start.column,
            message: getErrorMessage(options.style),
          });
        }
      },
    };
  },
};

function isValidPadding(leadingWidth, trailingWidth, style) {
  if (style === "always") {
    return leadingWidth === 1 && trailingWidth === 1;
  }

  if (style === "never") {
    return leadingWidth === 0 && trailingWidth === 0;
  }

  return (
    (leadingWidth === 0 && trailingWidth === 0) ||
    (leadingWidth === 1 && trailingWidth === 1)
  );
}

function getErrorMessage(style) {
  if (style === "always") {
    return "Expected exactly one space on both sides of the mustache body.";
  }

  if (style === "never") {
    return "Expected no inner spaces inside the mustache.";
  }

  return "Expected symmetric mustache padding with either no inner spaces or a single space on both sides.";
}
