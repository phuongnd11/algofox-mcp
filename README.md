# AlgoFox MCP — coding interview practice in your terminal

Practice coding interviews with the coding agent you already use — Claude Code, Cursor, Codex, or any MCP client.

**Works fully offline. Nothing ever leaves your machine.** No account, no telemetry, no network calls — problems ship in the package and your progress lives in `~/.algofox/`.

## How it works

1. Say **"Continue AlgoFox"** (or pick a problem). The agent materializes it into `./algofox/<slug>/`: the problem statement, a starter file, and a test runner.
2. **You** write the solution — the agent is your interviewer/coach, not your ghostwriter. It clarifies, runs the tests when you ask, and fetches tiered hints.
3. Tests run locally (`python3 run_tests.py` or `node run_tests.mjs`). Results are recorded; solving earns XP and keeps your streak alive.

Close your terminal any time. Come back in any supported agent, say "Continue AlgoFox", and you resume where you left off.

## Install

### Claude Code (recommended: the plugin)

The [algofox-skill](https://github.com/phuongnd11/algofox-skill) plugin bundles this server plus an interview-coach skill and `/algofox` commands:

```
/plugin marketplace add phuongnd11/algofox-skill
```

Or add just the server:

```bash
claude mcp add algofox -- npx -y -p @algofoxdotapp/mcp algofox-mcp
```

### Cursor

`.cursor/mcp.json`:

```json
{ "mcpServers": { "algofox": { "command": "npx", "args": ["-y", "-p", "@algofoxdotapp/mcp", "algofox-mcp"] } } }
```

### Codex

`~/.codex/config.toml`:

```toml
[mcp_servers.algofox]
command = "npx"
args = ["-y", "-p", "@algofoxdotapp/mcp", "algofox-mcp"]
```

For clients without skills, copy the coach block from [AGENTS.md](AGENTS.md) into your project's `AGENTS.md` / rules file so the agent behaves like an interviewer instead of solving problems for you.

## Standalone CLI

Progress without opening an agent:

```bash
npx -p @algofoxdotapp/mcp algofox status     # resume card
npx -p @algofoxdotapp/mcp algofox progress   # full problem list
npx -p @algofoxdotapp/mcp algofox history    # recent activity
npx -p @algofoxdotapp/mcp algofox resume     # ready-to-paste agent prompt
```

## What's inside

- **10 original coding problems** (arrays & hashing to start — more topics coming) with typed test cases, tiered hints, and reference solutions.
- **5 languages: Python, JavaScript, TypeScript, Java, Go.** You pick on first run; switch any time by telling your agent. LeetCode-style `Solution` boilerplate, sample input/output, and a test harness are generated from each problem's typed signature.
- Solutions are **earned**: `reveal_solution` unlocks after 2 failed runs or 2 hints. All content is local, so you *can* peek at the answer keys — but you'd only be cheating yourself.
- A run token ties submitted results to an actual test run, so your agent can't hand-wave a pass.

Want a full curriculum — guided lessons, spaced review, quick-play drills, company tracks? That's the [AlgoFox app](https://algofox.app).

## Requirements

Node ≥ 18. Per language: Python needs `python3`; TypeScript needs Node ≥ 22.6; Java needs a JDK (`javac`); Go needs the Go toolchain. JavaScript needs nothing extra.

## License

Code: MIT. Problem content (`content/`): CC BY-NC-ND 4.0 — see [content/LICENSE](content/LICENSE).
