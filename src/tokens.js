"use strict";

function tokenizeHandlebars(text) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let column = 1;

  while (index < text.length) {
    if (
      text[index] === "{" &&
      text[index + 1] === "{" &&
      !isEscapedExpression(text, index)
    ) {
      const token = readToken(text, index, line, column);

      if (!token) {
        const position = advanceChar(text[index], { line, column });
        line = position.line;
        column = position.column;
        index += 1;
        continue;
      }

      tokens.push(token);
      index = token.endIndex;
      line = token.end.line;
      column = token.end.column;
      continue;
    }

    const position = advanceChar(text[index], { line, column });
    line = position.line;
    column = position.column;
    index += 1;
  }

  return tokens;
}

function isEscapedExpression(text, index) {
  return text[index - 1] === "\\" && text[index - 2] !== "\\";
}

function readToken(text, startIndex, startLine, startColumn) {
  const start = {
    line: startLine,
    column: startColumn,
  };

  let openDelimiter = "{{";
  let closeDelimiter = "}}";
  let contentStart = startIndex + 2;

  if (text.startsWith("{{{{", startIndex)) {
    openDelimiter = "{{{{";
    closeDelimiter = "}}}}";
    contentStart = startIndex + 4;
  } else if (text.startsWith("{{{", startIndex)) {
    openDelimiter = "{{{";
    closeDelimiter = "}}}";
    contentStart = startIndex + 3;
  } else if (text.startsWith("{{!--", startIndex)) {
    openDelimiter = "{{!--";
    closeDelimiter = "--}}";
    contentStart = startIndex + 5;
  }

  const closeIndex = text.indexOf(closeDelimiter, contentStart);

  if (closeIndex === -1) {
    return null;
  }

  const endIndex = closeIndex + closeDelimiter.length;
  const raw = text.slice(startIndex, endIndex);
  const content = text.slice(contentStart, closeIndex);
  const end = advanceText(raw, start);

  return {
    type: classifyToken(openDelimiter, content),
    raw,
    content,
    openDelimiter,
    closeDelimiter,
    start,
    end,
    startIndex,
    endIndex,
  };
}

function classifyToken(openDelimiter, content) {
  if (openDelimiter === "{{!--") {
    return "comment";
  }

  if (openDelimiter === "{{{{") {
    return "raw-block";
  }

  if (openDelimiter === "{{{") {
    return "triple-stash";
  }

  const trimmed = getTagContentInfo({ content }).text.trim();

  if (trimmed.startsWith("!")) {
    return "comment";
  }

  if (trimmed.startsWith("#>")) {
    return "partial-block-open";
  }

  if (trimmed.startsWith(">")) {
    return "partial";
  }

  if (trimmed.startsWith("/")) {
    return "block-close";
  }

  if (trimmed === "^" || trimmed.startsWith("else")) {
    return "else";
  }

  if (trimmed.startsWith("#") || trimmed.startsWith("^")) {
    return "block-open";
  }

  return "mustache";
}

function extractTagPadding(token) {
  const content = getTagContentInfo(token).text;
  const leading = content.match(/^\s*/u)[0];
  const trailing = content.match(/\s*$/u)[0];

  return {
    leading,
    trailing,
    body: content.slice(leading.length, content.length - trailing.length),
  };
}

function getTagContentInfo(token) {
  let startOffset = 0;
  let endOffset = token.content.length;

  if (token.content.startsWith("~")) {
    startOffset += 1;
  }

  if (token.content.endsWith("~")) {
    endOffset -= 1;
  }

  return {
    text: token.content.slice(startOffset, endOffset),
    offset: startOffset,
  };
}

function advanceText(text, position) {
  let line = position.line;
  let column = position.column;

  for (const character of text) {
    const next = advanceChar(character, { line, column });
    line = next.line;
    column = next.column;
  }

  return { line, column };
}

function advanceChar(character, position) {
  if (character === "\n") {
    return {
      line: position.line + 1,
      column: 1,
    };
  }

  return {
    line: position.line,
    column: position.column + 1,
  };
}

module.exports = {
  extractTagPadding,
  getTagContentInfo,
  tokenizeHandlebars,
};
