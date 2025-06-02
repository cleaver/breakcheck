import express from "express";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import { promisify } from "util";
import pino from "pino";

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

interface IndexFile {
  pages: {
    url: string;
    diffFile: string;
    hasDifferences: boolean;
  }[];
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
  app.get("/", async (req, res) => {
    try {
      const indexPath = path.join(comparisonDir, "index.json");
      const indexData: IndexFile = JSON.parse(
        fs.readFileSync(indexPath, "utf-8")
      );

      const pagesWithDifferences = indexData.pages.filter(
        (page) => page.hasDifferences
      );
      const unchangedPages = indexData.pages.filter(
        (page) => !page.hasDifferences
      );

      res.render("index", {
        comparisonName,
        pagesWithDifferences,
        unchangedPages,
      });
    } catch (error) {
      logger.error("Error reading index file:", error);
      res.status(500).send("Error reading comparison data");
    }
  });

  // Diff view route
  app.get("/diff", async (req, res) => {
    try {
      const pageUrl = req.query.page as string;
      if (!pageUrl) {
        return res.status(400).send("Page URL is required");
      }

      const indexPath = path.join(comparisonDir, "index.json");
      const indexData: IndexFile = JSON.parse(
        fs.readFileSync(indexPath, "utf-8")
      );

      const page = indexData.pages.find((p) => p.url === pageUrl);
      if (!page) {
        return res.status(404).send("Page not found");
      }

      const diffPath = path.join(comparisonDir, "diffs", page.diffFile);
      const compressedData = fs.readFileSync(diffPath);
      const decompressedData = await gunzip(compressedData);
      const diffData: DiffFile = JSON.parse(decompressedData.toString());

      res.render("diff", {
        comparisonName,
        pageUrl,
        diffData,
      });
    } catch (error) {
      logger.error("Error reading diff file:", error);
      res.status(500).send("Error reading diff data");
    }
  });

  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`🌐 View server started at http://localhost:${port}`);
      resolve();
    });
  });
}
