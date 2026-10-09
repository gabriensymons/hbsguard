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

`hbsguard` is a standalone Handlebars linter built around plain Handlebars AST semantics. Linting is read-only by default, with optional fixes for three whitespace rules. It provides a generic `recommended` preset and supports project-specific configurations without coupling the published package to any one repository.

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
- `--fix`: apply supported whitespace fixes to the selected files
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

### Fix mode

Use explicit opt-in to fix `no-trailing-spaces`, `eol-last`, and `linebreak-style` findings:

```bash
npx hbsguard "templates/**/*.hbs" --fix
```

Only enabled rules are fixed, including warning-level rules even with `--quiet`. Other findings remain diagnostics. The output describes the final files; warning limits are checked after fixing. Ordinary lint commands and the browser Playground remain read-only.

Fixes use validated source ranges. Invalid or overlapping edits reject the whole file's proposed change. Files with parse errors are never modified. Each candidate output is reparsed, and fixes must reach a stable result within ten passes before anything is saved. A second run makes no further changes; unchanged files are not rewritten.

The EOF fixer preserves the first existing newline style, or appends LF when none exists. An enabled `linebreak-style` rule then enforces its configured style. Existing trailing-space detection does not flag spaces immediately before CRLF; Unix conversion can expose those spaces on a later pass. Empty files and extra final newlines remain unchanged.

These are text formatting fixes and can affect quoted helper strings, raw content, `<pre>`, scripts, and styles. They do not guarantee identical rendered output. Choose scoped inputs and review the resulting diff.

Fix mode accepts regular files with one hard link and valid UTF-8, preserving a UTF-8 BOM. Changed output is prepared in a temporary file, flushed, and renamed over the original after rechecking the original content and identity. Errors before replacement leave that file intact; a later file's failure does not undo earlier successful writes. A cleanup failure is reported and may leave a temporary file to remove.

Stop other writers while fixing: the final recheck is not a lock and cannot eliminate all races. Normal permission bits are preserved, but inode replacement does not promise preservation of ownership, ACLs, extended attributes, or crash durability. Read-only lint behavior is unchanged for files that do not meet the write requirements.

### Exit codes

- `0`: lint completed without remaining errors and did not exceed `--max-warnings`
- `1`: remaining lint errors or an exceeded warning limit
- `2`: CLI, configuration, fix-engine, or file-operation failure; processing stops, and earlier fixed files remain saved

## Automation and coding agents

`hbsguard` can be used as a read-only verification step by coding agents and other automated tools that edit Handlebars templates.

For machine-readable diagnostics, run the locally installed version:

```bash
npx --no-install hbsguard "templates/**/*.hbs" --format json --max-warnings 0
```

Using `--no-install` ensures the command fails if `hbsguard` is not installed locally instead of downloading it automatically. Replace `templates/**/*.hbs` with a glob that matches the location of Handlebars templates in your project.

A suggested agent instruction is:

> After editing Handlebars files, run `npx --no-install hbsguard "templates/**/*.hbs" --format json --max-warnings 0`. Resolve the reported diagnostics without changing the lint configuration unless requested, then rerun the command. Use `--fix` only when explicitly authorized to rewrite templates, and review the resulting diff.

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

The package exports `loadConfig`, `lintFiles`, `lintText`, `formatResults`, and `fixText`. The existing lint APIs remain read-only:

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

`fixText` is also pure: it accepts a string and returns proposed output without file access.

```js
const { fixText, loadConfig } = require("hbsguard");
const { config } = loadConfig();
const { output, changed, result } = fixText("example  ", {
  config,
  filePath: "example.hbs",
});
```

`changed` is whether `output` differs from the input. `result` has the ordinary lint result shape and describes `output`. Like `lintText`, calling without configuration enables no rules. Original parse-error input returns unchanged with its existing diagnostics. Invalid fixes, overlap, an introduced parse error, or failure to converge throw an error with the file path and a code (`HBSGUARD_INVALID_FIX`, `HBSGUARD_OVERLAPPING_FIXES`, `HBSGUARD_FIX_PARSE_ERROR`, or `HBSGUARD_FIX_LIMIT`); no partial output is returned.

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

Fix-mode tests use synthetic public inputs and temporary files; repository-specific corpus verification stays outside this package.
