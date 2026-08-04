"use strict";

module.exports = {
  meta: {
    defaultOptions: {},
  },
  create(context) {
    return {
      Template({ sourceCode }) {
        if (sourceCode.text.length === 0 || sourceCode.text.endsWith("\n")) {
          return;
        }

        const lineNumber = sourceCode.getLineCount();
        const line = sourceCode.getLine(lineNumber);

        context.report({
          line: lineNumber,
          column: line.length + 1,
          message: "Expected a trailing newline at the end of the file.",
        });
      },
    };
  },
};
