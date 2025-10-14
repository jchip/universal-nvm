import { describe, it, expect } from 'vitest';

const common = require("../../lib/common");

describe("common.getRemoteFromJson", () => {
  it("should get versions", async () => {
    const versions = await common.getRemoteFromJson();
    expect(versions).toBeInstanceOf(Array);
    expect(versions.length).toBeGreaterThan(0);
  }, 30000);
});
