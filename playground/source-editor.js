"use strict";

function createSourceEditor(options) {
  const { createSourceEditor: create } = require("./source-editor-implementation.mjs");
  return create(options);
}

function offsetFromLocation(text, line, column) {
  const normalized = prepareEditorValue(text).doc;
  const lines = normalized.split("\n");
  const lineIndex = Math.min(lines.length - 1, Math.max(0, Number(line || 1) - 1));
  const columnIndex = Math.min(
    lines[lineIndex].length,
    Math.max(0, Number(column || 1) - 1)
  );
  let offset = columnIndex;

  for (let index = 0; index < lineIndex; index += 1) {
    offset += lines[index].length + 1;
  }

  return offset;
}

function prepareEditorValue(value) {
  const text = String(value);
  const firstLineBreak = text.match(/\r\n|\r|\n/u);
  return {
    doc: text.replace(/\r\n?|\n/gu, "\n"),
    lineSeparator: firstLineBreak ? firstLineBreak[0] : "\n",
  };
}

function editorLines(value) {
  return String(value).split("\n");
}

function serializeEditorValue(doc, lineSeparator) {
  return String(doc).replace(/\n/gu, lineSeparator || "\n");
}

function valueFromEditorState(state) {
  return state.sliceDoc();
}

module.exports = {
  createSourceEditor,
  editorLines,
  offsetFromLocation,
  prepareEditorValue,
  serializeEditorValue,
  valueFromEditorState,
};
