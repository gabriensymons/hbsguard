import { htmlLanguage } from "@codemirror/lang-html";
import {
  continuedIndent,
  flatIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
  indentService,
  LanguageSupport,
  LRLanguage,
  syntaxTree,
} from "@codemirror/language";
import { parseMixed } from "@lezer/common";

import { handlebarsHighlighting } from "./highlight.js";
import { parser } from "./parser.js";

const mixedParser = parser.configure({
  props: [
    handlebarsHighlighting,
    foldNodeProp.add({
      Block: foldInside,
      PartialBlock: foldInside,
      RawBlock: foldInside,
    }),
    indentNodeProp.add({
      Template: flatIndent,
      Block: continuedIndent({ except: /^\s*\{\{(?:else\b|\^|\/)/u }),
      BlockClose: flatIndent,
      ElseClause: flatIndent,
      PartialBlock: continuedIndent({ except: /^\s*\{\{\//u }),
      RawBlock: continuedIndent({ except: /^\s*\{\{\{\{\//u }),
    }),
  ],
  wrap: parseMixed((node) =>
    node.type.name === "Template"
      ? {
          parser: htmlLanguage.parser,
          overlay: (descendant) => descendant.type.name === "HtmlText",
        }
      : null
  ),
});

export const handlebarsLanguage = LRLanguage.define({
  name: "handlebars",
  parser: mixedParser,
});

const structuralIndent = indentService.of((context, position) => {
  const line = context.state.doc.lineAt(position);
  let node = syntaxTree(context.state).resolve(position, 1);
  while (node && !["Block", "PartialBlock", "RawBlock"].includes(node.name)) {
    node = node.parent;
  }
  if (!node) {
    return null;
  }

  const baseIndent = context.lineIndent(node.from);
  const openingLine = context.state.doc.lineAt(node.from);
  const isClosingOrInverse =
    /^\s*\{\{(?:else\b|\^|\/)|^\s*\{\{\{\{\//u.test(line.text);
  return line.from === openingLine.from || isClosingOrInverse
    ? baseIndent
    : baseIndent + context.unit;
});

export function handlebars() {
  return new LanguageSupport(handlebarsLanguage, [structuralIndent]);
}
