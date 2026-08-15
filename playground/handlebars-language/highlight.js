import { styleTags, tags } from "@lezer/highlight";

export const handlebarsHighlighting = styleTags({
  "OpenDelimiter CloseDelimiter TripleOpenDelimiter TripleCloseDelimiter RawOpenDelimiter RawCloseDelimiter LongCommentOpen LongCommentClose WhitespaceLongCommentOpen WhitespaceLongCommentClose WhitespaceCommentOpen WhitespaceCommentClose":
    tags.punctuation,
  "OpenParen CloseParen": tags.paren,

  "WhitespaceControl UnescapedMarker Equals Dot Slash At ParentReference CurrentReference Pipe": tags.operator,
  "BlockMarker DecoratorMarker DecoratorBlockMarker PartialMarker PartialBlockMarker CloseMarker ElseKeyword InverseMarker AsKeyword":
    tags.keyword,

  "Comment LongComment InlineCommentText LongCommentText": tags.comment,
  "Callee/Path/PathSegment/RegularPathSegment Callee/Path/PathSegment/DigitPathSegment PartialName/Path/PathSegment/RegularPathSegment PartialName/Path/PathSegment/DigitPathSegment":
    tags.function(tags.variableName),
  "RegularPathSegment DigitPathSegment DotPathSegment DotBracketPathSegment BracketPathSegment DataVariable": tags.variableName,
  BlockParamName: tags.definition(tags.variableName),
  HashKey: tags.propertyName,

  "String DoubleQuotedString SingleQuotedString": tags.string,
  Number: tags.number,
  Boolean: tags.bool,
  Null: tags.null,
  Undefined: tags.atom,
});
