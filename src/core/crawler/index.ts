import type {
  CrawlerConfig,
  CrawlerInstance,
  CrawlError,
  CrawlResult,
} from "@project-types/crawler";
import { Dataset, purgeDefaultStorages } from "crawlee";
import { createCheerioCrawler } from "./implementations/cheerio";
import { createPlaywrightCrawler } from "./implementations/playwright";

export class BreakcheckCrawler {
  private config: CrawlerConfig;
  private crawler: CrawlerInstance;
  private datasetName: string;
  private errors: CrawlError[] = [];

  constructor(config: CrawlerConfig) {
    this.config = config;
    this.datasetName = "breakcheckDataset";
    this.crawler = this.createCrawler();
  }

  private createCrawler(): CrawlerInstance {
    switch (this.config.crawlerType) {
      case "cheerio":
        return createCheerioCrawler(this.config, this.datasetName);
      case "playwright":
        return createPlaywrightCrawler(this.config, this.datasetName);
      default:
        const _exhaustiveCheck: never = this.config.crawlerType;
        throw new Error(`Unsupported crawler type: ${this.config.crawlerType}`);
    }
  }

  async crawl(): Promise<CrawlResult> {
    try {
      await purgeDefaultStorages();
      this.errors = [];
      await this.crawler.run([this.config.baseUrl]);
      // Open the dataset and scan for error items only
      const dataset = await Dataset.open(this.datasetName);
      await dataset.forEach((item: any) => {
        if (item.type === "error") {
          this.errors.push({
            url: item.url,
            error: item.error,
            statusCode: item.statusCode,
          });
        }
      });
      return {
        datasetName: this.datasetName,
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
