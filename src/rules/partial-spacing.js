"use strict";

const { extractTagPadding, getFixableTokens, getTagContentInfo } = require("../tokens");

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
      Template({ tokens, ast, sourceCode }) {
        let fixable;
        for (const token of tokens) {
          if (!CHECKED_TYPES.has(token.type)) {
            continue;
          }

          const padding = extractTagPadding(token);
          const body = padding.body;
          const markerLength = body.startsWith("#>") ? 2 : 1;
          const spacing = body.slice(markerLength).match(/^\s*/u)[0];
          const content = getTagContentInfo(token);
          const contentStart = token.startIndex + token.openDelimiter.length + content.offset;

          if (spacing !== " ") {
            fixable ??= getFixableTokens(tokens, ast, sourceCode);
            context.report({
              line: token.start.line,
              column: token.start.column,
              message: "Expected exactly one space after the partial marker.",
              fix: fixable.has(token) && !/[\r\n\u2028\u2029]/u.test(spacing)
                ? {
                    range: [contentStart + padding.leading.length + markerLength,
                      contentStart + padding.leading.length + markerLength + spacing.length],
                    text: " ",
                  }
                : undefined,
            });
            continue;
          }

          if (!token.content.includes("\n") && hasInvalidClosingPadding(padding.trailing.length, options)) {
            fixable ??= getFixableTokens(tokens, ast, sourceCode);
            context.report({
              line: token.start.line,
              column: token.start.column,
              message: getClosingPaddingMessage(options),
              fix: fixable.has(token) && !/[\r\n\u2028\u2029]/u.test(padding.trailing)
                ? {
                    range: [contentStart + content.text.length - padding.trailing.length,
                      contentStart + content.text.length],
                    text: options.beforeClose === "never" ? "" : " ",
                  }
                : undefined,
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
