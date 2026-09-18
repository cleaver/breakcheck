#!/usr/bin/env node

import { createRequire } from "node:module";
import { InteractiveCommand } from "interactive-commander";
import { compareCommand } from "./cli/commands/compare.js";
import { cleanCommand } from "./cli/commands/clean.js";
import { compileCommand } from "./cli/commands/compile.js";
import { helpCommand } from "./cli/commands/help.js";
import { initCommand } from "./cli/commands/init.js";
import { listSnapshotsCommand } from "./cli/commands/list-snapshots.js";
import { newCommand } from "./cli/commands/new.js";
import { snapshotCommand } from "./cli/commands/snapshot.js";
import { viewCommand } from "./cli/commands/view.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

// Create the main program
const program = new InteractiveCommand();

// Configure the program
program
  .name("breakcheck")
  .description("A tool for comparing website states before and after changes")
  .option(
    "--config <file>",
    "Use this configuration file instead of discovering one",
  )
  .option("--no-config", "Disable project configuration discovery")
  .version(packageJson.version);

// Add the commands to the program
program.addCommand(snapshotCommand);
program.addCommand(compareCommand);
program.addCommand(cleanCommand);
program.addCommand(compileCommand);
program.addCommand(initCommand);
program.addCommand(newCommand);
program.addCommand(listSnapshotsCommand);
program.addCommand(viewCommand);
program.addCommand(helpCommand);

// `interactive-commander` currently reports its built-in version action with
// a non-zero status. Handle the package version directly so the published
// executable has the standard successful `--version` behavior.
if (process.argv.includes("--version") || process.argv.includes("-V")) {
  console.log(packageJson.version);
} else {
  await program.parseAsync();
}
