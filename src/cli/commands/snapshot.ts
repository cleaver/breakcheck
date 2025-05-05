import { InteractiveCommand } from "interactive-commander";
import { BreakcheckApi } from "../../api";
import type { SnapshotConfig } from "../../api/types";

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
  .option("--url-list <path>", "Generate a URL list file at the specified path")
  .action(async (options) => {
    try {
      // Create API instance
      const api = new BreakcheckApi();

      // Map CLI options to SnapshotConfig
      const config: SnapshotConfig = {
        baseUrl: options.url,
        name: options.name || `snapshot_${Date.now()}`,
        crawlSettings: {
          baseUrl: options.url,
          crawlerType: options.type,
          maxDepth: parseInt(options.depth, 10),
          maxConcurrency: parseInt(options.concurrency, 10),
          includePatterns: options.include,
          excludePatterns: options.exclude,
        },
        urlListPath: options.urlList,
      };

      // Call API to create snapshot
      const result = await api.createSnapshot(config);

      // Display results
      if (result.success) {
        console.log(`✅ Snapshot created successfully: ${result.snapshotId}`);
        console.log(`📊 Pages crawled: ${result.pageCount}`);
        console.log(`⏱️ Duration: ${result.metadata.duration}ms`);

        if (result.errors.length > 0) {
          console.log("\n⚠️ Some pages had errors:");
          result.errors.forEach((error) => {
            console.log(`  - ${error.url}: ${error.message}`);
          });
        }

        if (result.urlListPath) {
          console.log(`\n📝 URL list generated: ${result.urlListPath}`);
        }
      } else {
        console.error("❌ Failed to create snapshot");
        result.errors.forEach((error) => {
          console.error(`  - ${error.url}: ${error.message}`);
        });
      }
    } catch (error) {
      console.error(
        "❌ Error:",
        error instanceof Error ? error.message : "Unknown error occurred"
      );
      process.exit(1);
    }
  });
