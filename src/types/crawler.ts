import { CheerioCrawler, PlaywrightCrawler } from "crawlee";

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

export interface PageSnapshot {
  url: string;
  finalUrl: string;
  content: string;
  statusCode: number;
  headers: Record<string, string>;
  title?: string;
}

export interface CrawlResult {
  datasetName: string;
  errors: CrawlError[];
}

export interface CrawlError {
  url: string;
  error: string;
  statusCode?: number;
}

export type CrawlerInstance = CheerioCrawler | PlaywrightCrawler;
