// Packs the library, installs the tarball into each framework example (so the `exports` map is
// what gets tested), runs the deliberately failing specs and checks how the failures are reported
// in the terminal output and in the JUnit XML.
//
//   node scripts/run-examples.mjs [example ...]      (default: every folder under examples/)
//
// Normalized copies of what each framework printed are written to examples/_reports/ so the
// output can be looked at by eye.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplesDir = join(root, "examples");
const reportsDir = join(examplesDir, "_reports");
const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, "g");

const run = (command, args, cwd, env = {}) =>
  spawnSync(command, args, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", CI: "true", ...env },
    maxBuffer: 64 * 1024 * 1024,
  });

const must = (result, what) => {
  if (result.status !== 0) {
    throw new Error(`${what} failed (exit ${result.status})\n${result.stdout}\n${result.stderr}`);
  }
  return result;
};

const normalize = (text) =>
  text
    .replaceAll(root, "<root>")
    .replaceAll(root.replaceAll("\\", "/"), "<root>")
    .replace(ANSI, "")
    .replace(/\d+(\.\d+)?\s?ms/g, "<n>ms")
    .replace(/\b(time|timestamp)="[^"]*"/g, '$1="<t>"')
    .replace(/\r\n/g, "\n");

/** What every example must show, however its framework prints failures. */
const everyone = {
  output: [
    "2 of 3 assertions failed (user API response)",
    "✕ 1) status is 200",
    "✕ 3) content type",
    "2 of 2 assertions failed",
    "✕ 1) async status",
    "✕ 2) async id",
  ],
  // The failing location must be the spec file, not this package.
  outputPatterns: [/→ tests[\\/]example\.spec\.js:\d+:\d+/],
  // A single unlabelled failure is rethrown as is, so the framework's own diff survives.
  outputAbsent: ["1 of 1 assertion failed"],
  junit: ["2 of 3 assertions failed (user API response)"],
};
const expectations = {
  jest: { output: ["✕ 1) matcher status", "✕ 2) matcher id"] },
  vitest: { output: ["✕ 1) matcher status", "✕ 2) matcher id"] },
};

const problems = [];
const check = (name, ok, detail) => {
  if (!ok) problems.push(`${name}: ${detail}`);
};

const wanted = process.argv.slice(2);
const names = readdirSync(examplesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "node_modules")
  .map((d) => d.name)
  .filter((n) => wanted.length === 0 || wanted.includes(n));

if (!process.env.SKIP_BUILD) must(run("npm", ["run", "build"], root), "npm run build");
const packDir = mkdtempSync(join(tmpdir(), "multi-assert-pack-"));
const pack = must(run("npm", ["pack", "--pack-destination", `"${packDir}"`, "--json"], root), "npm pack");
const tarball = join(packDir, JSON.parse(pack.stdout)[0].filename);
console.log(`packed ${tarball}`);

mkdirSync(reportsDir, { recursive: true });
for (const name of names) {
  const dir = join(examplesDir, name);
  console.log(`\n== ${name}`);
  const flags = ["--no-audit", "--no-fund", "--no-package-lock"];
  mkdirSync(join(dir, "report"), { recursive: true });
  must(run("npm", ["install", ...flags], dir), `${name}: npm install`);
  must(run("npm", ["install", "--no-save", ...flags, `"${tarball}"`], dir), `${name}: install tarball`);

  const result = run("npm", ["test", "--silent"], dir);
  const output = normalize(`${result.stdout}\n${result.stderr}`);
  const junitPath = join(dir, "report", "junit.xml");
  const junitRaw = existsSync(junitPath) ? readFileSync(junitPath, "utf8") : "";
  const junit = normalize(junitRaw);
  writeFileSync(join(reportsDir, `${name}.txt`), output);
  writeFileSync(join(reportsDir, `${name}.junit.xml`), junit);

  check(name, result.status !== 0, "the failing specs should make the run exit non-zero");
  check(name, junitRaw.length > 0, "no report/junit.xml was written");
  const want = expectations[name] ?? {};
  for (const text of [...everyone.output, ...(want.output ?? [])]) {
    check(name, output.includes(text), `output is missing "${text}"`);
  }
  for (const pattern of everyone.outputPatterns) {
    check(name, pattern.test(output), `output does not match ${pattern}`);
  }
  for (const text of everyone.outputAbsent) {
    check(name, !output.includes(text), `output should not contain "${text}"`);
  }
  for (const text of everyone.junit) {
    check(name, junit.includes(text), `junit.xml is missing "${text}"`);
  }
  check(name, !junitRaw.includes(ESC) && !/&#(27|x1b);/i.test(junitRaw), "junit.xml contains ANSI codes");
  console.log(problems.some((p) => p.startsWith(`${name}:`)) ? "   FAIL" : "   ok");
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  console.error(`\nReports for inspection: ${reportsDir}`);
  process.exit(1);
}
console.log(`\nAll ${names.length} examples report failures as expected. Reports: ${reportsDir}`);
