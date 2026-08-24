import { startViewServer } from "@cleaver/breakcheck-core";
import { InteractiveCommand } from "interactive-commander";
import { configureLogger } from "../utils.js";

export const viewCommand = new InteractiveCommand("view")
  .description("View the results of a comparison")
  .argument(
    "[comparison-name]",
    "Name of the comparison to view",
    "compare_default"
  )
  .option("-p, --port <number>", "Port to run the view server on", "8080")
  .option("--json-logs", "Output logs in JSON format")
  .option("--no-json-logs", "Output logs in pretty format (default)")
  .action(async (comparisonName, options) => {
    // Configure logger based on options
    const logger = configureLogger(options);

    try {
      logger.info(`🔍 Viewing comparison: ${comparisonName}`);
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        logger.error("Port must be a number between 1 and 65535");
        process.exit(1);
      }
      const server = await startViewServer(comparisonName, port);
      logger.info("Press Ctrl+C to stop the server");

      await new Promise<void>((resolve) => {
        const shutdown = () => {
          logger.info("\nGracefully shutting down. Please wait...");
          server.close(() => {
            logger.info("✅ Server has been shut down.");
            resolve();
            process.exit(0);
          });
        };

        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
      });
    } catch (error) {
      logger.error({ err: error }, "❌ Error starting view server");
      process.exit(1);
    }
  });
