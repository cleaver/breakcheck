import express from "express";
import path from "path";
import pino from "pino";
import { promisify } from "util";
import { createIndexHandler, createDiffHandler } from "./index.handlers";
import zlib from "zlib";

const logger = pino({ transport: { target: "pino-pretty" } });
const gunzip = promisify(zlib.gunzip);

interface DiffEntry {
  count: number;
  added: boolean;
  removed: boolean;
  value: string;
}

interface DiffFile {
  url: string;
  differences: DiffEntry[];
  hasDifferences: boolean;
}

export async function startViewServer(
  comparisonName: string,
  port: number = 8080
): Promise<void> {
  const app = express();
  const comparisonDir = path.join(process.cwd(), "comparisons", comparisonName);

  // Set up EJS as the view engine
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "..", "views"));

  // Serve static files
  app.use(express.static(path.join(__dirname, "..", "..", "public")));

  // Index route
  app.get("/", createIndexHandler(comparisonDir));

  app.get("/diff", createDiffHandler(comparisonDir));

  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`🌐 View server started at http://localhost:${port}`);
      resolve();
    });
  });
}
