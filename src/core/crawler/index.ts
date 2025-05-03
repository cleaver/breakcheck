import {
  CheerioCrawler,
  PlaywrightCrawler,
  Dataset,
  Dictionary,
} from "crawlee";
import type {
  CrawlerConfig,
  CrawlResult,
  PageSnapshot,
  CrawlError,
  CrawlerInstance,
} from "../../types/crawler";

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
    const commonConfig = {
      maxRequestsPerCrawl: this.config.maxRequests,
      maxConcurrency: this.config.maxConcurrency,
      maxRequestRetries: 3,
      requestHandlerTimeoutSecs: 30,
    };

    // Store config in closure variable to avoid 'this' binding issues
    const { maxDepth, includePatterns, excludePatterns } = this.config;

    if (this.config.crawlerType === "cheerio") {
      return new CheerioCrawler({
        ...commonConfig,
        async requestHandler({ request, response, body, enqueueLinks }) {
          const pageSnapshot: PageSnapshot = {
            url: request.url,
            finalUrl: response.url || request.url,
            content: body.toString(),
            statusCode: response.statusCode || 0,
            headers: Object.fromEntries(
              Object.entries(response.headers).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(", ") : value || "",
              ])
            ),
          };
          await Dataset.pushData(pageSnapshot);

          const depth = (request.userData.depth as number) || 0;
          if (depth < (maxDepth || Infinity)) {
            await enqueueLinks({
              globs: includePatterns || [],
              exclude: excludePatterns || [],
            });
          }
        },
        failedRequestHandler: ({ request, error }) => {
          const crawlError: CrawlError = {
            url: request.url,
            error: error instanceof Error ? error.message : String(error),
            statusCode:
              error instanceof Error && "statusCode" in error
                ? (error.statusCode as number)
                : undefined,
          };
          Dataset.pushData({ type: "error", ...crawlError });
        },
      });
    } else {
      return new PlaywrightCrawler({
        ...commonConfig,
        async requestHandler({ request, response, page, enqueueLinks }) {
          const content = await page.content();
          const pageSnapshot: PageSnapshot = {
            url: request.url,
            finalUrl: response?.url() || request.url,
            content,
            statusCode: response?.status() || 0,
            headers: response?.headers() || {},
          };
          await Dataset.pushData(pageSnapshot);

          const depth = (request.userData.depth as number) || 0;
          if (depth < (maxDepth || Infinity)) {
            await enqueueLinks({
              globs: includePatterns || [],
              exclude: excludePatterns || [],
            });
          }
        },
        failedRequestHandler: ({ request, error }) => {
          const crawlError: CrawlError = {
            url: request.url,
            error: error instanceof Error ? error.message : String(error),
            statusCode:
              error instanceof Error && "statusCode" in error
                ? (error.statusCode as number)
                : undefined,
          };
          Dataset.pushData({ type: "error", ...crawlError });
        },
      });
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
