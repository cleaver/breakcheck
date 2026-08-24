import { chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const cliEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
await chmod(cliEntry, 0o755);
