import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.ALGOFOX_HOME ??= mkdtempSync(join(tmpdir(), "algofox-state-lang-"));

const { loadProblems } = await import("../src/content/loader.js");
const { materializeProblem } = await import("../src/harness/materialize.js");
const { generateStarter } = await import("../src/harness/starters.js");
const { computeToken } = await import("../src/harness/token.js");

function have(cmd: string): boolean {
  try { execSync(`command -v ${cmd}`, { stdio: "ignore" }); return true; } catch { return false; }
}
const HAS_JAVA = have("javac");
const HAS_GO = have("go");

function runResult(dir: string, cmd: string): { passed: number; failed: number; results: [string, string][]; token: string; problemId: string } {
  const out = execSync(cmd, { cwd: dir, encoding: "utf8", shell: "/bin/bash" });
  const line = out.split("\n").find((l) => l.startsWith("ALGOFOX_RESULT "));
  assert.ok(line, `no result line in:\n${out}`);
  return JSON.parse(line!.replace("ALGOFOX_RESULT ", ""));
}

test("starters generate for every language and problem", () => {
  for (const problem of loadProblems().values()) {
    for (const lang of ["python", "javascript", "typescript", "java", "go"]) {
      const starter = generateStarter(problem, lang);
      assert.ok(starter.length > 20, `${problem.slug}/${lang} starter empty`);
    }
    assert.match(generateStarter(problem, "python"), /class Solution:/);
    assert.match(generateStarter(problem, "java"), /class Solution \{/);
  }
});

const JAVA_SOLUTIONS: Record<string, string> = {
  "pair-with-target": `import java.util.*;
class Solution {
    public int[] pairWithTarget(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int j = 0; j < nums.length; j++) {
            if (seen.containsKey(target - nums[j])) return new int[]{seen.get(target - nums[j]), j};
            seen.put(nums[j], j);
        }
        return new int[]{};
    }
}`,
  "anagram-pairs": `import java.util.*;
class Solution {
    public int anagramPairs(String[] words) {
        Map<String, Integer> buckets = new HashMap<>();
        for (String w : words) {
            char[] c = w.toCharArray();
            Arrays.sort(c);
            buckets.merge(new String(c), 1, Integer::sum);
        }
        int pairs = 0;
        for (int c : buckets.values()) pairs += c * (c - 1) / 2;
        return pairs;
    }
}`,
  "target-sum-slice": `import java.util.*;
class Solution {
    public boolean targetSumSlice(int[] nums, int k) {
        Set<Long> seen = new HashSet<>();
        seen.add(0L);
        long total = 0;
        for (int v : nums) {
            total += v;
            if (seen.contains(total - k)) return true;
            seen.add(total);
        }
        return false;
    }
}`,
};

const GO_SOLUTIONS: Record<string, string> = {
  "pair-with-target": `package main

func pairWithTarget(nums []int, target int) []int {
	seen := map[int]int{}
	for j, v := range nums {
		if i, ok := seen[target-v]; ok {
			return []int{i, j}
		}
		seen[v] = j
	}
	return nil
}`,
  "anagram-pairs": `package main

import "sort"

func anagramPairs(words []string) int {
	buckets := map[string]int{}
	for _, w := range words {
		b := []byte(w)
		sort.Slice(b, func(i, j int) bool { return b[i] < b[j] })
		buckets[string(b)]++
	}
	pairs := 0
	for _, c := range buckets {
		pairs += c * (c - 1) / 2
	}
	return pairs
}`,
  "target-sum-slice": `package main

func targetSumSlice(nums []int, k int) bool {
	seen := map[int]bool{0: true}
	total := 0
	for _, v := range nums {
		total += v
		if seen[total-k] {
			return true
		}
		seen[total] = true
	}
	return false
}`,
};

test("java: every generated starter compiles", { skip: !HAS_JAVA }, () => {
  for (const problem of loadProblems().values()) {
    const base = mkdtempSync(join(tmpdir(), "algofox-javac-"));
    const mat = materializeProblem(problem, "java", base);
    execSync("javac Solution.java RunTests.java", { cwd: mat.dir, stdio: "pipe" });
  }
});

for (const [slug, solution] of Object.entries(JAVA_SOLUTIONS)) {
  test(`golden: ${slug} reference solution passes (java)`, { skip: !HAS_JAVA }, () => {
    const problem = loadProblems().get(slug)!;
    const base = mkdtempSync(join(tmpdir(), "algofox-java-"));
    const mat = materializeProblem(problem, "java", base);
    writeFileSync(join(mat.dir, "Solution.java"), solution, "utf8");
    const res = runResult(mat.dir, mat.runCommand);
    assert.equal(res.failed, 0, `java/${slug} failed cases`);
    // token round-trips through the server-side verifier
    const salt = JSON.parse(execSync("cat .algofox-meta.json", { cwd: mat.dir, encoding: "utf8" })).salt;
    assert.equal(res.token, computeToken(problem.id, res.results as [string, "pass" | "fail"][], salt));
  });
}

test("go: every generated starter compiles", { skip: !HAS_GO }, () => {
  for (const problem of loadProblems().values()) {
    const base = mkdtempSync(join(tmpdir(), "algofox-govet-"));
    const mat = materializeProblem(problem, "go", base);
    execSync("go build -o /dev/null run_tests.go solution.go", { cwd: mat.dir, stdio: "pipe" });
  }
});

for (const [slug, solution] of Object.entries(GO_SOLUTIONS)) {
  test(`golden: ${slug} reference solution passes (go)`, { skip: !HAS_GO }, () => {
    const problem = loadProblems().get(slug)!;
    const base = mkdtempSync(join(tmpdir(), "algofox-go-"));
    const mat = materializeProblem(problem, "go", base);
    writeFileSync(join(mat.dir, "solution.go"), solution, "utf8");
    const res = runResult(mat.dir, mat.runCommand);
    assert.equal(res.failed, 0, `go/${slug} failed cases`);
    const salt = JSON.parse(execSync("cat .algofox-meta.json", { cwd: mat.dir, encoding: "utf8" })).salt;
    assert.equal(res.token, computeToken(problem.id, res.results as [string, "pass" | "fail"][], salt));
  });
}
