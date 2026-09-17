import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  getStatus, listProblems, listProblemsInput, setPreferences, setPreferencesInput,
  startProblem, startProblemInput, submitProblemResult, submitResultInput,
  getHint, getHintInput, revealSolution, revealSolutionInput, type ToolReply,
} from "./tools/problems.js";

const VERSION = "0.2.0";

function reply(r: ToolReply) {
  return { content: [{ type: "text" as const, text: `${r.text}\n\n[coach] ${r.data.coachNote}\n[next] ${r.data.nextAction}` }] };
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: "algofox", version: VERSION });

  server.registerTool(
    "get_status",
    { description: "AlgoFox resume card: language, solved count, streak, XP, and the one suggested next action. Call this first when the user mentions AlgoFox or wants to continue practicing. Fully local — nothing leaves the machine." },
    async () => reply(getStatus()),
  );
  server.registerTool(
    "set_preferences",
    { description: "Set AlgoFox preferences. language: python | javascript | typescript | java | go. Required once on first run (get_status will say so); changeable any time.", inputSchema: setPreferencesInput.shape },
    async (input) => reply(setPreferences(input)),
  );
  server.registerTool(
    "list_problems",
    { description: "List AlgoFox coding problems grouped by topic, with solved/in-progress marks. Filter by topic or difficulty (1-5).", inputSchema: listProblemsInput.shape },
    async (input) => reply(listProblems(input)),
  );
  server.registerTool(
    "start_problem",
    { description: "Materialize a coding problem into ./algofox/<slug>/ in the working directory: PROBLEM.md, a starter solution file (the only file the user edits), tests, and a test runner. Returns the statement. The USER writes the code — the agent must not.", inputSchema: startProblemInput.shape },
    async (input) => reply(startProblem(input)),
  );
  server.registerTool(
    "submit_problem_result",
    { description: "Record a test run. Paste the ALGOFOX_RESULT line printed by the test runner. Verifies the run token, updates progress/XP/streak, and returns the next action.", inputSchema: submitResultInput.shape },
    async (input) => reply(submitProblemResult(input)),
  );
  server.registerTool(
    "get_hint",
    { description: "Get the next tiered hint for a problem (nudge → approach → key insight). Tracked; affects XP. Use this instead of hinting yourself.", inputSchema: getHintInput.shape },
    async (input) => reply(getHint(input)),
  );
  server.registerTool(
    "reveal_solution",
    { description: "Reveal the official solution + explanation. Locked until the user has 2 failed test runs or has used 2 hints. Never write the solution yourself — call this instead.", inputSchema: revealSolutionInput.shape },
    async (input) => reply(revealSolution(input)),
  );

  // Prompts: the coach persona for clients without skills support (Cursor, Codex, ...)
  server.registerPrompt(
    "coach",
    { description: "AlgoFox interview-coach behavior: resume via get_status, user writes the code, hints over answers." },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "You are an AlgoFox interview coach. Rules:",
              "1. Call get_status first and show its card; offer exactly one next action.",
              "2. After start_problem, show the statement then STOP — the USER writes the code in the materialized solution file. Never edit it, dictate the algorithm, or fix logic bugs. You may name WHICH test fails, never why.",
              "3. Run the printed test command when the user asks; submit the printed ALGOFOX_RESULT line via submit_problem_result. Never fabricate it.",
              "4. Asked for the answer? Call get_hint. Asked to just solve it? Call reveal_solution instead of generating a solution.",
              "5. Progress questions → get_status; never estimate from conversation history.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`algofox-mcp ${VERSION} ready (stdio). Fully offline — no network calls, state in ~/.algofox`);
}
