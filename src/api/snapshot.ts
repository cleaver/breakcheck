import { BreakcheckCrawler } from "@core/crawler";
import { SnapshotManager } from "@core/snapshot";
import { SnapshotConfig, SnapshotResult } from "@project-types/api";
import type { CrawlError } from "@project-types/crawler";

/**
 * Creates a snapshot of a website based on the provided configuration.
 * Orchestrates calls to Crawler and Snapshot Manager.
 */
export async function createSnapshot(
  config: SnapshotConfig
): Promise<SnapshotResult> {
  const startTime = Date.now();
  const errors: SnapshotResult["errors"] = [];

  try {
    // Validate input config
    if (!config.baseUrl) {
      throw new Error("baseUrl is required");
    }
    if (!config.name) {
      throw new Error("name is required");
    }

    // Initialize crawler with config
    const crawler = new BreakcheckCrawler(config.crawlSettings);

    // Execute crawl
    const { datasetName, errors: crawlErrors } = await crawler.crawl();

    // Convert crawl errors to result format
    errors.push(
      ...crawlErrors.map((err: CrawlError) => ({
        url: err.url,
        message: err.error,
        code: err.statusCode?.toString(),
      }))
    );

    // Open the dataset
    const dataset = await (await import("crawlee")).Dataset.open(datasetName);

    // Save snapshot (streaming/iterative)
    const snapshotManager = new SnapshotManager();
    const pageCount = await snapshotManager.saveSnapshot(config.name, {
      dataset,
      metadata: {
        baseUrl: config.baseUrl,
        timestamp: new Date().toISOString(),
        crawlSettings: config.crawlSettings,
      },
    });

    // Generate URL list if requested
    let urlListPath: string | undefined;
    if (config.urlListPath) {
      urlListPath = await snapshotManager.generateUrlList(
        config.name,
        config.urlListPath
      );
    }

    // Calculate duration
    const duration = Date.now() - startTime;

    // Return result
    return {
      success: true,
      snapshotId: config.name,
      timestamp: new Date().toISOString(),
      baseUrl: config.baseUrl,
      pageCount,
      errors,
      metadata: {
        crawlSettings: config.crawlSettings,
        duration,
      },
      urlListPath,
    };
  } catch (error) {
    // Handle any unexpected errors
    errors.push({
      url: config.baseUrl,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });

    return {
      success: false,
      snapshotId: config.name,
      timestamp: new Date().toISOString(),
      baseUrl: config.baseUrl,
      pageCount: 0,
      errors,
      metadata: {
        crawlSettings: config.crawlSettings,
        duration: Date.now() - startTime,
      },
    };
  }
}
