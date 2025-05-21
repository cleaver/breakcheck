/** Types for API users. */

import { CrawlError } from "./crawler";

export type CrawlerType = "cheerio" | "playwright";

/**
 * Configuration for the crawler behavior.
 * Used both internally by the crawler and externally via the API.
 */
export interface CrawlerConfig {
  /** Base URL to start crawling from */
  baseUrl: string;
  /** Maximum depth to crawl from the base URL */
  maxDepth?: number;
  /** Maximum number of requests to make */
  maxRequests?: number;
  /** Maximum number of concurrent requests */
  maxConcurrency?: number;
  /** URL patterns to include in the crawl */
  includePatterns?: string[];
  /** URL patterns to exclude from the crawl */
  excludePatterns?: string[];
  /** User agent string to use for requests */
  userAgent?: string;
  /** Type of crawler to use (cheerio or playwright) */
  crawlerType: CrawlerType;
}

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

interface SnapshotJobBase {
  snapshotId: string;
}

/**
 * Snapshot job is pending
 */
export interface SnapshotJobPending extends SnapshotJobBase {
  status: "pending";
  message?: string;
}

/**
 * Snapshot job is processing
 */
export interface SnapshotJobProcessing extends SnapshotJobBase {
  status: "processing";
  message?: string;
  progress?: {
    pagesCrawled?: number;
  };
}

/**
 * Snapshot job is successful
 */
export interface SnapshotJobSuccess extends SnapshotJobBase {
  status: "success";
  timestamp: string;
  baseUrl: string;
  pageCount: number;
  errors: Array<CrawlError>;
  metadata: {
    crawlSettings: CrawlerConfig;
    durationMs: number;
  };
  /** Path to the URL list file */
  urlListPath?: string;
  /** List of URLs crawled */
  urlList?: string[];
}

/**
 * Snapshot job failed
 */
export interface SnapshotJobFailed extends SnapshotJobBase {
  status: "failed";
  message: string;
  errors: Array<{
    statusCode?: number;
    message: string;
  }>;
}

export type SnapshotJobStatusResponse =
  | SnapshotJobPending
  | SnapshotJobProcessing
  | SnapshotJobSuccess
  | SnapshotJobFailed;

/**
 * Result of a snapshot creation operation
 */
export type SnapshotResult = SnapshotJobSuccess | SnapshotJobFailed;

/**
 * Configuration for running a comparison
 */
export interface ComparisonConfig {
  /** Name/identifier of the "before" snapshot */
  beforeSnapshotId: string;
  /** Name/identifier of the "after" snapshot */
  afterSnapshotId: string;
  /** Name/identifier of the ruleset to use */
  rulesetName?: string;
  /** Optional list of URLs to compare */
  urls?: string[];
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
  /** Path to the file containing detailed differences */
  differencesPath: string;
  /** Any errors that occurred during comparison */
  errors: Array<{
    url: string;
    message: string;
    statusCode?: string;
  }>;
}
