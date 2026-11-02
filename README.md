# @funktechno/multi-assert

Run a group of assertions in any Node test framework, keep going past failures, and get **one**
readable error that lists every failure. Works with Jest, Vitest, `node:test`, mocha/chai,
Playwright and anything else that throws on a failed assertion. No runtime dependencies.

```bash
npm install --save-dev @funktechno/multi-assert
```

```ts
import { multiAssert } from "@funktechno/multi-assert";

multiAssert([
  () => expect(res.status).toBe(200),
  () => expect(res.body.id).toBe(42),
  () => assert.equal(res.headers["content-type"], "application/json"),
]);
```

```
2 of 3 assertions failed

  ✕ 1) expected 404 to be 200 // Object.is equality
       → src/api/__tests__/http.spec.ts:38:24

  ✕ 3) Expected values to be strictly equal:
       + actual - expected
       + 'text/html'
       - 'application/json'
       → src/api/__tests__/http.spec.ts:40:14
```

## Call forms

```ts
// bare functions
multiAssert([() => a(), () => b()]);

// labelled, as tuples or as an object
multiAssert([["status is 200", () => a()], ["has id", () => b()]]);
multiAssert({ "status is 200": () => a(), "has id": () => b() });

// async checks run in order
await multiAssertAsync([async () => expect(await load()).toBe(1), () => b()]);
```

`multiAssert` is synchronous. A check that returns a promise is reported as a failure that tells
you to use `multiAssertAsync`, so a rejected promise is never silently dropped.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `message` | none | Heading shown after the summary line, e.g. `"user API response"`. |
| `rethrowSingle` | `true` | If exactly one check fails, and it has no label and the group has no `message`, the original error is rethrown so the framework shows its native diff. |
| `color` | `"auto"` | Keep colors only on a color TTY with `NO_COLOR` and `CI` unset, so JUnit XML stays clean. |
| `stackFrames` | `1` | Stack frames shown under each failure (`0` hides them). |
| `adapters` | `[]` | Custom [error adapters](#custom-adapters), tried before the built-in ones. |

Set defaults once, for example in a test setup file: `configure({ stackFrames: 0 })`.

## The error

Two or more failures throw a `MultiAssertError` (an `AggregateError`):

- `errors`: the original errors, untouched, so `instanceof`, `actual` and `expected` survive;
- `failures`: `{ index, label?, message, actual?, expected?, operator?, location? }[]`;
- `passed` and `total` counts;
- `toJSON()` returns `{ name, message, passed, total, failures }`. `failures`, `passed` and `total` are non-enumerable so reporters that dump an error's own properties (Vitest) do not print them twice.

The first line of the message is a short summary because JUnit `message` attributes and CI
annotation titles usually show only that. `error.stack` points at the call to `multiAssert`, so
reporter code frames land in your test.

## Custom adapters

Built in: `expect` matcher results (Jest, Vitest, Playwright), `node:assert`, chai, plain
`Error` and non-Error throws. For an in-house assertion library:

```ts
multiAssert(checks, {
  adapters: [
    {
      matches: (e) => e instanceof MyAssertError,
      normalize: (e) => ({ message: (e as MyAssertError).detail }),
    },
  ],
});
```

## Development

```bash
npm ci
npm run lint
npm test
npm run build
```

MIT
