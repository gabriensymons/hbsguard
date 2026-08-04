"use strict";

module.exports = {
  meta: {
    defaultOptions: "unix",
  },
  create(context) {
    const expectedStyle = context.options || this.meta.defaultOptions;

    return {
      Template({ sourceCode }) {
        if (expectedStyle === "windows") {
          checkWindowsLinebreaks(context, sourceCode);
          return;
        }

        checkUnixLinebreaks(context, sourceCode);
      },
    };
  },
};

function checkUnixLinebreaks(context, sourceCode) {
  const matcher = /\r\n/gu;
  let match;

  while ((match = matcher.exec(sourceCode.text)) !== null) {
    const location = sourceCode.getLocFromIndex(match.index);

    context.report({
      line: location.line,
      column: location.column,
      message: 'Expected Unix linebreaks ("\\n") but found Windows linebreaks ("\\r\\n").',
    });
  }
}

function checkWindowsLinebreaks(context, sourceCode) {
  for (let index = 0; index < sourceCode.text.length; index += 1) {
    if (sourceCode.text[index] !== "\n") {
      continue;
    }

    if (index > 0 && sourceCode.text[index - 1] === "\r") {
      continue;
    }

    const location = sourceCode.getLocFromIndex(index);

    context.report({
      line: location.line,
      column: location.column,
      message: 'Expected Windows linebreaks ("\\r\\n") but found Unix linebreaks ("\\n").',
    });
  }
}
