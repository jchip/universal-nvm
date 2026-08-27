"use strict";

// Resolve a path to the file that actually holds its contents, following a
// symlink chain to its end -- INCLUDING a dangling tail, where the final link
// points at something that does not exist yet.
//
// This is the piece fs.realpathSync cannot do: realpath throws ENOENT on a
// dangling link, and the usual existsSync guard in front of it reports false
// for the same case (fs.access follows the link). Skipping resolution means a
// later rename(2) replaces the SYMLINK ITSELF with a regular file, which is how
// a chezmoi/stow-managed .bashrc -> ~/.dotfiles/bashrc quietly stops being
// managed. Writing at the resolved target instead preserves the link.
//
// Contract (shared with the bash twin): the result is
//   realpath(dirname(end-of-chain)) + "/" + basename(end-of-chain)
// i.e. the directory is fully canonicalized while the final component is left
// alone, since it is allowed not to exist. Canonicalizing the directory is what
// lets the caller drop its temp file beside the real target for an atomic
// rename(2) -- rename cannot cross filesystems, so "beside" has to be the real
// location, not a path that merely points there.
//
// Kept in bin/ rather than lib/ on purpose: package.json "files" ships bin but
// not lib (lib is webpack-bundled into dist/unvm.js), so a lib require would be
// missing from the published package at runtime. The bash twin lives in
// bin/resolve-link.sh -- both are pinned to the same behavior by
// test/fixtures/link-cases.txt; change one, change both.
//
// @param {string} file - path to resolve
// @param {object} [dep] - injected fs/path, for tests
// @returns {string} the resolved path; the input itself when it is not a symlink
//                   (whether it exists or not)
// @throws {Error} code ELOOP when the chain exceeds MAX_LINK_DEPTH (a cycle)

const MAX_LINK_DEPTH = 40; // same order as the kernel's SYMLOOP_MAX

function resolveLinkTarget(file, { fs = require("fs"), path = require("path") } = {}) {
  // Canonicalize the directory, keep the final component verbatim (it may not
  // exist). An unresolvable directory falls back to the path as-is rather than
  // failing -- the caller's own write will report the real problem.
  const finalize = p => {
    try {
      return path.join(fs.realpathSync(path.dirname(p)), path.basename(p));
    } catch (err) {
      return p;
    }
  };

  let current = file;

  for (let depth = 0; depth < MAX_LINK_DEPTH; depth++) {
    let stat;
    try {
      // lstat, never stat: we are asking about the link, not its target, so a
      // dangling link is a symlink here rather than a missing file.
      stat = fs.lstatSync(current);
    } catch (err) {
      if (err.code === "ENOENT") {
        // End of a dangling chain (or the file simply does not exist). Either
        // way, this path is where the contents belong.
        return finalize(current);
      }
      throw err;
    }

    if (!stat.isSymbolicLink()) {
      return finalize(current);
    }

    const target = fs.readlinkSync(current);
    // A relative link resolves against the directory holding the link, not cwd.
    current = path.isAbsolute(target) ? target : path.resolve(path.dirname(current), target);
  }

  const err = new Error(`Too many levels of symbolic links resolving ${file}`);
  err.code = "ELOOP";
  throw err;
}

module.exports = { resolveLinkTarget, MAX_LINK_DEPTH };
