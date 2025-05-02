import { InteractiveCommand } from "interactive-commander";

export const snapshotCommand = new InteractiveCommand("snapshot")
  .description("Create a snapshot of a website")
  .requiredOption("-u, --url <url>", "Base URL to crawl")
  .option("-n, --name <name>", "Name for the snapshot")
  .option("-d, --depth <number>", "Maximum crawl depth", "3")
  .option("-c, --concurrency <number>", "Number of concurrent requests", "5")
  .option("-i, --include <patterns...>", "URL patterns to include")
  .option("-e, --exclude <patterns...>", "URL patterns to exclude")
  .action(async (options) => {
    console.log("Snapshot command called with options:", options);
    // TODO: Implement snapshot logic
  });
