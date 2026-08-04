"use strict";

const { formatResults } = require("./formatters");
const { loadConfig } = require("./config");
const { lintFiles } = require("./linter");

function runCli(argv, streams = {}) {
  const stdout = streams.stdout || process.stdout;
  const stderr = streams.stderr || process.stderr;

  try {
    const parsed = parseArgv(argv);

    if (parsed.help) {
      stdout.write(`${buildHelpText()}\n`);
      process.exitCode = 0;
      return 0;
    }

    const { config } = loadConfig({
      cwd: process.cwd(),
      configPath: parsed.configPath,
    });
    const results = lintFiles(parsed.patterns, {
      config,
      cwd: process.cwd(),
    });
    const formattedResults = parsed.quiet ? hideWarnings(results) : results;
    const output = formatResults(formattedResults, parsed.format, {
      cwd: process.cwd(),
    });

    if (output) {
      stdout.write(`${output}\n`);
    }

    const errorCount = sum(results, "errorCount");
    const warningCount = sum(results, "warningCount");
    const maxWarningsExceeded =
      parsed.maxWarnings >= 0 && warningCount > parsed.maxWarnings;
    const exitCode = errorCount > 0 || maxWarningsExceeded ? 1 : 0;

    if (maxWarningsExceeded) {
      stderr.write(
        `hbsguard found ${warningCount} warnings, which exceeds the configured maximum of ${parsed.maxWarnings}.\n`
      );
    }

    process.exitCode = exitCode;
    return exitCode;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return 2;
  }
}

function parseArgv(argv) {
  const parsed = {
    configPath: undefined,
    format: "stylish",
    help: false,
    maxWarnings: -1,
    patterns: [],
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "-h" || argument === "--help") {
      parsed.help = true;
      continue;
    }

    if (argument === "--quiet") {
      parsed.quiet = true;
      continue;
    }

    if (argument === "--config") {
      parsed.configPath = readOptionValue(argv, index, "--config");
      index += 1;
      continue;
    }

    if (argument === "--format") {
      parsed.format = readOptionValue(argv, index, "--format");
      index += 1;
      continue;
    }

    if (argument === "--max-warnings") {
      parsed.maxWarnings = Number(readOptionValue(argv, index, "--max-warnings"));
      index += 1;
      continue;
    }

    if (argument === "--fix") {
      throw new Error("Autofix is not supported in v1.");
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option "${argument}".`);
    }

    parsed.patterns.push(argument);
  }

  if (!["stylish", "json"].includes(parsed.format)) {
    throw new Error(`Unknown formatter "${parsed.format}".`);
  }

  if (!Number.isInteger(parsed.maxWarnings) || parsed.maxWarnings < -1) {
    throw new Error("--max-warnings must be an integer greater than or equal to -1.");
  }

  return parsed;
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];

  if (!value) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

function hideWarnings(results) {
  return results.map((result) => ({
    ...result,
    messages: result.messages.filter((message) => message.severity === 2),
    warningCount: 0,
  }));
}

function sum(results, fieldName) {
  return results.reduce((total, result) => total + result[fieldName], 0);
}

function buildHelpText() {
  return [
    "Usage: hbsguard [patterns...] [options]",
    "",
    "Options:",
    "  --config <path>        Path to a hbsguard config file",
    "  --format <name>        Output format: stylish or json",
    "  --max-warnings <n>     Fail when warning count exceeds n",
    "  --quiet                Suppress warnings in formatter output",
    "  -h, --help             Show help",
  ].join("\n");
}

module.exports = {
  runCli,
};
