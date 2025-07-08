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
  /** The patch of the diff */
  patch: string;
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

/**
 * Metadata stored in metadata.json for a comparison.
 */
export interface ComparisonMetadata {
  beforeSnapshotId: string;
  afterSnapshotId: string;
  rulesUsedIdentifier?: string;
}

/**
 * The structure of the main index for a comparison result.
 */
export interface ComparisonIndex {
  urls: {
    [url: string]: {
      filename: string;
      hasDifferences: boolean;
    };
  };
  metadata: ComparisonMetadata & {
    timestamp: string;
    totalPages: number;
    pagesWithDifferences: number;
  };
}
