#!/usr/bin/env node
import { startStdioServer } from "../server.js";

startStdioServer().catch((err) => {
  console.error("algofox-mcp failed to start:", err);
  process.exit(1);
});
