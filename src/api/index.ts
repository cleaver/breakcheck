import { compareSnapshots } from "@core/compare";
import { createSnapshot, SnapshotRepository } from "@core/snapshot";
import type {
  ComparisonConfig,
  ComparisonSummary,
  SnapshotConfig,
  SnapshotResult,
} from "@project-types/api";

const snapshotRepository = new SnapshotRepository();

/**
 * Creates a snapshot of a website based on the provided configuration.
 * Orchestrates calls to Crawler and Snapshot Manager.
 */
export async function createSnapshotFromConfig(
  config: SnapshotConfig
): Promise<SnapshotResult> {
  return createSnapshot(config);
}

/**
 * Starts a snapshot job and returns the job status.
 */
// async startSnapshotJob(
//   config: SnapshotConfig
// ): Promise<SnapshotJobStatusResponse> {}

/**
 * Gets the status of a snapshot job.
 */
// async getSnapshotJobStatus(
//   jobId: string
// ): Promise<SnapshotJobStatusResponse> {}

/**
 * Runs a comparison between two snapshots using specified rules.
 * Orchestrates calls to Snapshot Manager, Rules Engine Parser (if needed),
 * DOM Processor, and Diff Engine.
 */
export async function runComparison(
  config: ComparisonConfig
): Promise<ComparisonSummary> {
  const diff = await compareSnapshots(config, snapshotRepository);

  // Convert SnapshotDiff to ComparisonSummary
  return {
    comparisonId: `${config.beforeSnapshotId}_${config.afterSnapshotId}`,
    status: "completed",
    overallResult: diff.pageDiffs.some((d) => d.hasDifferences)
      ? "fail"
      : "pass",
    beforeSnapshotId: config.beforeSnapshotId,
    afterSnapshotId: config.afterSnapshotId,
    timestamp: new Date().toISOString(),
    durationMs: 0, // TODO: Add duration tracking
    totalPagesCompared: diff.pageDiffs.length,
    pagesWithDifferences: diff.pageDiffs.filter((d) => d.hasDifferences).length,
    pagesWithErrors: 0,
    newUrls: diff.newUrls,
    removedUrls: diff.removedUrls,
    comparisonProcessErrors: [],
    summaryFilePath: "", // TODO: Add summary file path
    resultsPath: "", // TODO: Add results path
  };
}

/**
 * Lists all available snapshots with their details
 */
export async function listSnapshots() {
  return snapshotRepository.listSnapshots();
}

// Export types for external use
export type { SnapshotConfig, SnapshotResult } from "@project-types/api";
