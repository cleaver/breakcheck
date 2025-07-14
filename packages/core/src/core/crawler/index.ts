import { Configuration, Dataset, purgeDefaultStorages } from "crawlee";
import { logger } from "../../lib/logger";
import type { CrawlerConfig } from "../../types/api";
import type {
    CrawlerInstance,
    CrawlError,
    CrawlResult
} from "../../types/crawler";
import { createCheerioCrawler } from "./implementations/cheerio";
import { createPlaywrightCrawler } from "./implementations/playwright";

export class BreakcheckCrawler {
  private config: CrawlerConfig;
  private crawler: CrawlerInstance;
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
      await purgeDefaultStorages();
      this.errors = [];
      await this.crawler.run([this.config.baseUrl]);
      // Open the dataset and scan for error items only
      const dataset = await Dataset.open();
      await dataset.forEach((item: any) => {
        if (item.type === "error") {
          this.errors.push({
            url: item.url,
            message: item.error,
            statusCode: item.statusCode,
          });
        }
      });
      const datasetInfo = await dataset.getInfo();
      let actualDatasetName =
        datasetInfo?.name ||
        Configuration.getGlobalConfig().get("defaultDatasetId");
      if (!actualDatasetName) actualDatasetName = "";
      return {
        datasetName: actualDatasetName,
        errors: this.errors,
      };
    } catch (error) {
      logger.error(
        {
          error,
          baseUrl: this.config.baseUrl,
          crawlerType: this.config.crawlerType,
          errors: this.errors,
        },
        "Crawling failed"
      );
      throw new Error(
        `Crawling failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
