// Loads the built CommonJS entry points with plain Node (run on the oldest supported Node).
const assert = require("node:assert");
const { multiAssert, MultiAssertError } = require("../../dist/index.js");
require("../../dist/jest.js");

try {
  multiAssert([["a", () => assert.equal(1, 2)], ["b", () => assert.equal(3, 4)]]);
  throw new Error("multiAssert should have thrown");
} catch (error) {
  assert.ok(error instanceof MultiAssertError, "expected a MultiAssertError");
  assert.equal(error.failures.length, 2);
  assert.match(error.message, /2 of 2 assertions failed/);
}
console.log(`cjs ok on ${process.version}`);
