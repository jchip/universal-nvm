"use strict";

const Fs = require("fs");
const Path = require("path");
const mkdirp = require("mkdirp");
const rimraf = require("rimraf");
const xclap = require("@xarc/run");

const pkgFile = Path.resolve("package.json");
let pkgData;

const moduleDev = require("@xarc/module-dev");

moduleDev.loadTasks({ xrun: xclap });

function readPkg() {
  if (!pkgData) {
    pkgData = Fs.readFileSync(pkgFile);
  }

  return pkgData;
}

function replaceLine(file, oldLine, newLine) {
  const data = Fs.readFileSync(file, "utf8").split("\n");
  let found = 0;
  const newData = data.map(x => {
    if (x === oldLine) {
      found++;
      return newLine;
    }
    return x;
  });
  if (found !== 1) {
    throw new Error(`Replace file ${file} found ${found} old lines [${oldLine}]`);
  }
  Fs.writeFileSync(file, newData.join("\n"));
}

xclap.load("nvm", {
  prepack: {
    task: () => {
      const data = readPkg();
      const pkg = JSON.parse(data);
      pkg.scripts = { preinstall: pkg.scripts.preinstall };
      delete pkg.dependencies;
      delete pkg.nyc;
      delete pkg.devDependencies;

      mkdirp.sync(Path.resolve(".tmp"));
      Fs.writeFileSync(Path.resolve(".tmp/package.json"), data);
      Fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
    }
  },

  postpack: {
    task: () => {
      Fs.writeFileSync(pkgFile, readPkg());
    }
  },

  ".prepare": [".clean-dist", "nvm/bundle", "~$git diff --quiet", "nvm/prepack"],

  release: {
    desc: "Release a new version to npm.  package.json must be updated.",
    task: ["nvm/.prepare", "nvm/publish"],
    finally: ["nvm/postpack"]
  },

  ".clean-dist"() {
    const dist = Path.resolve("dist");
    rimraf.sync(dist);
    mkdirp.sync(dist);
  },

  bundle: "webpack",
  publish: "npm publish",

  version: {
    desc: "Bump version for release",
    dep: ["bundle", "~$git diff --quiet"],
    task() {
      const data = readPkg();
      const pkg = JSON.parse(data);
      const oldVer = `${pkg.version}`;
      let ver = oldVer.split(".").map(x => parseInt(x, 10));
      const bump = this.argv[1];
      switch (bump) {
        case "--major":
          ver[0]++;
          ver[1] = ver[2] = 0;
          break;
        case "--minor":
          ver[1]++;
          ver[2] = 0;
          break;
        case "--patch":
          ver[2]++;
          break;
        default:
          ver = bump.substring(2).split(".");
          console.log(`Using ${bump} as new version`);
          break;
      }
      const newVer = ver.join(".");
      replaceLine("install.ps1", `\$nvmVersion = "${oldVer}"`, `\$nvmVersion = "${newVer}"`);
      replaceLine("install.sh", `NVM_VERSION="${oldVer}"`, `NVM_VERSION="${newVer}"`);
      pkg.version = newVer;
      Fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
      const oldVerEsc = oldVer.replace(/\./g, "\\.");
      const regex1 = new RegExp(`\\/v${oldVerEsc}`, "g");
      const regex2 = new RegExp(`@${oldVerEsc}\\/`, "g");
      const regex3 = new RegExp(`nvm-${oldVerEsc}`);
      const readme = Fs.readFileSync("README.md", "utf8")
        .replace(regex1, `/v${newVer}`)
        .replace(regex2, `@${newVer}/`)
        .replace(regex3, `nvm-${newVer}`);
      Fs.writeFileSync("README.md", readme);

      return xclap.serial([
        `~$git add dist install.ps1 install.sh package.json README.md`,
        `~$git commit -m "${newVer}"`,
        `~$git tag "v${newVer}"`
      ]);
    }
  }
});
