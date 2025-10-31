"use strict";

/* eslint-disable global-require */

const opfs = require("opfs");
opfs._opfsSetPromise(); // use native promise for opfs
const fs = require("fs");
const NixClap = require("nix-clap");
const Path = require("path");
const ck = require("chalker");
const common = require("./common");

const packageConfig = JSON.parse(
  fs.readFileSync(Path.join(__dirname, "../package.json")).toString()
);

const options = {
  proxy: {
    desc: "Set network proxy URL",
    alias: "p",
    type: "string"
  },
  verifyssl: {
    desc: "Turn on/off verify SSL certificate",
    alias: ["ssl", "no-ssl"],
    type: "boolean",
    default: true
  },
  corepack: {
    desc: "Enable corepack after installation",
    alias: ["no-corepack"],
    type: "boolean"
  },
  latest: {
    desc: "Match latest version to uninstall"
  }
};

const checkOpts = parsed => {
  // Proxy priority: CLI flag > NVM_PROXY > protocol-specific proxy
  // For protocol-specific: lowercase first (npm convention), then uppercase
  let proxy;
  let proxySource;

  if (parsed.source.proxy === "cli") {
    proxy = parsed.opts.proxy;
    proxySource = "--proxy flag";
  } else if (process.env.NVM_PROXY) {
    proxy = process.env.NVM_PROXY;
    proxySource = "NVM_PROXY";
  } else {
    // Choose proxy based on the URL protocol we'll be fetching
    // Parse the first dist URL to determine protocol using WHATWG URL API
    const distUrls = common.getDistUrls();
    const firstUrl = distUrls[0];
    const parsedUrl = new URL(firstUrl);
    const protocol = parsedUrl.protocol; // Will be 'https:' or 'http:'

    if (protocol === 'https:') {
      // Check lowercase first (npm convention), then uppercase
      if (process.env.https_proxy) {
        proxy = process.env.https_proxy;
        proxySource = "https_proxy";
      } else if (process.env.HTTPS_PROXY) {
        proxy = process.env.HTTPS_PROXY;
        proxySource = "HTTPS_PROXY";
      } else if (process.env.http_proxy) {
        // Fallback to http_proxy if https_proxy not set
        proxy = process.env.http_proxy;
        proxySource = "http_proxy";
      } else if (process.env.HTTP_PROXY) {
        proxy = process.env.HTTP_PROXY;
        proxySource = "HTTP_PROXY";
      }
    } else {
      // HTTP protocol
      if (process.env.http_proxy) {
        proxy = process.env.http_proxy;
        proxySource = "http_proxy";
      } else if (process.env.HTTP_PROXY) {
        proxy = process.env.HTTP_PROXY;
        proxySource = "HTTP_PROXY";
      }
    }
  }

  const verifyssl =
    process.env.NVM_VERIFY_SSL === undefined || parsed.source.verifyssl === "cli"
      ? parsed.opts.verifyssl
      : process.env.NVM_VERIFY_SSL !== "false";

  // Corepack priority: CLI flag > NVM_COREPACK_ENABLED env var > default (false)
  const corepack =
    parsed.source.corepack === "cli"
      ? parsed.opts.corepack
      : process.env.NVM_COREPACK_ENABLED === "true";

  return { proxy, proxySource, verifyssl, corepack };
};

const commands = {
  install: {
    desc: "install the given version of Node.js",
    args: "<version>",
    exec: async parsed => {
      const { proxy, proxySource, verifyssl, corepack } = checkOpts(parsed);
      common.logProxyInfo(proxy, proxySource);
      await require("./install").cmdInstall(parsed.args.version, proxy, verifyssl, corepack);
    }
  },
  uninstall: {
    desc: "uninstall the given version of Node.js",
    args: "<version>",
    exec: parsed => {
      require("./uninstall")(parsed.args.version, parsed.opts);
    }
  },
  use: {
    desc: "use the given version of Node.js in current shell",
    args: "[version]",
    exec: parsed => {
      require("./use")(parsed.args.version);
    }
  },
  "auto-use": {
    desc: "automatically use version from .nvmrc, .node-version, or package.json\n" +
          "       nvm auto-use enable [--cd]  - enable automatic switching on cd\n" +
          "         --cd: use cd wrapper mode (more efficient, only triggers on cd command)\n" +
          "       nvm auto-use disable        - disable automatic switching",
    args: "[action]",
    options: {
      cd: {
        desc: "Use cd wrapper mode instead of prompt-based (for enable)",
        type: "boolean"
      },
      silent: {
        desc: "Suppress 'no version file found' message (used by shell hooks)",
        type: "boolean",
        default: false
      }
    },
    exec: async parsed => {
      const action = parsed.args.action;
      const useCdWrapper = parsed.opts.cd === true;
      const isSilent = parsed.opts.silent === true;

      if (action === "enable") {
        require("./enable-auto-use").enableAutoUse(useCdWrapper);
      } else if (action === "disable") {
        require("./enable-auto-use").disableAutoUse();
      } else if (action) {
        // Unknown action
        common.log(ck`<red>Unknown action: ${action}</>`);
        common.log(ck`Use: <white>nvm auto-use [enable|disable]</>`);
        common.exit(1);
      } else {
        // No subcommand - just run auto-use for current directory
        await require("./auto-use")({ silent: isSilent, verbose: false });
      }
    }
  },
  stop: {
    desc: "undo effects of nvm in current shell",
    alias: "unuse",
    exec: () => {
      require("./deactivate")();
    }
  },
  link: {
    desc: "permanently link the version of Node.js as default (supports 'lts' and 'latest')",
    args: "<version>",
    exec: parsed => {
      require("./switch")(parsed.args.version);
    }
  },
  unlink: {
    desc: "permanently unlink the default version",
    exec: () => {
      require("./switch-deactivate")();
    }
  },
  ls: {
    desc: "list all the installed Node.js versions",
    exec: () => {
      require("./ls").local();
    }
  },
  "ls-remote": {
    desc: "list remote versions available for install",
    exec: parsed => {
      const { proxy, proxySource, verifyssl } = checkOpts(parsed);
      common.logProxyInfo(proxy, proxySource);
      require("./ls").remote(proxy, verifyssl);
    }
  },
  cleanup: {
    desc: "remove stale local caches",
    exec: () => {
      require("../lib/cleanup")();
    }
  },
  postinstall: {
    desc: "Invoke custom post install script for the given version",
    args: "[version]",
    exec: async parsed => {
      require("../lib/post-install")(parsed.args.version);
    }
  },
  "init-env": {
    desc: "(windows) Generate cmd file to initialize env for nvm",
    exec: async parsed => {
      await common.initEnv();
    }
  },
  "undo-env": {
    desc: "(windows) Generate cmd file to undo env for nvm",
    exec: async parsed => {
      await common.undoEnv();
    }
  }
};

new NixClap({
  name: "unvm",
  handlers: {
    "post-help": evt => {
      evt.self.output(ck`envs:

  <green>NVM_PROXY</> - set proxy URL
  <green>HTTP_PROXY</> - fallback proxy for HTTP requests
  <green>HTTPS_PROXY</> - fallback proxy for HTTPS requests
  <green>NVM_VERIFY_SSL</> - (true/false) turn on/off SSL certificate verification (default: true)
  <green>NVM_COREPACK_ENABLED</> - (true/false) enable corepack on install (default: false)

  Proxy priority: -p flag > NVM_PROXY > HTTPS_PROXY > HTTP_PROXY

Examples:

    nvm install lts
    nvm install latest
    nvm install 20 --corepack
    nvm use 20
    nvm link lts
    nvm uninstall 22.3

doc: https://www.npmjs.com/package/universal-nvm

`);
    }
  }
})
  .version(packageConfig.version)
  .usage("$0 <command> [options]")
  .init(options, commands)
  .parse();
