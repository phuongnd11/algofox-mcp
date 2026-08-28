import type { CodingProblem } from "../content/problemSchema.js";

/** Static Node test runner (any Node >= 18, zero deps). */
const RUNNER = `#!/usr/bin/env node
// AlgoFox test runner — generated file, do not edit. Run: node run_tests.mjs
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

function buildList(values) {
  let head = null;
  for (let i = values.length - 1; i >= 0; i--) head = { val: values[i], next: head };
  return head;
}
function listToJson(head) {
  const out = [];
  while (head) { out.push(head.val); head = head.next; }
  return out;
}
function buildTree(values) {
  if (!values.length || values[0] === null) return null;
  const nodes = values.map((v) => (v === null ? null : { val: v, left: null, right: null }));
  const kids = [...nodes].reverse();
  const root = kids.pop();
  for (const node of nodes) {
    if (node) {
      if (kids.length) node.left = kids.pop();
      if (kids.length) node.right = kids.pop();
    }
  }
  return root;
}
function treeToJson(root) {
  const out = [], queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) { out.push(null); continue; }
    out.push(node.val);
    queue.push(node.left, node.right);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
const decode = (v, t) => (t === "ListNode" ? buildList(v) : t === "TreeNode" ? buildTree(v) : v);
const encode = (v, t) => (t === "ListNode" ? listToJson(v) : t === "TreeNode" ? treeToJson(v) : v);

const sortKey = (v) => JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort()) : val));
function equals(got, expected, comparison) {
  const mode = comparison.mode ?? "exact";
  if (mode === "unordered" && Array.isArray(got) && Array.isArray(expected)) {
    const norm = (arr) => arr.map(sortKey).sort();
    return JSON.stringify(norm(got)) === JSON.stringify(norm(expected));
  }
  if (mode === "float-tolerance" && typeof got === "number" && typeof expected === "number") {
    return Math.abs(got - expected) <= (comparison.floatTolerance ?? 1e-6);
  }
  return JSON.stringify(got) === JSON.stringify(expected);
}

const spec = JSON.parse(readFileSync("tests.json", "utf8"));
const meta = JSON.parse(readFileSync(".algofox-meta.json", "utf8"));
const mod = await import("./solution.js");
const fn = mod[spec.jsFunctionName] ?? mod.default;
if (typeof fn !== "function") {
  console.log(\`solution.js must export function \${spec.jsFunctionName}\`);
  process.exit(1);
}

const results = [], failures = [];
for (const testCase of spec.cases) {
  const args = testCase.args.map((a, i) => decode(a, spec.params[i].type));
  let got, errored = false;
  try {
    got = encode(fn(...args), spec.returns);
  } catch (err) {
    got = \`<error: \${err}>\`;
    errored = true;
  }
  const ok = !errored && equals(got, testCase.expected, spec.comparison);
  results.push([testCase.id, ok ? "pass" : "fail"]);
  if (ok) {
    console.log(\`PASS  \${testCase.id}\`);
  } else {
    console.log(\`FAIL  \${testCase.id}\${testCase.note ? \` (\${testCase.note})\` : ""}\`);
    console.log(\`      expected: \${JSON.stringify(testCase.expected)}\`);
    console.log(\`      got:      \${errored ? got : JSON.stringify(got)}\`);
    failures.push(testCase.id);
  }
}
const passed = results.length - failures.length;
console.log(\`\\n\${passed}/\${results.length} tests passed\`);
const token = createHash("sha256")
  .update(\`\${meta.problemId}|\${JSON.stringify(results)}|\${meta.salt}\`)
  .digest("hex");
console.log("ALGOFOX_RESULT " + JSON.stringify({ problemId: meta.problemId, passed, failed: failures.length, failures, results, token }));
`;

export function javascriptRunner(_problem: CodingProblem): string {
  return RUNNER;
}

export function javascriptStarter(problem: CodingProblem): string {
  return problem.starters.javascript ?? "";
}

/** snake_case → camelCase for the JS export name. */
export function jsFunctionName(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export const javascriptRunCommand = "node run_tests.mjs";
export const javascriptSolutionFile = "solution.js";
