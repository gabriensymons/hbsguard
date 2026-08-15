"use strict";

const RULE_REFERENCE = [
  {
    id: "indentation",
    description: "Enforce indentation based on Handlebars block depth.",
  },
  {
    id: "mustache-spacing",
    description: "Keep whitespace inside mustache braces consistent.",
  },
  {
    id: "partial-spacing",
    description: "Require valid spacing around partial expressions.",
  },
  {
    id: "no-trailing-spaces",
    description: "Reject spaces and tabs at the ends of lines.",
  },
  {
    id: "eol-last",
    description: "Require a final newline at the end of a template.",
  },
  {
    id: "linebreak-style",
    description: "Enforce Unix or Windows line endings.",
  },
  {
    id: "no-invalid-bracket-path",
    description: "Report invalid bracket notation in Handlebars paths.",
  },
  {
    id: "no-bare-builtin-block-helpers",
    description: "Reject built-in block helpers used as inline expressions.",
  },
];

function addRuleOverride(config, ruleId) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Playground config must be an object.");
  }

  if (!RULE_REFERENCE.some((rule) => rule.id === ruleId)) {
    throw new Error(`Unknown rule "${ruleId}".`);
  }

  return {
    ...config,
    rules: {
      ...(config.rules || {}),
      [ruleId]: "warn",
    },
  };
}

function toggleRuleOverride(config, ruleId) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Playground config must be an object.");
  }

  if (!RULE_REFERENCE.some((rule) => rule.id === ruleId)) {
    throw new Error(`Unknown rule "${ruleId}".`);
  }

  const rules = { ...(config.rules || {}) };
  if (!Object.prototype.hasOwnProperty.call(rules, ruleId)) {
    return addRuleOverride(config, ruleId);
  }

  delete rules[ruleId];
  return {
    ...config,
    rules,
  };
}

module.exports = {
  addRuleOverride,
  RULE_REFERENCE,
  toggleRuleOverride,
};
