#!/usr/bin/env npx tsx

import { compareCommand } from "@cli/commands/compare.js";
import { snapshotCommand } from "@cli/commands/snapshot.js";
import { listSnapshotsCommand } from "@cli/commands/list-snapshots.js";
import { viewCommand } from "@cli/commands/view.js";
import { Command } from "commander";

// Create the main program
const program = new Command();

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

// Parse command line arguments
program.parse();
