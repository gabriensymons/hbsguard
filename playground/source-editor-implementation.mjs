import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState, Text } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

import { handlebars } from "./handlebars-language/index.js";
import sourceEditorHelpers from "./source-editor.js";

const { editorLines, prepareEditorValue, valueFromEditorState } = sourceEditorHelpers;

export function createSourceEditor({ parent, initialValue, onChange }) {
  const prepared = prepareEditorValue(initialValue);
  const lineSeparator = new Compartment();
  let suppressChange = false;

  const highlightStyle = HighlightStyle.define([
    { tag: tags.tagName, color: "var(--syntax-html-tag)" },
    { tag: tags.attributeName, color: "var(--syntax-html-attribute)" },
    { tag: tags.attributeValue, color: "var(--syntax-string)" },
    { tag: tags.function(tags.variableName), color: "var(--syntax-helper)" },
    { tag: [tags.variableName, tags.propertyName], color: "var(--syntax-variable)" },
    { tag: [tags.string, tags.number, tags.bool, tags.null, tags.atom], color: "var(--syntax-string)" },
    { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
    { tag: [tags.keyword, tags.operator], color: "var(--syntax-keyword)" },
    { tag: tags.punctuation, color: "var(--syntax-delimiter)" },
  ]);

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: Text.of(editorLines(prepared.doc)),
      extensions: [
        lineSeparator.of(EditorState.lineSeparator.of(prepared.lineSeparator)),
        EditorState.tabSize.of(2),
        lineNumbers(),
        history(),
        drawSelection(),
        dropCursor(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        handlebars(),
        syntaxHighlighting(highlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.contentAttributes.of({
          "aria-label": "Handlebars source editor",
          "aria-multiline": "true",
          autocapitalize: "off",
          autocomplete: "off",
          spellcheck: "false",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !suppressChange) {
            onChange(valueFromEditorState(update.state));
          }
        }),
      ],
    }),
  });

  return {
    getValue() {
      return valueFromEditorState(view.state);
    },

    setValue(value) {
      const next = prepareEditorValue(value);
      suppressChange = true;
      try {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: Text.of(editorLines(next.doc)) },
          selection: { anchor: 0 },
          effects: lineSeparator.reconfigure(
            EditorState.lineSeparator.of(next.lineSeparator)
          ),
          scrollIntoView: true,
        });
      } finally {
        suppressChange = false;
      }
    },

    focus() {
      view.focus();
    },

    selectRange(from, to, { scrollIntoView = false } = {}) {
      const start = Math.min(view.state.doc.length, Math.max(0, from));
      const end = Math.min(view.state.doc.length, Math.max(start, to));
      const transaction = { selection: { anchor: start, head: end } };
      if (scrollIntoView) {
        transaction.effects = EditorView.scrollIntoView(start, { y: "center" });
      }
      view.dispatch(transaction);
    },

    destroy() {
      view.destroy();
    },
  };
}
