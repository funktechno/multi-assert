const { test, expect } = require("@playwright/test");
const { multiAssert, multiAssertAsync } = require("@funktechno/multi-assert");

// These tests fail on purpose: scripts/run-examples.mjs checks how the failures are reported.
test.describe("api response (playwright)", () => {
  const res = { status: 404, headers: { "content-type": "text/html" }, body: { id: 7 } };

  test("passes when every check passes", () => {
    multiAssert([() => expect(res.status).toBe(404), () => expect(res.body.id).toBe(7)]);
  });

  test("reports every failure in one error", () => {
    multiAssert(
      [
        ["status is 200", () => expect(res.status).toBe(200)],
        ["has id", () => expect(res.body.id).toBe(7)],
        ["content type", () => expect(res.headers["content-type"]).toBe("application/json")],
      ],
      { message: "user API response" },
    );
  });

  test("keeps the native diff for a single failure", () => {
    multiAssert([() => expect(res.body).toEqual({ id: 8 })]);
  });

  test("reports async failures", async () => {
    await multiAssertAsync([
      ["async status", async () => expect(res.status).toBe(500)],
      ["async id", async () => expect(res.body.id).toBe(9)],
    ]);
  });
});
