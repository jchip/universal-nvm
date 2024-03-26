"use strict";

const common = require("../../lib/common");
const { expect } = require("chai");

describe("common.getRemoteFromJson", function() {
  this.timeout(30000);
  it("should get versions", async () => {
    const versions = await common.getRemoteFromJson();
    expect(versions).to.be.an("array").that.is.not.empty;
  });
});
