import { InteractiveCommand } from "interactive-commander";

export const compareCommand = new InteractiveCommand("compare")
  .description("Compare two snapshots")
  .requiredOption("-b, --before <name>", 'Name of the "before" snapshot')
  .requiredOption("-a, --after <name>", 'Name of the "after" snapshot')
  .option("-r, --rules <path>", "Path to rules file")
  .option("-o, --output <path>", "Path to output file")
  .action(async (options) => {
    console.log("Compare command called with options:", options);
    // TODO: Implement comparison logic
  });
