import { InteractiveCommand } from "interactive-commander";
import pino from "pino";
import { startViewServer } from "../../core/view";

const logger = pino({ transport: { target: "pino-pretty" } });

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
        throw new Error("Port must be a number between 1 and 65535");
      }

      await startViewServer(comparisonName, port);
    } catch (error) {
      logger.error(
        "❌ Error:",
        error instanceof Error ? error.message : "Unknown error occurred"
      );
      process.exit(1);
    }
  });
