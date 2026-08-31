import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/logger.js";
import { findRootDir } from "../../lib/root.js";
import { createDiffHandler, createIndexHandler } from "./index.handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startViewServer(
  comparisonName: string,
  port: number = 8080,
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
    const server = http.createServer(app);

    const startupErrorHandler = (error: NodeJS.ErrnoException) => {
      server.removeListener("listening", startupListeningHandler);
      server.removeListener("error", startupErrorHandler);

      if (error.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use.`));
      } else {
        reject(error);
      }
    };

    const startupListeningHandler = () => {
      server.removeListener("error", startupErrorHandler);
      logger.info(`🌐 View server started at http://localhost:${port}`);
      resolve(server);
    };

    server.once("error", startupErrorHandler);
    server.once("listening", startupListeningHandler);
    server.listen(port);
  });
}
