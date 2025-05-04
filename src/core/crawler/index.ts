import type {
  CrawlerConfig,
  CrawlerInstance,
  CrawlError,
  CrawlResult,
  PageSnapshot,
} from "@project-types/crawler";
import { Dataset } from "crawlee";
import { createCheerioCrawler } from "./implementations/cheerio";
import { createPlaywrightCrawler } from "./implementations/playwright";

export class BreakcheckCrawler {
  private config: CrawlerConfig;
  private crawler: CrawlerInstance;
  private pages: PageSnapshot[] = [];
  private errors: CrawlError[] = [];

  constructor(config: CrawlerConfig) {
    this.config = config;
    this.crawler = this.createCrawler();
  }

  private createCrawler(): CrawlerInstance {
    switch (this.config.crawlerType) {
      case "cheerio":
        return createCheerioCrawler(this.config);
      case "playwright":
        return createPlaywrightCrawler(this.config);
      default:
        const _exhaustiveCheck: never = this.config.crawlerType;
        throw new Error(`Unsupported crawler type: ${this.config.crawlerType}`);
    }
  }

  async crawl(): Promise<CrawlResult> {
    try {
      // Clear previous results
      this.pages = [];
      this.errors = [];

      // Start the crawler
      await this.crawler.run([this.config.baseUrl]);

      // Collect results from the dataset
      const results = await Dataset.getData();
      for (const item of results.items) {
        if (item.type === "error") {
          this.errors.push({
            url: item.url,
            error: item.error,
            statusCode: item.statusCode,
          });
        } else {
          // Type assertion since we know the shape of our data
          this.pages.push(item as unknown as PageSnapshot);
        }
      }

      return {
        pages: this.pages,
        errors: this.errors,
      };
    } catch (error) {
      throw new Error(
        `Crawling failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
