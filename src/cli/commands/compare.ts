import { InteractiveCommand } from "interactive-commander";
import pino from "pino";
const logger = pino({ transport: { target: "pino-pretty" } });

export const compareCommand = new InteractiveCommand("compare")
  .description("Compare two snapshots")
  .requiredOption("-b, --before <name>", 'Name of the "before" snapshot')
  .requiredOption("-a, --after <name>", 'Name of the "after" snapshot')
  .option("-r, --rules <path>", "Path to rules file")
  .option("-o, --output <path>", "Path to output file")
  .action(async (options) => {
    logger.info("Compare command called with options:", options);
    // TODO: Implement comparison logic
  });
