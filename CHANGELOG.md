# Changelog

## 1.0.0 (2026-11-03)

First stable release, published to npm with trusted publishing and provenance. It carries
everything from the 0.1.x development versions, which are no longer on npm:

- `multiAssert` / `multiAssertAsync` run every check and throw one `MultiAssertError`
  (an `AggregateError`) listing all failures, with labels (tuples or object), a short summary
  line, per-failure locations and the call site as the stack.
- A single unlabelled failure is rethrown as is, so the framework keeps its native diff.
- Error adapters for `expect` matcher results (Jest, Vitest, Playwright), `node:assert`, chai,
  plain errors and non-Error throws; custom adapters through the `adapters` option.
- `configure()` for defaults, `color`, `stackFrames`, `message` and `rethrowSingle` options.
- `@funktechno/multi-assert/jest`: `expect(value).toPassAll([...])` matcher.
- Dual ESM + CJS build with types; zero runtime dependencies; Node >= 18.
- Versions come from git: `scripts/version/*` (GitVersion plus doi's merged-PR rule) stamp
  `package.json` at release time; the release tag is the published version.
- Publish workflow: runs from a release or by manual dispatch with an opt-in `dry_run`, only on
  `main`, `dev` or `master`.
- Repository moved to https://github.com/funktechno/multi-assert.
