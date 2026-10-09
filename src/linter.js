"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const { resolveLintFiles } = require("./files");
const { fixText, lintText } = require("./lint-text");
const { fixError } = require("./fixes");

function lintFiles(patterns, options = {}) {
  const config = options.config || { ignore: [], rules: {} };
  const cwd = options.cwd || process.cwd();
  const filePaths = resolveLintFiles(patterns, {
    cwd,
    ignore: config.ignore,
  });

  return filePaths.map((filePath) => {
    const text = fs.readFileSync(filePath, "utf8");

    return lintText(text, {
      config,
      filePath,
    });
  });
}

function fixFiles(patterns, options = {}) {
  const config = options.config || { ignore: [], rules: {} };
  const cwd = options.cwd || process.cwd();
  const filePaths = resolveLintFiles(patterns, { cwd, ignore: config.ignore });

  return filePaths.map((filePath) => {
    try {
      const snapshot = readFixableFile(filePath);
      const text = snapshot.bytes.toString("utf8");
      if (!Buffer.from(text, "utf8").equals(snapshot.bytes)) {
        throw fixError(filePath, "HBSGUARD_INVALID_ENCODING", "Fix mode requires valid UTF-8.");
      }

      const fixed = fixText(text, { config, filePath });
      if (fixed.changed) {
        replaceFile(filePath, snapshot, fixed.output);
      }
      return fixed.result;
    } catch (error) {
      if (!error.message.includes(filePath)) {
        error.message = `${filePath}: ${error.message}`;
      }
      throw error;
    }
  });
}

function readFixableFile(filePath) {
  const before = fs.lstatSync(filePath);
  if (!before.isFile() || before.nlink !== 1) {
    throw fixError(filePath, "HBSGUARD_UNSAFE_FILE", "Fix mode requires a regular file with one hard link.");
  }

  const fd = fs.openSync(
    filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0)
  );
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || !sameFileMetadata(before, stat)) {
      throw fixError(filePath, "HBSGUARD_STALE_FILE", "File changed while it was being read.");
    }
    return { bytes: fs.readFileSync(fd), stat };
  } finally {
    fs.closeSync(fd);
  }
}

function sameFileMetadata(left, right) {
  return ["dev", "ino", "mode", "nlink"].every((key) => left[key] === right[key]);
}

function replaceFile(filePath, snapshot, output) {
  const temporaryPath = path.join(path.dirname(filePath), `.hbsguard-${randomUUID()}.tmp`);
  let fd;
  let ownsTemporaryFile = false;
  let failure;

  try {
    fd = fs.openSync(temporaryPath, "wx", 0o600);
    ownsTemporaryFile = true;
    fs.writeFileSync(fd, output, "utf8");
    fs.fchmodSync(fd, snapshot.stat.mode & 0o777);
    fs.fsyncSync(fd);
    const toClose = fd;
    fd = undefined;
    fs.closeSync(toClose);

    // shortcut: no cross-process lock; add one if concurrent writers must be supported.
    const current = readFixableFile(filePath);
    if (!sameFileMetadata(snapshot.stat, current.stat) || !snapshot.bytes.equals(current.bytes)) {
      throw fixError(filePath, "HBSGUARD_STALE_FILE", "File changed before fixes could be saved.");
    }

    fs.renameSync(temporaryPath, filePath);
    ownsTemporaryFile = false;
  } catch (error) {
    failure = error;
  } finally {
    // Rename consumes the temporary file, so successful commits need no cleanup.
    for (const cleanup of [
      () => { if (fd !== undefined) fs.closeSync(fd); },
      () => { if (ownsTemporaryFile) fs.unlinkSync(temporaryPath); },
    ]) {
      try {
        cleanup();
      } catch (error) {
        failure = new Error(`${failure?.message || "Fix failed"}; cleanup failed: ${error.message}`, {
          cause: failure || error,
        });
      }
    }
  }

  if (failure) {
    throw failure;
  }
}

module.exports = {
  fixFiles,
  lintFiles,
  lintText,
};
