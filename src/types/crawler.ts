/** Internal types for crawling used by other modules. */
import { CheerioCrawler, PlaywrightCrawler } from "crawlee";

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
  message: string;
  statusCode?: number;
}

export type CrawlerInstance = CheerioCrawler | PlaywrightCrawler;
