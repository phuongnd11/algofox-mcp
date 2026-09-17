import { z } from "zod";
import { getProblem, loadProblems, listTopics } from "../content/loader.js";
import { LANGUAGES, languageSchema, type CodingProblem, type Language } from "../content/problemSchema.js";
import { materializeProblem, renderStatement } from "../harness/materialize.js";
import { computeToken, type RunResults } from "../harness/token.js";
import {
  appendActivity, currentStreak, getConfig, getProblemProgress, getProgressFile,
  saveConfig, totalXp, updateProblemProgress,
} from "../state/store.js";

export interface ToolReply {
  text: string;
  data: Record<string, unknown>;
}

const DIFFICULTY_LABELS = ["", "Intro", "Easy", "Medium", "Hard", "Expert"];

function coach(text: string, data: Record<string, unknown>, coachNote: string, nextAction: string): ToolReply {
  return { text, data: { ...data, coachNote, nextAction } };
}

function problemLine(p: CodingProblem): string {
  const prog = getProblemProgress(p.slug);
  const mark = prog.solved ? "✓" : prog.attempts > 0 ? "▶" : "○";
  return `${mark} ${p.slug.padEnd(28)} ${DIFFICULTY_LABELS[p.difficulty].padEnd(7)} ~${p.estimatedMinutes} min`;
}

/** Pick the natural next problem: in-progress first, then easiest unsolved. */
export function suggestNextProblem(): CodingProblem | undefined {
  const all = [...loadProblems().values()].sort((a, b) => a.difficulty - b.difficulty || a.slug.localeCompare(b.slug));
  return (
    all.find((p) => { const s = getProblemProgress(p.slug); return s.attempts > 0 && !s.solved; }) ??
    all.find((p) => !getProblemProgress(p.slug).solved)
  );
}

// ---------- get_status ----------

export function getStatus(): ToolReply {
  const config = getConfig();
  if (!config.language) {
    return coach(
      [
        "Welcome to AlgoFox — coding interview practice, fully offline.",
        "",
        `First, pick your language: ${LANGUAGES.join(" · ")}`,
        "",
        "You can switch any time by asking.",
      ].join("\n"),
      { needsSetup: true, languages: [...LANGUAGES] },
      "First run: ask the user which language they want, then call set_preferences with it. Do not start a problem before that.",
      "Call set_preferences with the chosen language, then get_status again.",
    );
  }
  const progress = getProgressFile();
  const solved = Object.values(progress.problems).filter((p) => p.solved).length;
  const total = loadProblems().size;
  const streak = currentStreak();
  const next = suggestNextProblem();
  const inProgress = next && getProblemProgress(next.slug).attempts > 0;

  const lines = [
    "AlgoFox — Coding Problems",
    "",
    `Language: ${config.language}`,
    `Solved: ${solved}/${total} problems`,
    `Streak: ${streak} day${streak === 1 ? "" : "s"} · XP: ${totalXp()}`,
    "",
  ];
  if (next) {
    lines.push(inProgress ? `Continue: ${next.title} (${next.slug}) — in progress` : `Next up: ${next.title} (${next.slug}) — ${DIFFICULTY_LABELS[next.difficulty]}, ~${next.estimatedMinutes} min`);
  } else {
    lines.push("All problems solved. More topics are coming — the full course lives in the AlgoFox app.");
  }
  return coach(
    lines.join("\n"),
    { language: config.language, solved, total, streak, xp: totalXp(), next: next ? { slug: next.slug, title: next.title, inProgress } : null },
    "Show this card, then offer exactly one next action.",
    next ? `Call start_problem with slug "${next.slug}" when the user is ready.` : "Suggest list_problems to review solved work.",
  );
}

// ---------- set_preferences ----------

export const setPreferencesInput = z.object({
  language: languageSchema.optional(),
  displayName: z.string().max(60).optional(),
});

export function setPreferences(input: z.infer<typeof setPreferencesInput>): ToolReply {
  const config = saveConfig(input);
  return coach(`Preferences saved. Language: ${config.language}.`, { config }, "Confirm briefly and continue what the user was doing.", "Return to the previous activity.");
}

// ---------- list_problems ----------

export const listProblemsInput = z.object({
  topic: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
});

export function listProblems(input: z.infer<typeof listProblemsInput>): ToolReply {
  const all = [...loadProblems().values()]
    .filter((p) => (input.topic ? p.topic === input.topic : true))
    .filter((p) => (input.difficulty ? p.difficulty === input.difficulty : true))
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.difficulty - b.difficulty || a.slug.localeCompare(b.slug));
  const byTopic = new Map<string, CodingProblem[]>();
  for (const p of all) byTopic.set(p.topic, [...(byTopic.get(p.topic) ?? []), p]);

  const lines: string[] = ["AlgoFox Problems", ""];
  for (const [topic, problems] of byTopic) {
    const solved = problems.filter((p) => getProblemProgress(p.slug).solved).length;
    lines.push(`${topic} (${solved}/${problems.length} solved)`);
    for (const p of problems) lines.push(`  ${problemLine(p)}`);
    lines.push("");
  }
  if (!all.length) lines.push(`No problems match. Topics: ${listTopics().join(", ")}`);
  return coach(
    lines.join("\n"),
    { problems: all.map((p) => ({ slug: p.slug, title: p.title, topic: p.topic, difficulty: p.difficulty, estimatedMinutes: p.estimatedMinutes, ...getProblemProgress(p.slug) })) },
    "Show the list; let the user pick. Do not describe solutions.",
    "Call start_problem with the chosen slug.",
  );
}

// ---------- start_problem ----------

export const startProblemInput = z.object({
  slug: z.string(),
  language: languageSchema.optional(),
  dir: z.string().optional().describe("Base directory to materialize into (default: current directory)"),
});

export function startProblem(input: z.infer<typeof startProblemInput>): ToolReply {
  const problem = getProblem(input.slug);
  if (!problem) return coach(`Unknown problem: ${input.slug}`, { error: "not_found" }, "Tell the user and show the list.", "Call list_problems.");
  const configured = getConfig().language;
  if (!input.language && !configured) {
    return coach(
      `Pick a language first: ${LANGUAGES.join(" · ")}`,
      { needsSetup: true, languages: [...LANGUAGES] },
      "Ask the user which language they want, call set_preferences, then retry start_problem.",
      "Call set_preferences with the chosen language.",
    );
  }
  const language: Language = input.language ?? configured!;
  const result = materializeProblem(problem, language, input.dir ?? process.cwd());
  const text = [
    `Materialized ${problem.title} → ${result.dir}`,
    "",
    `Edit:      ${result.solutionFile}`,
    `Run tests: cd ${result.dir} && ${result.runCommand}`,
    "",
    "--- PROBLEM.md ---",
    "",
    // statement + examples are delivered; hints and solution are NOT — they stay behind get_hint / reveal_solution
    renderStatement(problem).trim(),
  ].join("\n");
  return coach(
    text,
    { slug: problem.slug, dir: result.dir, solutionFile: result.solutionFile, runCommand: result.runCommand, files: result.files },
    "Show the problem, then STOP. The user writes the code — do not edit the solution file, dictate the algorithm, or fix logic bugs. Run tests when the user asks, then call submit_problem_result with the ALGOFOX_RESULT line.",
    `User solves it in ${result.solutionFile}; run tests on request.`,
  );
}

// ---------- submit_problem_result ----------

export const submitResultInput = z.object({
  slug: z.string(),
  resultLine: z.string().describe("The ALGOFOX_RESULT {...} JSON line printed by the test runner (with or without the ALGOFOX_RESULT prefix)"),
});

const runnerOutput = z.object({
  problemId: z.string(),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  failures: z.array(z.string()),
  results: z.array(z.tuple([z.string(), z.enum(["pass", "fail"])])),
  token: z.string(),
});

export function submitProblemResult(input: z.infer<typeof submitResultInput>): ToolReply {
  const problem = getProblem(input.slug);
  if (!problem) return coach(`Unknown problem: ${input.slug}`, { error: "not_found" }, "Tell the user.", "Call list_problems.");

  let parsed: z.infer<typeof runnerOutput>;
  try {
    parsed = runnerOutput.parse(JSON.parse(input.resultLine.replace(/^\s*ALGOFOX_RESULT\s*/, "")));
  } catch {
    return coach("Could not parse the result line. Run the tests and paste the full ALGOFOX_RESULT line.", { error: "bad_result_line" }, "Re-run the tests and submit the printed line verbatim.", "Run the test command again.");
  }

  const prior = getProblemProgress(input.slug);
  if (!prior.salt) {
    return coach("This problem hasn't been materialized yet — start it first.", { error: "not_started" }, "Call start_problem first.", `Call start_problem with slug "${input.slug}".`);
  }
  if (parsed.problemId !== problem.id || parsed.token !== computeToken(problem.id, parsed.results as RunResults, prior.salt)) {
    return coach(
      "Run token didn't verify. Submit the exact ALGOFOX_RESULT line from an actual test run (re-materializing rotates the token).",
      { error: "bad_token" },
      "Actually run the tests; never fabricate results.",
      "Run the test command, then submit the printed line.",
    );
  }

  const solvedNow = parsed.failed === 0;
  const firstSolve = solvedNow && !prior.solved;
  const xp = firstSolve ? Math.max(10, 30 - 5 * prior.hintsUsed - (prior.revealed ? 20 : 0)) : 0;
  const next = updateProblemProgress(input.slug, {
    attempts: prior.attempts + 1,
    failedRuns: prior.failedRuns + (solvedNow ? 0 : 1),
    solved: prior.solved || solvedNow,
    ...(firstSolve ? { solvedAt: new Date().toISOString() } : {}),
  });
  appendActivity({ type: solvedNow ? "problem_solved" : "problem_run", slug: input.slug, passed: parsed.passed, failed: parsed.failed, xp });

  const streak = currentStreak();
  const lines = solvedNow
    ? [
        `Solved — all ${parsed.passed} tests passed.`,
        firstSolve ? `XP earned: +${xp}` : "(already solved before — no new XP)",
        `Streak: ${streak} day${streak === 1 ? "" : "s"}`,
      ]
    : [
        `${parsed.passed}/${parsed.passed + parsed.failed} tests passed.`,
        `Failing: ${parsed.failures.join(", ")}`,
        next.failedRuns >= 2 ? "Stuck? A hint is available (get_hint), or reveal_solution is now unlocked." : "Keep going — a hint is available if you want one.",
      ];
  const nextProblem = solvedNow ? suggestNextProblem() : undefined;
  if (solvedNow) lines.push("", nextProblem ? `Next recommended: ${nextProblem.title} (${nextProblem.slug})` : "That was the last one — more coming. The full course lives in the AlgoFox app.");

  return coach(
    lines.join("\n"),
    { solved: solvedNow, firstSolve, xp, passed: parsed.passed, failed: parsed.failed, failures: parsed.failures, streak, nextProblem: nextProblem?.slug ?? null },
    solvedNow ? "Celebrate briefly using these fields; offer exactly one next action." : "Name the failing test cases only — do not explain why they fail or how to fix the code.",
    solvedNow ? (nextProblem ? `Offer start_problem "${nextProblem.slug}".` : "Offer list_problems.") : "User keeps working; offer get_hint.",
  );
}

// ---------- get_hint ----------

export const getHintInput = z.object({ slug: z.string() });

export function getHint(input: z.infer<typeof getHintInput>): ToolReply {
  const problem = getProblem(input.slug);
  if (!problem) return coach(`Unknown problem: ${input.slug}`, { error: "not_found" }, "Tell the user.", "Call list_problems.");
  const prior = getProblemProgress(input.slug);
  const tier = Math.min(prior.hintsUsed, problem.hints.length - 1);
  const exhausted = prior.hintsUsed >= problem.hints.length;
  if (!exhausted) {
    updateProblemProgress(input.slug, { hintsUsed: prior.hintsUsed + 1 });
    appendActivity({ type: "hint", slug: input.slug });
  }
  const hint = problem.hints[tier];
  return coach(
    exhausted ? `No more hints (${problem.hints.length} used). reveal_solution is available.\nLast hint: ${hint}` : `Hint ${tier + 1}/${problem.hints.length}: ${hint}`,
    { hint, tier: tier + 1, total: problem.hints.length, exhausted },
    "Relay the hint verbatim. Do not extend it into a fuller explanation.",
    "User keeps working.",
  );
}

// ---------- reveal_solution ----------

export const revealSolutionInput = z.object({ slug: z.string() });

export function revealSolution(input: z.infer<typeof revealSolutionInput>): ToolReply {
  const problem = getProblem(input.slug);
  if (!problem) return coach(`Unknown problem: ${input.slug}`, { error: "not_found" }, "Tell the user.", "Call list_problems.");
  const prior = getProblemProgress(input.slug);
  const unlocked = prior.solved || prior.failedRuns >= 2 || prior.hintsUsed >= 2;
  if (!unlocked) {
    return coach(
      "The solution unlocks after 2 recorded failed test runs or 2 hints — attempting first is the point.",
      { locked: true, failedRuns: prior.failedRuns, hintsUsed: prior.hintsUsed },
      "Encourage one real attempt or a hint instead. Do not generate the solution yourself — that defeats the user's own goal.",
      "Offer get_hint.",
    );
  }
  const preferred = (prior.language as Language | undefined) ?? getConfig().language ?? "python";
  const available = Object.keys(problem.solution) as Language[];
  const language = problem.solution[preferred] ? preferred : available[0];
  const code = problem.solution[language] ?? "";
  const langNote = language === preferred ? "" : `\n\n(Reference solution is in ${language}; ${preferred} version coming.)`;
  updateProblemProgress(input.slug, { revealed: true });
  appendActivity({ type: "reveal", slug: input.slug });
  return coach(
    [`Solution — ${problem.title}`, "", "```" + language, code.trim(), "```", "", problem.solutionExplanation.trim() + langNote].join("\n"),
    { solution: code, explanation: problem.solutionExplanation, language },
    "Walk through the solution as a teacher; connect it to the user's own attempt.",
    "Suggest re-implementing it from memory, or the next problem.",
  );
}
