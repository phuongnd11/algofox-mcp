// Offline guarantee gate: fail if any runtime source references a network API.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BANNED = [/\bfetch\s*\(/, /node:https?\b/, /["']https?:\/\//, /node:net\b/, /node:dns\b/, /node:tls\b/, /\bWebSocket\b/, /XMLHttpRequest/];
const failures = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|mjs|js)$/.test(entry)) {
      const src = readFileSync(path, "utf8");
      for (const pattern of BANNED) if (pattern.test(src)) failures.push(`${path}: matches ${pattern}`);
    }
  }
}
walk(new URL("../src", import.meta.url).pathname);
if (failures.length) {
  console.error("OFFLINE GUARANTEE VIOLATED:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("offline check passed — no network APIs in src/");
