"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { NodeProp } = require("@lezer/common");

const { EXAMPLES } = require("../playground/examples");

const LANGUAGE_URL = pathToFileURL(
  path.resolve(__dirname, "../playground/handlebars-language/index.js")
).href;
const PUBLIC_FIXTURES_DIR = path.resolve(__dirname, "fixtures/templates");

async function createState(source, extraExtensions = []) {
  const { handlebars } = await import(LANGUAGE_URL);
  const { EditorState } = await import("@codemirror/state");
  return EditorState.create({ doc: source, extensions: [handlebars(), ...extraExtensions] });
}

async function parse(source) {
  const state = await createState(source);
  const { syntaxTree } = await import("@codemirror/language");
  return syntaxTree(state);
}

function errorNodeRanges(tree) {
  const ranges = [];
  const visited = new Set();

  function visit(currentTree, offset = 0) {
    if (visited.has(currentTree)) {
      return;
    }
    visited.add(currentTree);

    const cursor = currentTree.cursor();
    do {
      if (cursor.type.isError) {
        ranges.push([offset + cursor.from, offset + cursor.to]);
      }

      const mounted = cursor.node.prop(NodeProp.mounted);
      if (mounted) {
        visit(mounted.tree, offset + cursor.from);
      }
    } while (cursor.next());
  }

  visit(tree);
  return ranges;
}

test("finds error nodes in mounted HTML trees", async () => {
  const tree = await parse("<div");

  assert.deepEqual(errorNodeRanges(tree), [[4, 4]]);
});

test("parses a basic mustache", async () => {
  const source = "<p>{{user.name}}</p>";
  const tree = await parse(source);

  assert.equal(tree.length, source.length);
  assert.match(tree.toString(), /Mustache/);
  assert.match(tree.toString(), /Path/);
});

test("parses plain Handlebars path forms", async () => {
  const cases = [
    ["{{user}}", /Path/],
    ["{{../parent/name}}", /ParentReference/],
    ["{{this.value}}", /ThisKeyword/],
    ["{{.}}", /Dot/],
    ["{{@index}}", /DataVariable/],
    ["{{user/profile.name}}", /Slash/],
    ["{{user[name]}}", /BracketPath/],
    ["{{foo?}}", /PathSegment/],
    ["{{foo:bar}}", /PathSegment/],
    ["{{.\/foo}}", /CurrentReference/],
    ["{{[foo bar]}}", /BracketPath/],
    ["{{$foo}}", /PathSegment/],
    ["{{üser}}", /PathSegment/],
    ["{{0foo}}", /PathSegment/],
    ["{{[foo.bar]}}", /BracketPathSegment/],
    ["{{foo.[bar baz]}}", /BracketPathSegment/],
  ];

  for (const [source, expectedNode] of cases) {
    const tree = await parse(source);
    assert.equal(tree.length, source.length, source);
    assert.doesNotMatch(tree.toString(), /⚠/u, tree.toString());
    assert.match(tree.toString(), expectedNode, source);
  }
});

test("parses digit-prefixed paths as one callee", async () => {
  const printed = (await parse("{{0foo}}")).toString();
  assert.match(printed, /^Template\(Mustache\(OpenDelimiter,MustacheContent\(Expression\(Callee\(Path\(PathSegment\(/u);
  assert.doesNotMatch(printed, /Argument|Number/u, printed);
});

test("keeps compound paths intact", async () => {
  for (const source of ["{{user.name}}", "{{../parent/name}}", "{{@index.value}}", "{{user[name]}}"] ) {
    const printed = (await parse(source)).toString();
    assert.equal((printed.match(/(?:^|[,(])Path\(/g) || []).length, 1, `${source}: ${printed}`);
    assert.doesNotMatch(printed, /Argument/, `${source}: ${printed}`);
  }
});

test("parses literal values", async () => {
  const cases = [
    ["{{\"double\"}}", /String/],
    ["{{'single'}}", /String/],
    ["{{-12.5}}", /Number/],
    ["{{true}}", /Boolean/],
    ["{{false}}", /Boolean/],
    ["{{null}}", /Null/],
    ["{{undefined}}", /Undefined/],
  ];

  for (const [source, expectedNode] of cases) {
    const tree = await parse(source);
    assert.doesNotMatch(tree.toString(), /⚠/u, tree.toString());
    assert.match(tree.toString(), expectedNode, source);
  }
});

test("parses hash pairs", async () => {
  const source = "{{format user.name style=\"long\" enabled=true}}";
  const tree = await parse(source);
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.equal((printed.match(/HashPair/g) || []).length, 2);
  assert.match(printed, /HashKey/);
  assert.match(printed, /Equals/);
  assert.match(printed, /Path/);
  assert.match(printed, /String/);
  assert.match(printed, /Boolean/);
});

test("parses nested subexpressions", async () => {
  const source = "{{format (lookup user (concat first last))}}";
  const tree = await parse(source);
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.equal((printed.match(/Subexpression/g) || []).length, 2);
});

test("parses block parameters", async () => {
  const source = "{{each items as |item index|}}";
  const tree = await parse(source);
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.match(printed, /BlockParams/);
  assert.equal((printed.match(/BlockParamName/g) || []).length, 2);
});

test("parses delimiter whitespace control", async () => {
  const tree = await parse("{{~value~}}");
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.equal((printed.match(/WhitespaceControl/g) || []).length, 2);
});

test("parses triple mustaches", async () => {
  const tree = await parse("<div>{{{html}}}</div>");
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.match(printed, /TripleMustache/);
  assert.match(printed, /TripleOpenDelimiter/);
  assert.match(printed, /TripleCloseDelimiter/);
});

test("parses ampersand-unescaped expressions with exact structure", async () => {
  const source = "{{& html}}";
  const tree = await parse(source);

  assert.equal(tree.length, source.length);
  assert.equal(
    tree.toString(),
    "Template(Mustache(OpenDelimiter,MustacheContent(UnescapedMarker,Expression(Callee(Path(PathSegment(RegularPathSegment)))),CloseDelimiter)))"
  );
  assert.deepEqual(errorNodeRanges(tree), []);
});

test("parses triple-mustache whitespace control in plain Handlebars positions", async () => {
  for (const source of ["{{{html}}}", "{{~{html}~}}"] ) {
    const printed = (await parse(source)).toString();
    assert.match(printed, /TripleMustache/);
    assert.doesNotMatch(printed, /⚠/u, `${source}: ${printed}`);
  }
});

test("parses inline comments", async () => {
  const tree = await parse("before {{! braces { stay text }} after");
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.match(printed, /Comment/);
  assert.match(printed, /InlineCommentText/);
});

test("parses whitespace-controlled inline comments", async () => {
  const source = "{{~! note ~}}";
  const tree = await parse(source);

  assert.equal(
    tree.toString(),
    "Template(Comment(WhitespaceCommentOpen,InlineCommentText,WhitespaceCommentClose))"
  );
  assert.deepEqual(errorNodeRanges(tree), []);
});

test("parses multiline long comments", async () => {
  const source = "<div>{{!-- line one\n{{brace-like}} --}}after</div>";
  const tree = await parse(source);
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.match(printed, /LongComment/);
  assert.match(printed, /LongCommentText/);
});

test("parses whitespace-controlled long comments", async () => {
  const source = "{{~!-- note --~}}";
  const tree = await parse(source);

  assert.equal(
    tree.toString(),
    "Template(LongComment(WhitespaceLongCommentOpen,LongCommentText,WhitespaceLongCommentClose))"
  );
  assert.deepEqual(errorNodeRanges(tree), []);
});

test("parses partial invocations", async () => {
  const tree = await parse("<main>{{> avatar user theme=\"dark\"}}</main>");
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.match(printed, /Partial/);
  assert.match(printed, /PartialName/);
  assert.match(printed, /HashPair/);
});

test("parses dynamic partial names with exact structure", async () => {
  const source = '{{> (lookup . "p")}}';
  const tree = await parse(source);

  assert.equal(tree.length, source.length);
  assert.equal(
    tree.toString(),
    "Template(Partial(OpenDelimiter,PartialContent(PartialMarker,PartialName(Subexpression(OpenParen,Expression(Callee(Path(PathSegment(RegularPathSegment))),Argument(Value(Path(Dot))),Argument(Value(Literal(String(DoubleQuotedString))))),CloseParen)),CloseDelimiter)))"
  );
  assert.deepEqual(errorNodeRanges(tree), []);
});

test("parses partial blocks", async () => {
  const source = "{{#> layout}}<span>{{value}}</span>{{/layout}}";
  const tree = await parse(source);
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.match(printed, /PartialBlock/);
  assert.match(printed, /PartialBlockOpen/);
  assert.match(printed, /BlockClose/);
});

test("parses dynamic partial-block names with exact structure", async () => {
  const source = '{{#> (lookup . "layout")}}x{{/layout}}';
  const tree = await parse(source);

  assert.equal(tree.length, source.length);
  assert.equal(
    tree.toString(),
    "Template(PartialBlock(PartialBlockOpen(OpenDelimiter,PartialBlockOpenContent(PartialBlockMarker,PartialName(Subexpression(OpenParen,Expression(Callee(Path(PathSegment(RegularPathSegment))),Argument(Value(Path(Dot))),Argument(Value(Literal(String(DoubleQuotedString))))),CloseParen)),CloseDelimiter)),HtmlText(PlainHtmlText),BlockClose(OpenDelimiter,BlockCloseContent(CloseMarker,Path(PathSegment(RegularPathSegment)),CloseDelimiter))))"
  );
  assert.deepEqual(errorNodeRanges(tree), []);
});

test("parses raw blocks without parsing inner mustaches", async () => {
  const source = "{{{{raw}}}}<b>{{notParsed}}</b>{{{{/raw}}}}";
  const tree = await parse(source);
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.match(printed, /RawBlock/);
  assert.match(printed, /RawBlockOpen/);
  assert.match(printed, /RawBlockClose/);
  assert.doesNotMatch(printed, /Mustache/);
});

test("keeps escaped Handlebars openings as template text", async () => {
  const tree = await parse("<p>\\{{value}}</p>");
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.doesNotMatch(printed, /Mustache/);
  assert.match(printed, /HtmlText/);
});

test("recognizes mustaches preceded by multiple backslashes", async () => {
  const printed = (await parse("<p>\\\\{{value}}</p>")).toString();
  assert.match(printed, /Mustache/);
  assert.doesNotMatch(printed, /⚠/u, printed);
});

test("parses generic nested blocks without semantic name matching", async () => {
  const sources = [
    "{{#if user}}{{#each user.items}}{{name}}{{/each}}{{/if}}",
    "{{#if user}}content{{/unless}}",
  ];

  for (const source of sources) {
    const tree = await parse(source);
    const printed = tree.toString();
    assert.doesNotMatch(printed, /⚠/u, printed);
    assert.match(printed, /Block/);
    assert.match(printed, /BlockOpen/);
    assert.match(printed, /BlockClose/);
  }
});

test("parses inline decorator blocks with exact structure", async () => {
  const source = '{{#*inline "p"}}x{{/inline}}';
  const tree = await parse(source);

  assert.equal(tree.length, source.length);
  assert.equal(
    tree.toString(),
    "Template(Block(BlockOpen(OpenDelimiter,BlockOpenContent(DecoratorBlockMarker,Expression(Callee(Path(PathSegment(RegularPathSegment))),Argument(Value(Literal(String(DoubleQuotedString))))),CloseDelimiter)),HtmlText(PlainHtmlText),BlockClose(OpenDelimiter,BlockCloseContent(CloseMarker,Path(PathSegment(RegularPathSegment)),CloseDelimiter))))"
  );
  assert.deepEqual(errorNodeRanges(tree), []);
});

test("parses non-block decorators with exact structure", async () => {
  const source = "{{*foo bar}}";
  const tree = await parse(source);

  assert.equal(
    tree.toString(),
    "Template(Decorator(OpenDelimiter,DecoratorContent(DecoratorMarker,Expression(Callee(Path(PathSegment(RegularPathSegment))),Argument(Value(Path(PathSegment(RegularPathSegment))))),CloseDelimiter)))"
  );
  assert.deepEqual(errorNodeRanges(tree), []);
});

test("parses inverse block openings", async () => {
  const tree = await parse("{{^if user}}none{{/if}}");
  const printed = tree.toString();

  assert.doesNotMatch(printed, /⚠/u, printed);
  assert.match(printed, /Block/);
  assert.match(printed, /InverseMarker/);
});

test("parses else and inverse clauses", async () => {
  const sources = [
    "{{#if user}}yes{{else}}no{{/if}}",
    "{{#if user}}yes{{else if fallback}}maybe{{/if}}",
    "{{#if user}}yes{{^}}no{{/if}}",
  ];

  for (const source of sources) {
    const tree = await parse(source);
    const printed = tree.toString();
    assert.doesNotMatch(printed, /⚠/u, printed);
    assert.match(printed, /ElseClause/);
  }
});

test("keeps one coherent HTML tree across Handlebars overlays", async () => {
  const source = '<section><a href="/u/{{user.id}}">x</a></section>';
  const tree = await parse(source);
  const printed = tree.toString();
  const { NodeProp } = await import("@lezer/common");
  const mounted = tree.prop(NodeProp.mounted);

  assert.ok(mounted, "Template should carry one mounted HTML overlay tree");
  const htmlTree = mounted.tree.toString();
  assert.equal((htmlTree.match(/Document/g) || []).length, 1, htmlTree);
  assert.equal((htmlTree.match(/Element/g) || []).length, 2, htmlTree);
  assert.match(htmlTree, /Attribute/);
  assert.doesNotMatch(htmlTree, /MismatchedCloseTag/);
  assert.match(printed, /Mustache/);
});

test("highlights HTML and Handlebars token categories distinctly", async () => {
  const source = '<div class="card">{{format user.name "long"}}</div>{{! note}}';
  const tree = await parse(source);
  const { highlightTree, tags } = await import("@lezer/highlight");
  const categories = new Set();
  const highlighter = {
    style(tagSet) {
      if (tagSet.includes(tags.tagName)) return "html-tag";
      if (tagSet.includes(tags.function(tags.variableName))) return "helper";
      if (tagSet.includes(tags.variableName)) return "variable";
      if (tagSet.includes(tags.string)) return "string";
      if (tagSet.includes(tags.comment)) return "comment";
      if (tagSet.includes(tags.punctuation)) return "delimiter";
      return null;
    },
  };

  highlightTree(tree, highlighter, (_from, _to, category) => categories.add(category));
  assert.deepEqual(
    [...categories].sort(),
    ["comment", "delimiter", "helper", "html-tag", "string", "variable"]
  );
});

test("provides fold ranges for structural blocks", async () => {
  const source = "{{#if user}}\n  {{name}}\n{{/if}}";
  const state = await createState(source);
  const { foldable } = await import("@codemirror/language");
  const firstLine = state.doc.line(1);
  const range = foldable(state, firstLine.from, firstLine.to);

  assert.ok(range);
  assert.equal(source.slice(range.from, range.to), "\n  {{name}}\n");
});

test("aligns block closing and else lines with their opener", async () => {
  const source = "{{#if user}}\n{{name}}\n{{else}}\nfallback\n{{/if}}";
  const { getIndentation, indentUnit } = await import("@codemirror/language");
  const state = await createState(source, [indentUnit.of("  ")]);

  assert.equal(getIndentation(state, state.doc.line(2).from), 2);
  assert.equal(getIndentation(state, state.doc.line(3).from), 0);
  assert.equal(getIndentation(state, state.doc.line(4).from), 2);
  assert.equal(getIndentation(state, state.doc.line(5).from), 0);
});

test("parses every Playground example with full document coverage", async () => {
  for (const example of EXAMPLES) {
    const tree = await parse(example.source);
    const printed = tree.toString();
    assert.equal(tree.length, example.source.replace(/\r\n?/gu, "\n").length, example.id);
    if (example.source.includes("{{")) {
      assert.match(
        printed,
        /Mustache|Block|Partial|Comment|RawBlock/u,
        `${example.id}: ${printed}`
      );
    }
  }
});

test("parses every valid public Handlebars fixture without error nodes", async () => {
  const fixtureNames = fs
    .readdirSync(PUBLIC_FIXTURES_DIR)
    .filter((fileName) => fileName.endsWith(".hbs"))
    .sort();

  assert.ok(fixtureNames.length > 0);
  for (const fixtureName of fixtureNames) {
    const source = fs.readFileSync(path.join(PUBLIC_FIXTURES_DIR, fixtureName), "utf8");
    const tree = await parse(source);
    assert.equal(tree.length, source.length, fixtureName);
    assert.deepEqual(errorNodeRanges(tree), [], `${fixtureName}: ${tree.toString()}`);
  }
});

test("recovers with full coverage for every representative prefix", async () => {
  const sources = [
    '<div>{{helper "unfinished}}</div>',
    "{{format (lookup user key)}}",
    "{{#if user}}<p>{{name}}</p>{{else}}none{{/if}}",
    "{{!-- comment with {{ braces --}}",
    "{{> avatar user}}",
    "{{{{raw}}}}{{value}}{{{{/raw}}}}",
  ];

  for (const source of sources) {
    for (let length = 0; length <= source.length; length += 1) {
      const prefix = source.slice(0, length);
      const tree = await parse(prefix);
      assert.equal(tree.length, prefix.length, JSON.stringify(prefix));
    }
  }
});
