#!/usr/bin/env node
// Standalone CLI: inspect progress without opening an agent. Read-mostly; fully offline.
import { getStatus, listProblems, suggestNextProblem } from "../tools/problems.js";
import { readActivity, stateRoot } from "../state/store.js";

const command = process.argv[2] ?? "status";

function out(text: string): void {
  process.stdout.write(text + "\n");
}

switch (command) {
  case "status":
    out(getStatus().text);
    break;
  case "progress":
    out(listProblems({}).text);
    break;
  case "history": {
    const events = readActivity().slice(-20);
    if (!events.length) { out("No activity yet. Say \"Continue AlgoFox\" in your coding agent to start."); break; }
    for (const e of events) out(`${e.ts.slice(0, 16).replace("T", " ")}  ${e.type.padEnd(15)} ${e.slug}${e.xp ? `  +${e.xp} XP` : ""}`);
    break;
  }
  case "resume": {
    const next = suggestNextProblem();
    out(getStatus().text);
    out("");
    out("Open your coding agent and say:");
    out(next ? `  "Continue AlgoFox — problem ${next.slug}."` : '  "Continue AlgoFox."');
    break;
  }
  case "export":
    out(JSON.stringify({ stateRoot: stateRoot(), activity: readActivity() }, null, 2));
    break;
  default:
    out(`algofox — AlgoFox terminal companion (fully offline)

Usage: algofox <command>

Commands:
  status     Resume card: solved count, streak, XP, next problem
  progress   Full problem list with solved marks
  history    Recent activity
  resume     Ready-to-paste prompt for your coding agent
  export     Dump activity as JSON`);
}
