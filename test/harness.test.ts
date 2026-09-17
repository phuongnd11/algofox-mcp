import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Isolate all state before importing modules that touch it.
process.env.ALGOFOX_HOME = mkdtempSync(join(tmpdir(), "algofox-state-"));

const { loadProblems } = await import("../src/content/loader.js");
const { materializeProblem } = await import("../src/harness/materialize.js");
const { submitProblemResult, startProblem, getHint, revealSolution, getStatus, setPreferences } = await import("../src/tools/problems.js");
const { getProblemProgress } = await import("../src/state/store.js");

// typescript reuses the javascript reference solutions (valid TS) under Node type stripping
const LANGS = [
  { language: "python" as const, solutionLang: "python" as const, cmd: ["python3", "run_tests.py"], solutionFile: "solution.py" },
  { language: "javascript" as const, solutionLang: "javascript" as const, cmd: ["node", "run_tests.mjs"], solutionFile: "solution.js" },
  { language: "typescript" as const, solutionLang: "javascript" as const, cmd: ["node", "--experimental-strip-types", "run_tests.ts"], solutionFile: "solution.ts" },
];

function runInDir(dir: string, cmd: string[]): string {
  return execFileSync(cmd[0], cmd.slice(1), { cwd: dir, encoding: "utf8" });
}

function resultLine(output: string): string {
  const line = output.split("\n").find((l) => l.startsWith("ALGOFOX_RESULT "));
  assert.ok(line, `no ALGOFOX_RESULT line in output:\n${output}`);
  return line!;
}

before(() => {
  assert.ok(loadProblems().size >= 10, "expected at least 10 bundled problems");
});

for (const problem of loadProblems().values()) {
  for (const { language, solutionLang, cmd, solutionFile } of LANGS) {
    test(`golden: ${problem.slug} reference solution passes (${language})`, () => {
      const base = mkdtempSync(join(tmpdir(), "algofox-golden-"));
      const mat = materializeProblem(problem, language, base);
      writeFileSync(join(mat.dir, solutionFile), problem.solution[solutionLang]!, "utf8");
      const parsed = JSON.parse(resultLine(runInDir(mat.dir, cmd)).replace("ALGOFOX_RESULT ", ""));
      assert.equal(parsed.failed, 0, `${problem.slug}/${language} failures: ${JSON.stringify(parsed.failures)}`);
      const reply = submitProblemResult({ slug: problem.slug, resultLine: resultLine(runInDir(mat.dir, cmd)) });
      assert.equal(reply.data.solved, true, `submit rejected: ${reply.text}`);
    });
  }
}

test("wrong solution fails and is recorded", () => {
  const problem = loadProblems().get("pair-with-target")!;
  const base = mkdtempSync(join(tmpdir(), "algofox-wrong-"));
  const mat = materializeProblem(problem, "python", base);
  // starter returns None → every case fails
  const parsed = JSON.parse(resultLine(runInDir(mat.dir, ["python3", "run_tests.py"])).replace("ALGOFOX_RESULT ", ""));
  assert.equal(parsed.passed, 0);
  const reply = submitProblemResult({ slug: problem.slug, resultLine: JSON.stringify(parsed) });
  assert.equal(reply.data.solved, false);
});

test("forged results are rejected by the run token", () => {
  const problem = loadProblems().get("missing-number")!;
  const base = mkdtempSync(join(tmpdir(), "algofox-forge-"));
  const mat = materializeProblem(problem, "python", base);
  const line = resultLine(runInDir(mat.dir, ["python3", "run_tests.py"]));
  const forged = JSON.parse(line.replace("ALGOFOX_RESULT ", ""));
  forged.failed = 0;
  forged.failures = [];
  forged.passed = forged.results.length;
  forged.results = forged.results.map(([id]: [string, string]) => [id, "pass"]);
  const reply = submitProblemResult({ slug: problem.slug, resultLine: JSON.stringify(forged) });
  assert.equal(reply.data.error, "bad_token");
});

test("reveal_solution is gated until 2 hints", () => {
  // fresh state dir: the golden loop above already solved every problem
  process.env.ALGOFOX_HOME = mkdtempSync(join(tmpdir(), "algofox-state2-"));
  const problem = loadProblems().get("balance-point")!;
  const base = mkdtempSync(join(tmpdir(), "algofox-gate-"));
  startProblem({ slug: problem.slug, language: "python", dir: base });
  assert.equal(revealSolution({ slug: problem.slug }).data.locked, true);
  getHint({ slug: problem.slug });
  getHint({ slug: problem.slug });
  const revealed = revealSolution({ slug: problem.slug });
  assert.ok(!revealed.data.locked);
  assert.ok(String(revealed.data.solution).includes("def balance_point"));
  assert.equal(getProblemProgress(problem.slug).hintsUsed, 2);
});

test("first run asks for a language, then status card renders", () => {
  process.env.ALGOFOX_HOME = mkdtempSync(join(tmpdir(), "algofox-state3-"));
  const setup = getStatus();
  assert.equal(setup.data.needsSetup, true);
  assert.match(setup.text, /pick your language/i);
  setPreferences({ language: "python" });
  const status = getStatus();
  assert.match(status.text, /AlgoFox/);
  assert.ok(typeof status.data.solved === "number");
});
