import { formatFailures, shouldUseColor, summaryLine } from "./format";
import { MultiAssertError } from "./MultiAssertError";
import { normalizeError, userFrames } from "./normalize";
import type {
  AsyncCheck,
  AsyncCheckFn,
  Check,
  CheckFn,
  Failure,
  MultiAssertOptions,
} from "./types";

const defaults: Required<Omit<MultiAssertOptions, "message">> & { message?: string } = {
  rethrowSingle: true,
  color: "auto",
  stackFrames: 1,
  adapters: [],
};

/** Set defaults once, e.g. in a test setup file. */
export function configure(options: MultiAssertOptions): void {
  Object.assign(defaults, options);
}

interface Entry<F> {
  label?: string;
  fn: F;
}

function toEntries<F extends () => unknown>(
  checks: Array<F | [string, F]> | Record<string, F>,
): Entry<F>[] {
  const pairs: Array<[string | undefined, unknown]> = Array.isArray(checks)
    ? checks.map((c) => (Array.isArray(c) ? [c[0], c[1]] : [undefined, c]))
    : Object.entries(checks ?? {});
  return pairs.map(([label, fn], i) => {
    if (typeof fn !== "function") {
      throw new TypeError(
        `multiAssert: check ${i + 1}${label ? ` ("${label}")` : ""} is not a function`,
      );
    }
    return { label, fn: fn as F };
  });
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | undefined)?.then === "function";

interface Caught {
  entry: Entry<unknown>;
  index: number;
  error: unknown;
}

function captureSite(from: (...args: any[]) => unknown): string | undefined {
  const holder: { stack?: string } = {};
  const capture = (Error as any).captureStackTrace as
    | ((target: object, ctor?: (...args: any[]) => unknown) => void)
    | undefined;
  if (capture) {
    capture(holder, from);
    return holder.stack;
  }
  return new Error().stack;
}

function finish(
  caught: Caught[],
  total: number,
  options: MultiAssertOptions,
  site: string | undefined,
): void {
  if (caught.length === 0) return;
  const settings = { ...defaults, ...options };
  const [only] = caught;
  if (
    caught.length === 1 &&
    settings.rethrowSingle &&
    only.error instanceof Error &&
    !only.entry.label &&
    !settings.message
  ) {
    throw only.error;
  }

  const frames = new Map<Failure, string[]>();
  const failures = caught.map(({ entry, index, error }) => {
    const normalized = normalizeError(error, settings.adapters);
    const failure: Failure = {
      index,
      label: entry.label,
      message: normalized.message,
      actual: normalized.actual,
      expected: normalized.expected,
      operator: normalized.operator,
    };
    const list = userFrames(error instanceof Error ? error.stack : undefined);
    failure.location = list[0];
    frames.set(failure, list);
    return failure;
  });

  const message = formatFailures(failures, total, {
    heading: settings.message,
    color: shouldUseColor(settings.color),
    stackFrames: settings.stackFrames,
    frames,
  });
  const error = new MultiAssertError(
    caught.map((c) => c.error),
    message,
    failures,
    total,
  );
  // Point reporters at the test that called multiAssert, not at this package.
  const callSite = (site ?? "").split("\n").filter((l) => /^\s*at /.test(l));
  const heading = `${error.name}: ${summaryLine(failures.length, total, settings.message)}`;
  error.stack = [heading, ...callSite].join("\n");
  throw error;
}

/**
 * Runs every check instead of stopping at the first failure, then throws once with all failures
 * combined. Checks must be synchronous; use {@link multiAssertAsync} for async checks.
 */
export function multiAssert(
  checks: Check[] | Record<string, CheckFn>,
  options: MultiAssertOptions = {},
): void {
  const entries = toEntries<CheckFn>(checks);
  const caught: Caught[] = [];
  entries.forEach((entry, i) => {
    try {
      const result = entry.fn();
      if (isThenable(result)) {
        // Avoid an unhandled rejection from a promise we are not going to await.
        result.then(undefined, () => undefined);
        throw new TypeError("check returned a Promise; use multiAssertAsync() for async checks");
      }
    } catch (error) {
      caught.push({ entry, index: i + 1, error });
    }
  });
  finish(caught, entries.length, options, caught.length ? captureSite(multiAssert) : undefined);
}

/** Like {@link multiAssert}, but awaits each check in order. */
export async function multiAssertAsync(
  checks: AsyncCheck[] | Record<string, AsyncCheckFn>,
  options: MultiAssertOptions = {},
): Promise<void> {
  const site = captureSite(multiAssertAsync);
  const entries = toEntries<AsyncCheckFn>(checks);
  const caught: Caught[] = [];
  for (const [i, entry] of entries.entries()) {
    try {
      await entry.fn();
    } catch (error) {
      caught.push({ entry, index: i + 1, error });
    }
  }
  finish(caught, entries.length, options, site);
}
