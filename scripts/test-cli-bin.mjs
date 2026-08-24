import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(repoRoot, "packages/cli/dist/index.js");
const { NODE_OPTIONS: _nodeOptions, ...environment } = process.env;

const cliStats = await stat(cliEntry);
assert.equal(
  cliStats.mode & 0o111,
  0o111,
  `CLI entrypoint is not executable: mode ${
    (cliStats.mode & 0o777).toString(8).padStart(3, "0")
  }`,
);

await execFileAsync(cliEntry, ["--version"], {
  cwd: repoRoot,
  env: environment,
});

console.log("Native CLI bin smoke test passed");
