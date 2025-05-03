import { CheerioCrawler, PlaywrightCrawler } from "crawlee";

export type CrawlerType = "cheerio" | "playwright";

export interface CrawlerConfig {
  baseUrl: string;
  maxDepth?: number;
  maxRequests?: number;
  maxConcurrency?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  userAgent?: string;
  crawlerType: CrawlerType;
}

export interface PageSnapshot {
  url: string;
  finalUrl: string;
  content: string;
  statusCode: number;
  headers: Record<string, string>;
}

export interface CrawlResult {
  pages: PageSnapshot[];
  errors: CrawlError[];
}

export interface CrawlError {
  url: string;
  error: string;
  statusCode?: number;
}

export type CrawlerInstance = CheerioCrawler | PlaywrightCrawler;
