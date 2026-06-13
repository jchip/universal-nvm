"use strict";

const https = require("https");
const http = require("http");

function getReq(url) {
  const port = parseInt(url.port);

  if (url.protocol === "https:") {
    return { client: https, port: port || 443 };
  } else if (url.protocol === "http:") {
    return { client: http, port: port || 80 };
  } else {
    return { client: https, port: 443 };
  }
}

function check() {
  const registry = process.argv[2];
  const url = new URL(registry);

  const { client, port } = getReq(url);

  const options = {
    hostname: url.hostname,
    port,
    path: "/optional-require",
    method: "GET"
  };

  const req = client.request(options, res => {
    console.log(`Checking npm registry ${registry} statusCode: ${res.statusCode}`);

    res.on("data", () => {
      process.exit(0);
    });
  });

  req.on("error", error => {
    console.error(`Checking npm registry ${registry} failed:`, error.message);
    process.exit(1);
  });

  req.end();
}

check();
