import type { CodingProblem, Json, TypeSpec } from "../content/problemSchema.js";
import { jsFunctionName } from "./javascript.js";
import { JAVA_TYPES } from "./starters.js";

/**
 * Java harness: tests are embedded as native literals in the generated
 * RunTests.java (no JSON parsing in Java), token via MessageDigest sha256.
 */

function javaLiteral(value: Json, type: TypeSpec): string {
  switch (type) {
    case "int": return String(value);
    case "float": return `${value}`.includes(".") ? String(value) : `${value}.0`;
    case "bool": return String(value);
    case "string": return JSON.stringify(value);
    case "int[]": return `new int[]{${(value as number[]).join(", ")}}`;
    case "float[]": return `new double[]{${(value as number[]).map((v) => (`${v}`.includes(".") ? v : `${v}.0`)).join(", ")}}`;
    case "bool[]": return `new boolean[]{${(value as boolean[]).join(", ")}}`;
    case "string[]": return `new String[]{${(value as string[]).map((s) => JSON.stringify(s)).join(", ")}}`;
    case "int[][]": return `new int[][]{${(value as number[][]).map((row) => `{${row.join(", ")}}`).join(", ")}}`;
    default: throw new Error(`Java harness does not support type ${type} yet`);
  }
}

function javaDisplay(type: TypeSpec, expr: string): string {
  if (type === "int[][]") return `Arrays.deepToString(${expr})`;
  if (type.endsWith("[]")) return `Arrays.toString(${expr})`;
  if (type === "string") return expr;
  return `String.valueOf(${expr})`;
}

function javaEquals(type: TypeSpec, mode: string): string {
  if (mode === "unordered") {
    if (type === "int[]") return "unorderedEquals(got, expected)";
    if (type === "string[]") return "unorderedEqualsStr(got, expected)";
    throw new Error(`Java harness: unordered comparison unsupported for ${type}`);
  }
  if (type === "int[][]") return "Arrays.deepEquals(got, expected)";
  if (type.endsWith("[]")) return "Arrays.equals(got, expected)";
  if (type === "string") return "got.equals(expected)";
  if (type === "float") return "Math.abs(got - expected) < 1e-9";
  return "got == expected";
}

export function javaRunner(problem: CodingProblem): string {
  const { functionName, params, returns } = problem.signature;
  const camel = jsFunctionName(functionName);
  const mode = problem.comparison.mode;
  if (mode === "float-tolerance") throw new Error("Java harness: float-tolerance not supported yet");

  const cases = problem.tests.map((t) => {
    const args = t.args.map((a, i) => javaLiteral(a, params[i].type)).join(", ");
    const expected = javaLiteral(t.expected, returns);
    const note = t.note ? JSON.stringify(` (${t.note})`) : '""';
    return `        runCase("${t.id}", ${note}, () -> sol.${camel}(${args}), ${expected});`;
  }).join("\n");

  return `// AlgoFox test runner — generated file, do not edit. Run: javac Solution.java RunTests.java && java RunTests
import java.util.*;
import java.security.MessageDigest;

public class RunTests {
    static final String PROBLEM_ID = ${JSON.stringify(problem.id)};
    static final String SALT = "__ALGOFOX_SALT__";
    static StringBuilder results = new StringBuilder();
    static List<String> failures = new ArrayList<>();
    static int passed = 0, total = 0;

    interface Call { ${JAVA_TYPES[returns]} run(); }

    static boolean unorderedEquals(int[] a, int[] b) {
        int[] x = a.clone(), y = b.clone();
        Arrays.sort(x); Arrays.sort(y);
        return Arrays.equals(x, y);
    }
    static boolean unorderedEqualsStr(String[] a, String[] b) {
        String[] x = a.clone(), y = b.clone();
        Arrays.sort(x); Arrays.sort(y);
        return Arrays.equals(x, y);
    }

    static void runCase(String id, String note, Call call, ${JAVA_TYPES[returns]} expected) {
        total++;
        ${JAVA_TYPES[returns]} got;
        boolean ok;
        String gotDisplay;
        try {
            got = call.run();
            ok = ${javaEquals(returns, mode)};
            gotDisplay = ${javaDisplay(returns, "got")};
        } catch (Exception e) {
            ok = false;
            gotDisplay = "<error: " + e + ">";
        }
        if (results.length() > 0) results.append(",");
        results.append("[\\"").append(id).append("\\",\\"").append(ok ? "pass" : "fail").append("\\"]");
        if (ok) {
            passed++;
            System.out.println("PASS  " + id);
        } else {
            failures.add(id);
            System.out.println("FAIL  " + id + note);
            System.out.println("      expected: " + ${javaDisplay(returns, "expected")});
            System.out.println("      got:      " + gotDisplay);
        }
    }

    public static void main(String[] args) throws Exception {
        Solution sol = new Solution();
${cases}
        System.out.println("\\n" + passed + "/" + total + " tests passed");
        String resultsJson = "[" + results + "]";
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest((PROBLEM_ID + "|" + resultsJson + "|" + SALT).getBytes("UTF-8"));
        StringBuilder token = new StringBuilder();
        for (byte b : hash) token.append(String.format("%02x", b));
        StringBuilder failJson = new StringBuilder();
        for (String f : failures) {
            if (failJson.length() > 0) failJson.append(",");
            failJson.append("\\"").append(f).append("\\"");
        }
        System.out.println("ALGOFOX_RESULT {\\"problemId\\":\\"" + PROBLEM_ID + "\\",\\"passed\\":" + passed
            + ",\\"failed\\":" + failures.size() + ",\\"failures\\":[" + failJson + "],\\"results\\":" + resultsJson
            + ",\\"token\\":\\"" + token + "\\"}");
    }
}
`;
}

export const javaRunCommand = "javac Solution.java RunTests.java && java RunTests";
export const javaSolutionFile = "Solution.java";
