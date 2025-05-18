import { SnapshotManager } from "@core/snapshot";
import type {
  ComparisonConfig,
  ComparisonResult,
  SnapshotConfig,
  SnapshotResult,
} from "@project-types/api";
import { createSnapshot } from "./snapshot";
import { CompareManager } from "@core/compare";
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
   * Runs a comparison between two snapshots using specified rules.
   * Orchestrates calls to Snapshot Manager, Rules Engine Parser (if needed),
   * DOM Processor, and Diff Engine.
   */
  async runComparison(config: ComparisonConfig): Promise<ComparisonResult> {
    const compareManager = new CompareManager();
    return await compareManager.compareSnapshots(config);
  }

  /**
   * Lists all available snapshots with their details
   */
  async listSnapshots() {
    return this.snapshotManager.listSnapshots();
  }
}

// Export types for external use
export type {
  ComparisonResult,
  SnapshotConfig,
  SnapshotResult,
} from "@project-types/api";
