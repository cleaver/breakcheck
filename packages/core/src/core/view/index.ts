import { logger } from "@/lib/logger";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createDiffHandler, createIndexHandler } from "./index.handlers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startViewServer(
  comparisonName: string,
  port: number = 8080
): Promise<http.Server> {
  const app = express();
  const comparisonDir = path.join(process.cwd(), "comparisons", comparisonName);

  app.set("view engine", "ejs");
  app.set("views", path.join(process.cwd(), "packages", "cli", "src", "views"));
  app.use(express.static(path.join(__dirname, "..", "..", "public")));

  app.get("/", createIndexHandler(comparisonDir));
  app.get("/diff", createDiffHandler(comparisonDir));

  return new Promise<http.Server>((resolve) => {
    const server = app.listen(port, () => {
      logger.info(`🌐 View server started at http://localhost:${port}`);
      resolve(server);
    });
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
