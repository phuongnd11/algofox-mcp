import type { CodingProblem } from "../content/problemSchema.js";
import { javascriptRunner } from "./javascript.js";

/**
 * TypeScript runner: identical logic to the JS runner (the runner itself is
 * plain JS, valid TS), but imports ./solution.ts and runs under Node's native
 * type stripping. Requires Node >= 22.6.
 */
export function typescriptRunner(problem: CodingProblem): string {
  const base = javascriptRunner(problem)
    .replace('await import("./solution.js")', 'await import("./solution.ts")')
    .replace("// AlgoFox test runner — generated file, do not edit. Run: node run_tests.mjs",
             "// AlgoFox test runner — generated file, do not edit. Run: node --experimental-strip-types run_tests.ts");
  const guard = `const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  console.log(\`TypeScript problems need Node >= 22.6 (you have \${process.versions.node}). Use JavaScript, or upgrade Node.\`);
  process.exit(1);
}
`;
  // insert the version guard after the imports
  return base.replace('import { createHash } from "node:crypto";\n', 'import { createHash } from "node:crypto";\n\n' + guard);
}

export const typescriptRunCommand = "node --experimental-strip-types run_tests.ts";
export const typescriptSolutionFile = "solution.ts";
