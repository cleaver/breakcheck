import { CrawlerConfig } from "@project-types/crawler";

/**
 * Configuration for creating a snapshot
 */
export interface SnapshotConfig {
  /** Base URL to start crawling from */
  baseUrl: string;
  /** Name/identifier for this snapshot */
  name: string;
  /** Crawler configuration to use */
  crawlSettings: CrawlerConfig;
  /** Optional path to generate a URL list file */
  urlListPath?: string;
}

/**
 * Result of a snapshot creation operation
 */
export interface SnapshotResult {
  /** Whether the snapshot was created successfully */
  success: boolean;
  /** Name/identifier of the created snapshot */
  snapshotId: string;
  /** Timestamp when the snapshot was created */
  timestamp: string;
  /** Base URL that was crawled */
  baseUrl: string;
  /** Number of pages successfully crawled */
  pageCount: number;
  /** Any errors that occurred during crawling */
  errors: Array<{
    url: string;
    message: string;
    code?: string;
  }>;
  /** Metadata about the crawl */
  metadata: {
    crawlSettings: CrawlerConfig;
    duration: number; // in milliseconds
  };
  /** Path to the generated URL list file, if requested */
  urlListPath?: string;
}

/**
 * Configuration for running a comparison
 */
export interface ComparisonConfig {
  /** Name/identifier of the "before" snapshot */
  beforeSnapshotId: string;
  /** Name/identifier of the "after" snapshot */
  afterSnapshotId: string;
  /** Rules to apply during comparison (either as DSL text or pre-parsed JSON) */
  rules: string | object;
}

/**
 * Result of a comparison operation
 */
export interface ComparisonResult {
  /** Whether the comparison completed successfully */
  success: boolean;
  /** Summary of the comparison results */
  summary: {
    totalPages: number;
    pagesWithDifferences: number;
    totalDifferences: number;
  };
  /** Detailed differences found, grouped by page URL */
  differences: Array<{
    url: string;
    differences: Array<{
      type: "element" | "attribute" | "content";
      selector: string;
      before?: string;
      after?: string;
      message: string;
    }>;
  }>;
  /** Any errors that occurred during comparison */
  errors: Array<{
    url: string;
    message: string;
    code?: string;
  }>;
}
