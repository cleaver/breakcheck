#!/usr/bin/env npx tsx

import { InteractiveCommand } from "interactive-commander";
import { compareCommand } from "./cli/commands/compare.js";
import { helpCommand } from "./cli/commands/help.js";
import { listSnapshotsCommand } from "./cli/commands/list-snapshots.js";
import { snapshotCommand } from "./cli/commands/snapshot.js";
import { viewCommand } from "./cli/commands/view.js";

// Create the main program
const program = new InteractiveCommand();

// Configure the program
program
  .name("breakcheck")
  .description("A tool for comparing website states before and after changes")
  .version("0.0.1");

// Add the commands to the program
program.addCommand(snapshotCommand);
program.addCommand(compareCommand);
program.addCommand(listSnapshotsCommand);
program.addCommand(viewCommand);
program.addCommand(helpCommand);

// Parse command line arguments
await program.parseAsync();
