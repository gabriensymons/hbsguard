"use strict";

const fs = require("node:fs");
const path = require("node:path");

const INTERNAL_IGNORES = [".git/**", "node_modules/**"];

function resolveLintFiles(patterns, options = {}) {
  const cwd = options.cwd || process.cwd();
  const ignoreMatchers = [...INTERNAL_IGNORES, ...(options.ignore || [])].map((pattern) =>
    createGlobMatcher(pattern)
  );
  const files = new Set();

  for (const pattern of patterns.length === 0 ? ["**/*.hbs"] : patterns) {
    const resolvedPattern = resolvePatternInput(pattern, cwd);

    if (resolvedPattern.kind === "file") {
      addIfLintable(files, resolvedPattern.filePath, cwd, ignoreMatchers);
      continue;
    }

    if (resolvedPattern.kind === "directory") {
      const ignoreBaseDirectories = isOutsideDirectory(resolvedPattern.filePath, cwd)
        ? [resolvedPattern.filePath]
        : [];

      for (const filePath of walkDirectory(resolvedPattern.filePath)) {
        if (!filePath.endsWith(".hbs")) {
          continue;
        }

        addIfLintable(files, filePath, cwd, ignoreMatchers, ignoreBaseDirectories);
      }
      continue;
    }

    const ignoreBaseDirectories = path.isAbsolute(resolvedPattern.pattern)
      ? [getPatternBaseDirectory(resolvedPattern.pattern, cwd)]
      : [];

    for (const filePath of expandGlobPattern(resolvedPattern.pattern, cwd)) {
      addIfLintable(files, filePath, cwd, ignoreMatchers, ignoreBaseDirectories);
    }
  }

  return Array.from(files).sort();
}

function isOutsideDirectory(directoryPath, cwd) {
  const relativePath = path.relative(cwd, directoryPath);

  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

function resolvePatternInput(pattern, cwd) {
  const absolutePath = path.resolve(cwd, pattern);

  if (!isGlobPattern(pattern) && fs.existsSync(absolutePath)) {
    const stats = fs.statSync(absolutePath);

    if (stats.isDirectory()) {
      return {
        kind: "directory",
        filePath: absolutePath,
      };
    }

    return {
      kind: "file",
      filePath: absolutePath,
    };
  }

  return {
    kind: "pattern",
    pattern,
  };
}

function expandGlobPattern(pattern, cwd) {
  const normalizedPattern = normalizeGlobPattern(pattern);
  const absoluteBaseDir = getPatternBaseDirectory(normalizedPattern, cwd);
  const matcher = createGlobMatcher(normalizedPattern);

  if (!fs.existsSync(absoluteBaseDir)) {
    return [];
  }

  const matches = [];

  for (const filePath of walkDirectory(absoluteBaseDir)) {
    const matchPath = getGlobMatchPath(normalizedPattern, filePath, cwd);

    if (matcher(matchPath)) {
      matches.push(filePath);
    }
  }

  return matches;
}

function addIfLintable(files, filePath, cwd, ignoreMatchers, ignoreBaseDirectories = []) {
  const ignoreMatchPaths = [cwd, ...ignoreBaseDirectories].map((baseDirectory) =>
    normalizePath(path.relative(baseDirectory, filePath))
  );

  if (
    ignoreMatchers.some((matcher) =>
      ignoreMatchPaths.some((ignoreMatchPath) => matcher(ignoreMatchPath))
    )
  ) {
    return;
  }

  files.add(filePath);
}

function walkDirectory(directoryPath) {
  const results = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...walkDirectory(entryPath));
      continue;
    }

    if (entry.isFile()) {
      results.push(entryPath);
    }
  }

  return results;
}

function createGlobMatcher(pattern, pathApi = path) {
  const matcher = new RegExp(
    globToRegExpSource(normalizeGlobPattern(pattern, pathApi)),
    pathApi.sep === "\\" ? "i" : ""
  );

  return (value) => matcher.test(normalizePath(value, pathApi));
}

function getGlobMatchPath(pattern, filePath, cwd, pathApi = path) {
  if (!pathApi.isAbsolute(pattern)) {
    return normalizePath(pathApi.relative(cwd, filePath), pathApi);
  }

  const patternRoot = normalizePath(pathApi.parse(pattern).root, pathApi);
  const fileRoot = normalizePath(pathApi.parse(filePath).root, pathApi);

  if (patternRoot === "/" && fileRoot !== "/") {
    return `/${normalizePath(pathApi.relative(pathApi.parse(filePath).root, filePath), pathApi)}`;
  }

  return normalizePath(filePath, pathApi);
}

function globToRegExpSource(pattern) {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          source += "(?:.*/)?";
          index += 2;
        } else {
          source += ".*";
          index += 1;
        }
      } else {
        source += "[^/]*";
      }

      continue;
    }

    if (character === "?") {
      source += "[^/]";
      continue;
    }

    if ("\\.[]{}()+-^$|".includes(character)) {
      source += `\\${character}`;
      continue;
    }

    source += character;
  }

  source += "$";
  return source;
}

function getPatternBaseDirectory(pattern, cwd, pathApi = path) {
  const normalizedPattern = normalizeGlobPattern(pattern, pathApi);
  const segments = normalizedPattern.split("/");
  const staticSegments = [];

  for (const segment of segments) {
    if (segment.includes("*") || segment.includes("?") || segment.includes("[")) {
      break;
    }

    staticSegments.push(segment);
  }

  const staticPath = staticSegments.join("/");
  const root = normalizePath(pathApi.parse(pattern).root, pathApi);
  const basePath =
    pathApi.isAbsolute(pattern) && staticPath === root.replace(/\/$/u, "") ? root : staticPath;

  return pathApi.resolve(cwd, basePath);
}

function isGlobPattern(pattern) {
  return /[*?[]/u.test(pattern);
}

function normalizeGlobPattern(pattern, pathApi = path) {
  const firstGlobIndex = pattern.search(/[*?[]/u);

  if (firstGlobIndex === -1) {
    return normalizePath(pathApi.normalize(pattern), pathApi);
  }

  const separatorIndex = Math.max(
    pattern.lastIndexOf(pathApi.sep, firstGlobIndex),
    pathApi.sep === "/" ? -1 : pattern.lastIndexOf("/", firstGlobIndex)
  );

  if (separatorIndex === -1) {
    return normalizePath(pattern, pathApi);
  }

  const staticPrefix = pathApi.normalize(pattern.slice(0, separatorIndex + 1));
  const dynamicSuffix = pattern.slice(separatorIndex + 1);

  if (staticPrefix === ".") {
    return normalizePath(dynamicSuffix, pathApi);
  }

  const separator = staticPrefix.endsWith(pathApi.sep) ? "" : pathApi.sep;
  return normalizePath(`${staticPrefix}${separator}${dynamicSuffix}`, pathApi);
}

function normalizePath(value, pathApi = path) {
  const normalized = value.split(pathApi.sep).join("/");

  if (normalized.startsWith("./")) {
    return normalized.slice(2);
  }

  return normalized;
}

module.exports = {
  createGlobMatcher,
  getGlobMatchPath,
  getPatternBaseDirectory,
  resolveLintFiles,
};
