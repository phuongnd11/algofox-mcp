import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CodingProblem, Language } from "../content/problemSchema.js";
import { newSalt } from "./token.js";
import { updateProblemProgress } from "../state/store.js";
import { pythonRunner, pythonStarter, pythonRunCommand, pythonSolutionFile } from "./python.js";
import { javascriptRunner, javascriptStarter, javascriptRunCommand, javascriptSolutionFile, jsFunctionName } from "./javascript.js";
import { renderLinkedList, renderTree } from "../render/ascii.js";

export interface Materialized {
  dir: string;
  solutionFile: string;
  runCommand: string;
  files: string[];
}

function problemMarkdown(problem: CodingProblem, solutionFile: string, runCommand: string): string {
  const lines: string[] = [];
  lines.push(`# ${problem.title}`);
  lines.push("");
  lines.push(`Topic: ${problem.topic} · Difficulty: ${"●".repeat(problem.difficulty)}${"○".repeat(5 - problem.difficulty)} · ~${problem.estimatedMinutes} min`);
  lines.push("");
  lines.push(problem.statement.markdown.trim());
  lines.push("");
  if (problem.statement.constraints.length) {
    lines.push("## Constraints");
    lines.push("");
    for (const c of problem.statement.constraints) lines.push(`- ${c}`);
    lines.push("");
  }
  if (problem.statement.examples.length) {
    lines.push("## Examples");
    lines.push("");
    problem.statement.examples.forEach((ex, i) => {
      lines.push(`### Example ${i + 1}`);
      lines.push("```");
      lines.push(`Input:  ${ex.input}`);
      lines.push(`Output: ${ex.output}`);
      lines.push("```");
      if (ex.explanation) lines.push(ex.explanation);
      lines.push("");
    });
  }
  // ASCII view of structured inputs (linked lists / trees) from example test cases
  const structured = problem.signature.params
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.type === "ListNode" || p.type === "TreeNode");
  if (structured.length) {
    const example = problem.tests.find((t) => t.kind === "example") ?? problem.tests[0];
    lines.push("## Input structure");
    lines.push("```");
    for (const { p, i } of structured) {
      const arg = example.args[i] as Array<number | null>;
      lines.push(`${p.name}:`);
      lines.push(p.type === "ListNode" ? renderLinkedList(arg as number[]) : renderTree(arg));
    }
    lines.push("```");
    lines.push("");
  }
  lines.push("## How to work");
  lines.push("");
  lines.push(`1. Write your solution in \`${solutionFile}\` — it's the only file you edit.`);
  lines.push(`2. Run the tests: \`${runCommand}\``);
  lines.push("3. Ask your agent for a hint if you're stuck; it will fetch one tier at a time.");
  lines.push("");
  return lines.join("\n");
}

/** Write ./algofox/<slug>/ into baseDir. Issues a fresh run-token salt (stored in local state too). */
export function materializeProblem(problem: CodingProblem, language: Language, baseDir: string): Materialized {
  const dir = resolve(baseDir, "algofox", problem.slug);
  mkdirSync(dir, { recursive: true });

  const [starter, runner, runCommand, solutionFile] =
    language === "python"
      ? [pythonStarter(problem), pythonRunner(problem), pythonRunCommand, pythonSolutionFile]
      : [javascriptStarter(problem), javascriptRunner(problem), javascriptRunCommand, javascriptSolutionFile];
  if (!starter) throw new Error(`problem ${problem.slug} has no ${language} starter`);

  const salt = newSalt();
  const testsSpec = {
    problemId: problem.id,
    functionName: problem.signature.functionName,
    jsFunctionName: jsFunctionName(problem.signature.functionName),
    params: problem.signature.params,
    returns: problem.signature.returns,
    comparison: problem.comparison,
    cases: problem.tests,
  };

  const runnerFile = language === "python" ? "run_tests.py" : "run_tests.mjs";
  if (language === "javascript") {
    // Node < 22 has no module detection: without this, `export` in solution.js is a syntax error
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }, null, 2) + "\n", "utf8");
  }
  writeFileSync(join(dir, "PROBLEM.md"), problemMarkdown(problem, solutionFile, runCommand), "utf8");
  writeFileSync(join(dir, solutionFile), starter.trimStart(), "utf8");
  writeFileSync(join(dir, "tests.json"), JSON.stringify(testsSpec, null, 2) + "\n", "utf8");
  writeFileSync(join(dir, runnerFile), runner, "utf8");
  writeFileSync(
    join(dir, ".algofox-meta.json"),
    JSON.stringify({ problemId: problem.id, slug: problem.slug, language, salt, materializedAt: new Date().toISOString() }, null, 2) + "\n",
    "utf8",
  );

  updateProblemProgress(problem.slug, { salt, language, materializedDir: dir });
  return { dir, solutionFile: join(dir, solutionFile), runCommand, files: ["PROBLEM.md", solutionFile, "tests.json", runnerFile, ".algofox-meta.json", ...(language === "javascript" ? ["package.json"] : [])] };
}
