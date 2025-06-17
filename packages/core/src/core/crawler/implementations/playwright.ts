import { Dataset, PlaywrightCrawler } from "crawlee";
import type { CrawlerConfig } from "../../../types/api";
import type {
  CrawlerInstance,
  CrawlError,
  PageSnapshot,
} from "../../../types/crawler";

export function createPlaywrightCrawler(
  config: CrawlerConfig
): CrawlerInstance {
  const { maxDepth, includePatterns, excludePatterns } = config;

  let datasetPromise = Dataset.open();

  return new PlaywrightCrawler({
    maxRequestsPerCrawl: config.maxRequests,
    maxConcurrency: config.maxConcurrency,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 30,
    async requestHandler({ request, response, page, enqueueLinks }) {
      const content = await page.content();
      const title = await page.title();
      const pageSnapshot: PageSnapshot = {
        url: request.url,
        finalUrl: response?.url() || request.url,
        content,
        title,
        statusCode: response?.status() || 0,
        headers: response?.headers() || {},
      };
      const dataset = await datasetPromise;
      await dataset.pushData(pageSnapshot);

      const depth = (request.userData.depth as number) || 0;
      if (depth < (maxDepth || Infinity)) {
        await enqueueLinks({
          globs: includePatterns || [],
          exclude: excludePatterns || [],
        });
      }
    },
    failedRequestHandler: async ({ request, error }) => {
      const crawlError: CrawlError = {
        url: request.url,
        message: error instanceof Error ? error.message : String(error),
        statusCode:
          error instanceof Error && "statusCode" in error
            ? (error.statusCode as number)
            : undefined,
      };
      const dataset = await datasetPromise;
      await dataset.pushData({ type: "error", ...crawlError });
    },
  });
}
