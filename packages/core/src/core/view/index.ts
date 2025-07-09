import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../../lib/logger";
import { findRootDir } from "../../lib/root";
import { createDiffHandler, createIndexHandler } from "./index.handlers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startViewServer(
  comparisonName: string,
  port: number = 8080
): Promise<http.Server> {
  const app = express();

  const rootDir = await findRootDir();
  const comparisonDir = path.join(rootDir, "comparisons", comparisonName);

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "..", "views"));

  app.get("/", createIndexHandler(comparisonDir));
  app.get("/diff", createDiffHandler(comparisonDir));

  app.use(express.static(path.join(__dirname, "..", "..", "public")));

  return new Promise<http.Server>((resolve, reject) => {
    const server = app.listen(port, () => {
      // Once listening, we no longer need the startup error handler
      server.removeListener('error', startupErrorHandler);
      logger.info(`🌐 View server started at http://localhost:${port}`);
      resolve(server);
    });

    // Define a specific error handler for startup
    const startupErrorHandler = (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use.`));
      } else {
        reject(err);
      }
    };

    server.on('error', startupErrorHandler);
  });
}

export async function startCliViewServer(comparisonName: string, port: number) {
  const server = await startViewServer(comparisonName, port);
  logger.info("Press Ctrl+C to stop the server");

  const shutdown = () => {
    logger.info("\nGracefully shutting down. Please wait...");
    server.close(() => {
      logger.info("✅ Server has been shut down.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
