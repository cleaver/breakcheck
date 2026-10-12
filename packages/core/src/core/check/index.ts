import { resolveUrlPaths } from "../crawler/url-paths.js";
import { validateSnapshotRoutes } from "../snapshot/route-coverage.js";
import type {
  ComparisonConfig,
  ComparisonSummary,
  SiteCheckConfig,
  SiteCheckResult,
  SnapshotConfig,
  SnapshotResult,
} from "../../types/api.js";
import type { CrawlError } from "../../types/crawler.js";
import type { SnapshotRepository } from "../snapshot/classes/SnapshotRepository.js";

export interface SiteCheckOperations {
  snapshotRepository: SnapshotRepository;
  createSnapshot: (
    config: SnapshotConfig,
    signal?: AbortSignal,
  ) => Promise<SnapshotResult>;
  runComparison: (config: ComparisonConfig) => Promise<ComparisonSummary>;
}

/** Runs an exact-route regression check using the supplied core operations. */
export async function runSiteCheck(
  config: SiteCheckConfig,
  operations: SiteCheckOperations,
  signal?: AbortSignal,
): Promise<SiteCheckResult> {
  signal?.throwIfAborted();
  if (config.name === config.baselineSnapshotId) {
    throw new Error(
      "The check snapshot name must differ from the baseline snapshot ID.",
    );
  }
  if (
    (config.crawlSettings.includePatterns?.length ?? 0) > 0 ||
    (config.crawlSettings.excludePatterns?.length ?? 0) > 0
  ) {
    throw new Error(
      "Exact-route checks cannot use crawl includePatterns or excludePatterns.",
    );
  }

  const manifest = resolveUrlPaths(config.baseUrl, config.routes);
  if (manifest.issues.length > 0) {
    throw new Error(manifest.issues.map((issue) => issue.message).join("; "));
  }

  const baseline = await operations.snapshotRepository.loadSnapshot(
    config.baselineSnapshotId,
  );
  signal?.throwIfAborted();
  const snapshotResult = await operations.createSnapshot(
    {
      baseUrl: config.baseUrl,
      name: config.name,
      urlPaths: manifest.paths,
      crawlSettings: {
        ...config.crawlSettings,
        baseUrl: config.baseUrl,
        includePatterns: [],
        excludePatterns: [],
      },
    },
    signal,
  );

  if (snapshotResult.status === "failed") {
    return {
      status: "failed",
      baseUrl: config.baseUrl,
      baselineSnapshotId: config.baselineSnapshotId,
      snapshotId: snapshotResult.snapshotId,
      routes: manifest.paths,
      crawlErrors: snapshotResult.errors.map((error): CrawlError => ({
        url: config.baseUrl,
        message: error.message,
        ...(error.statusCode === undefined
          ? {}
          : { statusCode: error.statusCode }),
      })),
      errors: [snapshotResult.message],
    };
  }

  signal?.throwIfAborted();
  const afterSnapshot = await operations.snapshotRepository.loadSnapshot(
    snapshotResult.snapshotId,
  );
  const failures = snapshotResult.errors.map(
    (error) => `${error.url}: ${error.message}`,
  );
  failures.push(
    ...(await validateSnapshotRoutes(afterSnapshot, manifest.paths)),
  );

  signal?.throwIfAborted();
  if (failures.length > 0) {
    return {
      status: "failed",
      baseUrl: config.baseUrl,
      baselineSnapshotId: config.baselineSnapshotId,
      snapshotId: snapshotResult.snapshotId,
      routes: manifest.paths,
      crawlErrors: snapshotResult.errors,
      errors: failures,
    };
  }

  const commonRoutes = manifest.paths.filter(
    (route) =>
      baseline.index.urls[route] !== undefined &&
      afterSnapshot.index.urls[route] !== undefined,
  );
  let comparison: ComparisonSummary;
  try {
    comparison = await operations.runComparison({
      beforeSnapshotId: config.baselineSnapshotId,
      afterSnapshotId: snapshotResult.snapshotId,
      comparisonName: config.name,
      ruleset: config.ruleset,
      urls: commonRoutes,
    });
  } catch (error) {
    return {
      status: "failed",
      baseUrl: config.baseUrl,
      baselineSnapshotId: config.baselineSnapshotId,
      snapshotId: snapshotResult.snapshotId,
      routes: manifest.paths,
      crawlErrors: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  if (signal?.aborted) signal.throwIfAborted();
  if (comparison.pagesWithErrors > 0) {
    return {
      status: "failed",
      baseUrl: config.baseUrl,
      baselineSnapshotId: config.baselineSnapshotId,
      snapshotId: snapshotResult.snapshotId,
      routes: manifest.paths,
      crawlErrors: [],
      errors: [
        `Comparison could not process ${comparison.pagesWithErrors} page(s).`,
      ],
      comparison,
    };
  }

  const status =
    comparison.pagesWithDifferences > 0 ||
    comparison.newUrls.length > 0 ||
    comparison.removedUrls.length > 0
      ? "differences"
      : "passed";
  return {
    status,
    baseUrl: config.baseUrl,
    baselineSnapshotId: config.baselineSnapshotId,
    snapshotId: snapshotResult.snapshotId,
    routes: manifest.paths,
    crawlErrors: [],
    errors: [],
    comparison,
  };
}
