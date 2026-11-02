import { multiAssert } from "./multiAssert";
import type { MultiAssertOptions } from "./types";

type Matcher<T> = ((received: T) => unknown) | [label: string, fn: (received: T) => unknown];

/** `expect(value).toPassAll([...])`: every check gets `value`, all failures are reported at once. */
export const multiAssertMatchers = {
  toPassAll<T>(received: T, checks: Matcher<T>[], options?: MultiAssertOptions) {
    const entries = checks.map((check) =>
      Array.isArray(check)
        ? ([check[0], () => check[1](received)] as [string, () => unknown])
        : () => check(received),
    );
    try {
      multiAssert(entries, { ...options, rethrowSingle: false });
      return { pass: true, message: () => "expected at least one check to fail, but all passed" };
    } catch (error) {
      return { pass: false, message: () => (error as Error).message };
    }
  },
};

interface ExpectLike {
  extend(matchers: Record<string, unknown>): void;
}

/** Registers `toPassAll` on a Jest-compatible `expect` (Jest, Vitest, Playwright). */
export function installMultiAssertMatchers(expectLike: ExpectLike): void {
  expectLike.extend(multiAssertMatchers);
}

// Importing "@funktechno/multi-assert/jest" is enough when `expect` is a global.
const globalExpect = (globalThis as { expect?: Partial<ExpectLike> }).expect;
if (typeof globalExpect?.extend === "function") {
  installMultiAssertMatchers(globalExpect as ExpectLike);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
     
    interface Matchers<R, T = unknown> {
      toPassAll(
        checks: Array<((received: T) => unknown) | [label: string, fn: (received: T) => unknown]>,
        options?: MultiAssertOptions,
      ): R;
    }
  }
}
