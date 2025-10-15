"use strict";

const ck = require("chalker");
const common = require("./common");
const fs = require("fs");
const semver = require("semver");

const versionFileNames = [".nvmrc", ".node-version"];

function isValidNodeVersion(version) {
  return /^v?\d+(\.\d+)*$/.test(version);
}

async function getEnginesNodeFromPackageJson() {
  try {
    const packageJsonContent = await fs.promises.readFile("package.json", "utf8");
    const packageJson = JSON.parse(packageJsonContent);
    const enginesNode = packageJson?.engines?.node;

    if (enginesNode) {
      common.log(`Read node requirement "${enginesNode}" from package.json`);
      return enginesNode;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      // Only log if it's not just a missing file
      if (err instanceof SyntaxError) {
        common.log(ck`<red>Failed parsing package.json: ${err.message}</>`);
      }
    }
  }

  return null;
}

async function findVersionFromSemverRange(range) {
  // Get all installed versions
  const installedVersions = await common.findLocalVersions();

  if (installedVersions.length === 0) {
    common.log(ck`<red>No Node.js versions installed</>`);
    common.exit(1);
  }

  // Find the best (highest) version that satisfies the range
  const matchingVersion = semver.maxSatisfying(installedVersions, range);

  if (matchingVersion) {
    common.log(ck`<green>Found installed version <white>${matchingVersion}</> matching "${range}"</>`);
    return matchingVersion.replace(/^v/, "");
  }

  common.log(ck`<red>No installed version satisfies requirement "${range}"</>`);
  common.log(`Available versions: ${installedVersions.join(" ")}`);
  common.log(ck`<yellow>Hint: Try running <white>nvm install ${range}</> first</>`);
  common.exit(1);
}

async function getNodeVersionFromFile() {
  // Try each file in order of priority
  for (const fileName of versionFileNames) {
    try {
      const version = (await fs.promises.readFile(fileName, "ascii")).trim();
      if (isValidNodeVersion(version)) {
        common.log(`Read version ${version} from ${fileName}`);
        return version;
      }
      common.log(ck`<red>Invalid version from ${fileName}: <white>${version}</>.</>`);
      common.exit(1);
    } catch (err) {
      if (err.code !== "ENOENT") {
        common.log(ck`<red>Failed reading ${fileName}: ${err.message}</>`);
        common.exit(1);
      }
      // File not found, try next file
    }
  }

  // Try package.json engines.node as fallback
  const enginesNode = await getEnginesNodeFromPackageJson();
  if (enginesNode) {
    // Check if it's a semver range or exact version
    if (isValidNodeVersion(enginesNode)) {
      // Exact version like "20.10.0"
      return enginesNode;
    } else if (semver.validRange(enginesNode)) {
      // Semver range like ">=18.0.0" or "^20.0.0"
      return await findVersionFromSemverRange(enginesNode);
    } else {
      common.log(ck`<red>Invalid node version requirement in package.json: <white>${enginesNode}</></>`);
      common.exit(1);
    }
  }

  // None of the version sources were found
  common.log(ck`<red>No ${versionFileNames.join(" or ")} file or package.json with engines.node found</>`);
  common.exit(1);
}

module.exports = async function(ver, ignoreTmp) {
  if (!ver) {
    ver = await getNodeVersionFromFile();
    ver = ver?.replace("v", "").trim();
  }

  const { version, nodeDir } = await common.findNodeVersion(ver);

  if (ignoreTmp !== true) {
    await common.resetNvmPaths();
    common.setNvmUsePath(nodeDir);
    process.env.NVM_USE = version;
    await common.createEnvironmentTmp();
  }
  common.log(ck`<green>Now using node <white>${version}</>.</>`);

  return { version, nodeDir };
};
