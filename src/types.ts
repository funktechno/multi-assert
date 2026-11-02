export type CheckFn = () => unknown;
export type AsyncCheckFn = () => unknown | Promise<unknown>;

/** A check is a bare function, or a `[label, fn]` tuple. */
export type Check = CheckFn | [label: string, fn: CheckFn];
export type AsyncCheck = AsyncCheckFn | [label: string, fn: AsyncCheckFn];

/** What an adapter extracts from a thrown value. */
export interface NormalizedError {
  message: string;
  actual?: unknown;
  expected?: unknown;
  operator?: string;
}

/** Teaches multi-assert how to read errors from an assertion library it doesn't know. */
export interface ErrorAdapter {
  name?: string;
  matches(error: unknown): boolean;
  normalize(error: unknown): NormalizedError;
}

export interface MultiAssertOptions {
  /** Heading for the group, shown after the summary line. */
  message?: string;
  /**
   * When exactly one check fails, and it has no label and the group has no `message`, rethrow
   * the original error so the framework shows its native diff. Default `true`.
   */
  rethrowSingle?: boolean;
  /**
   * Keep terminal colors. `"auto"` keeps them only on a color TTY when `NO_COLOR` and `CI` are
   * unset, so JUnit XML stays clean. Default `"auto"`.
   */
  color?: boolean | "auto";
  /** How many stack frames to show under each failure; `0` hides them. Default `1`. */
  stackFrames?: number;
  /** Custom adapters, tried before the built-in ones. */
  adapters?: ErrorAdapter[];
}

export interface Failure {
  /** 1-based position of the check in the group. */
  index: number;
  label?: string;
  message: string;
  actual?: unknown;
  expected?: unknown;
  operator?: string;
  /** First stack frame outside node_modules, relative to the cwd when possible. */
  location?: string;
}
