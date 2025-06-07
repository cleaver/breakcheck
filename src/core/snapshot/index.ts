import { BreakcheckCrawler } from "@core/crawler";
import { logger } from "@lib/logger";
import { SnapshotConfig, SnapshotResult } from "@project-types/api";
import { CrawlError } from "@project-types/crawler";
import { Dataset } from "crawlee";
import { SnapshotRepository } from "./classes/SnapshotRepository";

export { LoadedSnapshot } from "./classes/LoadedSnapshot";
export { SnapshotRepository } from "./classes/SnapshotRepository";

/**
 * Creates a snapshot of a website based on the provided configuration.
 * Orchestrates calls to Crawler and Snapshot Manager.
 */
export async function createSnapshot(
  config: SnapshotConfig,
  snapshotRepository: SnapshotRepository
): Promise<SnapshotResult> {
  const startTime = Date.now();
  const errors: CrawlError[] = [];

  try {
    // Validate input config
    if (!config.baseUrl) {
      logger.error({ config }, "Snapshot creation failed: baseUrl is required");
      throw new Error("baseUrl is required");
    }
    if (!config.name) {
      logger.error({ config }, "Snapshot creation failed: name is required");
      throw new Error("name is required");
    }

    const crawler = new BreakcheckCrawler(config.crawlSettings);

    const { datasetName, errors: crawlErrors } = await crawler.crawl();

    errors.push(...crawlErrors);

    const dataset = await Dataset.open(datasetName);

    const pageCount = await snapshotRepository.saveSnapshot(config.name, {
      dataset,
      metadata: {
        baseUrl: config.baseUrl,
        timestamp: new Date().toISOString(),
        crawlSettings: config.crawlSettings,
      },
    });

    let urlListPath: string | undefined;
    if (config.urlListPath) {
      urlListPath = await snapshotRepository.generateUrlList(
        config.name,
        config.urlListPath
      );
    }

    const duration = Date.now() - startTime;

    return {
      status: "success",
      snapshotId: config.name,
      timestamp: new Date().toISOString(),
      baseUrl: config.baseUrl,
      pageCount,
      errors: errors,
      metadata: {
        crawlSettings: config.crawlSettings,
        durationMs: duration,
      },
      urlListPath,
    };
  } catch (error) {
    errors.push({
      url: config.baseUrl,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });

    return {
      status: "failed",
      snapshotId: config.name,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
      errors,
    };
  }
}
