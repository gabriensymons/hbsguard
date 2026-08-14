<p align="center">
  <a href="https://gabriensymons.github.io/hbsguard/">
    <img src="https://gabriensymons.github.io/hbsguard/assets/hbsguard-logo.svg" alt="hbsguard" width="420">
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/hbsguard"><img src="https://img.shields.io/npm/v/hbsguard.svg" alt="npm version"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/hbsguard.svg" alt="Node.js version"></a>
  <a href="https://github.com/gabriensymons/hbsguard/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/hbsguard.svg" alt="license"></a>
</p>

<p align="center">
  <strong><a href="https://gabriensymons.github.io/hbsguard/">Try hbsguard in the Playground →</a></strong>
</p>

`hbsguard` is a standalone, read-only Handlebars linter built around plain Handlebars AST semantics. It provides a generic `recommended` preset and supports project-specific configurations without coupling the published package to any one repository.

Use the [browser Playground](https://gabriensymons.github.io/hbsguard/) to edit preloaded violations, switch presets, and inspect live diagnostics without installing anything.

## Requirements

- Node.js 20 or newer

## Installation

```bash
npm install --save-dev hbsguard
```

## Quick start

Lint a glob:

```bash
npx hbsguard "templates/**/*.hbs"
```

Lint all Handlebars files under the current working directory:

```bash
npx hbsguard
```

When no patterns are supplied, `hbsguard` uses `**/*.hbs`. When no config file exists, it applies the `recommended` preset.

Quote glob patterns so that `hbsguard`, rather than the shell, expands them.

## File inputs

The CLI accepts:

- Relative glob patterns
- Absolute glob patterns
- Direct file paths
- Direct directory paths

Configured ignore patterns are applied during file discovery. The built-in ignore patterns are `.git/**` and `node_modules/**`. Absolute globs may target a repository outside the current working directory; configured and built-in ignores are evaluated against that glob's traversal base as well as the current working directory.

## CLI

```text
Usage: hbsguard [patterns...] [options]
```

Options:

- `--config <path>`: use a specific config file
- `--format stylish|json`: select the output format; defaults to `stylish`
- `--max-warnings <n>`: fail when the warning count exceeds `n`
- `--quiet`: suppress warnings in formatter output
- `-h`, `--help`: show help

Autofix is not supported in v1. Passing `--fix` exits with an error without modifying files.

### Exit codes

- `0`: lint completed without errors and did not exceed `--max-warnings`
- `1`: lint errors were found or the warning limit was exceeded
- `2`: CLI, configuration, or runtime failure

## Configuration

Configuration is optional. To customize behavior, create `hbsguard.config.cjs` in the working directory:

```js
module.exports = {
  extends: ["recommended"],
  ignore: ["dist/**", "static/**"],
  rules: {
    indentation: ["error", { size: 2, blockDepth: true }],
    "mustache-spacing": "error",
    "partial-spacing": "error",
    "no-trailing-spaces": "error",
    "eol-last": "error",
    "linebreak-style": ["error", "unix"],
    "no-invalid-bracket-path": "error",
  },
};
```

Rules accept `"off"`, `"warn"`, or `"error"` severities. Numeric severities `0`, `1`, and `2` are also supported.

### Custom configuration example

Projects can extend `recommended` and override individual rules for an existing template corpus:

```js
module.exports = {
  extends: ["recommended"],
  ignore: [".runtime-cache/**"],
  rules: {
    indentation: "off",
    "no-bare-builtin-block-helpers": "error",
  },
};
```

This example ignores generated runtime-cache files, disables `indentation` while an existing corpus is brought into compliance, and enables `no-bare-builtin-block-helpers` for expressions such as `{{if foo}}` that should be written as `{{#if foo}}`.

### Stricter spacing styles

Repositories that require exact spacing can opt into stricter styles:

```js
module.exports = {
  rules: {
    "mustache-spacing": ["error", { style: "always" }],
    "partial-spacing": ["error", { beforeClose: "never" }],
  },
};
```

This requires `{{ title }}` instead of `{{title}}`, and `{{> foo}}` instead of `{{> foo }}`.

## Rules

| Rule | Purpose |
| --- | --- |
| `indentation` | Check indentation using Handlebars block depth. |
| `mustache-spacing` | Reject asymmetric mustache padding; optionally require padded mustaches. |
| `partial-spacing` | Require a separator after `>` and optionally disallow space before closing braces. |
| `no-trailing-spaces` | Disallow trailing spaces and tabs. |
| `eol-last` | Require a final newline. |
| `linebreak-style` | Enforce Unix or Windows line endings. |
| `no-invalid-bracket-path` | Report invalid bracket notation in Handlebars paths. |
| `no-bare-builtin-block-helpers` | Disallow inline use of built-in block helpers. |

Handlebars parse errors are always reported, independently of configured rules. JSON output preserves the full parser diagnostic; stylish output presents a shorter message with source context.

## Programmatic API

The package exports `loadConfig`, `lintFiles`, `lintText`, and `formatResults`:

```js
const { formatResults, lintFiles, loadConfig } = require("hbsguard");

const cwd = process.cwd();
const { config } = loadConfig({ cwd });
const results = lintFiles(["templates/**/*.hbs"], { config, cwd });
const output = formatResults(results, "stylish", { cwd });

if (output) {
  console.log(output);
}
```

This API provides an integration seam for external harnesses and private corpus runners while keeping repository-specific automation outside the package.

## Development

```bash
npm install
npm test
npm pack --dry-run --json
```

The project intentionally remains read-only for its initial release; fix mode is deferred until lint behavior is stable across existing template corpora.
