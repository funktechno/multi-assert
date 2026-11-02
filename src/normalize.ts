import type { ErrorAdapter, NormalizedError } from "./types";

const ESC = String.fromCharCode(27);
/** Every ANSI CSI sequence, plus the already-escaped text form some reporters print. */
const ANSI = new RegExp(`(?:${ESC}|\\\\u001b|\\\\x1b)\\[[0-9;?]*[A-Za-z]`, "g");

export const stripAnsi = (text: string): string => text.replace(ANSI, "");

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null;

/** Cycle-safe, truncated rendering for values that aren't Errors. */
export function safeInspect(value: unknown, max = 500): string {
  const seen = new WeakSet<object>();
  let text: string;
  try {
    text =
      JSON.stringify(
        value,
        (_key, v) => {
          if (typeof v === "bigint") return `${v}n`;
          if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
          if (typeof v === "symbol") return v.toString();
          if (isObject(v)) {
            if (seen.has(v)) return "[Circular]";
            seen.add(v);
          }
          return v;
        },
        2,
      ) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Jest / Vitest / Playwright `expect` errors carry a `matcherResult`. */
const matcherAdapter: ErrorAdapter = {
  name: "matcher",
  matches: (e) => isObject(e) && isObject(e.matcherResult),
  normalize(e) {
    const result = (e as any).matcherResult;
    let message: unknown = result.message;
    if (typeof message === "function") message = message();
    if (Array.isArray(message)) message = message.join("\n");
    return {
      message: typeof message === "string" ? message : String((e as Error).message ?? ""),
      actual: result.actual,
      expected: result.expected,
      operator: typeof result.name === "string" ? result.name : undefined,
    };
  },
};

/** node:assert, chai, uvu and Vitest's chai-based errors expose actual / expected. */
const assertionAdapter: ErrorAdapter = {
  name: "assertion",
  matches: (e) =>
    e instanceof Error &&
    ("actual" in e || "expected" in e || "operator" in e || e.name === "AssertionError"),
  normalize(e) {
    const err = e as Error & { actual?: unknown; expected?: unknown; operator?: string };
    return {
      message: err.message,
      actual: err.actual,
      expected: err.expected,
      operator: typeof err.operator === "string" ? err.operator : undefined,
    };
  },
};

const errorAdapter: ErrorAdapter = {
  name: "error",
  matches: (e) => e instanceof Error || (isObject(e) && typeof e.message === "string"),
  normalize(e) {
    const err = e as Error;
    const message = err.message ? `${err.name}: ${err.message}` : String(err.name ?? "Error");
    return { message };
  },
};

const otherAdapter: ErrorAdapter = {
  name: "other",
  matches: () => true,
  normalize: (e) => ({ message: `[non-Error thrown] ${safeInspect(e)}` }),
};

export const builtInAdapters: ErrorAdapter[] = [
  matcherAdapter,
  assertionAdapter,
  errorAdapter,
  otherAdapter,
];

export function normalizeError(error: unknown, custom: ErrorAdapter[] = []): NormalizedError {
  const adapter = [...custom, ...builtInAdapters].find((a) => {
    try {
      return a.matches(error);
    } catch {
      return false;
    }
  }) as ErrorAdapter;
  const normalized = adapter.normalize(error);
  return { ...normalized, message: stripAnsi(normalized.message) };
}

/** Frames from this package's own source/dist, which should never be shown as a location. */
const OWN_FRAME = /[\\/]multi-assert[\\/](?:src|dist)[\\/]/;
const FRAME_LOCATION = /\(?((?:file:\/\/)?[^\s()]+?:\d+:\d+)\)?\s*$/;

export function userFrames(stack: string | undefined): string[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .filter((line) => /^\s*at /.test(line))
    .filter(
      (line) => !line.includes("node_modules") && !line.includes("node:") && !OWN_FRAME.test(line),
    )
    .map((line) => FRAME_LOCATION.exec(line)?.[1])
    .filter((loc): loc is string => Boolean(loc))
    .map(relativize);
}

function relativize(location: string): string {
  // file:///C:/x -> C:/x, but file:///home/x -> /home/x
  const withoutScheme = location.replace(/^file:\/\//, "").replace(/^\/([A-Za-z]:)/, "$1");
  const cwd = typeof process !== "undefined" && process.cwd ? process.cwd() : undefined;
  if (!cwd) return withoutScheme;
  const norm = (p: string) => p.replace(/\\/g, "/");
  const base = norm(cwd).replace(/\/$/, "") + "/";
  const loc = norm(withoutScheme);
  return loc.toLowerCase().startsWith(base.toLowerCase()) ? loc.slice(base.length) : loc;
}
