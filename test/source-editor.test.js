"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createSourceEditor,
  editorLines,
  offsetFromLocation,
  prepareEditorValue,
  serializeEditorValue,
  valueFromEditorState,
} = require("../playground/source-editor");

test("exports the source editor adapter contract", () => {
  assert.equal(typeof createSourceEditor, "function");
});

test("converts one-based diagnostic locations to CodeMirror offsets", () => {
  assert.equal(offsetFromLocation("alpha\nbeta", 1, 1), 0);
  assert.equal(offsetFromLocation("alpha\nbeta", 2, 3), 8);
  assert.equal(offsetFromLocation("alpha\r\nbeta", 2, 1), 6);
  assert.equal(offsetFromLocation("alpha\nbeta", 99, 99), 10);
  assert.equal(offsetFromLocation("alpha\nbeta", 0, 0), 0);
});

test("round-trips CRLF while keeping normalized editor coordinates", () => {
  const source = "alpha\r\nbeta\r\n";
  const prepared = prepareEditorValue(source);

  assert.deepEqual(prepared, {
    doc: "alpha\nbeta\n",
    lineSeparator: "\r\n",
  });
  assert.equal(serializeEditorValue(prepared.doc, prepared.lineSeparator), source);
  assert.equal(offsetFromLocation(source, 2, 1), 6);
});

test("serializes CodeMirror state with its configured line separator", () => {
  const { EditorState, Text } = require("@codemirror/state");
  const source = "alpha\r\nbeta\r\n";
  const prepared = prepareEditorValue(source);
  const state = EditorState.create({
    doc: Text.of(editorLines(prepared.doc)),
    extensions: [EditorState.lineSeparator.of(prepared.lineSeparator)],
  });

  assert.equal(state.doc.lines, 3);
  assert.equal(state.doc.line(2).text, "beta");
  assert.equal(valueFromEditorState(state), source);
});
