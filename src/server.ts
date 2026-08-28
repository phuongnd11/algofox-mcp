import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  getStatus, listProblems, listProblemsInput, setPreferences, setPreferencesInput,
  startProblem, startProblemInput, submitProblemResult, submitResultInput,
  getHint, getHintInput, revealSolution, revealSolutionInput, type ToolReply,
} from "./tools/problems.js";

const VERSION = "0.1.0";

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
    { description: "Set AlgoFox preferences (language: python | javascript). Optional — defaults apply without it.", inputSchema: setPreferencesInput.shape },
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

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`algofox-mcp ${VERSION} ready (stdio). Fully offline — no network calls, state in ~/.algofox`);
}
