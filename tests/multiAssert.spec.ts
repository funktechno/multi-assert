import assert, { AssertionError } from "node:assert";
import { describe, expect, it } from "vitest";
import { MultiAssertError, configure, multiAssert, multiAssertAsync } from "../src";
import { stripAnsi, safeInspect, normalizeError } from "../src/normalize";

const catchIt = (fn: () => unknown): any => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected a throw");
};

describe("multiAssert", () => {
  it("does nothing when every check passes", () => {
    expect(() => multiAssert([() => expect(1).toBe(1), () => assert.equal(2, 2)])).not.toThrow();
  });

  it("reports every failure in one MultiAssertError", () => {
    const err = catchIt(() =>
      multiAssert([
        () => expect(1).toBe(2),
        () => expect(2).toBe(2),
        () => assert.strictEqual("a", "b"),
      ]),
    );
    expect(err).toBeInstanceOf(MultiAssertError);
    expect(err.total).toBe(3);
    expect(err.passed).toBe(1);
    expect(err.failures.map((f: any) => f.index)).toEqual([1, 3]);
    expect(err.errors).toHaveLength(2);
    expect(err.message.split("\n")[0]).toBe("2 of 3 assertions failed");
  });

  it("keeps the original errors untouched", () => {
    const err = catchIt(() =>
      multiAssert([
        () => assert.strictEqual(1, 2),
        () => assert.strictEqual(3, 4),
      ]),
    );
    expect(err.errors[0]).toBeInstanceOf(AssertionError);
    expect(err.errors[0].actual).toBe(1);
    expect(err.failures[1]).toMatchObject({ actual: 3, expected: 4, operator: "strictEqual" });
  });

  it("rethrows a single unlabelled failure as is", () => {
    const original = new Error("boom");
    const err = catchIt(() =>
      multiAssert([
        () => undefined,
        () => {
          throw original;
        },
      ]),
    );
    expect(err).toBe(original);
  });

  it("wraps a single failure when rethrowSingle is false", () => {
    const err = catchIt(() =>
      multiAssert([() => assert.equal(1, 2)], { rethrowSingle: false }),
    );
    expect(err).toBeInstanceOf(MultiAssertError);
    expect(err.message.split("\n")[0]).toBe("1 of 1 assertion failed");
  });

  it("wraps a single failure when it has a label so the label isn't lost", () => {
    const err = catchIt(() => multiAssert([["status is 200", () => assert.equal(404, 200)]]));
    expect(err).toBeInstanceOf(MultiAssertError);
    expect(err.message).toContain("✕ 1) status is 200");
  });

  it("accepts labels as tuples and as an object", () => {
    const tuple = catchIt(() =>
      multiAssert([
        ["first", () => assert.equal(1, 2)],
        ["second", () => assert.equal(3, 4)],
      ]),
    );
    const record = catchIt(() =>
      multiAssert({
        first: () => assert.equal(1, 2),
        second: () => assert.equal(3, 4),
      }),
    );
    expect(tuple.failures.map((f: any) => f.label)).toEqual(["first", "second"]);
    expect(record.failures.map((f: any) => f.label)).toEqual(["first", "second"]);
  });

  it("shows the group heading", () => {
    const err = catchIt(() =>
      multiAssert([() => assert.equal(1, 2), () => assert.equal(3, 4)], {
        message: "user API response",
      }),
    );
    expect(err.message.split("\n")[0]).toBe("2 of 2 assertions failed (user API response)");
  });

  it("puts the failing spec location on each failure", () => {
    const err = catchIt(() =>
      multiAssert([() => assert.equal(1, 2), () => assert.equal(3, 4)]),
    );
    expect(err.failures[0].location).toMatch(/tests\/multiAssert\.spec\.ts:\d+:\d+$/);
    expect(err.message).toMatch(/→ tests\/multiAssert\.spec\.ts:\d+:\d+/);
  });

  it("points the error stack at the caller, not the package", () => {
    const err = catchIt(() =>
      multiAssert([() => assert.equal(1, 2), () => assert.equal(3, 4)]),
    );
    const lines = err.stack.split("\n");
    expect(lines[0]).toBe("MultiAssertError: 2 of 2 assertions failed");
    expect(err.stack).toContain(err.message);
    expect(lines.find((l: string) => /^\s*at /.test(l))).toContain("multiAssert.spec.ts");
    expect(err.stack).not.toMatch(/src[\\/]multiAssert\.ts/);
  });

  it("hides stack frames when stackFrames is 0", () => {
    const err = catchIt(() =>
      multiAssert([() => assert.equal(1, 2), () => assert.equal(3, 4)], { stackFrames: 0 }),
    );
    expect(err.message).not.toContain("→");
  });

  it("strips ANSI colors from messages unless color is on", () => {
    const colored = () => {
      throw Object.assign(new Error("x"), {
        matcherResult: { message: "expected \u001b[31m1\u001b[39m to be 2" },
      });
    };
    const off = catchIt(() => multiAssert([colored, colored], { color: false }));
    expect(off.message).not.toContain("\u001b");
    expect(off.failures[0].message).toBe("expected 1 to be 2");
    const on = catchIt(() => multiAssert([colored, colored], { color: true }));
    expect(on.message).toContain("\u001b[31m✕\u001b[39m");
    expect(on.failures[0].message).toBe("expected 1 to be 2");
  });

  it("reports non-Error throws", () => {
    const err = catchIt(() =>
      multiAssert([
        () => {
          throw "boom";
        },
        () => {
          throw { code: 7 };
        },
      ]),
    );
    expect(err.failures[0].message).toBe("[non-Error thrown] \"boom\"");
    expect(err.failures[1].message).toContain("\"code\": 7");
  });

  it("flags a check that returns a promise and tells the user what to use", () => {
    const err = catchIt(() =>
      multiAssert([() => Promise.reject(new Error("late")), () => assert.equal(1, 2)]),
    );
    expect(err.failures[0].message).toContain("multiAssertAsync");
    expect(err.failures).toHaveLength(2);
  });

  it("rejects checks that are not functions", () => {
    expect(() => multiAssert([123 as any])).toThrow(TypeError);
    expect(() => multiAssert({ named: "nope" } as any)).toThrow(/"named"/);
  });

  it("serialises to the failures with toJSON", () => {
    const err = catchIt(() =>
      multiAssert([["a", () => assert.equal(1, 2)], ["b", () => assert.equal(3, 4)]]),
    );
    const json = JSON.parse(JSON.stringify(err));
    expect(json).toMatchObject({ name: "MultiAssertError", passed: 0, total: 2 });
    expect(json.message).toContain("2 of 2 assertions failed");
    expect(json.failures).toHaveLength(2);
    expect(json.failures[0]).toMatchObject({ index: 1, label: "a" });
    // reporters that dump own properties must not see the failures twice
    expect(Object.keys(err)).not.toContain("failures");
  });

  it("uses custom adapters before the built-in ones", () => {
    class MyAssertError extends Error {
      constructor(public detail: string) {
        super("generic");
      }
    }
    const adapters = [
      {
        matches: (e: unknown) => e instanceof MyAssertError,
        normalize: (e: unknown) => ({ message: `custom: ${(e as MyAssertError).detail}` }),
      },
    ];
    const throwIt = (detail: string) => () => {
      throw new MyAssertError(detail);
    };
    const err = catchIt(() => multiAssert([throwIt("one"), throwIt("two")], { adapters }));
    expect(err.failures.map((f: any) => f.message)).toEqual(["custom: one", "custom: two"]);
  });

  it("configure() changes the defaults", () => {
    configure({ rethrowSingle: false });
    try {
      expect(catchIt(() => multiAssert([() => assert.equal(1, 2)]))).toBeInstanceOf(
        MultiAssertError,
      );
    } finally {
      configure({ rethrowSingle: true });
    }
  });
});

describe("multiAssertAsync", () => {
  it("awaits checks in order and aggregates failures", async () => {
    const order: number[] = [];
    const err = await multiAssertAsync([
      async () => {
        order.push(1);
        await expect(Promise.resolve(1)).resolves.toBe(2);
      },
      () => {
        order.push(2);
      },
      ["third", () => Promise.reject(new Error("nope"))],
    ]).catch((e) => e);
    expect(order).toEqual([1, 2]);
    expect(err).toBeInstanceOf(MultiAssertError);
    expect(err.failures.map((f: any) => f.index)).toEqual([1, 3]);
  });

  it("keeps the caller in the stack after an await", async () => {
    const err = await multiAssertAsync([
      () => Promise.reject(new Error("a")),
      () => Promise.reject(new Error("b")),
    ]).catch((e) => e);
    const frame = err.stack.split("\n").find((l: string) => /^\s*at /.test(l));
    expect(frame).toContain("multiAssert.spec.ts");
  });

  it("resolves when everything passes", async () => {
    await expect(multiAssertAsync([async () => 1, () => 2])).resolves.toBeUndefined();
  });
});

describe("normalize helpers", () => {
  it("strips every kind of ANSI sequence", () => {
    expect(stripAnsi("\u001b[1;31mred\u001b[0m \\u001b[32mgreen\\u001b[39m")).toBe("red green");
  });

  it("handles function and array matcher messages", () => {
    const fn = normalizeError({ matcherResult: { message: () => "from fn" } });
    const arr = normalizeError({ matcherResult: { message: ["a", "b"] } });
    expect(fn.message).toBe("from fn");
    expect(arr.message).toBe("a\nb");
  });

  it("inspects cyclic and exotic values safely", () => {
    const cyc: any = { name: "x" };
    cyc.self = cyc;
    expect(safeInspect(cyc)).toContain("[Circular]");
    expect(safeInspect(10n)).toBe("\"10n\"");
    expect(safeInspect("x".repeat(600), 10)).toHaveLength(11);
  });

  it("falls through to the next adapter when a custom one throws", () => {
    const result = normalizeError(new Error("hi"), [
      {
        matches: () => {
          throw new Error("bad adapter");
        },
        normalize: () => ({ message: "never" }),
      },
    ]);
    expect(result.message).toBe("Error: hi");
  });
});
