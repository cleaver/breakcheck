import { Change } from "diff";

/**
 * Represents a single difference found between two page snapshots
 * This is equivalent to the Change type from the diff package
 */
export type LineDifference = Change;

/**
 * Represents the complete diff result for a single page
 */
export interface PageDiff {
  /** URL of the page being compared */
  url: string;
  /** List of differences found */
  differences: LineDifference[];
  /** Whether the page had any differences */
  hasDifferences: boolean;
}
