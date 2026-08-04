"use strict";

const DEFAULT_BUILTINS = new Set(["if", "unless", "each", "with"]);

module.exports = {
  meta: {
    defaultOptions: {
      builtins: ["if", "unless", "each", "with"],
    },
  },
  create(context) {
    const options = {
      ...this.meta.defaultOptions,
      ...(context.options || {}),
    };
    const builtinNames = new Set(options.builtins || DEFAULT_BUILTINS);

    return {
      MustacheStatement(node) {
        const helperName = node.path && node.path.original;

        if (!builtinNames.has(helperName)) {
          return;
        }

        context.report({
          line: node.loc.start.line,
          column: node.loc.start.column + 1,
          message: `Built-in helper "${helperName}" must be used as a block helper, like "{{#${helperName} ...}}".`,
        });
      },
    };
  },
};
