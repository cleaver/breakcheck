import type {
  CrawlerConfig,
  CrawlerInstance,
  CrawlError,
  PageSnapshot,
} from "@project-types/crawler";
import { Dataset, PlaywrightCrawler } from "crawlee";

export function createPlaywrightCrawler(
  config: CrawlerConfig
): CrawlerInstance {
  const { maxDepth, includePatterns, excludePatterns } = config;

  return new PlaywrightCrawler({
    maxRequestsPerCrawl: config.maxRequests,
    maxConcurrency: config.maxConcurrency,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 30,
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
