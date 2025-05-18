/** Internal types for diffs / comparisons used by other modules */

import { Change } from "diff";

/**
 * Represents a single difference found between two page snapshots
 * This is equivalent to the Change type from the diff package
 */
export type LineDiff = Change;

/**
 * Represents the complete diff result for a single page
 */
export interface PageDiff {
  /** URL of the page being compared */
  url: string;
  /** List of differences found */
  differences: LineDiff[];
  /** Whether the page had any differences */
  hasDifferences: boolean;
}

/**
 * Result of comparing two snapshots
 */
export interface SnapshotDiff {
  /** List of page differences found */
  pageDiffs: PageDiff[];
  /** URLs that exist in the after snapshot but not in the before snapshot */
  newUrls: string[];
  /** URLs that exist in the before snapshot but not in the after snapshot */
  removedUrls: string[];
}
