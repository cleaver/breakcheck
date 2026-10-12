import { randomUUID } from "node:crypto";
import { resolveUrlPaths } from "../crawler/url-paths.js";
import type {
  SnapshotConfig,
  SnapshotResult,
  SnapshotRouteUpdateResult,
} from "../../types/api.js";
import type { SnapshotRepository } from "./classes/SnapshotRepository.js";
import { validateSnapshotRoutes } from "./route-coverage.js";

/** Crawls selected routes and atomically merges them into a stored baseline. */
export async function updateSnapshotRoutes(
  config: SnapshotConfig,
  baselineSnapshotId: string,
  snapshotRepository: SnapshotRepository,
  createSnapshot: (
    config: SnapshotConfig,
    signal?: AbortSignal,
  ) => Promise<SnapshotResult>,
  signal?: AbortSignal,
): Promise<SnapshotRouteUpdateResult> {
  signal?.throwIfAborted();
  if (config.urlPaths === undefined) {
    throw new Error(
      "A URL manifest is required for a route-scoped baseline update.",
    );
  }
  if (
    (config.crawlSettings.includePatterns?.length ?? 0) > 0 ||
    (config.crawlSettings.excludePatterns?.length ?? 0) > 0
  ) {
    throw new Error(
      "Exact-route baseline updates cannot use crawl includePatterns or excludePatterns.",
    );
  }
  const manifest = resolveUrlPaths(config.baseUrl, config.urlPaths);
  if (manifest.issues.length > 0) {
    throw new Error(manifest.issues.map((issue) => issue.message).join("; "));
  }

  await snapshotRepository.loadSnapshot(baselineSnapshotId);
  signal?.throwIfAborted();
  const stagingSnapshotId = `baseline_update_${randomUUID()}`;
  try {
    const snapshot = await createSnapshot(
      {
        ...config,
        name: stagingSnapshotId,
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
    if (snapshot.status === "failed") {
      throw new Error(snapshot.message);
    }
    signal?.throwIfAborted();
    if (snapshot.errors.length > 0) {
      throw new Error(
        snapshot.errors
          .map((error) => `${error.url}: ${error.message}`)
          .join("; "),
      );
    }

    const stagedSnapshot = await snapshotRepository.loadSnapshot(
      snapshot.snapshotId,
    );
    const failures = await validateSnapshotRoutes(
      stagedSnapshot,
      manifest.paths,
    );
    if (failures.length > 0) throw new Error(failures.join("; "));

    signal?.throwIfAborted();
    await snapshotRepository.replaceSnapshotRoutes(
      baselineSnapshotId,
      stagingSnapshotId,
      manifest.paths,
      signal,
    );
    return {
      snapshotId: baselineSnapshotId,
      updatedRoutes: manifest.paths,
      pageCount: manifest.paths.length,
    };
  } finally {
    await snapshotRepository.deleteSnapshot(stagingSnapshotId);
  }
}
