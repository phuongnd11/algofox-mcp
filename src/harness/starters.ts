import type { CodingProblem, TypeSpec } from "../content/problemSchema.js";
import { jsFunctionName } from "./javascript.js";

/**
 * LeetCode-style boilerplate generated from the problem signature.
 * Adding a language = one entry here + a runner generator.
 */

const PY_TYPES: Record<TypeSpec, string> = {
  int: "int", float: "float", bool: "bool", string: "str",
  "int[]": "list[int]", "int[][]": "list[list[int]]", "float[]": "list[float]",
  "bool[]": "list[bool]", "string[]": "list[str]",
  ListNode: "Optional[ListNode]", TreeNode: "Optional[TreeNode]",
};
const TS_TYPES: Record<TypeSpec, string> = {
  int: "number", float: "number", bool: "boolean", string: "string",
  "int[]": "number[]", "int[][]": "number[][]", "float[]": "number[]",
  "bool[]": "boolean[]", "string[]": "string[]",
  ListNode: "ListNode | null", TreeNode: "TreeNode | null",
};
const JAVA_TYPES: Record<TypeSpec, string> = {
  int: "int", float: "double", bool: "boolean", string: "String",
  "int[]": "int[]", "int[][]": "int[][]", "float[]": "double[]",
  "bool[]": "boolean[]", "string[]": "String[]",
  ListNode: "ListNode", TreeNode: "TreeNode",
};
const JAVA_DEFAULTS: Record<TypeSpec, string> = {
  int: "0", float: "0.0", bool: "false", string: '""',
  "int[]": "new int[]{}", "int[][]": "new int[][]{}", "float[]": "new double[]{}",
  "bool[]": "new boolean[]{}", "string[]": "new String[]{}",
  ListNode: "null", TreeNode: "null",
};
const GO_TYPES: Record<TypeSpec, string> = {
  int: "int", float: "float64", bool: "bool", string: "string",
  "int[]": "[]int", "int[][]": "[][]int", "float[]": "[]float64",
  "bool[]": "[]bool", "string[]": "[]string",
  ListNode: "*ListNode", TreeNode: "*TreeNode",
};
const GO_DEFAULTS: Record<TypeSpec, string> = {
  int: "0", float: "0", bool: "false", string: '""',
  "int[]": "nil", "int[][]": "nil", "float[]": "nil", "bool[]": "nil",
  "string[]": "nil", ListNode: "nil", TreeNode: "nil",
};

export function generateStarter(problem: CodingProblem, language: string): string {
  const { functionName, params, returns } = problem.signature;
  const camel = jsFunctionName(functionName);
  switch (language) {
    case "python": {
      const needsOptional = [...params.map((p) => p.type), returns].some((t) => t === "ListNode" || t === "TreeNode");
      const args = params.map((p) => `${p.name}: ${PY_TYPES[p.type]}`).join(", ");
      return `${needsOptional ? "from typing import Optional\n\n\n" : ""}class Solution:\n    def ${functionName}(self, ${args}) -> ${PY_TYPES[returns]}:\n        # TODO: implement\n        pass\n`;
    }
    case "javascript": {
      const doc = params.map((p) => ` * @param {${TS_TYPES[p.type]}} ${p.name}`).join("\n");
      return `/**\n${doc}\n * @return {${TS_TYPES[returns]}}\n */\nexport function ${camel}(${params.map((p) => p.name).join(", ")}) {\n  // TODO: implement\n}\n`;
    }
    case "typescript": {
      const args = params.map((p) => `${p.name}: ${TS_TYPES[p.type]}`).join(", ");
      return `export function ${camel}(${args}): ${TS_TYPES[returns]} {\n  // TODO: implement\n  return undefined as unknown as ${TS_TYPES[returns]};\n}\n`;
    }
    case "java": {
      const args = params.map((p) => `${JAVA_TYPES[p.type]} ${p.name}`).join(", ");
      return `import java.util.*;\n\nclass Solution {\n    public ${JAVA_TYPES[returns]} ${camel}(${args}) {\n        // TODO: implement\n        return ${JAVA_DEFAULTS[returns]};\n    }\n}\n`;
    }
    case "go": {
      const args = params.map((p) => `${p.name} ${GO_TYPES[p.type]}`).join(", ");
      return `package main\n\nfunc ${camel}(${args}) ${GO_TYPES[returns]} {\n\t// TODO: implement\n\treturn ${GO_DEFAULTS[returns]}\n}\n`;
    }
    default:
      throw new Error(`no starter generator for language: ${language}`);
  }
}

export { JAVA_TYPES, GO_TYPES, TS_TYPES };
