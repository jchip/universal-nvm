"use strict";

const Path = require("path");
const webpack = require("webpack");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const base = {
  mode: "production",
  devtool: "source-map",
  entry: {
    "nvm.js": Path.resolve("lib/cli.js")
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true
    }),
    process.env.ANALYZE_BUNDLE && new BundleAnalyzerPlugin()
  ].filter(x => x),
  resolve: {
    symlinks: false, // don't resolve symlinks to their real path
    alias: {
      xml2js: Path.resolve("stubs/xml2js.js"),
      "iconv-lite": Path.resolve("stubs/iconv-lite.js"),
      "./iconv-loader": Path.resolve("stubs/iconv-loader.js"),
      debug: Path.resolve("stubs/debug.js"),
      lodash: require.resolve("lodash/lodash.min.js"),
      "resolve-from": Path.resolve("stubs/resolve-from.js"),
      bluebird: Path.resolve("stubs/bluebird")
    }
  },
  output: {
    filename: `[name]`,
    path: Path.resolve("dist"),
    libraryTarget: "commonjs2"
  },
  target: "node",
  node: {
    __filename: false,
    __dirname: false
  }
};

const node10 = Object.assign({}, base, {
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: x => x.indexOf("node_modules") > 0,
        use: {
          loader: "babel-loader",
          options: {
            presets: [["@babel/env", { targets: { node: "10.16.0" } }]]
          }
        }
      }
    ]
  }
});

module.exports = node10;
