import { describe, expect, it } from "vitest";
import { installMultiAssertMatchers, multiAssertMatchers } from "../src/jest";

installMultiAssertMatchers(expect);

describe("toPassAll matcher", () => {
  const res = { status: 404, body: { id: 7 } };

  it("passes when every check passes", () => {
    (expect(res) as any).toPassAll([
      (r: typeof res) => expect(r.status).toBe(404),
      ["has id", (r: typeof res) => expect(r.body.id).toBe(7)],
    ]);
  });

  it("reports every failing check in one message", () => {
    const result = multiAssertMatchers.toPassAll(res, [
      ["status is 200", (r) => expect(r.status).toBe(200)],
      (r) => expect(r.body.id).toBe(7),
      ["id is 8", (r) => expect(r.body.id).toBe(8)],
    ]);
    expect(result.pass).toBe(false);
    const message = result.message();
    expect(message.split("\n")[0]).toBe("2 of 3 assertions failed");
    expect(message).toContain("✕ 1) status is 200");
    expect(message).toContain("✕ 3) id is 8");
  });

  it("fails the test through expect when used as a matcher", () => {
    expect(() =>
      (expect(res) as any).toPassAll([
        ["a", (r: typeof res) => expect(r.status).toBe(1)],
        ["b", (r: typeof res) => expect(r.status).toBe(2)],
      ]),
    ).toThrow(/2 of 2 assertions failed/);
  });

  it("supports .not when something fails", () => {
    (expect(res) as any).not.toPassAll([(r: typeof res) => expect(r.status).toBe(200)]);
  });
});
