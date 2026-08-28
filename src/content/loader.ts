import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { codingProblem, type CodingProblem } from "./problemSchema.js";

const CONTENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content");

let cache: Map<string, CodingProblem> | null = null;

/** Load + validate every bundled coding problem, indexed by slug. Lazy, cached. */
export function loadProblems(): Map<string, CodingProblem> {
  if (cache) return cache;
  const problems = new Map<string, CodingProblem>();
  const problemsDir = join(CONTENT_ROOT, "problems");
  for (const topic of readdirSync(problemsDir)) {
    const topicDir = join(problemsDir, topic);
    for (const file of readdirSync(topicDir)) {
      if (!file.endsWith(".json")) continue;
      const raw = JSON.parse(readFileSync(join(topicDir, file), "utf8"));
      const parsed = codingProblem.parse(raw);
      if (problems.has(parsed.slug)) throw new Error(`duplicate problem slug: ${parsed.slug}`);
      problems.set(parsed.slug, parsed);
    }
  }
  cache = problems;
  return problems;
}

export function getProblem(slug: string): CodingProblem | undefined {
  return loadProblems().get(slug);
}

export function listTopics(): string[] {
  return [...new Set([...loadProblems().values()].map((p) => p.topic))].sort();
}
