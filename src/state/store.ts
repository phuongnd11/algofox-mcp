import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

/** Root of all local state. ALGOFOX_HOME overrides for tests. Nothing ever leaves this machine. */
export function stateRoot(): string {
  return process.env.ALGOFOX_HOME ?? join(homedir(), ".algofox");
}

function ensureDirs(): void {
  mkdirSync(join(stateRoot(), "sessions"), { recursive: true });
  mkdirSync(join(stateRoot(), "activity"), { recursive: true });
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Atomic write: temp file + rename, so a crash never corrupts state. */
function writeJsonAtomic(path: string, value: unknown): void {
  ensureDirs();
  const tmp = `${path}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

// ---------- config ----------

export interface Config {
  stateVersion: 1;
  /** unset until the user picks one (first-run setup) */
  language?: "python" | "javascript" | "typescript" | "java" | "go";
  displayName?: string;
}

const DEFAULT_CONFIG: Config = { stateVersion: 1 };

export function getConfig(): Config {
  return { ...DEFAULT_CONFIG, ...readJson<Partial<Config>>(join(stateRoot(), "config.json"), {}) };
}

export function saveConfig(patch: Partial<Omit<Config, "stateVersion">>): Config {
  const next = { ...getConfig(), ...patch };
  writeJsonAtomic(join(stateRoot(), "config.json"), next);
  return next;
}

// ---------- progress ----------

export interface ProblemProgress {
  attempts: number;          // recorded test runs
  failedRuns: number;
  solved: boolean;
  solvedAt?: string;
  hintsUsed: number;
  revealed: boolean;
  /** run-token salt issued at materialize time; rotates on re-materialize */
  salt?: string;
  language?: string;
  materializedDir?: string;
  lastActiveAt?: string;
}

interface ProgressFile {
  stateVersion: 1;
  problems: Record<string, ProblemProgress>;
}

const EMPTY_PROGRESS: ProgressFile = { stateVersion: 1, problems: {} };

export function getProgressFile(): ProgressFile {
  return readJson<ProgressFile>(join(stateRoot(), "progress.json"), EMPTY_PROGRESS);
}

export function getProblemProgress(slug: string): ProblemProgress {
  return (
    getProgressFile().problems[slug] ?? {
      attempts: 0,
      failedRuns: 0,
      solved: false,
      hintsUsed: 0,
      revealed: false,
    }
  );
}

export function updateProblemProgress(slug: string, patch: Partial<ProblemProgress>): ProblemProgress {
  const file = getProgressFile();
  const next = { ...getProblemProgress(slug), ...patch, lastActiveAt: new Date().toISOString() };
  file.problems[slug] = next;
  writeJsonAtomic(join(stateRoot(), "progress.json"), file);
  return next;
}

// ---------- activity log (append-only; source of truth for streak/XP/history) ----------

export interface ActivityEvent {
  ts: string;
  type: "problem_run" | "problem_solved" | "hint" | "reveal";
  slug: string;
  passed?: number;
  failed?: number;
  xp?: number;
}

export function appendActivity(event: Omit<ActivityEvent, "ts">): ActivityEvent {
  ensureDirs();
  const full: ActivityEvent = { ts: new Date().toISOString(), ...event };
  const month = full.ts.slice(0, 7); // YYYY-MM
  appendFileSync(join(stateRoot(), "activity", `${month}.jsonl`), JSON.stringify(full) + "\n", "utf8");
  return full;
}

export function readActivity(): ActivityEvent[] {
  const dir = join(stateRoot(), "activity");
  if (!existsSync(dir)) return [];
  const events: ActivityEvent[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".jsonl")) continue;
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as ActivityEvent);
      } catch {
        // skip corrupt line; append-only log must never brick the app
      }
    }
  }
  return events;
}

/** Streak = consecutive local-calendar days (ending today or yesterday) with any activity. */
export function currentStreak(now = new Date()): number {
  const days = new Set(readActivity().map((e) => new Date(e.ts).toLocaleDateString("en-CA")));
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(cursor.toLocaleDateString("en-CA"))) cursor.setDate(cursor.getDate() - 1); // today not yet active
  while (days.has(cursor.toLocaleDateString("en-CA"))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function totalXp(): number {
  return readActivity().reduce((sum, e) => sum + (e.xp ?? 0), 0);
}
