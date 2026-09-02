import { Dataset } from "crawlee";
import { logger } from "../../lib/logger.js";
import type { SnapshotConfig, SnapshotResult } from "../../types/api.js";
import type { CrawlError } from "../../types/crawler.js";
import { resolveUrlPaths, type UrlPathIssue } from "../crawler/url-paths.js";
import { BreakcheckCrawler } from "../crawler/index.js";
import { SnapshotRepository } from "./classes/SnapshotRepository.js";

export { LoadedSnapshot } from "./classes/LoadedSnapshot.js";
export { SnapshotRepository } from "./classes/SnapshotRepository.js";

/**
 * Creates a snapshot of a website based on the provided configuration.
 * Orchestrates calls to Crawler and Snapshot Manager.
 */
export async function createSnapshot(
  config: SnapshotConfig,
  snapshotRepository: SnapshotRepository,
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

    const manifest =
      config.urlPaths === undefined
        ? undefined
        : resolveUrlPaths(config.baseUrl, config.urlPaths);

    if (manifest?.issues.length) {
      throw new Error(formatUrlPathIssues(manifest.issues));
    }

    const startUrls = manifest?.paths.map(
      (urlPath) => new URL(urlPath, config.baseUrl).href,
    );

    if (
      startUrls &&
      config.crawlSettings.maxRequests !== undefined &&
      config.crawlSettings.maxRequests < startUrls.length
    ) {
      throw new Error(
        `maxRequests (${config.crawlSettings.maxRequests}) must be at least the number of unique manifest paths (${startUrls.length})`,
      );
    }

    if (
      startUrls &&
      (config.crawlSettings.includePatterns?.length ||
        config.crawlSettings.excludePatterns?.length)
    ) {
      throw new Error(
        "includePatterns and excludePatterns cannot be used with an exact URL manifest",
      );
    }

    const crawler = new BreakcheckCrawler(config.crawlSettings, {
      startUrls,
      followLinks: config.urlPaths === undefined,
    });

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
        config.urlListPath,
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

function formatUrlPathIssues(issues: UrlPathIssue[]): string {
  return issues
    .map((issue) => {
      switch (issue.type) {
        case "base":
          return `${issue.message}: ${issue.value}`;
        case "entry":
          return `Manifest path ${issue.index + 1} (${issue.value}): ${issue.message}`;
        case "manifest":
          return issue.message;
      }
    })
    .join("; ");
}
