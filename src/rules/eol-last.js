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
          fix: {
            range: [sourceCode.text.length, sourceCode.text.length],
            text: sourceCode.text.endsWith("\r")
              ? "\n"
              : (sourceCode.text.match(/\r?\n/u)?.[0] || "\n"),
          },
        });
      },
    };
  },
};
