# Changelog

## 0.1.0 (2026-11-02)

- `multiAssert` / `multiAssertAsync` run every check and throw one `MultiAssertError`
  (an `AggregateError`) listing all failures, with labels (tuples or object), a short summary
  line, per-failure locations and the call site as the stack.
- A single unlabelled failure is rethrown as is, so the framework keeps its native diff.
- Error adapters for `expect` matcher results (Jest, Vitest, Playwright), `node:assert`, chai,
  plain errors and non-Error throws; custom adapters through the `adapters` option.
- `configure()` for defaults, `color`, `stackFrames`, `message` and `rethrowSingle` options.
- `@funktechno/multi-assert/jest`: `expect(value).toPassAll([...])` matcher.
- Dual ESM + CJS build with types; zero runtime dependencies; Node >= 18.

## Unreleased

- Versions come from git: GitVersion (`GitVersion.yml`) plus `scripts/version/*` stamp
  `package.json` at release time. Patch bumps on merge to `main`; minor/major with
  `+semver: minor|major` in a commit message or a tag.
- Publish workflow: runs from a release or by manual dispatch, with an opt-in `dry_run`.
