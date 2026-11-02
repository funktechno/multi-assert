const assert = require("node:assert");
const { multiAssert, multiAssertAsync } = require("@funktechno/multi-assert");
require("@funktechno/multi-assert/jest");

// These tests fail on purpose: scripts/examples/run-examples.mjs checks how the failures are reported.
describe("api response (jest)", () => {
  const res = { status: 404, headers: { "content-type": "text/html" }, body: { id: 7 } };

  it("passes when every check passes", () => {
    multiAssert([() => expect(res.status).toBe(404), () => expect(res.body.id).toBe(7)]);
  });

  it("reports every failure in one error", () => {
    multiAssert(
      [
        ["status is 200", () => expect(res.status).toBe(200)],
        ["has id", () => expect(res.body.id).toBe(7)],
        ["content type", () => assert.strictEqual(res.headers["content-type"], "application/json")],
      ],
      { message: "user API response" },
    );
  });

  it("keeps the native diff for a single failure", () => {
    multiAssert([() => expect(res.body).toEqual({ id: 8 })]);
  });

  it("reports async failures", async () => {
    await multiAssertAsync([
      ["async status", async () => expect(res.status).toBe(500)],
      ["async id", async () => expect(res.body.id).toBe(9)],
    ]);
  });

  it("supports the toPassAll matcher", () => {
    expect(res).toPassAll([
      ["matcher status", (r) => expect(r.status).toBe(201)],
      ["matcher id", (r) => expect(r.body.id).toBe(10)],
    ]);
  });
});
