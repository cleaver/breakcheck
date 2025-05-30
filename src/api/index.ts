import { SnapshotManager } from "@core/snapshot";
import type {
  ComparisonConfig,
  ComparisonSummary,
  SnapshotConfig,
  SnapshotJobStatusResponse,
  SnapshotResult,
} from "@project-types/api";
import { createSnapshot } from "./snapshot";
import { CompareManager } from "@core/compare";
import { PageSnapshot } from "@project-types/crawler";
/**
 * The main Breakcheck API interface
 */
export class BreakcheckApi {
  private snapshotManager: SnapshotManager;

  constructor() {
    this.snapshotManager = new SnapshotManager();
  }

  /**
   * Creates a snapshot of a website based on the provided configuration.
   * Orchestrates calls to Crawler and Snapshot Manager.
   */
  async createSnapshot(config: SnapshotConfig): Promise<SnapshotResult> {
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
  async runComparison(config: ComparisonConfig): Promise<ComparisonSummary> {
    const compareManager = new CompareManager();
    return compareManager.runComparison(config);
  }

  /**
   * Lists all available snapshots with their details
   */
  async listSnapshots() {
    return this.snapshotManager.listSnapshots();
  }
}

// Export types for external use
export type { SnapshotConfig, SnapshotResult } from "@project-types/api";
