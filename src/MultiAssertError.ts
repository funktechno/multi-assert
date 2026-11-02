import type { Failure } from "./types";

/** Thrown when two or more checks in a group fail (or one fails and can't be rethrown as is). */
export class MultiAssertError extends AggregateError {
  declare readonly failures: Failure[];
  declare readonly passed: number;
  declare readonly total: number;

  constructor(errors: unknown[], message: string, failures: Failure[], total: number) {
    super(errors, message);
    this.name = "MultiAssertError";
    // Non-enumerable so reporters that dump an error's own properties (Vitest does) don't print
    // the same failures twice.
    const hidden = { enumerable: false, writable: false, configurable: true };
    Object.defineProperties(this, {
      failures: { value: failures, ...hidden },
      total: { value: total, ...hidden },
      passed: { value: total - failures.length, ...hidden },
    });
  }

  /**
   * Keeps `name` and `message` so reporters that serialise errors with `toJSON` (Vitest) still
   * show the summary, and adds the structured failures.
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      passed: this.passed,
      total: this.total,
      failures: this.failures,
    };
  }
}
