import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const common = require('../../lib/common');
const switchVersion = require('../../lib/switch');

// UNV-11: switch.js resolved "lts" with a hardcoded getRemoteFromJson(null, true,
// true), so `nvm link lts` ignored --proxy/--no-ssl and NVM_PROXY and failed
// behind a proxy while install and ls-remote worked.
describe('switch (nvm link) network options', () => {
  let tmpDir;
  let getRemote;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvm-switch-test-'));
    process.env.NVM_LINK = path.join(tmpDir, 'nodejs', 'bin');

    vi.spyOn(common, 'findLocalVersions').mockResolvedValue(['v18.19.0', 'v20.10.0']);
    getRemote = vi.spyOn(common, 'getRemoteFromJson').mockResolvedValue(['v18.19.0', 'v20.10.0']);
    vi.spyOn(common, 'findNodeVersion').mockResolvedValue({
      version: 'v20.10.0',
      nodeDir: path.join(tmpDir, 'v20.10.0')
    });
    vi.spyOn(common, 'getNodeBinDir').mockReturnValue(path.join(tmpDir, 'v20.10.0', 'bin'));
    vi.spyOn(common, 'createEnvironmentTmp').mockResolvedValue(undefined);
    vi.spyOn(common, 'setNvmLinkPath').mockResolvedValue(undefined);
    vi.spyOn(common, 'log').mockImplementation(() => {});
    // a failed link must not take the test process down with it
    vi.spyOn(common, 'exit').mockImplementation(() => {
      throw new Error('common.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NVM_LINK;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('forwards proxy and verifyssl when resolving "lts"', async () => {
    await switchVersion('lts', { proxy: 'http://proxy.corp:8080', verifyssl: false });

    expect(getRemote).toHaveBeenCalledWith('http://proxy.corp:8080', false, true);
  });

  it('defaults to verifyssl true and no proxy when none are given', async () => {
    await switchVersion('lts');

    expect(getRemote).toHaveBeenCalledWith(undefined, true, true);
  });

  it('keeps ssl verification on when only a proxy is set', async () => {
    await switchVersion('lts', { proxy: 'http://proxy.corp:8080' });

    expect(getRemote).toHaveBeenCalledWith('http://proxy.corp:8080', true, true);
  });

  it('reports the proxy it is about to use', async () => {
    const logProxy = vi.spyOn(common, 'logProxyInfo').mockImplementation(() => {});

    await switchVersion('lts', { proxy: 'http://proxy.corp:8080', proxySource: '--proxy flag' });

    expect(logProxy).toHaveBeenCalledWith('http://proxy.corp:8080', '--proxy flag');
  });

  // "latest" and an explicit version resolve from installed versions alone, so
  // they must not reach the network at all -- nor announce a proxy they will
  // never use.
  it('does not fetch remote versions for "latest"', async () => {
    const logProxy = vi.spyOn(common, 'logProxyInfo').mockImplementation(() => {});

    await switchVersion('latest', { proxy: 'http://proxy.corp:8080' });

    expect(getRemote).not.toHaveBeenCalled();
    expect(logProxy).not.toHaveBeenCalled();
  });

  it('does not fetch remote versions for an explicit version', async () => {
    await switchVersion('20.10.0', { proxy: 'http://proxy.corp:8080' });

    expect(getRemote).not.toHaveBeenCalled();
  });
});
