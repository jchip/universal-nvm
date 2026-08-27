import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');
const nvx = path.join(projectRoot, 'bin', 'nvx');

// UNV-10. The --install-to-system branch itself writes /etc/environment and
// needs root, so it is not executed here; ENV_FILE is deliberately NOT made
// overridable, since an env var steering a sudo write is a worse problem than
// the missing coverage. What IS pinned: the two premises the fix rests on, plus
// the fact that nvx still loads with the helper sourced.
describe('nvx --install-to-system prerequisites', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nvx-envfile-')));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // The bug: `grep -v -E '^PATH=' file && ...` aborted the chain on a stock
  // Debian/Ubuntu /etc/environment, which holds nothing but a PATH= line --
  // grep selects no lines and exits 1, which is success for our purposes.
  describe('grep -v exit status on a PATH-only /etc/environment', () => {
    const runGrep = envFile => {
      const out = path.join(tmpDir, 'out');
      const r = spawnSync('bash', ['--noprofile', '--norc', '-c', `grep -v -E '^PATH=' "$1" > "$2"`, 'bash', envFile, out], {
        encoding: 'utf8'
      });
      return { status: r.status, content: fs.readFileSync(out, 'utf8') };
    };

    it('exits 1 with empty output when the file holds only a PATH line', () => {
      const envFile = path.join(tmpDir, 'environment');
      fs.writeFileSync(envFile, 'PATH="/usr/local/bin:/usr/bin:/bin"\n');

      const { status, content } = runGrep(envFile);

      // status 1 is "no lines selected", NOT an error -- the fix treats <= 1 as ok
      expect(status).toBe(1);
      expect(content).toBe('');
    });

    it('exits 0 and keeps non-PATH lines when the file has other content', () => {
      const envFile = path.join(tmpDir, 'environment');
      fs.writeFileSync(envFile, 'LANG=en_US.UTF-8\nPATH="/usr/bin:/bin"\nEDITOR=vi\n');

      const { status, content } = runGrep(envFile);

      expect(status).toBe(0);
      expect(content).toBe('LANG=en_US.UTF-8\nEDITOR=vi\n');
    });
  });

  it('nvx parses and sources the symlink helper without error', () => {
    // bash -n catches syntax errors introduced in the sourcing block; running
    // --help exercises the source itself.
    execFileSync('bash', ['-n', nvx]);

    const out = execFileSync(nvx, ['--help'], { encoding: 'utf8' });
    expect(out).toContain('--install-to-system');
  });

  it('nvx exposes resolve_link_target after sourcing, resolving a dangling link', () => {
    const real = path.join(tmpDir, 'environment.real');
    const link = path.join(tmpDir, 'environment');
    fs.symlinkSync(real, link); // dangling: target not created

    // Same load path nvx uses: source bin/resolve-link.sh out of the script dir.
    const resolved = execFileSync(
      'bash',
      [
        '--noprofile',
        '--norc',
        '-c',
        `. '${path.join(projectRoot, 'bin', 'resolve-link.sh')}' && resolve_link_target "$1"`,
        'bash',
        link
      ],
      { encoding: 'utf8' }
    ).trim();

    expect(resolved).toBe(real);
  });
});
