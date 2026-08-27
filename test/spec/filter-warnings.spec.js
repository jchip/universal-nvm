import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const { filterWarnings, SUPPRESSED_CODES } = require('../../lib/filter-warnings');

const deprecation = code => Object.assign(new Error('url.parse() is deprecated'), {
  name: 'DeprecationWarning',
  code
});

// UNV-16: needle calls the deprecated url.parse, so every network operation
// printed a CVE-mentioning DEP0169 warning. Filter that one code without
// touching the rest of the warning system.
describe('filterWarnings', () => {
  let proc;
  let seen;
  let restore;

  beforeEach(() => {
    // a stand-in process: an EventEmitter is exactly the surface being patched
    proc = new EventEmitter();
    seen = [];
    proc.on('warning', w => seen.push(w));
    restore = filterWarnings(proc);
  });

  afterEach(() => {
    if (restore) restore();
  });

  it('swallows the needle url.parse deprecation', () => {
    const delivered = proc.emit('warning', deprecation('DEP0169'));

    expect(seen).toEqual([]);
    // false is what emit returns when nothing handled the event
    expect(delivered).toBe(false);
  });

  it('lets every other deprecation through', () => {
    proc.emit('warning', deprecation('DEP0040'));

    expect(seen).toHaveLength(1);
    expect(seen[0].code).toBe('DEP0040');
  });

  it('lets non-deprecation warnings through even with the suppressed code', () => {
    // only DeprecationWarning is filtered; an ExperimentalWarning carrying the
    // same code must still reach the user
    const w = Object.assign(new Error('experimental'), {
      name: 'ExperimentalWarning',
      code: 'DEP0169'
    });

    proc.emit('warning', w);

    expect(seen).toHaveLength(1);
  });

  it('leaves unrelated events untouched', () => {
    const exits = [];
    proc.on('exit', c => exits.push(c));

    const delivered = proc.emit('exit', 0);

    expect(exits).toEqual([0]);
    expect(delivered).toBe(true);
  });

  it('survives a warning with no code or payload', () => {
    expect(() => proc.emit('warning', undefined)).not.toThrow();
    expect(() => proc.emit('warning', new Error('plain'))).not.toThrow();
  });

  it('restores the original emit', () => {
    restore();
    restore = null;

    proc.emit('warning', deprecation('DEP0169'));

    expect(seen).toHaveLength(1);
  });

  it('suppresses only the codes it declares', () => {
    expect([...SUPPRESSED_CODES]).toEqual(['DEP0169']);
  });
});
