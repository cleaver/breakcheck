import type { CrawlerConfig } from "@project-types/api";
import type {
    CrawlerInstance,
    CrawlError,
    PageSnapshot
} from "@project-types/crawler";
import { CheerioCrawler, Dataset } from "crawlee";

export function createCheerioCrawler(config: CrawlerConfig): CrawlerInstance {
  const { maxDepth, includePatterns, excludePatterns } = config;

  let datasetPromise = Dataset.open();

  return new CheerioCrawler({
    maxRequestsPerCrawl: config.maxRequests,
    maxConcurrency: config.maxConcurrency,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 30,
    async requestHandler({ request, response, body, $, enqueueLinks }) {
      const title = $("title").first().text() || undefined;
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
        title,
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
