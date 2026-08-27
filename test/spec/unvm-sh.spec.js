import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execFileP = promisify(execFile);

const hasShell = shell => {
  try {
    require('child_process').execFileSync('which', [shell], { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
};

// Drives the real bin/unvm.sh through a shell with NVM_HOME pointing at a stub
// "node" that prints each argv element on its own line, so argument forwarding
// (word-splitting, globbing) is observable end to end.
describe('bin/unvm.sh argument forwarding', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const unvmSh = path.join(projectRoot, 'bin', 'unvm.sh');
  let nvmHome;

  beforeAll(() => {
    nvmHome = fs.mkdtempSync(path.join(os.tmpdir(), 'unvm-sh-test-'));
    fs.mkdirSync(path.join(nvmHome, 'dist'));
    // dist/unvm.js only needs to exist; the stub node ignores it
    fs.writeFileSync(path.join(nvmHome, 'dist', 'unvm.js'), '');
    const stub = path.join(nvmHome, 'node');
    fs.writeFileSync(
      stub,
      '#!/bin/sh\n' +
        '# mimic "node -e ..." for the TMPDIR probe, else dump argv line by line\n' +
        'if [ "$1" = "-e" ]; then echo /tmp; exit 0; fi\n' +
        'shift 1\n' + // drop the dist/unvm.js path
        'for a in "$@"; do echo "ARG:$a"; done\n',
      { mode: 0o755 }
    );
    // a glob bait file: `nvm install 20.*` must not expand to it
    fs.writeFileSync(path.join(nvmHome, '20.1'), '');
  });

  afterAll(() => {
    fs.rmSync(nvmHome, { recursive: true, force: true });
  });

  // zsh sources ~/.zshenv even for `zsh -c`, and a developer running these tests
  // very likely has unvm installed there - which would reset NVM_HOME and redefine
  // the unvm function, so the stub never runs. -f (and bash's --norc) keeps the
  // shell from reading any user startup file. The env is likewise reduced to the
  // bare minimum so no inherited NVM_* / BASH_ENV leaks in.
  const shellArgs = shell => (shell === 'zsh' ? ['-f', '-c'] : ['--noprofile', '--norc', '-c']);

  async function runUnvm(shell, args) {
    const quoted = args.map(a => `'${a}'`).join(' ');
    const script = `source '${unvmSh}' && cd '${nvmHome}' && unvm ${quoted}`;
    const { stdout, stderr } = await execFileP(shell, [...shellArgs(shell), script], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: os.tmpdir(),
        NVM_HOME: nvmHome
      }
    });
    const parsed = stdout
      .split('\n')
      .filter(l => l.startsWith('ARG:'))
      .map(l => l.slice(4));
    // surface anything the shell complained about; an empty parse is otherwise silent
    if (parsed.length === 0) {
      throw new Error(`${shell} produced no ARG lines.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    }
    return parsed;
  }

  for (const shell of ['bash', 'zsh']) {
    const maybe = hasShell(shell) ? it : it.skip;

    maybe(`${shell}: forwards a quoted semver range as a single argument`, async () => {
      const args = await runUnvm(shell, ['install', '>=20 <21']);
      expect(args).toEqual([`--shell=${shell}`, 'install', '>=20 <21']);
    });

    maybe(`${shell}: does not glob-expand version arguments`, async () => {
      const args = await runUnvm(shell, ['install', '20.*']);
      expect(args).toEqual([`--shell=${shell}`, 'install', '20.*']);
    });

    maybe(`${shell}: preserves empty and whitespace-bearing arguments`, async () => {
      const args = await runUnvm(shell, ['run', 'a  b', '']);
      expect(args).toEqual([`--shell=${shell}`, 'run', 'a  b', '']);
    });
  }
});
