// Start `next dev` with the settings from .env.fake (points ITDash at scripts/fake-sources.mjs).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const env = { ...process.env };
for (const line of readFileSync(new URL("../.env.fake", import.meta.url), "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
