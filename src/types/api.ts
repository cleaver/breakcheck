/** Types for API users. */

import { CrawlError } from "./crawler";
import { Ruleset } from "./rules";

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

type RulesetName = string;

/**
 * Configuration for running a comparison
 */
export interface ComparisonConfig {
  /** Name/identifier of the "before" snapshot */
  beforeSnapshotId: string;
  /** Name/identifier of the "after" snapshot */
  afterSnapshotId: string;
  /** Name/identifier of the comparison */
  comparisonName: string;
  /** Name/identifier of the ruleset to use */
  ruleset: Ruleset | RulesetName;
  /** Optional list of URLs to compare */
  urls?: string[];
}

/**
 * Response payload when a comparison job is successfully initiated.
 */
export interface ComparisonJobInfo {
  comparisonId: string;
  status: "pending" | "processing";
  message: string;
  statusUrl: string;
  resultsPath: string;
}

/**
 * Progress details for a running comparison job.
 */
export interface ComparisonProgress {
  processedPages: number;
  totalPages: number;
  currentStage?: string;
}

/**
 * Represents the status of a comparison job.
 */
export interface ComparisonJobStatus {
  comparisonId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: ComparisonProgress;
  startTime?: string;
  endTime?: string;
  message?: string;
  summaryUrl?: string;
  pageDiffsUrl?: string;
  resultsPath: string;
}

/**
 * Details of an error that occurred during the comparison process itself.
 */
export interface ComparisonProcessError {
  pageUrl?: string;
  stage?: string;
  message: string;
  details?: any;
}

/**
 * Summary of a completed comparison job.
 */
export interface ComparisonSummary {
  comparisonId: string;
  status: "completed" | "failed";
  overallResult: "pass" | "fail";
  beforeSnapshotId: string;
  afterSnapshotId: string;
  /** Identifier of the ruleset or description of rules used (e.g., 'custom_rules_provided', rulesetName, or filePath). */
  rulesUsedIdentifier?: string;
  timestamp: string;
  durationMs: number;
  totalPagesCompared: number;
  pagesWithDifferences: number;
  pagesWithErrors: number;
  newUrls: string[];
  removedUrls: string[];
  comparisonProcessErrors: ComparisonProcessError[];
  summaryFilePath: string;
  resultsPath: string;
}
