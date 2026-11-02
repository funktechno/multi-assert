import assert from "node:assert";
import { describe, it } from "node:test";
import { multiAssert, multiAssertAsync } from "@funktechno/multi-assert";

// These tests fail on purpose: scripts/examples/run-examples.mjs checks how the failures are reported.
describe("api response (node:test)", () => {
  const res = { status: 404, headers: { "content-type": "text/html" }, body: { id: 7 } };

  it("passes when every check passes", () => {
    multiAssert([() => assert.strictEqual(res.status, 404), () => assert.strictEqual(res.body.id, 7)]);
  });

  it("reports every failure in one error", () => {
    multiAssert(
      [
        ["status is 200", () => assert.strictEqual(res.status, 200)],
        ["has id", () => assert.strictEqual(res.body.id, 7)],
        ["content type", () => assert.strictEqual(res.headers["content-type"], "application/json")],
      ],
      { message: "user API response" },
    );
  });

  it("keeps the native diff for a single failure", () => {
    multiAssert([() => assert.deepStrictEqual(res.body, { id: 8 })]);
  });

  it("reports async failures", async () => {
    await multiAssertAsync([
      ["async status", async () => assert.strictEqual(res.status, 500)],
      ["async id", async () => assert.strictEqual(res.body.id, 9)],
    ]);
  });
});
