"use strict";

/* eslint-disable max-statements */

const fs = require("fs");
const path = require("path");
const common = require("./common");
const ck = require("chalker");

// Errors worth pointing at proxy settings: connection-level failures and TLS
// interception, which is what a corporate network looks like from here. A 404
// or a JSON parse error is not one of these, so it gets the cause alone.
const NETWORK_ERROR_RE = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|EPROTO|socket hang up|certificate|self.signed|tunneling socket|\b407\b/i;

function isNetworkError(err) {
  const text = `${(err && err.code) || ""} ${(err && err.message) || err || ""}`;
  return NETWORK_ERROR_RE.test(text);
}

// opts carries the network settings resolved by cli.js checkOpts (CLI flag >
// NVM_PROXY > HTTPS_PROXY/HTTP_PROXY). Only the "lts" path below reaches the
// network, but it has to honor them: it previously hardcoded proxy=null and
// verifyssl=true, so `nvm link lts` failed behind a proxy and ignored --no-ssl
// while `nvm install` and `nvm ls-remote` worked.
module.exports = async function(ver, { proxy, verifyssl = true, proxySource } = {}) {
  const link = common.getNvmLinkDir();

  if (!link) {
    common.log(ck`<red>can't link because can't determine link dir.
define env NVM_LINK to specify the link dir.</>`);
    common.exit(1);
  }

  // Resolve special keywords like "lts" and "latest" to actual versions
  let resolvedVer = ver;
  const lver = ver ? ver.toLowerCase() : "";

  if (lver === "lts" || lver === "vlts" || lver === "latest" || lver === "vlatest") {
    // Get installed versions
    const installedVersions = await common.findLocalVersions();

    if (installedVersions.length === 0) {
      common.log(ck`<red>No Node.js versions installed yet</>`);
      common.exit(1);
    }

    if (lver === "lts" || lver === "vlts") {
      // Find the latest LTS version among installed versions.
      // Knowing which installed versions are LTS requires the remote list, so
      // this is the one path in `link` that touches the network.
      let remoteVersions;

      // Only the fetch is guarded. Widening this try would swallow the
      // common.exit(1) below -- exit is injectable, so a caller that makes it
      // throw would surface a genuine "no LTS installed" as a network failure.
      try {
        // logged here rather than in cli.js so `nvm link <explicit version>`,
        // which never fetches, stays quiet about a proxy it will not use
        common.logProxyInfo(proxy, proxySource);
        remoteVersions = await common.getRemoteFromJson(proxy, verifyssl, true);
      } catch (err) {
        // Report the cause. Without it a proxy 407, an ETIMEDOUT and a
        // self-signed certificate all read identically, and the old advice
        // ("specify a specific version") routed around a network
        // misconfiguration instead of naming it.
        const reason = common.ckEscape((err && err.message) || err);
        common.log(ck`<red>Unable to fetch remote versions to determine LTS status: ${reason}</>`);

        if (isNetworkError(err) && !proxy) {
          common.log(
            ck`<yellow>If this machine reaches the internet through a proxy, set <white>--proxy</> or the <white>NVM_PROXY</> env var.</>`
          );
        }

        common.log(ck`<yellow>Or link an exact version instead, e.g. <white>nvm link 24.20.0</></>`);
        common.exit(1);
        return;
      }

      // Filter installed versions that are also LTS versions
      const installedLtsVersions = installedVersions.filter(v => remoteVersions.includes(v));

      if (installedLtsVersions.length === 0) {
        common.log(ck`<red>No LTS versions installed. Available LTS versions can be found with: nvm ls-remote</>`);
        common.log(`Installed versions: ${installedVersions.join(" ")}`);
        common.exit(1);
        return;
      }

      // Get the latest LTS version
      resolvedVer = installedLtsVersions[installedLtsVersions.length - 1];
      common.log(ck`<green>Linking to latest installed LTS version: ${resolvedVer}</>`);
    } else {
      // "latest" - just use the latest installed version
      resolvedVer = installedVersions[installedVersions.length - 1];
      common.log(ck`<green>Linking to latest installed version: ${resolvedVer}</>`);
    }
  }

  const { version, nodeDir } = await common.findNodeVersion(resolvedVer);

  try {
    // lexists (not _exists): a dangling NVM_LINK symlink -- e.g. its target
    // version dir was removed -- must still be unlinked, or the symlink() below
    // fails with EEXIST. _exists follows the link and would report it missing.
    if (await common.lexists(link)) {
      await fs.promises.unlink(link);
    } else {
      const baseDir = path.dirname(link);
      if (!(await common._exists(baseDir))) {
        await fs.promises.mkdir(baseDir, { recursive: true });
      }
    }

    const nodeBinDir = common.getNodeBinDir(nodeDir);
    await fs.promises.symlink(nodeBinDir, link, "junction");

    process.env.NVM_LINK_VERSION = version;

    if (!process.env.NVM_USE) {
      await common.setNvmLinkPath();
    }
    await common.createEnvironmentTmp();
  } catch (err) {
    common.log(ck`<red>switch to version ${version} failed</>`, err);
    common.exit(1);
  }
};
