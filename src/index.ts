#!/usr/bin/env npx tsx

import { Command } from "commander";
import { snapshotCommand } from "./cli/commands/snapshot.js";
import { compareCommand } from "./cli/commands/compare.js";

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

// Parse command line arguments
program.parse();
