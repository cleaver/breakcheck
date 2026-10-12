import { Dataset } from "crawlee";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runSiteCheck,
  updateSnapshotRoutesFromConfig,
} from "../../api/index.js";
import { BreakcheckCrawler } from "../../core/crawler/index.js";
import { SnapshotRepository } from "../../core/snapshot/index.js";

describe("site-check and baseline-update APIs", () => {
  it("rejects a check name that would overwrite its baseline", async () => {
    const storageDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "breakcheck-check-collision-"),
    );
    const datasetName = `check-collision-${Date.now()}`;
    const dataset = await Dataset.open(datasetName);
    const repository = await SnapshotRepository.createWithCustomDir(
      path.join(storageDir, "snapshots"),
    );
    const crawl = vi
      .spyOn(BreakcheckCrawler.prototype, "crawl")
      .mockResolvedValue({ datasetName, errors: [] });

    try {
      await dataset.pushData({
        url: "http://example.com/",
        finalUrl: "http://example.com/",
        content: "<p>baseline</p>",
        statusCode: 200,
        headers: {},
      });
      await repository.saveSnapshot("baseline", {
        dataset,
        metadata: {
          baseUrl: "http://example.com",
          timestamp: "2026-10-12T00:00:00.000Z",
          crawlSettings: {
            baseUrl: "http://example.com",
            crawlerType: "cheerio",
          },
        },
      });
      const baseline = await repository.loadSnapshot("baseline");
      const beforePage = await baseline.getPage("/");
      const baselineDir = path.join(storageDir, "snapshots", "baseline");
      const baselineFiles = [
        "metadata.json",
        "index.json",
        path.join("pages", `${Buffer.from("/").toString("base64url")}.json.gz`),
      ];
      const beforeFiles = await Promise.all(
        baselineFiles.map((file) => fs.readFile(path.join(baselineDir, file))),
      );

      await expect(
        runSiteCheck(
          {
            baseUrl: "http://example.com",
            name: "baseline",
            baselineSnapshotId: "baseline",
            routes: ["/"],
            crawlSettings: {
              baseUrl: "http://example.com",
              crawlerType: "cheerio",
            },
          },
          { storageDir },
        ),
      ).rejects.toThrow(/must differ|cannot match/i);

      expect(crawl).not.toHaveBeenCalled();
      await expect(baseline.getPage("/")).resolves.toEqual(beforePage);
      const afterFiles = await Promise.all(
        baselineFiles.map((file) => fs.readFile(path.join(baselineDir, file))),
      );
      expect(afterFiles).toEqual(beforeFiles);
    } finally {
      crawl.mockRestore();
      await dataset.drop();
      await fs.rm(storageDir, { recursive: true, force: true });
    }
  });

  it("does not commit a baseline update cancelled during its crawl", async () => {
    const storageDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "breakcheck-check-cancel-"),
    );
    const baselineDataset = await Dataset.open(
      `check-cancel-baseline-${Date.now()}`,
    );
    const stagedDatasetName = `check-cancel-staged-${Date.now()}`;
    const stagedDataset = await Dataset.open(stagedDatasetName);
    const repository = await SnapshotRepository.createWithCustomDir(
      path.join(storageDir, "snapshots"),
    );
    const cancellation = new AbortController();
    const crawl = vi
      .spyOn(BreakcheckCrawler.prototype, "crawl")
      .mockImplementation(async () => {
        cancellation.abort();
        return {
          datasetName: stagedDatasetName,
          errors: [],
        };
      });

    try {
      await baselineDataset.pushData({
        url: "http://example.com/",
        finalUrl: "http://example.com/",
        content: "<p>baseline</p>",
        statusCode: 200,
        headers: {},
      });
      await repository.saveSnapshot("baseline", {
        dataset: baselineDataset,
        metadata: {
          baseUrl: "http://example.com",
          timestamp: "2026-10-12T00:00:00.000Z",
          crawlSettings: {
            baseUrl: "http://example.com",
            crawlerType: "cheerio",
          },
        },
      });
      await stagedDataset.pushData({
        url: "http://example.com/",
        finalUrl: "http://example.com/",
        content: "<p>updated</p>",
        statusCode: 200,
        headers: {},
      });

      await expect(
        updateSnapshotRoutesFromConfig(
          {
            baseUrl: "http://example.com",
            name: "temporary-name",
            urlPaths: ["/"],
            crawlSettings: {
              baseUrl: "http://example.com",
              crawlerType: "cheerio",
            },
          },
          "baseline",
          { storageDir, signal: cancellation.signal },
        ),
      ).rejects.toThrow();

      expect(crawl).toHaveBeenCalledOnce();
      await expect(
        (await repository.loadSnapshot("baseline")).getPage("/"),
      ).resolves.toMatchObject({ content: "<p>baseline</p>" });
    } finally {
      crawl.mockRestore();
      await Promise.all([baselineDataset.drop(), stagedDataset.drop()]);
      await fs.rm(storageDir, { recursive: true, force: true });
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
