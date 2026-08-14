"use strict";

const { parseTemplate } = require("./parser");
const { SourceCode } = require("./source-code");
const { tokenizeHandlebars } = require("./tokens");
const rules = require("./rules");
const { traverseAst } = require("./traverse");

function lintText(text, options = {}) {
  const config = options.config || { rules: {} };
  const filePath = options.filePath || "<input>";
  const sourceCode = new SourceCode(text, filePath);
  const tokens = tokenizeHandlebars(text);
  const parsed = parseTemplate(text);
  const messages = [];

  if (parsed.error) {
    messages.push({
      ruleId: "parse-error",
      severity: 2,
      line: parsed.error.line,
      column: parsed.error.column,
      message: parsed.error.message,
      source: sourceCode.getLine(parsed.error.line),
    });
  }

  for (const [ruleId, ruleConfig] of Object.entries(config.rules || {})) {
    const definition = rules[ruleId];

    if (!definition) {
      throw new Error(`Unknown rule "${ruleId}".`);
    }

    const normalizedRule = normalizeRuleConfig(ruleConfig);

    if (normalizedRule.severity === 0) {
      continue;
    }

    const context = createRuleContext(ruleId, normalizedRule, {
      sourceCode,
      ast: parsed.ast,
      filePath,
      tokens,
      report(message) {
        messages.push({
          ruleId,
          severity: normalizedRule.severity,
          ...message,
        });
      },
    });
    const listeners = definition.create(context) || {};

    if (typeof listeners.Template === "function") {
      listeners.Template({
        ast: parsed.ast,
        parseError: parsed.error,
        sourceCode,
        tokens,
      });
    }

    if (parsed.ast) {
      traverseAst(parsed.ast, listeners);
    }
  }

  messages.sort(compareMessages);

  return {
    filePath,
    messages,
    errorCount: messages.filter((message) => message.severity === 2).length,
    warningCount: messages.filter((message) => message.severity === 1).length,
  };
}

function createRuleContext(ruleId, normalizedRule, state) {
  return {
    id: ruleId,
    options: normalizedRule.options,
    getAst() {
      return state.ast;
    },
    getFilename() {
      return state.filePath;
    },
    getSourceCode() {
      return state.sourceCode;
    },
    getTokens() {
      return state.tokens;
    },
    report(details) {
      const line = details.line || 1;
      const column = details.column || 1;

      state.report({
        line,
        column,
        message: details.message,
      });
    },
  };
}

function normalizeRuleConfig(ruleConfig) {
  if (Array.isArray(ruleConfig)) {
    return {
      severity: normalizeSeverity(ruleConfig[0]),
      options: ruleConfig[1],
    };
  }

  return {
    severity: normalizeSeverity(ruleConfig),
    options: undefined,
  };
}

function normalizeSeverity(severity) {
  if (severity === 0 || severity === "off") {
    return 0;
  }

  if (severity === 1 || severity === "warn" || severity === "warning") {
    return 1;
  }

  if (severity === 2 || severity === "error") {
    return 2;
  }

  throw new Error(`Invalid rule severity "${severity}".`);
}

function compareMessages(left, right) {
  if (left.line !== right.line) {
    return left.line - right.line;
  }

  if (left.column !== right.column) {
    return left.column - right.column;
  }

  return left.ruleId.localeCompare(right.ruleId);
}

module.exports = {
  lintText,
};
