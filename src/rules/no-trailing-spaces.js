"use strict";

module.exports = {
  meta: {
    defaultOptions: {},
  },
  create(context) {
    return {
      Template({ sourceCode }) {
        for (let lineNumber = 1; lineNumber <= sourceCode.getLineCount(); lineNumber += 1) {
          const line = sourceCode.getLine(lineNumber);
          const match = line.match(/[ \t]+$/u);

          if (!match) {
            continue;
          }

          context.report({
            line: lineNumber,
            column: line.length - match[0].length + 1,
            message: "Trailing whitespace is not allowed.",
          });
        }
      },
    };
  },
};
