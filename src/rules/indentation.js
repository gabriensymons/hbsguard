"use strict";

module.exports = {
  meta: {
    defaultOptions: {
      size: 2,
      blockDepth: true,
    },
  },
  create(context) {
    const options = {
      ...this.meta.defaultOptions,
      ...context.options,
    };

    return {
      Template({ sourceCode, tokens }) {
        const tokensByLine = groupTokensByLine(tokens);
        let depth = 0;

        for (let lineNumber = 1; lineNumber <= sourceCode.getLineCount(); lineNumber += 1) {
          const line = sourceCode.getLine(lineNumber);

          if (/^\s*$/u.test(line)) {
            depth = updateDepth(depth, tokensByLine.get(lineNumber) || []);
            continue;
          }

          const actualIndent = getIndentWidth(line, options.size);
          const expectedDepth = options.blockDepth
            ? getExpectedDepth(depth, line)
            : Math.floor(actualIndent / options.size);
          const expectedIndent = expectedDepth * options.size;

          if (actualIndent !== expectedIndent) {
            context.report({
              line: lineNumber,
              column: 1,
              message: `Expected indentation of ${expectedIndent} spaces but found ${actualIndent}.`,
            });
          }

          depth = updateDepth(depth, tokensByLine.get(lineNumber) || []);
        }
      },
    };
  },
};

function groupTokensByLine(tokens) {
  const map = new Map();

  for (const token of tokens) {
    const lineTokens = map.get(token.start.line) || [];
    lineTokens.push(token);
    map.set(token.start.line, lineTokens);
  }

  return map;
}

function getIndentWidth(line, size) {
  let width = 0;

  for (const character of line.match(/^\s*/u)[0]) {
    width += character === "\t" ? size : 1;
  }

  return width;
}

function getExpectedDepth(depth, line) {
  const trimmed = line.trimStart();

  if (/^\{\{~?(?:\/|else\b|\^)/u.test(trimmed)) {
    return Math.max(depth - 1, 0);
  }

  return depth;
}

function updateDepth(depth, tokens) {
  let nextDepth = depth;

  for (const token of tokens) {
    if (token.type === "block-open" || token.type === "partial-block-open") {
      nextDepth += 1;
    } else if (token.type === "block-close") {
      nextDepth = Math.max(nextDepth - 1, 0);
    }
  }

  return nextDepth;
}
