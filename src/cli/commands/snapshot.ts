import { createSnapshotFromConfig } from "@api/index";
import type { SnapshotConfig } from "@project-types/api";
import { InteractiveCommand } from "interactive-commander";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

export const snapshotCommand = new InteractiveCommand("snapshot")
  .description("Create a snapshot of a website")
  .requiredOption("-u, --url <url>", "Base URL to crawl")
  .option("-n, --name <name>", "Name for the snapshot")
  .option("-d, --depth <number>", "Maximum crawl depth", "3")
  .option("-c, --concurrency <number>", "Number of concurrent requests", "5")
  .option("-i, --include <patterns...>", "URL patterns to include")
  .option("-e, --exclude <patterns...>", "URL patterns to exclude")
  .option(
    "-t, --type <type>",
    "Crawler type (cheerio or playwright)",
    "cheerio"
  )
  .option(
    "-w, --write-urls <path>",
    "Generate a URL list file at the specified path"
  )
  .action(async (options) => {
    try {
      // Map CLI options to SnapshotConfig
      const config: SnapshotConfig = {
        baseUrl: options.url,
        name:
          options.name ||
          `snapshot_${new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .replace(/T/, "_")
            .replace(/Z$/, "Z")}`,
        crawlSettings: {
          baseUrl: options.url,
          crawlerType: options.type,
          maxDepth: parseInt(options.depth, 10),
          maxConcurrency: parseInt(options.concurrency, 10),
          includePatterns: options.include,
          excludePatterns: options.exclude,
        },
        urlListPath: options.writeUrls,
      };

      // Call API to create snapshot
      const result = await createSnapshotFromConfig(config);

      // Display results
      if (result.status === "success") {
        logger.info(`✅ Snapshot created successfully: ${result.snapshotId}`);
        logger.info(`📊 Pages crawled: ${result.pageCount}`);
        logger.info(`⏱️ Duration: ${result.metadata.durationMs}ms`);

        if (result.errors.length > 0) {
          logger.warn("\n⚠️ Some pages had errors:");
          result.errors.forEach((error) => {
            logger.warn(`  - ${error.url}: ${error.message}`);
          });
        }

        if (result.urlListPath) {
          logger.info(`\n📝 URL list generated: ${result.urlListPath}`);
        }
      } else {
        logger.error("❌ Failed to create snapshot");
        result.errors.forEach((error) => {
          logger.error(`  - ${error.message}`);
        });
      }
    } catch (error) {
      logger.error(
        "❌ Error:",
        error instanceof Error ? error.message : "Unknown error occurred"
      );
      process.exit(1);
    }
  });
