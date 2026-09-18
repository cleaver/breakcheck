import { compareSnapshots } from "../core/compare/index.js";
import { ComparisonRepository } from "../core/compare/classes/ComparisonRepository.js";
import { RulesEngine } from "../core/rules/RulesEngine.js";
import { createSnapshot, SnapshotRepository } from "../core/snapshot/index.js";
import { logger } from "../lib/logger.js";
import { resolveStorageContext } from "../lib/storage.js";
import type {
  ComparisonConfig,
  ComparisonSummary,
  SnapshotConfig,
  SnapshotResult,
  StorageOptions,
} from "../types/api.js";
import type { RulesDocument } from "../types/rules.js";
import { processRulesDsl } from "../core/rules/RulesDsl.js";

/**
 * Creates a snapshot of a website based on the provided configuration.
 * Orchestrates calls to Crawler and Snapshot Manager.
 */
export async function createSnapshotFromConfig(
  config: SnapshotConfig,
  options: StorageOptions = {},
): Promise<SnapshotResult> {
  const storageContext = await resolveStorageContext(options.storageDir);
  const snapshotRepository =
    SnapshotRepository.createWithStorageContext(storageContext);
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
  config: ComparisonConfig,
  options: StorageOptions = {},
): Promise<ComparisonSummary> {
  const storageContext = await resolveStorageContext(options.storageDir);
  const snapshotRepository =
    SnapshotRepository.createWithStorageContext(storageContext);
  const rulesEngine = await RulesEngine.create(config.ruleset);
  const comparisonRepository =
    await ComparisonRepository.createWithStorageContext(
      config.comparisonName,
      {
        beforeSnapshotId: config.beforeSnapshotId,
        afterSnapshotId: config.afterSnapshotId,
        rulesUsedIdentifier:
          typeof config.ruleset === "string"
            ? config.ruleset
            : config.ruleset?.name,
      },
      storageContext,
    );

  const diff = await compareSnapshots(
    config,
    snapshotRepository,
    comparisonRepository,
    rulesEngine,
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
 * Parses and validates a rules.breakcheck directory into the intermediate
 * JSON document used by the rules engine.
 */
export async function compileRulesDsl(
  rulesDirectory: string,
): Promise<RulesDocument> {
  const ruleset = await processRulesDsl(rulesDirectory);
  await RulesEngine.create(ruleset);
  return {
    rules: ruleset.rules,
    regions: ruleset.regions ?? [],
  };
}

/**
 * Lists all available snapshots with their details
 */
export async function listSnapshots(options: StorageOptions = {}) {
  const storageContext = await resolveStorageContext(options.storageDir);
  const snapshotRepository =
    SnapshotRepository.createWithStorageContext(storageContext);
  return snapshotRepository.listSnapshots();
}

/** Deletes one named snapshot. */
export async function deleteSnapshot(
  name: string,
  options: StorageOptions = {},
): Promise<boolean> {
  const storageContext = await resolveStorageContext(options.storageDir);
  const snapshotRepository =
    SnapshotRepository.createWithStorageContext(storageContext);
  return snapshotRepository.deleteSnapshot(name);
}

/** Deletes all snapshots and returns the names that were removed. */
export async function deleteAllSnapshots(
  options: StorageOptions = {},
): Promise<string[]> {
  const storageContext = await resolveStorageContext(options.storageDir);
  const snapshotRepository =
    SnapshotRepository.createWithStorageContext(storageContext);
  return snapshotRepository.deleteAllSnapshots();
}

/** Deletes one named comparison. */
export async function deleteComparison(
  name: string,
  options: StorageOptions = {},
): Promise<boolean> {
  const storageContext = await resolveStorageContext(options.storageDir);
  const comparisonRepository =
    ComparisonRepository.openWithStorageContext(storageContext);
  return comparisonRepository.deleteComparison(name);
}

/** Deletes all comparisons and returns the names that were removed. */
export async function deleteAllComparisons(
  options: StorageOptions = {},
): Promise<string[]> {
  const storageContext = await resolveStorageContext(options.storageDir);
  const comparisonRepository =
    ComparisonRepository.openWithStorageContext(storageContext);
  return comparisonRepository.deleteAllComparisons();
}

export {
  logger,
  type ComparisonConfig,
  type SnapshotConfig,
  type StorageOptions,
};
