import { startViewServer } from "@cleaver/breakcheck-core";
import { InteractiveCommand } from "interactive-commander";
import { configureLogger } from "../utils.js";

const DEFAULT_VIEW_PORT = 8080;
const MAX_VIEW_PORT = 65534;

function isPortInUseError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes("already in use")) {
    return true;
  }

  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === "EADDRINUSE";
}

export async function startViewServerWithPortSelection(
  comparisonName: string,
  requestedPort: number | undefined,
) {
  let port = requestedPort ?? DEFAULT_VIEW_PORT;

  while (port <= MAX_VIEW_PORT) {
    try {
      return await startViewServer(comparisonName, port);
    } catch (error) {
      if (requestedPort !== undefined || !isPortInUseError(error)) {
        throw error;
      }

      port += 1;
    }
  }

  throw new Error(
    `No available port found between ${DEFAULT_VIEW_PORT} and ${MAX_VIEW_PORT}.`,
  );
}

export const viewCommand = new InteractiveCommand("view")
  .description("View the results of a comparison")
  .argument(
    "[comparison-name]",
    "Name of the comparison to view",
    "compare_default",
  )
  .option(
    "-p, --port <number>",
    "Port to run the view server on (defaults to 8080 and increments when occupied)",
  )
  .option("--json-logs", "Output logs in JSON format")
  .option("--no-json-logs", "Output logs in pretty format (default)")
  .action(async (comparisonName, options) => {
    // Configure logger based on options
    const logger = configureLogger(options);

    try {
      logger.info(`🔍 Viewing comparison: ${comparisonName}`);
      const requestedPort =
        options.port === undefined ? undefined : parseInt(options.port, 10);

      if (
        requestedPort !== undefined &&
        (isNaN(requestedPort) || requestedPort < 1024 || requestedPort > 65535)
      ) {
        logger.error("Port must be a number between 1024 and 65535");
        process.exit(1);
      }
      const server = await startViewServerWithPortSelection(
        comparisonName,
        requestedPort,
      );
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
