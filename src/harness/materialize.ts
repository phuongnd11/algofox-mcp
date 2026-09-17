import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CodingProblem, Language } from "../content/problemSchema.js";
import { newSalt } from "./token.js";
import { updateProblemProgress } from "../state/store.js";
import { generateStarter } from "./starters.js";
import { pythonRunner, pythonRunCommand, pythonSolutionFile } from "./python.js";
import { javascriptRunner, javascriptRunCommand, javascriptSolutionFile, jsFunctionName } from "./javascript.js";
import { typescriptRunner, typescriptRunCommand, typescriptSolutionFile } from "./typescript.js";
import { javaRunner, javaRunCommand, javaSolutionFile } from "./java.js";
import { goRunner, goRunCommand, goSolutionFile } from "./go.js";
import { renderLinkedList, renderTree } from "../render/ascii.js";

export interface Materialized {
  dir: string;
  solutionFile: string;
  runCommand: string;
  files: string[];
}

interface LangSpec {
  runner: (p: CodingProblem) => string;
  runnerFile: string;
  runCommand: string;
  solutionFile: string;
  needsTestsJson: boolean;   // py/js/ts runners read tests.json + meta; java/go embed everything
  needsModulePkg: boolean;   // js/ts need {"type":"module"} on Node < 22
}

const LANG: Record<Language, LangSpec> = {
  python: { runner: pythonRunner, runnerFile: "run_tests.py", runCommand: pythonRunCommand, solutionFile: pythonSolutionFile, needsTestsJson: true, needsModulePkg: false },
  javascript: { runner: javascriptRunner, runnerFile: "run_tests.mjs", runCommand: javascriptRunCommand, solutionFile: javascriptSolutionFile, needsTestsJson: true, needsModulePkg: true },
  typescript: { runner: typescriptRunner, runnerFile: "run_tests.ts", runCommand: typescriptRunCommand, solutionFile: typescriptSolutionFile, needsTestsJson: true, needsModulePkg: true },
  java: { runner: javaRunner, runnerFile: "RunTests.java", runCommand: javaRunCommand, solutionFile: javaSolutionFile, needsTestsJson: false, needsModulePkg: false },
  go: { runner: goRunner, runnerFile: "run_tests.go", runCommand: goRunCommand, solutionFile: goSolutionFile, needsTestsJson: false, needsModulePkg: false },
};

/** Statement + constraints + examples — shared by PROBLEM.md and the start_problem reply. */
export function renderStatement(problem: CodingProblem): string {
  const lines: string[] = [problem.statement.markdown.trim(), ""];
  if (problem.statement.constraints.length) {
    lines.push("## Constraints", "");
    for (const c of problem.statement.constraints) lines.push(`- ${c}`);
    lines.push("");
  }
  problem.statement.examples.forEach((ex, i) => {
    lines.push(`## Example ${i + 1}`, "```", `Input:  ${ex.input}`, `Output: ${ex.output}`, "```");
    if (ex.explanation) lines.push(ex.explanation);
    lines.push("");
  });
  return lines.join("\n");
}

function problemMarkdown(problem: CodingProblem, solutionFile: string, runCommand: string): string {
  const lines: string[] = [
    `# ${problem.title}`,
    "",
    `Topic: ${problem.topic} · Difficulty: ${"●".repeat(problem.difficulty)}${"○".repeat(5 - problem.difficulty)} · ~${problem.estimatedMinutes} min`,
    "",
    renderStatement(problem),
  ];
  const structured = problem.signature.params
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.type === "ListNode" || p.type === "TreeNode");
  if (structured.length) {
    const example = problem.tests.find((t) => t.kind === "example") ?? problem.tests[0];
    lines.push("## Input structure", "```");
    for (const { p, i } of structured) {
      const arg = example.args[i] as Array<number | null>;
      lines.push(`${p.name}:`);
      lines.push(p.type === "ListNode" ? renderLinkedList(arg as number[]) : renderTree(arg));
    }
    lines.push("```", "");
  }
  lines.push(
    "## How to work",
    "",
    `1. Write your solution in \`${solutionFile}\` — it's the only file you edit.`,
    `2. Run the tests: \`${runCommand}\``,
    "3. Ask your agent for a hint if you're stuck; it will fetch one tier at a time.",
    "",
  );
  return lines.join("\n");
}

/** Write ./algofox/<slug>/ into baseDir. Issues a fresh run-token salt (stored in local state too). */
export function materializeProblem(problem: CodingProblem, language: Language, baseDir: string): Materialized {
  const spec = LANG[language];
  if (!spec) throw new Error(`unsupported language: ${language}`);
  const dir = resolve(baseDir, "algofox", problem.slug);
  mkdirSync(dir, { recursive: true });

  const starter = problem.starters[language] ?? generateStarter(problem, language);
  const salt = newSalt();
  const files = ["PROBLEM.md", spec.solutionFile, spec.runnerFile, ".algofox-meta.json"];

  writeFileSync(join(dir, "PROBLEM.md"), problemMarkdown(problem, spec.solutionFile, spec.runCommand), "utf8");
  writeFileSync(join(dir, spec.solutionFile), starter.trimStart(), "utf8");
  writeFileSync(join(dir, spec.runnerFile), spec.runner(problem).replace("__ALGOFOX_SALT__", salt), "utf8");
  writeFileSync(
    join(dir, ".algofox-meta.json"),
    JSON.stringify({ problemId: problem.id, slug: problem.slug, language, salt, materializedAt: new Date().toISOString() }, null, 2) + "\n",
    "utf8",
  );
  if (spec.needsTestsJson) {
    files.push("tests.json");
    writeFileSync(join(dir, "tests.json"), JSON.stringify({
      problemId: problem.id,
      functionName: problem.signature.functionName,
      jsFunctionName: jsFunctionName(problem.signature.functionName),
      params: problem.signature.params,
      returns: problem.signature.returns,
      comparison: problem.comparison,
      cases: problem.tests,
    }, null, 2) + "\n", "utf8");
  }
  if (spec.needsModulePkg) {
    files.push("package.json");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }, null, 2) + "\n", "utf8");
  }

  updateProblemProgress(problem.slug, { salt, language, materializedDir: dir });
  return { dir, solutionFile: join(dir, spec.solutionFile), runCommand: spec.runCommand, files };
}
