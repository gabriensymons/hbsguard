"use strict";

class SourceCode {
  constructor(text, filePath) {
    this.text = text;
    this.filePath = filePath;
    this.lines = text.split("\n");
    this.lineStartIndices = buildLineStartIndices(text);
  }

  getLine(lineNumber) {
    return this.lines[lineNumber - 1] ?? "";
  }

  getLineCount() {
    return this.lines.length;
  }

  getLocFromIndex(index) {
    const boundedIndex = Math.max(0, Math.min(index, this.text.length));
    let low = 0;
    let high = this.lineStartIndices.length - 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const start = this.lineStartIndices[middle];
      const nextStart =
        middle + 1 < this.lineStartIndices.length
          ? this.lineStartIndices[middle + 1]
          : this.text.length + 1;

      if (boundedIndex < start) {
        high = middle - 1;
      } else if (boundedIndex >= nextStart) {
        low = middle + 1;
      } else {
        return {
          line: middle + 1,
          column: boundedIndex - start + 1,
        };
      }
    }

    return {
      line: 1,
      column: 1,
    };
  }

  getIndexFromLoc(location) {
    const lineStart = this.lineStartIndices[location.line - 1];

    if (lineStart == null) {
      return this.text.length;
    }

    return lineStart + Math.max(0, location.column - 1);
  }
}

function buildLineStartIndices(text) {
  const indices = [0];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      indices.push(index + 1);
    }
  }

  return indices;
}

module.exports = {
  SourceCode,
};
