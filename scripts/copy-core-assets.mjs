import { cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreSource = resolve(repositoryRoot, "packages/core/src");
const coreDestination = resolve(repositoryRoot, "packages/core/dist");

await Promise.all([
  cp(resolve(coreSource, "views"), resolve(coreDestination, "views"), {
    recursive: true,
  }),
  cp(resolve(coreSource, "public"), resolve(coreDestination, "public"), {
    recursive: true,
  }),
]);
