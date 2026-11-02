import type { Failure } from "./types";

/** Thrown when two or more checks in a group fail (or one fails and can't be rethrown as is). */
export class MultiAssertError extends AggregateError {
  readonly failures: Failure[];
  readonly passed: number;
  readonly total: number;

  constructor(errors: unknown[], message: string, failures: Failure[], total: number) {
    super(errors, message);
    this.name = "MultiAssertError";
    this.failures = failures;
    this.total = total;
    this.passed = total - failures.length;
  }

  toJSON(): Failure[] {
    return this.failures;
  }
}
