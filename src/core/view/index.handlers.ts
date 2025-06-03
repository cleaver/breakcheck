import { ComparisonIndex, PageDiff } from "@/types/compare";
import { Request, RequestHandler, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { logger } from "@lib/logger";
import { gunzip } from "zlib";

export const createIndexHandler = (comparisonDir: string): RequestHandler => {
  return async (req: Request, res: Response) => {
    try {
      const indexPath = path.join(comparisonDir, "index.json");
      const fileData = await fs.readFile(indexPath, "utf-8");
      const indexData: ComparisonIndex = JSON.parse(fileData);
      const comparisonName = path.basename(comparisonDir);

      const pages = Object.entries(indexData.urls).map(([url, page]) => ({
        url,
        ...page,
      }));
      const pagesWithDifferences = pages.filter((p) => p.hasDifferences);
      const unchangedPages = pages.filter((p) => !p.hasDifferences);

      res.render("index", {
        comparisonName,
        pagesWithDifferences,
        unchangedPages,
      });
    } catch (error) {
      logger.error({ err: error }, "Error reading index file");
      res.status(500).send("Error reading comparison data");
    }
  };
};

export const createDiffHandler = (comparisonDir: string): RequestHandler => {
  return async (req: Request, res: Response) => {
    try {
      const pageUrl = req.query.page as string;
      if (!pageUrl) {
        res.status(400).send("Page URL is required");
        return;
      }

      const indexPath = path.join(comparisonDir, "index.json");
      const fileData = await fs.readFile(indexPath, "utf-8");
      const indexData: ComparisonIndex = JSON.parse(fileData);
      const comparisonName = path.basename(comparisonDir);

      const page = indexData.urls[pageUrl];
      if (!page) {
        res.status(404).send("Page not found");
        return;
      }

      const diffPath = path.join(comparisonDir, "diffs", page.filename);
      const compressedData = await fs.readFile(diffPath);
      const decompressedData = await new Promise<Buffer>((resolve, reject) => {
        gunzip(compressedData, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      const diffData: PageDiff = JSON.parse(decompressedData.toString());

      res.render("diff", {
        comparisonName,
        pageUrl,
        diffData,
      });
    } catch (error) {
      logger.error({ err: error }, "Error reading diff file");
      res.status(500).send("Error reading diff data");
    }
  };
};
