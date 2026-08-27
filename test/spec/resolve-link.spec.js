import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { resolveLinkTarget, MAX_LINK_DEPTH } = require('../../bin/resolve-link');

const projectRoot = path.resolve(__dirname, '../..');
const resolveLinkSh = path.join(projectRoot, 'bin', 'resolve-link.sh');
const casesFile = path.join(projectRoot, 'test', 'fixtures', 'link-cases.txt');

// One table, both implementations. See test/fixtures/link-cases.txt.
function loadCases() {
  return fs
    .readFileSync(casesFile, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(line => {
      const [name, setup, input, expected] = line.split('|').map(s => s.trim());
      return { name, setup, input, expected };
    });
}

function applySetup(dir, setup) {
  if (setup === '-') return;

  for (const op of setup.split(';')) {
    const [kind, rest] = [op.slice(0, op.indexOf(':')), op.slice(op.indexOf(':') + 1)];

    if (kind === 'dir') {
      fs.mkdirSync(path.join(dir, rest), { recursive: true });
    } else if (kind === 'file') {
      fs.writeFileSync(path.join(dir, rest), 'contents\n');
    } else if (kind === 'link') {
      const [linkPath, target] = rest.split('->');
      // target verbatim: a relative target must stay relative on disk
      fs.symlinkSync(target, path.join(dir, linkPath));
    } else {
      throw new Error(`unknown setup op: ${op}`);
    }
  }
}

// Drive the bash implementation the same way bin/nvx will: source it, call the
// function. -f / --norc keeps a developer's rc files out of it.
function runBash(input) {
  return execFileSync(
    'bash',
    ['--noprofile', '--norc', '-c', `. '${resolveLinkSh}' && resolve_link_target "$1"`, 'bash', input],
    { encoding: 'utf8' }
  ).trim();
}

describe('symlink resolution contract (bin/resolve-link.js and bin/resolve-link.sh)', () => {
  let tmpDir;

  beforeEach(() => {
    // realpath the temp dir itself: on macOS /var is a symlink to /private/var,
    // and the resolver canonicalizes directories, so $T must already be real.
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-link-')));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const c of loadCases()) {
    it(`js: ${c.name}`, () => {
      applySetup(tmpDir, c.setup);
      const input = path.join(tmpDir, c.input);

      if (c.expected === 'ELOOP') {
        expect(() => resolveLinkTarget(input)).toThrow(
          expect.objectContaining({ code: 'ELOOP' })
        );
        return;
      }

      expect(resolveLinkTarget(input)).toBe(c.expected.replace('$T', tmpDir));
    });

    it(`sh: ${c.name}`, () => {
      applySetup(tmpDir, c.setup);
      const input = path.join(tmpDir, c.input);

      if (c.expected === 'ELOOP') {
        expect(() => runBash(input)).toThrow();
        return;
      }

      expect(runBash(input)).toBe(c.expected.replace('$T', tmpDir));
    });
  }

  // Depth is part of the contract too: the twins must give up at the same place,
  // so a chain that is legal for one is not an ELOOP for the other.
  it('both implementations accept a chain just under the depth limit', () => {
    fs.writeFileSync(path.join(tmpDir, 'link0'), 'contents\n');
    for (let i = 1; i < MAX_LINK_DEPTH; i++) {
      fs.symlinkSync(path.join(tmpDir, `link${i - 1}`), path.join(tmpDir, `link${i}`));
    }
    const deepest = path.join(tmpDir, `link${MAX_LINK_DEPTH - 1}`);

    expect(resolveLinkTarget(deepest)).toBe(path.join(tmpDir, 'link0'));
    expect(runBash(deepest)).toBe(path.join(tmpDir, 'link0'));
  });
});
