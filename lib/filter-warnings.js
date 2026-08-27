"use strict";

// needle -- the HTTP client behind install, ls-remote and link -- calls the
// deprecated url.parse in five places, two of them on the proxy path. Node 22+
// turns that into a multi-line DEP0169 DeprecationWarning that name-drops CVEs
// and prints on every network operation, which reads to a user as though unvm
// itself is unsafe.
//
// It is neither our bug nor actionable by the user: needle 3.5.0 (the latest
// release) still has all five call sites, and moving to fetch would mean losing
// per-request proxy / rejectUnauthorized support or taking on undici directly.
// See UNV-16.
//
// So filter that single code -- and only that one. This intercepts the emit
// rather than replacing the "warning" listener, because replacing the listener
// means reimplementing Node's printer and losing the "(node:pid) [CODE]" prefix,
// the trace hint and --trace-warnings stacks for every OTHER warning. Suppress
// one known-noisy dependency warning; leave the warning system alone.

const SUPPRESSED_CODES = new Set(["DEP0169"]);

/**
 * Stop the suppressed deprecation warnings from being emitted.
 * @param {object} [proc] - process to patch (injectable for tests)
 * @returns {function} restore function that puts the original emit back
 */
function filterWarnings(proc = process) {
  const originalEmit = proc.emit;

  proc.emit = function(name, data, ...rest) {
    if (
      name === "warning" &&
      data &&
      data.name === "DeprecationWarning" &&
      SUPPRESSED_CODES.has(data.code)
    ) {
      // what EventEmitter.emit returns when nothing handled the event
      return false;
    }

    return originalEmit.call(this, name, data, ...rest);
  };

  return () => {
    proc.emit = originalEmit;
  };
}

module.exports = { filterWarnings, SUPPRESSED_CODES };
