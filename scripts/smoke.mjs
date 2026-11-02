// Loads the built ESM entry points with plain Node (run on the oldest supported Node).
import assert from "node:assert";
import { multiAssertAsync, MultiAssertError } from "../dist/index.mjs";
import "../dist/jest.mjs";

const error = await multiAssertAsync([
  ["a", () => assert.equal(1, 2)],
  ["b", async () => assert.equal(3, 4)],
]).catch((e) => e);
assert.ok(error instanceof MultiAssertError, "expected a MultiAssertError");
assert.equal(error.failures.length, 2);
console.log(`esm ok on ${process.version}`);
