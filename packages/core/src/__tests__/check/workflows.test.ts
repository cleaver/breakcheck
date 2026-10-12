import { Dataset } from "crawlee";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runSiteCheck,
  type SiteCheckOperations,
} from "../../core/check/index.js";
import { SnapshotRepository } from "../../core/snapshot/classes/SnapshotRepository.js";
import { updateSnapshotRoutes } from "../../core/snapshot/update-routes.js";
import type {
  ComparisonConfig,
  ComparisonSummary,
  SiteCheckConfig,
  SnapshotConfig,
} from "../../types/api.js";

const crawlee = vi.hoisted(() => ({
  Dataset: {
    open: vi.fn(async (name?: string) => {
      const items: unknown[] = [];
      return {
        pushData: async (item: unknown) => {
          items.push(item);
        },
        forEach: async (callback: (item: unknown) => void | Promise<void>) => {
          for (const item of items) await callback(item);
        },
        drop: async () => undefined,
        getInfo: async () => ({ name }),
      };
    }),
  },
}));

vi.mock("crawlee", async (importOriginal) => ({
  ...(await importOriginal<typeof import("crawlee")>()),
  ...crawlee,
}));

const BASE_URL = "http://example.com";

function checkConfig(
  overrides: Partial<SiteCheckConfig> = {},
): SiteCheckConfig {
  return {
    baseUrl: BASE_URL,
    name: `check-${randomUUID()}`,
    baselineSnapshotId: "baseline",
    routes: ["/", "/about"],
    crawlSettings: { baseUrl: BASE_URL, crawlerType: "cheerio" },
    ...overrides,
  };
}

function comparison(
  overrides: Partial<ComparisonSummary> = {},
): ComparisonSummary {
  return {
    comparisonId: "check",
    status: "completed",
    overallResult: "pass",
    beforeSnapshotId: "baseline",
    afterSnapshotId: "after",
    timestamp: "2026-10-12T00:00:00.000Z",
    durationMs: 1,
    totalPagesCompared: 2,
    pagesWithDifferences: 0,
    pagesWithErrors: 0,
    newUrls: [],
    removedUrls: [],
    comparisonProcessErrors: [],
    summaryFilePath: "/tmp/summary.json",
    resultsPath: "/tmp/results.json",
    ...overrides,
  };
}

describe("check and baseline workflows", () => {
  let root: string;
  let repository: SnapshotRepository;
  const datasets: Dataset[] = [];

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "breakcheck-workflows-"));
    repository = await SnapshotRepository.createWithCustomDir(
      path.join(root, "snapshots"),
    );
  });

  afterEach(async () => {
    await Promise.all(datasets.splice(0).map((dataset) => dataset.drop()));
    await fs.rm(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function saveSnapshot(
    name: string,
    pages: Array<{ route: string; content: string; statusCode?: number }>,
  ): Promise<void> {
    const dataset = await Dataset.open(`workflow-${randomUUID()}`);
    datasets.push(dataset);
    for (const page of pages) {
      await dataset.pushData({
        url: new URL(page.route, BASE_URL).href,
        finalUrl: new URL(page.route, BASE_URL).href,
        content: page.content,
        statusCode: page.statusCode ?? 200,
        headers: {},
      });
    }
    await repository.saveSnapshot(name, {
      dataset,
      metadata: {
        baseUrl: BASE_URL,
        timestamp: "2026-10-12T00:00:00.000Z",
        crawlSettings: { baseUrl: BASE_URL, crawlerType: "cheerio" },
      },
    });
  }

  function operations(
    createSnapshot: SiteCheckOperations["createSnapshot"],
    runComparison: SiteCheckOperations["runComparison"] = async () =>
      comparison(),
  ): SiteCheckOperations {
    return { snapshotRepository: repository, createSnapshot, runComparison };
  }

  function successfulCapture(
    pages: Array<{ route: string; content: string; statusCode?: number }>,
  ): SiteCheckOperations["createSnapshot"] {
    return async (config) => {
      await saveSnapshot(config.name, pages);
      return {
        status: "success",
        snapshotId: config.name,
        timestamp: "2026-10-12T00:00:00.000Z",
        baseUrl: BASE_URL,
        pageCount: pages.length,
        errors: [],
        metadata: { crawlSettings: config.crawlSettings, durationMs: 1 },
      };
    };
  }

  it("passes when all exact routes are captured and unchanged", async () => {
    await saveSnapshot("baseline", [
      { route: "/", content: "home" },
      { route: "/about", content: "about" },
    ]);
    const createSnapshot = successfulCapture([
      { route: "/", content: "home" },
      { route: "/about", content: "about" },
    ]);
    const runComparison = vi.fn(async () => comparison());

    await expect(
      runSiteCheck(checkConfig(), operations(createSnapshot, runComparison)),
    ).resolves.toMatchObject({ status: "passed", routes: ["/", "/about"] });
    expect(runComparison).toHaveBeenCalledWith(
      expect.objectContaining({ urls: ["/", "/about"] }),
    );
  });

  it("reports content and route differences", async () => {
    await saveSnapshot("baseline", [
      { route: "/", content: "old" },
      { route: "/about", content: "about" },
    ]);
    const runComparison = async (config: ComparisonConfig) =>
      comparison({
        afterSnapshotId: config.afterSnapshotId,
        pagesWithDifferences: 1,
        overallResult: "fail",
        newUrls: ["/about"],
        removedUrls: ["/"],
      });

    await expect(
      runSiteCheck(
        checkConfig(),
        operations(
          successfulCapture([
            { route: "/", content: "new" },
            { route: "/about", content: "about" },
          ]),
          runComparison,
        ),
      ),
    ).resolves.toMatchObject({ status: "differences" });
  });

  it("returns a failed result when snapshot creation fails", async () => {
    await saveSnapshot("baseline", [{ route: "/", content: "home" }]);
    const createSnapshot: SiteCheckOperations["createSnapshot"] = async () => ({
      status: "failed",
      snapshotId: "failed",
      message: "crawl failed",
      errors: [
        { url: BASE_URL, message: "connection refused", statusCode: 503 },
      ],
    });
    const runComparison = vi.fn(async () => comparison());

    await expect(
      runSiteCheck(
        checkConfig({ routes: ["/"] }),
        operations(createSnapshot, runComparison),
      ),
    ).resolves.toMatchObject({
      status: "failed",
      errors: ["crawl failed"],
      crawlErrors: [
        { url: BASE_URL, message: "connection refused", statusCode: 503 },
      ],
    });
    expect(runComparison).not.toHaveBeenCalled();
  });

  it("rejects partial captures before comparison", async () => {
    await saveSnapshot("baseline", [
      { route: "/", content: "home" },
      { route: "/about", content: "about" },
    ]);
    const runComparison = vi.fn(async () => comparison());

    await expect(
      runSiteCheck(
        checkConfig(),
        operations(
          successfulCapture([{ route: "/", content: "home" }]),
          runComparison,
        ),
      ),
    ).resolves.toMatchObject({
      status: "failed",
      errors: [
        'The crawl did not capture route "/about".',
        "Expected 2 route(s), but captured 1.",
      ],
    });
    expect(runComparison).not.toHaveBeenCalled();
  });

  it("rejects invalid route filters and reports a missing baseline", async () => {
    const createSnapshot = vi.fn(successfulCapture([]));
    const ops = operations(createSnapshot);

    await expect(
      runSiteCheck(
        checkConfig({
          crawlSettings: {
            ...checkConfig().crawlSettings,
            includePatterns: ["/a"],
          },
        }),
        ops,
      ),
    ).rejects.toThrow(/cannot use crawl includePatterns/i);
    await expect(
      runSiteCheck(
        checkConfig({ routes: ["https://example.com/elsewhere"] }),
        ops,
      ),
    ).rejects.toThrow();
    await expect(runSiteCheck(checkConfig(), ops)).rejects.toThrow();
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it("turns comparison exceptions and comparison page errors into failed results", async () => {
    await saveSnapshot("baseline", [{ route: "/", content: "home" }]);
    const config = checkConfig({ routes: ["/"] });
    const createSnapshot = successfulCapture([{ route: "/", content: "home" }]);

    await expect(
      runSiteCheck(
        config,
        operations(createSnapshot, async () => {
          throw new Error("compare failed");
        }),
      ),
    ).resolves.toMatchObject({ status: "failed", errors: ["compare failed"] });
    await expect(
      runSiteCheck(
        config,
        operations(createSnapshot, async () =>
          comparison({ pagesWithErrors: 1 }),
        ),
      ),
    ).resolves.toMatchObject({
      status: "failed",
      errors: ["Comparison could not process 1 page(s)."],
    });
  });

  it("stops a check when cancellation arrives after its crawl", async () => {
    await saveSnapshot("baseline", [{ route: "/", content: "home" }]);
    const controller = new AbortController();
    const createSnapshot: SiteCheckOperations["createSnapshot"] = async (
      config,
    ) => {
      await saveSnapshot(config.name, [{ route: "/", content: "home" }]);
      controller.abort();
      return {
        status: "success",
        snapshotId: config.name,
        timestamp: "2026-10-12T00:00:00.000Z",
        baseUrl: BASE_URL,
        pageCount: 1,
        errors: [],
        metadata: { crawlSettings: config.crawlSettings, durationMs: 1 },
      };
    };

    await expect(
      runSiteCheck(
        checkConfig({ routes: ["/"] }),
        operations(createSnapshot),
        controller.signal,
      ),
    ).rejects.toThrow();
  });

  it("updates selected baseline routes and preserves the rest", async () => {
    await saveSnapshot("baseline", [
      { route: "/", content: "old home" },
      { route: "/about", content: "untouched" },
    ]);
    const config: SnapshotConfig = {
      baseUrl: BASE_URL,
      name: "ignored-name",
      urlPaths: ["/"],
      crawlSettings: { baseUrl: BASE_URL, crawlerType: "cheerio" },
    };
    const createSnapshot: SiteCheckOperations["createSnapshot"] =
      successfulCapture([{ route: "/", content: "new home" }]);
    const result = await updateSnapshotRoutes(
      config,
      "baseline",
      repository,
      createSnapshot,
    );

    expect(result).toMatchObject({ updatedRoutes: ["/"], pageCount: 1 });
    const updated = await repository.loadSnapshot("baseline");
    await expect(updated.getPage("/")).resolves.toMatchObject({
      content: "new home",
    });
    await expect(updated.getPage("/about")).resolves.toMatchObject({
      content: "untouched",
    });
    await expect(repository.listSnapshots()).resolves.toHaveLength(1);
  });

  it("preserves the baseline and removes staging after an invalid capture", async () => {
    await saveSnapshot("baseline", [{ route: "/", content: "original" }]);
    const config: SnapshotConfig = {
      baseUrl: BASE_URL,
      name: "ignored-name",
      urlPaths: ["/"],
      crawlSettings: { baseUrl: BASE_URL, crawlerType: "cheerio" },
    };

    await expect(
      updateSnapshotRoutes(
        config,
        "baseline",
        repository,
        successfulCapture([{ route: "/elsewhere", content: "wrong route" }]),
      ),
    ).rejects.toThrow(/did not capture route/);
    await expect(
      (await repository.loadSnapshot("baseline")).getPage("/"),
    ).resolves.toMatchObject({ content: "original" });
    await expect(repository.listSnapshots()).resolves.toHaveLength(1);
  });

  it("cleans up staging when cancellation arrives before baseline commit", async () => {
    await saveSnapshot("baseline", [{ route: "/", content: "original" }]);
    const controller = new AbortController();
    const config: SnapshotConfig = {
      baseUrl: BASE_URL,
      name: "ignored-name",
      urlPaths: ["/"],
      crawlSettings: { baseUrl: BASE_URL, crawlerType: "cheerio" },
    };
    const createSnapshot: SiteCheckOperations["createSnapshot"] = async (
      staged,
    ) => {
      await saveSnapshot(staged.name, [{ route: "/", content: "new" }]);
      controller.abort();
      return {
        status: "success",
        snapshotId: staged.name,
        timestamp: "2026-10-12T00:00:00.000Z",
        baseUrl: BASE_URL,
        pageCount: 1,
        errors: [],
        metadata: { crawlSettings: staged.crawlSettings, durationMs: 1 },
      };
    };

    await expect(
      updateSnapshotRoutes(
        config,
        "baseline",
        repository,
        createSnapshot,
        controller.signal,
      ),
    ).rejects.toThrow();
    await expect(
      (await repository.loadSnapshot("baseline")).getPage("/"),
    ).resolves.toMatchObject({ content: "original" });
    await expect(repository.listSnapshots()).resolves.toHaveLength(1);
  });

  it("requires an exact manifest without crawler filters", async () => {
    const createSnapshot = vi.fn(successfulCapture([]));
    const config: SnapshotConfig = {
      baseUrl: BASE_URL,
      name: "ignored-name",
      crawlSettings: { baseUrl: BASE_URL, crawlerType: "cheerio" },
    };

    await expect(
      updateSnapshotRoutes(config, "baseline", repository, createSnapshot),
    ).rejects.toThrow(/URL manifest is required/i);
    await expect(
      updateSnapshotRoutes(
        {
          ...config,
          urlPaths: ["/"],
          crawlSettings: { ...config.crawlSettings, excludePatterns: ["**"] },
        },
        "baseline",
        repository,
        createSnapshot,
      ),
    ).rejects.toThrow(/cannot use crawl includePatterns or excludePatterns/i);
    await expect(
      updateSnapshotRoutes(
        { ...config, urlPaths: ["relative"] },
        "baseline",
        repository,
        createSnapshot,
      ),
    ).rejects.toThrow(/root-relative/i);
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it("rejects failed snapshots and snapshots containing crawl errors", async () => {
    await saveSnapshot("baseline", [{ route: "/", content: "original" }]);
    const config: SnapshotConfig = {
      baseUrl: BASE_URL,
      name: "ignored-name",
      urlPaths: ["/"],
      crawlSettings: { baseUrl: BASE_URL, crawlerType: "cheerio" },
    };
    const failed: SiteCheckOperations["createSnapshot"] = async () => ({
      status: "failed",
      snapshotId: "failed",
      message: "crawl did not complete",
      errors: [],
    });
    await expect(
      updateSnapshotRoutes(config, "baseline", repository, failed),
    ).rejects.toThrow("crawl did not complete");

    const withErrors: SiteCheckOperations["createSnapshot"] = async (
      staged,
    ) => {
      await saveSnapshot(staged.name, [{ route: "/", content: "updated" }]);
      return {
        status: "success",
        snapshotId: staged.name,
        timestamp: "2026-10-12T00:00:00.000Z",
        baseUrl: BASE_URL,
        pageCount: 1,
        errors: [{ url: `${BASE_URL}/`, message: "retry failed" }],
        metadata: { crawlSettings: staged.crawlSettings, durationMs: 1 },
      };
    };
    await expect(
      updateSnapshotRoutes(config, "baseline", repository, withErrors),
    ).rejects.toThrow(/retry failed/);
    await expect(repository.listSnapshots()).resolves.toHaveLength(1);
  });

  it("cancels after staging validation and before replacing the baseline", async () => {
    await saveSnapshot("baseline", [{ route: "/", content: "original" }]);
    const controller = new AbortController();
    const config: SnapshotConfig = {
      baseUrl: BASE_URL,
      name: "ignored-name",
      urlPaths: ["/"],
      crawlSettings: { baseUrl: BASE_URL, crawlerType: "cheerio" },
    };
    const originalLoad = repository.loadSnapshot.bind(repository);
    vi.spyOn(repository, "loadSnapshot").mockImplementation(async (name) => {
      const loaded = await originalLoad(name);
      if (name !== "baseline") controller.abort();
      return loaded;
    });
    const replace = vi.spyOn(repository, "replaceSnapshotRoutes");

    await expect(
      updateSnapshotRoutes(
        config,
        "baseline",
        repository,
        successfulCapture([{ route: "/", content: "updated" }]),
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(replace).not.toHaveBeenCalled();
    await expect(
      (await originalLoad("baseline")).getPage("/"),
    ).resolves.toMatchObject({ content: "original" });
    await expect(repository.listSnapshots()).resolves.toHaveLength(1);
  });

  it("restores the baseline if the staged directory cannot be committed", async () => {
    await saveSnapshot("baseline", [{ route: "/", content: "original" }]);
    await saveSnapshot("staged", [{ route: "/", content: "updated" }]);
    let renameCount = 0;
    const faultingRepository = await SnapshotRepository.createWithCustomDir(
      path.join(root, "snapshots"),
      {
        rename: async (oldPath, newPath) => {
          renameCount += 1;
          if (renameCount === 2) throw new Error("commit rename failed");
          return fs.rename(oldPath, newPath);
        },
      },
    );
    await expect(
      faultingRepository.replaceSnapshotRoutes("baseline", "staged", ["/"]),
    ).rejects.toThrow("commit rename failed");

    await expect(
      (await repository.loadSnapshot("baseline")).getPage("/"),
    ).resolves.toMatchObject({ content: "original" });
    await expect(repository.listSnapshots()).resolves.toHaveLength(2);
    await expect(fs.readdir(path.join(root, "snapshots"))).resolves.toEqual([
      "baseline",
      "staged",
    ]);
  });
});
