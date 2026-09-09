# Changelog

All notable changes to hbsguard will be documented in this file.

## 0.3.0 — 2026-09-09

### Added

- Add a sorted rule-count breakdown to problem summaries in the `stylish` formatter while leaving clean and JSON output unchanged.

## 0.2.0 — 2026-08-14

### Changed

- Rename the project-specific preset identifier to `custom` across the package, Playground, and tests.
- Align historical changelog terminology with the generic custom-configuration language used in public documentation.

## 0.1.2 — 2026-08-14

### Changed

- Replace project-specific preset terminology in the npm README with a generic custom configuration example.

## 0.1.1 — 2026-08-14

### Added

- An interactive browser Playground with recommended, empty, and custom configuration examples.
- Available-rule helpers, live diagnostics, resolved configuration copying, and responsive light and dark themes.
- Branded README artwork and a direct link to the Playground for GitHub and npm users.
- Trusted npm publishing through the GitHub release workflow.

### Changed

- Improve stylish output with file-level status counts, elapsed time, and terminal color support.
- Extract browser-safe text linting while preserving the existing public Node.js API.

### Fixed

- Handle invalid Playground configuration shapes without crashing rule insertion.
- Report clipboard fallback failures instead of showing a false success state.

## 0.1.0 — 2026-08-06

Initial release.

### Added

- Standalone, read-only Handlebars linting for glob patterns, direct files, and directories.
- A CLI with stylish and JSON output, warning limits, quiet mode, and explicit exit codes.
- A programmatic API for loading config, linting files or text, and formatting results.
- A generic `recommended` preset and support for custom configurations.
- Rules for mustache and partial spacing, trailing spaces, final newlines, linebreak style, invalid bracket paths, Handlebars block indentation, and bare built-in block helpers.
- Parse-error reporting with full diagnostics in JSON and concise source context in stylish output.
- Relative and absolute glob discovery across POSIX and Windows paths, including drive-qualified, root-relative, UNC, and mixed-separator patterns.
- Built-in ignores for `.git/**` and `node_modules/**`, plus configurable ignore patterns.

### Fixed

- Apply the `recommended` preset when no config file is present instead of silently linting with no active rules.
- Apply configured and built-in ignores when an absolute glob targets a repository outside the current working directory.
- Normalize static `.` and `..` path segments consistently before traversing and matching absolute glob patterns.
- Preserve complete parser diagnostics in JSON while shortening recognized parse errors in stylish output.
- Avoid reporting bracket-like text inside Handlebars string literals as invalid paths.
- Treat backslash-escaped Handlebars expressions as literal text during token-based lint checks.
- Apply configured and built-in ignores when linting a direct directory outside the current working directory.
