<p align="center">
  <a href="https://gabriensymons.github.io/hbsguard/">
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcset="https://gabriensymons.github.io/hbsguard/assets/hbsguard-logo-dark.svg"
      >
      <source
        media="(prefers-color-scheme: light)"
        srcset="https://gabriensymons.github.io/hbsguard/assets/hbsguard-logo.svg"
      >
      <img
        src="https://gabriensymons.github.io/hbsguard/assets/hbsguard-logo.svg"
        alt="hbsguard"
        width="420"
      >
    </picture>
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

### Stylish summary

The default `stylish` formatter ends with file and problem totals, a count for each rule with visible findings, and elapsed time:

```text
Files:     398 with problems, 531 clean, 929 checked
Problems:  786 errors, 0 warnings
Rules:     429  mustache-spacing
           239  no-trailing-spaces
           118  eol-last
Time:      1.90 s
```

Rule counts are sorted from highest to lowest, with alphabetical ordering for ties. The `Rules:` section is omitted when a run has no visible findings. Use `--format json` for machine-readable diagnostics.

Autofix is not supported in v1. Passing `--fix` exits with an error without modifying files.

### Exit codes

- `0`: lint completed without errors and did not exceed `--max-warnings`
- `1`: lint errors were found or the warning limit was exceeded
- `2`: CLI, configuration, or runtime failure

## Automation and coding agents

`hbsguard` can be used as a read-only verification step by coding agents and other automated tools that edit Handlebars templates.

For machine-readable diagnostics, run the locally installed version:

```bash
npx --no-install hbsguard "templates/**/*.hbs" --format json --max-warnings 0
```

Using `--no-install` ensures the command fails if `hbsguard` is not installed locally instead of downloading it automatically. Replace `templates/**/*.hbs` with a glob that matches the location of Handlebars templates in your project.

A suggested agent instruction is:

> After editing Handlebars files, run `npx --no-install hbsguard "templates/**/*.hbs" --format json --max-warnings 0`. Resolve the reported diagnostics without changing the lint configuration unless requested, then rerun the command. Do not pass `--fix`; `hbsguard` does not modify files.

Treat any nonzero exit code as a failed verification step. See [Exit codes](#exit-codes) for details.

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
npm run build:grammar
npm run build:playground
npm run preview:stylish
npm pack --dry-run --json
```

`build:grammar` regenerates the committed hbsguard-owned Handlebars parser.
`build:playground` runs that generation step before producing the static site.
`preview:stylish` renders clean and representative problem summaries for visually checking terminal formatting. Use `NO_COLOR=1 npm run preview:stylish` to compare the plain-text output.

The project intentionally remains read-only for its initial release; fix mode is deferred until lint behavior is stable across existing template corpora.
