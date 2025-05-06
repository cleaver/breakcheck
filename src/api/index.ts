import type {
  ComparisonConfig,
  ComparisonResult,
  SnapshotConfig,
  SnapshotResult,
} from "@project-types/api";
import { createSnapshot } from "./snapshot";

/**
 * The main Breakcheck API interface
 */
export class BreakcheckApi {
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
    // TODO: Implement in task 7.3
    throw new Error("Not implemented yet");
  }
}

// Export types for external use
export type {
  ComparisonConfig,
  ComparisonResult,
  SnapshotConfig,
  SnapshotResult,
} from "@project-types/api";
