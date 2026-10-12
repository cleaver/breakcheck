import { describe, expect, it, vi } from "vitest";
import { BreakcheckCrawler } from "../../core/crawler/index.js";
import type { CrawlerConfig } from "../../types/api.js";

const crawlee = vi.hoisted(() => ({
  purgeDefaultStorages: vi.fn(async () => undefined),
  Dataset: {
    open: vi.fn(async () => ({
      forEach: vi.fn(async () => undefined),
      getInfo: vi.fn(async () => ({ name: "crawler-test" })),
    })),
  },
  Configuration: {
    getGlobalConfig: () => ({ get: () => "default-dataset" }),
  },
  CheerioCrawler: class {},
  PlaywrightCrawler: class {},
}));

vi.mock("crawlee", async (importOriginal) => ({
  ...(await importOriginal<typeof import("crawlee")>()),
  ...crawlee,
}));

const config: CrawlerConfig = {
  baseUrl: "http://example.com",
  crawlerType: "cheerio",
};

describe("BreakcheckCrawler cancellation", () => {
  it("does not start a crawl when its signal is already aborted", async () => {
    const crawler = {
      run: vi.fn(async () => undefined),
      teardown: vi.fn(async () => undefined),
    };
    const instance = new BreakcheckCrawler(config, { crawler });
    const controller = new AbortController();
    controller.abort(new Error("cancel before crawl"));

    await expect(instance.crawl(controller.signal)).rejects.toThrow(
      "cancel before crawl",
    );
    expect(crawler.run).not.toHaveBeenCalled();
    expect(crawler.teardown).not.toHaveBeenCalled();
  });

  it("waits for crawler teardown after cancellation during the crawl", async () => {
    const controller = new AbortController();
    let announceRun: (() => void) | undefined;
    let finishTeardown: (() => void) | undefined;
    const runStarted = new Promise<void>((resolve) => {
      announceRun = resolve;
    });
    const crawler = {
      run: vi.fn(async () => {
        announceRun?.();
        controller.abort(new Error("cancel during crawl"));
      }),
      teardown: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishTeardown = resolve;
          }),
      ),
    };
    const instance = new BreakcheckCrawler(config, { crawler });
    let settled = false;
    const crawl = instance.crawl(controller.signal).finally(() => {
      settled = true;
    });
    void crawl.catch(() => undefined);

    await runStarted;
    expect(crawler.teardown).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    finishTeardown?.();
    await expect(crawl).rejects.toThrow(/Crawling failed: cancel during crawl/);
    expect(settled).toBe(true);
  });

  it("surfaces teardown failures after cancellation", async () => {
    const controller = new AbortController();
    const crawler = {
      run: vi.fn(async () => {
        controller.abort(new Error("cancel crawl"));
      }),
      teardown: vi.fn(async () => {
        throw new Error("teardown failed");
      }),
    };
    const instance = new BreakcheckCrawler(config, { crawler });

    await expect(instance.crawl(controller.signal)).rejects.toThrow(
      "teardown failed",
    );
    expect(crawler.teardown).toHaveBeenCalledOnce();
  });

  it("removes the abort listener after crawl failures", async () => {
    const controller = new AbortController();
    const crawler = {
      run: vi.fn(async () => {
        throw new Error("run failed");
      }),
      teardown: vi.fn(async () => undefined),
    };
    const instance = new BreakcheckCrawler(config, { crawler });

    await expect(instance.crawl(controller.signal)).rejects.toThrow(
      "Crawling failed: run failed",
    );
    controller.abort();
    expect(crawler.teardown).not.toHaveBeenCalled();
  });

  it("removes the abort listener after successful crawls", async () => {
    const controller = new AbortController();
    const crawler = {
      run: vi.fn(async () => undefined),
      teardown: vi.fn(async () => undefined),
    };
    const instance = new BreakcheckCrawler(config, { crawler });

    await expect(instance.crawl(controller.signal)).resolves.toMatchObject({
      errors: [],
    });
    controller.abort();
    expect(crawler.teardown).not.toHaveBeenCalled();
  });
});
