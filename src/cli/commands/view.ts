import { InteractiveCommand } from "interactive-commander";
import pino from "pino";
const logger = pino({ transport: { target: "pino-pretty" } });

export const viewCommand = new InteractiveCommand("view")
  .description("View the results of a comparison")
  .argument(
    "[comparison-name]",
    "Name of the comparison to view",
    "compare_default"
  )
  .action(async (comparisonName) => {
    try {
      logger.info(`🔍 Viewing comparison: ${comparisonName}`);
      // TODO: Implement the actual viewing functionality
      // This will be implemented in a future update
      logger.info("View functionality coming soon!");
    } catch (error) {
      logger.error(
        "❌ Error:",
        error instanceof Error ? error.message : "Unknown error occurred"
      );
      process.exit(1);
    }
  });
