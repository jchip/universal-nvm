import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// shellName is derived from process.argv inside the module, so pull it (and
// build the markers) from the module rather than hardcoding "bash".
const { updateShellProfile, shellName } = require('../../bin/install_bashrc');
const BEGIN = `# NVM ${shellName} initialize BEGIN - do not modify #`;

const countBegins = s => (s.match(/initialize BEGIN/g) || []).length;
const countEnds = s => (s.match(/initialize END/g) || []).length;

describe('install_bashrc updateShellProfile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvm-bashrc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds the nvm block to a fresh profile, preserving user content', () => {
    const f = path.join(tmpDir, '.bashrc');
    fs.writeFileSync(f, '# user content\nexport FOO=1\n');

    updateShellProfile(f);

    const out = fs.readFileSync(f, 'utf8');
    expect(out).toContain('export FOO=1');
    expect(countBegins(out)).toBe(1);
    expect(countEnds(out)).toBe(1);
  });

  it('is idempotent across repeated installs (no duplicate blocks)', () => {
    const f = path.join(tmpDir, '.bashrc');
    fs.writeFileSync(f, '# user content\nexport FOO=1\n');

    updateShellProfile(f);
    const first = fs.readFileSync(f, 'utf8');
    updateShellProfile(f);
    updateShellProfile(f);
    const after = fs.readFileSync(f, 'utf8');

    expect(after).toBe(first);
    expect(countBegins(after)).toBe(1);
    expect(countEnds(after)).toBe(1);
  });

  it('aborts without modifying when the end marker is missing (corrupted block)', () => {
    const f = path.join(tmpDir, '.bashrc');
    const corrupted = `${BEGIN}\nsome stale line\n# user content after\nexport KEEP=1\n`;
    fs.writeFileSync(f, corrupted);

    updateShellProfile(f);

    // unchanged: we don't duplicate the block or delete the trailing content
    expect(fs.readFileSync(f, 'utf8')).toBe(corrupted);
  });
});
