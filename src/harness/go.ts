import type { CodingProblem, Json, TypeSpec } from "../content/problemSchema.js";
import { jsFunctionName } from "./javascript.js";

/**
 * Go harness: tests embedded as native literals in run_tests.go; comparison via
 * canonical compact JSON (sorted copies for unordered); crypto/sha256 token.
 * Run: go run run_tests.go solution.go (no module needed).
 */

function goLiteral(value: Json, type: TypeSpec): string {
  switch (type) {
    case "int": return String(value);
    case "float": return String(value);
    case "bool": return String(value);
    case "string": return JSON.stringify(value);
    case "int[]": return `[]int{${(value as number[]).join(", ")}}`;
    case "float[]": return `[]float64{${(value as number[]).join(", ")}}`;
    case "bool[]": return `[]bool{${(value as boolean[]).join(", ")}}`;
    case "string[]": return `[]string{${(value as string[]).map((s) => JSON.stringify(s)).join(", ")}}`;
    case "int[][]": return `[][]int{${(value as number[][]).map((row) => `{${row.join(", ")}}`).join(", ")}}`;
    default: throw new Error(`Go harness does not support type ${type} yet`);
  }
}

/** Canonical compact JSON of the expected value, pre-sorted when unordered. */
function expectedJson(value: Json, mode: string): string {
  const v = mode === "unordered" && Array.isArray(value) ? [...(value as (number | string)[])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) : value;
  return JSON.stringify(JSON.stringify(v));
}

export function goRunner(problem: CodingProblem): string {
  const { functionName, params, returns } = problem.signature;
  const camel = jsFunctionName(functionName);
  const mode = problem.comparison.mode;
  if (mode === "float-tolerance") throw new Error("Go harness: float-tolerance not supported yet");
  const sortGot = mode === "unordered"
    ? (returns === "int[]" ? "sort.Ints(got)" : returns === "string[]" ? "sort.Strings(got)" : (() => { throw new Error(`Go harness: unordered unsupported for ${returns}`); })())
    : "";

  const cases = problem.tests.map((t) => {
    const args = t.args.map((a, i) => goLiteral(a, params[i].type)).join(", ");
    const note = t.note ? JSON.stringify(` (${t.note})`) : '""';
    return `	runCase("${t.id}", ${note}, func() any { return ${camel}(${args}) }, ${expectedJson(t.expected, mode)}, ${JSON.stringify(JSON.stringify(t.expected))})`;
  }).join("\n");

  return `// AlgoFox test runner — generated file, do not edit. Run: go run run_tests.go solution.go
package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

const problemID = ${JSON.stringify(problem.id)}
const salt = "__ALGOFOX_SALT__"

var results [][2]string
var failures []string
var passed, total int

var _ = sort.Ints // keep import used even when comparison is exact

func canonical(v any) string {
${mode === "unordered" ? `	if got, ok := v.(${returns === "int[]" ? "[]int" : "[]string"}); ok {
		got = append(${returns === "int[]" ? "[]int" : "[]string"}{}, got...)
		${returns === "int[]" ? "sort.Ints(got)" : "sort.Strings(got)"}
		v = got
	}
` : ""}	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("<unmarshalable: %v>", err)
	}
	s := string(b)
	if s == "null" {
		s = "[]" // a nil slice counts as empty
	}
	return s
}

func runCase(id, note string, call func() any, expectedCanonical, expectedDisplay string) {
	total++
	var gotJSON string
	func() {
		defer func() {
			if r := recover(); r != nil {
				gotJSON = fmt.Sprintf("<panic: %v>", r)
			}
		}()
		gotJSON = canonical(call())
	}()
	ok := gotJSON == expectedCanonical
	results = append(results, [2]string{id, map[bool]string{true: "pass", false: "fail"}[ok]})
	if ok {
		passed++
		fmt.Println("PASS  " + id)
	} else {
		failures = append(failures, id)
		fmt.Println("FAIL  " + id + note)
		fmt.Println("      expected: " + expectedDisplay)
		fmt.Println("      got:      " + gotJSON)
	}
}

func main() {
${cases}
	fmt.Printf("\\n%d/%d tests passed\\n", passed, total)
	resultsJSON, _ := json.Marshal(results)
	sum := sha256.Sum256([]byte(problemID + "|" + string(resultsJSON) + "|" + salt))
	token := fmt.Sprintf("%x", sum)
	failJSON, _ := json.Marshal(failures)
	if failures == nil {
		failJSON = []byte("[]")
	}
	var out strings.Builder
	out.WriteString("ALGOFOX_RESULT ")
	out.WriteString(fmt.Sprintf("{\\"problemId\\":%q,\\"passed\\":%d,\\"failed\\":%d,\\"failures\\":%s,\\"results\\":%s,\\"token\\":%q}",
		problemID, passed, len(failures), failJSON, resultsJSON, token))
	fmt.Println(out.String())
}
`;
}

export const goRunCommand = "go run run_tests.go solution.go";
export const goSolutionFile = "solution.go";
