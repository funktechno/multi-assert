import { expect } from "chai";
import { multiAssert, multiAssertAsync } from "@funktechno/multi-assert";

// These tests fail on purpose: scripts/run-examples.mjs checks how the failures are reported.
describe("api response (mocha + chai)", () => {
  const res = { status: 404, headers: { "content-type": "text/html" }, body: { id: 7 } };

  it("passes when every check passes", () => {
    multiAssert([() => expect(res.status).to.equal(404), () => expect(res.body.id).to.equal(7)]);
  });

  it("reports every failure in one error", () => {
    multiAssert(
      [
        ["status is 200", () => expect(res.status).to.equal(200)],
        ["has id", () => expect(res.body.id).to.equal(7)],
        ["content type", () => expect(res.headers["content-type"]).to.equal("application/json")],
      ],
      { message: "user API response" },
    );
  });

  it("keeps the native diff for a single failure", () => {
    multiAssert([() => expect(res.body).to.deep.equal({ id: 8 })]);
  });

  it("reports async failures", async () => {
    await multiAssertAsync([
      ["async status", async () => expect(res.status).to.equal(500)],
      ["async id", async () => expect(res.body.id).to.equal(9)],
    ]);
  });
});
