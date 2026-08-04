"use strict";

function traverseAst(node, visitors, parent = null) {
  if (!node || typeof node.type !== "string") {
    return;
  }

  const handler = visitors[node.type];

  if (typeof handler === "function") {
    handler(node, parent);
  }

  switch (node.type) {
    case "Program":
      visitAll(node.body, visitors, node);
      visit(node.blockParams, visitors, node);
      break;
    case "BlockStatement":
      visit(node.path, visitors, node);
      visitAll(node.params, visitors, node);
      visit(node.hash, visitors, node);
      visit(node.program, visitors, node);
      visit(node.inverse, visitors, node);
      break;
    case "MustacheStatement":
    case "SubExpression":
      visit(node.path, visitors, node);
      visitAll(node.params, visitors, node);
      visit(node.hash, visitors, node);
      break;
    case "PartialStatement":
      visit(node.name, visitors, node);
      visitAll(node.params, visitors, node);
      visit(node.hash, visitors, node);
      break;
    case "PartialBlockStatement":
      visit(node.name, visitors, node);
      visitAll(node.params, visitors, node);
      visit(node.hash, visitors, node);
      visit(node.program, visitors, node);
      break;
    case "Hash":
      visitAll(node.pairs, visitors, node);
      break;
    case "HashPair":
      visit(node.value, visitors, node);
      break;
    default:
      break;
  }
}

function visit(node, visitors, parent) {
  if (node) {
    traverseAst(node, visitors, parent);
  }
}

function visitAll(nodes, visitors, parent) {
  if (!Array.isArray(nodes)) {
    return;
  }

  for (const node of nodes) {
    visit(node, visitors, parent);
  }
}

module.exports = {
  traverseAst,
};
