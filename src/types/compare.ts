import { PageSnapshot } from "./crawler";

/**
 * Represents a single difference found between two page snapshots
 */
export interface PageDifference {
  /** Type of difference found */
  type: "element" | "attribute" | "content";
  /** CSS selector or XPath to locate the element */
  selector: string;
  /** Original value (from before snapshot) */
  before?: string;
  /** New value (from after snapshot) */
  after?: string;
  /** Human-readable description of the difference */
  message: string;
}

/**
 * Represents the complete diff result for a single page
 */
export interface PageDiff {
  /** URL of the page being compared */
  url: string;
  /** List of differences found */
  differences: PageDifference[];
  /** Whether the page had any differences */
  hasDifferences: boolean;
  /** Whether the page was found in both snapshots */
  existsInBoth: boolean;
  /** Whether the page was only found in the before snapshot */
  onlyInBefore: boolean;
  /** Whether the page was only found in the after snapshot */
  onlyInAfter: boolean;
}
