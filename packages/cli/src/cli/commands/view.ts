import { logger, startCliViewServer } from "breakcheck-core";
import { InteractiveCommand } from "interactive-commander";

export const viewCommand = new InteractiveCommand("view")
  .description("View the results of a comparison")
  .argument(
    "[comparison-name]",
    "Name of the comparison to view",
    "compare_default"
  )
  .option("-p, --port <number>", "Port to run the view server on", "8080")
  .action(async (comparisonName, options) => {
    try {
      logger.info(`🔍 Viewing comparison: ${comparisonName}`);
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        logger.error("Port must be a number between 1 and 65535");
        process.exit(1);
      }
      await startCliViewServer(comparisonName, port);
    } catch (error) {
      logger.error({ err: error }, "❌ Error starting view server");
      process.exit(1);
    }
  });
