import { createHash, randomBytes } from "node:crypto";

/** [testId, "pass" | "fail"] in test order — the canonical result encoding all runners emit. */
export type RunResults = Array<[string, "pass" | "fail"]>;

export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Run token proves the runner actually executed: sha256(problemId | canonical results | salt).
 * The salt is issued at materialize time and stored both in the materialized dir (for the
 * runner) and in local state (for verification). A norm, not security — everything is local.
 */
export function computeToken(problemId: string, results: RunResults, salt: string): string {
  const canonical = JSON.stringify(results);
  return createHash("sha256").update(`${problemId}|${canonical}|${salt}`).digest("hex");
}
