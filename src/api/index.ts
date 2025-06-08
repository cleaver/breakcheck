import { RulesEngine } from "@/core/rules/RulesEngine";
import { compareSnapshots } from "@core/compare";
import { ComparisonRepository } from "@core/compare/classes/ComparisonRepository";
import { createSnapshot, SnapshotRepository } from "@core/snapshot";
import type {
  ComparisonConfig,
  ComparisonSummary,
  SnapshotConfig,
  SnapshotResult,
} from "@project-types/api";

/**
 * Creates a snapshot of a website based on the provided configuration.
 * Orchestrates calls to Crawler and Snapshot Manager.
 */
export async function createSnapshotFromConfig(
  config: SnapshotConfig
): Promise<SnapshotResult> {
  const snapshotRepository = new SnapshotRepository();
  return createSnapshot(config, snapshotRepository);
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
  const snapshotRepository = new SnapshotRepository();
  const rulesEngine = await RulesEngine.create(config.ruleset);
  const comparisonRepository = await ComparisonRepository.create(
    config.comparisonName,
    {
      beforeSnapshotId: config.beforeSnapshotId,
      afterSnapshotId: config.afterSnapshotId,
      rulesUsedIdentifier:
        typeof config.ruleset === "string"
          ? config.ruleset
          : config.ruleset.name,
    }
  );

  const diff = await compareSnapshots(
    config,
    snapshotRepository,
    comparisonRepository,
    rulesEngine
  );

  // Convert SnapshotDiff to ComparisonSummary
  return {
    comparisonId: config.comparisonName,
    status: "completed",
    overallResult: diff.overallResult,
    beforeSnapshotId: config.beforeSnapshotId,
    afterSnapshotId: config.afterSnapshotId,
    timestamp: new Date().toISOString(),
    durationMs: diff.durationMs,
    totalPagesCompared: diff.totalPagesCompared,
    pagesWithDifferences: diff.pagesWithDifferences,
    pagesWithErrors: diff.pagesWithErrors,
    newUrls: diff.newUrls,
    removedUrls: diff.removedUrls,
    comparisonProcessErrors: [],
    summaryFilePath: diff.summaryFilePath,
    resultsPath: diff.resultsPath,
  };
}

/**
 * Lists all available snapshots with their details
 */
export async function listSnapshots() {
  const snapshotRepository = new SnapshotRepository();
  return snapshotRepository.listSnapshots();
}

// Export types for external use
export type { SnapshotConfig, SnapshotResult } from "@project-types/api";
