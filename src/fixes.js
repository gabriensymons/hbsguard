"use strict";

function fixError(filePath, code, message) {
  return Object.assign(new Error(`${filePath}: ${message}`), { code });
}

function applyFixes(source, reports, filePath) {
  const fixes = [];

  for (const { ruleId, fix } of reports) {
    if (
      !fix || typeof fix !== "object" || Array.isArray(fix) ||
      !Array.isArray(fix.range) || fix.range.length !== 2 ||
      !Number.isInteger(fix.range[0]) || !Number.isInteger(fix.range[1]) ||
      typeof fix.text !== "string"
    ) {
      throw fixError(filePath, "HBSGUARD_INVALID_FIX", `Invalid fix from ${ruleId}.`);
    }

    const [start, end] = fix.range;
    if (
      start < 0 || end < start || end > source.length ||
      splitsSurrogatePair(source, start) || splitsSurrogatePair(source, end)
    ) {
      throw fixError(filePath, "HBSGUARD_INVALID_FIX", `Invalid fix range from ${ruleId}.`);
    }

    if (source.slice(start, end) !== fix.text) {
      fixes.push(fix);
    }
  }

  fixes.sort((left, right) => left.range[0] - right.range[0] || left.range[1] - right.range[1]);
  let previous;
  for (const fix of fixes) {
    const [start, end] = fix.range;
    if (
      previous && (
        start < previous.range[1] ||
        (start === end && start === previous.range[0] && start === previous.range[1])
      )
    ) {
      throw fixError(filePath, "HBSGUARD_OVERLAPPING_FIXES", "Overlapping fixes are not allowed.");
    }
    previous = fix;
  }

  let cursor = 0;
  const parts = [];
  for (const { range: [start, end], text } of fixes) {
    parts.push(source.slice(cursor, start), text);
    cursor = end;
  }
  parts.push(source.slice(cursor));
  return parts.join("");
}

function splitsSurrogatePair(source, index) {
  const before = source.charCodeAt(index - 1);
  const after = source.charCodeAt(index);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

module.exports = { applyFixes, fixError };
